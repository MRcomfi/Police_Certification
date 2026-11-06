import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../data/questions';
import { gradeAttempt } from '../grading/grade';
import { createEmptyAnswers } from '../utils/answers';
import {
  alignDraft,
  isLockActive,
  parseDraft,
  parseLastAttemptRecord,
  parsePassedRecord,
  RETAKE_LOCK_MS,
  type AttemptSummary,
} from './storage';

const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

function failedSummary(): AttemptSummary {
  const grade = gradeAttempt(QUESTIONS, createEmptyAnswers(QUESTIONS));
  return { nickname: 'Steve_Police', finishedAt: NOW, ...grade };
}

describe('сохранённая блокировка пересдачи', () => {
  it('корректная запись читается без изменений', () => {
    const record = { summary: failedSummary(), lockedUntil: NOW + RETAKE_LOCK_MS };
    const parsed = parseLastAttemptRecord(JSON.stringify(record), NOW + 1000);
    expect(parsed?.clamped).toBe(false);
    expect(parsed?.record.lockedUntil).toBe(NOW + RETAKE_LOCK_MS);
    expect(isLockActive(parsed?.record ?? null, NOW + 1000)).toBe(true);
    expect(isLockActive(parsed?.record ?? null, NOW + RETAKE_LOCK_MS)).toBe(false);
  });

  it('блокировка длится 45 минут', () => {
    expect(RETAKE_LOCK_MS).toBe(45 * 60 * 1000);
  });

  it('срок дальше 45 минут от текущего момента ограничивается', () => {
    const record = { summary: failedSummary(), lockedUntil: NOW + 10 * RETAKE_LOCK_MS };
    const parsed = parseLastAttemptRecord(JSON.stringify(record), NOW);
    expect(parsed?.clamped).toBe(true);
    expect(parsed?.record.lockedUntil).toBe(NOW + RETAKE_LOCK_MS);
  });

  it.each([
    ['не JSON', '{oops'],
    ['не объект', '42'],
    ['срок не число', JSON.stringify({ summary: failedSummary(), lockedUntil: 'завтра' })],
    ['нет сводки', JSON.stringify({ lockedUntil: NOW })],
    ['сумма не совпадает с ответами', JSON.stringify({ summary: { ...failedSummary(), score: 14 }, lockedUntil: NOW })],
    ['сдана, но лежит как неуспешная', JSON.stringify({ summary: { ...failedSummary(), passed: true }, lockedUntil: NOW })],
  ])('повреждённые данные игнорируются: %s', (_, raw) => {
    expect(parseLastAttemptRecord(raw, NOW)).toBeNull();
  });
});

describe('ответы неуспешной попытки', () => {
  it('сохраняются вместе со сводкой', () => {
    const answers = createEmptyAnswers(QUESTIONS);
    answers[0] = ['45 секунд'];
    const record = { summary: failedSummary(), lockedUntil: NOW + 1000, answers };
    expect(parseLastAttemptRecord(JSON.stringify(record), NOW)?.record.answers).toEqual(answers);
  });

  it('повреждённые ответы не отменяют блокировку', () => {
    const record = { summary: failedSummary(), lockedUntil: NOW + 1000, answers: [['слишком мало вопросов']] };
    const parsed = parseLastAttemptRecord(JSON.stringify(record), NOW);
    expect(parsed?.record.answers).toBeNull();
    expect(isLockActive(parsed?.record ?? null, NOW)).toBe(true);
  });

  it('запись без ответов (старая версия сайта) читается', () => {
    const record = { summary: failedSummary(), lockedUntil: NOW + 1000 };
    expect(parseLastAttemptRecord(JSON.stringify(record), NOW)?.record.answers).toBeNull();
  });
});

describe('сохранённая успешная сдача', () => {
  it('неуспешная сводка не принимается за успешную', () => {
    expect(parsePassedRecord(JSON.stringify(failedSummary()))).toBeNull();
  });

  it('подделанный статус «сдана» при 0 полных ответов игнорируется', () => {
    expect(parsePassedRecord(JSON.stringify({ ...failedSummary(), passed: true }))).toBeNull();
  });
});

describe('незавершённая попытка', () => {
  const ids = QUESTIONS.map((q) => q.id);

  it('корректная попытка восстанавливается', () => {
    const draft = { nickname: 'Steve', questionIds: ids, answers: createEmptyAnswers(QUESTIONS), currentIndex: 3 };
    expect(parseDraft(JSON.stringify(draft), QUESTIONS)).toEqual(draft);
  });

  it('попытка старой версии без номеров вопросов не восстанавливается', () => {
    const draft = { nickname: 'Steve', answers: createEmptyAnswers(QUESTIONS), currentIndex: 0 };
    expect(parseDraft(JSON.stringify(draft), QUESTIONS)).toBeNull();
  });

  it('вопрос добавлен во время попытки: ответы не сдвигаются', () => {
    // Попытка начата, когда вопроса 2 не было.
    const withoutQ2 = QUESTIONS.filter((q) => q.id !== 2);
    const answers = createEmptyAnswers(withoutQ2);
    answers[1] = ['12 грамм']; // вопрос с id 3
    answers[13] = ['рейд', '9.5 и 11.1', 'угроза жизни']; // вопрос с id 15
    const raw = JSON.stringify({ nickname: 'Steve', questionIds: withoutQ2.map((q) => q.id), answers, currentIndex: 13 });

    const draft = parseDraft(raw, QUESTIONS);
    expect(draft?.questionIds).toEqual(ids);
    expect(draft?.answers[1]).toEqual(['', '']); // новый вопрос 2 — пустые поля
    expect(draft?.answers[2]).toEqual(['12 грамм']); // ответ остался у вопроса 3
    expect(draft?.answers[14]).toEqual(['рейд', '9.5 и 11.1', 'угроза жизни']);
  });

  it('вопрос удалён во время попытки: ответы не сдвигаются', () => {
    const answers = createEmptyAnswers(QUESTIONS);
    answers[1] = ['губернатор', 'мэрия, ФБР, ЦПД']; // вопрос 2
    answers[2] = ['12 грамм']; // вопрос 3
    const draft = alignDraft(
      { nickname: 'Steve', questionIds: ids, answers, currentIndex: 14 },
      QUESTIONS.filter((q) => q.id !== 2),
    );
    expect(draft.answers[1]).toEqual(['12 грамм']);
    expect(draft.answers).toHaveLength(14);
    expect(draft.currentIndex).toBe(13);
  });

  it('у вопроса изменилось число полей: только его поля очищаются', () => {
    const answers = createEmptyAnswers(QUESTIONS);
    answers[0] = ['45 минут'];
    answers[5] = ['адвокаты']; // у вопроса 6 должно быть 4 поля
    const draft = parseDraft(JSON.stringify({ nickname: 'Steve', questionIds: ids, answers, currentIndex: 0 }), QUESTIONS);
    expect(draft?.answers[0]).toEqual(['45 минут']);
    expect(draft?.answers[5]).toEqual(['', '', '', '']);
  });
});
