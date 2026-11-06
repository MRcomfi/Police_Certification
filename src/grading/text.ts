/**
 * Нормализация и разбиение ответа на слова.
 *
 * - регистр не учитывается, «ё» = «е»;
 * - знаки препинания, точки в сокращениях («мин.», «гос.»), дефисы и лишние пробелы игнорируются;
 * - номера статей с точками («10.2.1», «9,5») сохраняются как одно слово;
 * - число, слитное с буквами («45мин», «12г»), делится на число и слово;
 * - запятые, скобки, тире и союзы («и», «или») делят ответ на части (сегменты).
 *   Ключевая фраза ищется только внутри одной части: так «заместители и главы»
 *   не превращается в фразу «заместители глав».
 */

import { stemRussian } from './stemmer';

export interface Token {
  /** Нормализованное слово. */
  text: string;
  /** Основа слова для сравнения форм (для чисел и номеров статей совпадает с text). */
  stem: string;
  /** Номер части ответа. */
  segment: number;
}

const SEGMENT_SEPARATORS = /[,;:!?()[\]{}<>«»"„“”/\\|+&—–\r\n]+/u;

/** Союзы, которые разделяют перечисление на части и сами не учитываются. */
const SEGMENT_WORDS: ReadonlySet<string> = new Set(['и', 'или', 'либо', 'а', 'также', 'плюс']);

/** Номер статьи (цифры через точку), слово из букв или число. */
const TOKEN_PATTERN = /\d+(?:\.\d+)+|[a-zа-я]+|\d+/gu;

/** Нижний регистр, «ё» → «е», запятая между цифрами → точка («9,5» → «9.5»). */
export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/(\d)[.,](?=\d)/g, '$1.');
}

export function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];
  let segment = 0;

  for (const part of normalizeText(raw).split(SEGMENT_SEPARATORS)) {
    for (const match of part.matchAll(TOKEN_PATTERN)) {
      const word = match[0];
      if (SEGMENT_WORDS.has(word)) {
        segment++;
        continue;
      }
      tokens.push({ text: word, stem: /\d/.test(word) ? word : stemRussian(word), segment });
    }
    segment++;
  }

  return tokens;
}

export function isBlank(value: string): boolean {
  return value.trim() === '';
}
