/**
 * Поиск ключевых фраз в ответе.
 *
 * Синтаксис фраз (используется в src/data/questions.ts):
 *   слово   — совпадение с учётом форм слова: «судья» найдёт «судьи», «судей»;
 *   слово*  — любое слово, начинающееся с этих букв: «спец*» найдёт «спецсредства», «специальные»;
 *   =слово  — только точное совпадение слова;
 *   9.5     — номер статьи (сравнивается точно).
 * Слова фразы должны идти в указанном порядке внутри одной части ответа;
 * между ними допускается до MAX_GAP посторонних слов («опасность для жизни»).
 */

import { stemRussian } from './stemmer';
import { normalizeText, type Token } from './text';

export interface WordPattern {
  kind: 'stem' | 'prefix' | 'exact';
  value: string;
}

export type CompiledPhrase = readonly WordPattern[];

/** Сколько посторонних слов допускается между словами фразы. */
export const MAX_GAP = 2;

/** Частицы, которые отрицают следующее за ними слово («не обязан», «не отказался»). */
const NEGATION_PARTICLES: ReadonlySet<string> = new Set(['не', 'ни']);

const cache = new Map<string, CompiledPhrase>();

function compileWord(raw: string): WordPattern {
  const word = normalizeText(raw);
  if (word.startsWith('=')) return { kind: 'exact', value: word.slice(1) };
  if (word.endsWith('*')) return { kind: 'prefix', value: word.slice(0, -1) };
  if (/\d/.test(word)) return { kind: 'exact', value: word };
  return { kind: 'stem', value: stemRussian(word) };
}

export function compilePhrase(phrase: string): CompiledPhrase {
  const cached = cache.get(phrase);
  if (cached) return cached;
  const compiled = phrase.trim().split(/\s+/).filter(Boolean).map(compileWord);
  cache.set(phrase, compiled);
  return compiled;
}

export function matchesWord(token: Token, pattern: WordPattern): boolean {
  switch (pattern.kind) {
    case 'exact':
      return token.text === pattern.value;
    case 'prefix':
      return token.text.startsWith(pattern.value);
    case 'stem':
      return token.stem === pattern.value;
  }
}

/** Стоит ли перед словом с индексом index частица «не»/«ни» в той же части ответа. */
export function isNegated(tokens: readonly Token[], index: number): boolean {
  const previous = tokens[index - 1];
  const current = tokens[index];
  return (
    previous !== undefined &&
    current !== undefined &&
    previous.segment === current.segment &&
    NEGATION_PARTICLES.has(previous.text)
  );
}

function findNextWord(tokens: readonly Token[], after: number, segment: number, pattern: WordPattern): number {
  for (let index = after + 1; index <= after + 1 + MAX_GAP; index++) {
    const token = tokens[index];
    if (token === undefined || token.segment !== segment) return -1;
    if (matchesWord(token, pattern)) return index;
  }
  return -1;
}

/**
 * Все вхождения фразы. Каждое вхождение — индексы совпавших слов.
 * Вхождения с отрицанием перед первым словом пропускаются, если skipNegated = true.
 */
export function findPhraseMatches(
  tokens: readonly Token[],
  phrase: CompiledPhrase,
  skipNegated = true,
): number[][] {
  const [first, ...rest] = phrase;
  if (first === undefined) return [];

  const matches: number[][] = [];
  tokens.forEach((token, start) => {
    if (!matchesWord(token, first)) return;
    if (skipNegated && isNegated(tokens, start)) return;

    const indices = [start];
    let last = start;
    for (const pattern of rest) {
      const next = findNextWord(tokens, last, token.segment, pattern);
      if (next === -1) return;
      indices.push(next);
      last = next;
    }
    matches.push(indices);
  });
  return matches;
}

export function containsAnyPhrase(
  tokens: readonly Token[],
  phrases: readonly string[],
  skipNegated = true,
): boolean {
  return phrases.some((phrase) => findPhraseMatches(tokens, compilePhrase(phrase), skipNegated).length > 0);
}
