/**
 * Оценка ответов аттестации. Чистые функции без зависимости от React и браузера.
 *
 * ВАЖНО: автоматическая проверка свободного текста реализует только игровые правила
 * этого сайта. Она учитывает формы слов, синонимы, сокращения, числа словами и отрицания,
 * но не может гарантированно правильно оценить любую формулировку. При необходимости
 * её можно заменить ручной проверкой ответов руководством.
 */

import { checkNumber } from './numbers';
import { compilePhrase, containsAnyPhrase, findPhraseMatches } from './phrases';
import { isBlank, tokenize, type Token } from './text';
import type {
  AttemptGrade,
  CompositeQuestion,
  ItemMatch,
  Points,
  Question,
  QuestionResult,
  QuestionStatus,
  SingleCheck,
} from './types';

/** Сколько полностью правильных ответов нужно для сдачи. */
export const PASS_THRESHOLD = 10;

/** Максимальная длина одного поля ответа. */
export const MAX_ANSWER_LENGTH = 300;

/** Минимум пунктов для частичного зачёта: половина с округлением вверх. */
export function partialThreshold(total: number): number {
  return Math.ceil(total / 2);
}

/** Балл составного вопроса по числу уникальных засчитанных пунктов. */
export function compositePoints(matched: number, total: number): Points {
  if (total > 0 && matched >= total) return 1;
  if (matched > 0 && matched >= partialThreshold(total)) return 0.5;
  return 0;
}

function statusFromPoints(points: Points): QuestionStatus {
  if (points === 1) return 'correct';
  if (points === 0.5) return 'partial';
  return 'incorrect';
}

/** Число полей ответа у вопроса. */
export function fieldCount(question: Question): number {
  return question.kind === 'single' ? 1 : question.items.length;
}

function checkSingle(check: SingleCheck, tokens: readonly Token[]): boolean {
  switch (check.type) {
    case 'number':
      return checkNumber([tokens], check);
    case 'yes':
      if (containsAnyPhrase(tokens, check.negativePhrases, false)) return false;
      return containsAnyPhrase(tokens, check.yesPhrases);
  }
}

function phraseGroups(match: ItemMatch): readonly (readonly string[])[] {
  switch (match.type) {
    case 'phrases':
      return [match.phrases];
    case 'allOf':
      return match.groups;
    case 'number':
      return [];
  }
}

interface Candidate {
  item: number;
  group: number;
  field: number;
  indices: readonly number[];
}

/**
 * Считает уникальные засчитанные пункты составного вопроса.
 *
 * Порядок полей не важен: каждый пункт ищется во всех заполненных полях,
 * повтор пункта засчитывается один раз, одно поле может содержать несколько пунктов.
 *
 * Если ключевая фраза одного пункта входит в более длинную фразу другого пункта,
 * слова засчитываются только за более длинное (точное) совпадение:
 * «заместители глав госфракций» — пункт «заместители», но не «главы».
 */
export function countMatchedItems(question: CompositeQuestion, fields: readonly (readonly Token[])[]): number {
  const candidates: Candidate[] = [];

  question.items.forEach((item, itemIndex) => {
    phraseGroups(item.match).forEach((phrases, groupIndex) => {
      for (const phrase of phrases) {
        const compiled = compilePhrase(phrase);
        fields.forEach((tokens, fieldIndex) => {
          for (const indices of findPhraseMatches(tokens, compiled)) {
            candidates.push({ item: itemIndex, group: groupIndex, field: fieldIndex, indices });
          }
        });
      }
    });
  });

  // Более длинные совпадения точнее, поэтому занимают слова первыми (сортировка устойчива).
  candidates.sort((a, b) => b.indices.length - a.indices.length);

  const owners = new Map<string, number>();
  const foundGroups = new Set<string>();
  for (const candidate of candidates) {
    const keys = candidate.indices.map((index) => `${candidate.field}:${index}`);
    const takenByOther = keys.some((key) => {
      const owner = owners.get(key);
      return owner !== undefined && owner !== candidate.item;
    });
    if (takenByOther) continue;
    for (const key of keys) owners.set(key, candidate.item);
    foundGroups.add(`${candidate.item}:${candidate.group}`);
  }

  return question.items.filter((item, itemIndex) => {
    if (item.match.type === 'number') return checkNumber(fields, item.match);
    return phraseGroups(item.match).every((_, groupIndex) => foundGroups.has(`${itemIndex}:${groupIndex}`));
  }).length;
}

/** Оценивает один вопрос. answer — значения полей ответа (у одиночного вопроса одно). */
export function gradeQuestion(question: Question, answer: readonly string[]): QuestionResult {
  const values = answer.map((value) => value.slice(0, MAX_ANSWER_LENGTH));

  if (question.kind === 'single') {
    const value = values[0] ?? '';
    if (isBlank(value)) return { questionId: question.id, points: 0, status: 'empty' };
    const points: Points = checkSingle(question.check, tokenize(value)) ? 1 : 0;
    return { questionId: question.id, points, status: statusFromPoints(points) };
  }

  const total = question.items.length;
  // Пустые поля не засчитываются и не влияют на оценку.
  const filled = values.slice(0, total).filter((value) => !isBlank(value));
  if (filled.length === 0) {
    return { questionId: question.id, points: 0, status: 'empty', matched: 0, total };
  }

  const matched = countMatchedItems(question, filled.map(tokenize));
  const points = compositePoints(matched, total);
  return { questionId: question.id, points, status: statusFromPoints(points), matched, total };
}

/** Оценивает всю попытку. Каждый вопрос оценивается ровно один раз. */
export function gradeAttempt(
  questions: readonly Question[],
  answers: readonly (readonly string[])[],
): AttemptGrade {
  const results = questions.map((question, index) => gradeQuestion(question, answers[index] ?? []));
  const score = results.reduce((sum, result) => sum + result.points, 0);
  const fullCount = results.filter((result) => result.points === 1).length;
  return { results, score, fullCount, passed: fullCount >= PASS_THRESHOLD };
}
