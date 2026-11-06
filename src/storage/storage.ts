/**
 * Хранение данных аттестации в браузере сотрудника.
 *
 * localStorage:   ник; итог успешной сдачи (без текстов ответов); итог последней неуспешной
 *                 попытки вместе с текстами ответов сотрудника (чтобы их можно было посмотреть
 *                 на главной) и срок блокировки. Правильные ответы никогда не сохраняются.
 * sessionStorage: ответы незавершённой попытки (чтобы обновление вкладки их не стирало);
 *                 удаляются сразу после завершения попытки.
 * Тексты неуспешной попытки удаляются при следующей попытке, успешной сдаче или сбросе.
 * Ничего не отправляется на серверы.
 *
 * ВНИМАНИЕ: это клиентская защита. Блокировку пересдачи можно обойти очисткой данных
 * браузера, режимом инкогнито или другим браузером, а сохранённые данные — изменить вручную.
 * Для игровой аттестации это допустимо. Повреждённые или подозрительные данные
 * игнорируются, а срок блокировки не может превышать RETAKE_LOCK_MINUTES от текущего момента.
 */

import { QUESTIONS } from '../data/questions';
import { compositePoints, fieldCount, MAX_ANSWER_LENGTH, PASS_THRESHOLD } from '../grading/grade';
import type { Points, Question, QuestionResult, QuestionStatus } from '../grading/types';
import { alignAnswers, answersMatch } from '../utils/answers';
import { normalizeNickname, validateNickname } from '../utils/nickname';

/** Блокировка пересдачи после неуспешной попытки, минут. */
export const RETAKE_LOCK_MINUTES = 45;
export const RETAKE_LOCK_MS = RETAKE_LOCK_MINUTES * 60 * 1000;

const PREFIX = 'pd-attestation:v1:';

const KEYS = {
  nickname: `${PREFIX}nickname`,
  passed: `${PREFIX}passed`,
  lastAttempt: `${PREFIX}last-attempt`,
  draft: `${PREFIX}draft`,
} as const;

/** Итоговая сводка попытки (без текстов ответов). */
export interface AttemptSummary {
  nickname: string;
  /** Момент завершения, мс с 1970-01-01. */
  finishedAt: number;
  score: number;
  fullCount: number;
  passed: boolean;
  results: QuestionResult[];
}

/** Последняя неуспешная попытка и срок блокировки пересдачи. */
export interface LastAttemptRecord {
  summary: AttemptSummary;
  lockedUntil: number;
  /** Тексты ответов сотрудника (без правильных ответов). null — тексты недоступны. */
  answers: string[][] | null;
}

/** Незавершённая попытка. */
export interface DraftAttempt {
  nickname: string;
  /** Номера (id) вопросов, к которым относятся ответы, в том же порядке, что и answers. */
  questionIds: number[];
  answers: string[][];
  currentIndex: number;
}

/**
 * Приводит попытку к текущему списку вопросов. Ответы привязаны к id вопроса, а не к позиции:
 * если вопрос добавили, удалили или переставили, ответы остаются у своих вопросов,
 * у новых вопросов поля пустые, а число полей всегда совпадает с вопросом.
 */
export function alignDraft(draft: DraftAttempt, questions: readonly Question[]): DraftAttempt {
  if (answersMatch(draft.questionIds, draft.answers, questions)) return draft;
  return {
    ...draft,
    questionIds: questions.map((question) => question.id),
    answers: alignAnswers(draft.questionIds, draft.answers, questions),
    currentIndex: Math.min(Math.max(draft.currentIndex, 0), Math.max(questions.length - 1, 0)),
  };
}

// ---------- Проверка данных ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isValidNickname(value: unknown): value is string {
  return typeof value === 'string' && value === normalizeNickname(value) && validateNickname(value) === null;
}

function isPoints(value: unknown): value is Points {
  return value === 0 || value === 0.5 || value === 1;
}

const STATUSES: readonly QuestionStatus[] = ['correct', 'partial', 'incorrect', 'empty'];

function isStatus(value: unknown): value is QuestionStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

function statusMatchesPoints(status: QuestionStatus, points: Points): boolean {
  if (points === 1) return status === 'correct';
  if (points === 0.5) return status === 'partial';
  return status === 'incorrect' || status === 'empty';
}

function parseQuestionResult(value: unknown, question: Question): QuestionResult | null {
  if (!isRecord(value)) return null;
  const { questionId, points, status, matched, total } = value;
  if (questionId !== question.id || !isPoints(points) || !isStatus(status)) return null;
  if (!statusMatchesPoints(status, points)) return null;

  if (question.kind === 'single') {
    if (matched !== undefined || total !== undefined) return null;
    return { questionId, points, status };
  }

  const itemCount = question.items.length;
  if (total !== itemCount || typeof matched !== 'number' || !Number.isInteger(matched)) return null;
  if (matched < 0 || matched > itemCount || compositePoints(matched, itemCount) !== points) return null;
  if (status === 'empty' && matched !== 0) return null;
  return { questionId, points, status, matched, total };
}

/** Проверяет сводку попытки, включая согласованность суммы, числа полных ответов и статуса. */
export function parseSummary(value: unknown): AttemptSummary | null {
  if (!isRecord(value)) return null;
  const { nickname, finishedAt, score, fullCount, passed, results } = value;
  if (!isValidNickname(nickname)) return null;
  if (typeof finishedAt !== 'number' || !Number.isFinite(finishedAt) || finishedAt <= 0) return null;
  if (typeof passed !== 'boolean') return null;
  if (!Array.isArray(results) || results.length !== QUESTIONS.length) return null;

  const parsed: QuestionResult[] = [];
  for (const [index, question] of QUESTIONS.entries()) {
    const result = parseQuestionResult(results[index], question);
    if (result === null) return null;
    parsed.push(result);
  }

  const expectedScore = parsed.reduce((sum, result) => sum + result.points, 0);
  const expectedFull = parsed.filter((result) => result.points === 1).length;
  if (score !== expectedScore || fullCount !== expectedFull || passed !== expectedFull >= PASS_THRESHOLD) {
    return null;
  }

  return { nickname, finishedAt, score: expectedScore, fullCount: expectedFull, passed, results: parsed };
}

/** Сводка успешной сдачи или null, если данных нет или они некорректны. */
export function parsePassedRecord(raw: string | null): AttemptSummary | null {
  const summary = parseSummary(parseJson(raw));
  return summary !== null && summary.passed ? summary : null;
}

/**
 * Последняя неуспешная попытка. Если срок блокировки дальше, чем через RETAKE_LOCK_MINUTES
 * от текущего момента (данные изменены вручную или сбились часы), он ограничивается.
 * Сводка проверяется по id вопросов, поэтому сохранённые ответы относятся к тем же вопросам.
 */
export function parseLastAttemptRecord(
  raw: string | null,
  now: number,
): { record: LastAttemptRecord; clamped: boolean } | null {
  const value = parseJson(raw);
  if (!isRecord(value)) return null;
  const summary = parseSummary(value.summary);
  const { lockedUntil } = value;
  if (summary === null || summary.passed) return null;
  if (typeof lockedUntil !== 'number' || !Number.isFinite(lockedUntil)) return null;

  const maxLockedUntil = now + RETAKE_LOCK_MS;
  const clamped = lockedUntil > maxLockedUntil;
  // Повреждённые тексты ответов не отменяют блокировку: показывается только сводка.
  const answers = parseAnswers(value.answers, QUESTIONS);
  return { record: { summary, lockedUntil: clamped ? maxLockedUntil : lockedUntil, answers }, clamped };
}

/** Ответы: по массиву строк на вопрос, число полей совпадает с вопросом. */
export function parseAnswers(value: unknown, questions: readonly Question[]): string[][] | null {
  if (!Array.isArray(value) || value.length !== questions.length) return null;

  const parsed: string[][] = [];
  for (const [index, question] of questions.entries()) {
    const fields: unknown = value[index];
    if (!Array.isArray(fields) || fields.length !== fieldCount(question)) return null;
    const strings: string[] = [];
    for (const field of fields as unknown[]) {
      if (typeof field !== 'string' || field.length > MAX_ANSWER_LENGTH) return null;
      strings.push(field);
    }
    parsed.push(strings);
  }
  return parsed;
}

/**
 * Незавершённая попытка. Ответы сопоставляются с вопросами по id (см. alignDraft),
 * поэтому изменение списка вопросов не сдвигает ответы.
 */
export function parseDraft(raw: string | null, questions: readonly Question[]): DraftAttempt | null {
  const value = parseJson(raw);
  if (!isRecord(value)) return null;
  const { nickname, currentIndex, questionIds, answers } = value;
  if (!isValidNickname(nickname)) return null;
  if (typeof currentIndex !== 'number' || !Number.isInteger(currentIndex) || currentIndex < 0) return null;
  // Попытка без id вопросов (старая версия сайта) не восстанавливается: её ответы не к чему привязать.
  if (!Array.isArray(questionIds) || !questionIds.every((id) => Number.isInteger(id))) return null;
  if (!Array.isArray(answers) || answers.length !== questionIds.length) return null;

  const parsedAnswers: string[][] = [];
  for (const fields of answers as unknown[]) {
    if (!Array.isArray(fields)) return null;
    const strings: string[] = [];
    for (const field of fields as unknown[]) {
      if (typeof field !== 'string' || field.length > MAX_ANSWER_LENGTH) return null;
      strings.push(field);
    }
    parsedAnswers.push(strings);
  }

  return alignDraft(
    { nickname, questionIds: questionIds as number[], answers: parsedAnswers, currentIndex },
    questions,
  );
}

export function isLockActive(record: LastAttemptRecord | null, now: number): boolean {
  return record !== null && record.lockedUntil > now;
}

// ---------- Доступ к хранилищу ----------

type StorageKind = 'local' | 'session';

function getStorage(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read(kind: StorageKind, key: string): string | null {
  try {
    return getStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(kind: StorageKind, key: string, value: unknown): void {
  try {
    getStorage(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // Хранилище недоступно или переполнено — сайт продолжает работать без сохранения.
  }
}

function remove(kind: StorageKind, key: string): void {
  try {
    getStorage(kind)?.removeItem(key);
  } catch {
    // Нечего удалять.
  }
}

export function loadNickname(): string {
  const value = parseJson(read('local', KEYS.nickname));
  return isValidNickname(value) ? value : '';
}

export function saveNickname(nickname: string): void {
  write('local', KEYS.nickname, nickname);
}

export function loadPassed(): AttemptSummary | null {
  const raw = read('local', KEYS.passed);
  const summary = parsePassedRecord(raw);
  if (summary === null && raw !== null) remove('local', KEYS.passed);
  return summary;
}

/** Сохраняет успешную сдачу. Уже сохранённый результат не перезаписывается. */
export function savePassed(summary: AttemptSummary): void {
  if (loadPassed() !== null) return;
  write('local', KEYS.passed, summary);
}

export function loadLastAttempt(now: number): LastAttemptRecord | null {
  const raw = read('local', KEYS.lastAttempt);
  const parsed = parseLastAttemptRecord(raw, now);
  if (parsed === null) {
    if (raw !== null) remove('local', KEYS.lastAttempt);
    return null;
  }
  // Ограниченный срок сохраняется, чтобы он не продлевался при каждом открытии сайта.
  if (parsed.clamped) write('local', KEYS.lastAttempt, parsed.record);
  return parsed.record;
}

export function saveLastAttempt(record: LastAttemptRecord): void {
  write('local', KEYS.lastAttempt, record);
}

export function clearLastAttempt(): void {
  remove('local', KEYS.lastAttempt);
}

export function loadDraft(questions: readonly Question[]): DraftAttempt | null {
  const raw = read('session', KEYS.draft);
  const draft = parseDraft(raw, questions);
  if (draft === null && raw !== null) remove('session', KEYS.draft);
  return draft;
}

export function saveDraft(draft: DraftAttempt): void {
  write('session', KEYS.draft, draft);
}

export function clearDraft(): void {
  remove('session', KEYS.draft);
}

/** Удаляет все данные сайта в этом браузере: результат, ответы, ник, незавершённую попытку и таймер. */
export function clearAllData(): void {
  for (const kind of ['local', 'session'] as const) {
    const storage = getStorage(kind);
    if (storage === null) continue;
    try {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key !== null && key.startsWith(PREFIX)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    } catch {
      // Хранилище недоступно.
    }
  }
}
