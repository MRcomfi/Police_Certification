/**
 * Распознавание чисел (цифрами и словами) и проверка числовых ответов.
 *
 * Числовой ответ засчитывается, если:
 *  - в нём есть правильное число (или фраза-замена, например «лейтенант»);
 *  - нет других чисел (номера статей с точками — «10.2.1», «5.4» — числами не считаются);
 *  - сразу после числа не стоит противоречащая единица измерения («45 секунд»);
 *  - перед числом нет отрицания («не 45»).
 */

import { UNIT_WORDS } from '../data/questions';
import { compilePhrase, containsAnyPhrase, isNegated, matchesWord, type WordPattern } from './phrases';
import type { Token } from './text';
import type { NumberCheck, UnitKind } from './types';

type NumberWordKind = 'unit' | 'teen' | 'ten' | 'hundred' | 'zero';

interface NumberWord {
  value: number;
  kind: NumberWordKind;
}

const NUMBER_WORDS = new Map<string, NumberWord>();

function addForms(forms: readonly string[], value: number, kind: NumberWordKind): void {
  for (const form of forms) NUMBER_WORDS.set(form, { value, kind });
}

function addStem(stem: string, suffixes: readonly string[], value: number, kind: NumberWordKind): void {
  addForms(suffixes.map((suffix) => stem + suffix), value, kind);
}

/** Окончания порядковых числительных: «пятый», «пятого», «пятую»… */
const ORDINAL = ['ый', 'ой', 'ая', 'ое', 'ые', 'ого', 'ому', 'ым', 'ом', 'ую', 'ых', 'ыми'];
/** Окончания количественных числительных на «-ь»: «пятнадцать», «пятнадцати», «пятнадцатью». */
const CARDINAL_SOFT = ['ь', 'и', 'ью'];

addForms(['ноль', 'нуль', 'ноля', 'нуля', 'нолю', 'нулю', 'нолем', 'нулем'], 0, 'zero');

addForms(
  ['один', 'одна', 'одно', 'одни', 'одного', 'одной', 'одному', 'одним', 'одними', 'одних', 'одну', 'одном', 'одною', 'единица', 'единицу', 'единицы'],
  1,
  'unit',
);
addStem('перв', ORDINAL, 1, 'unit');

addForms(['два', 'две', 'двух', 'двум', 'двумя', 'двое', 'двоих', 'двоим', 'дважды', 'двойка', 'двойку'], 2, 'unit');
addStem('втор', ORDINAL, 2, 'unit');

addForms(
  ['три', 'трех', 'трем', 'тремя', 'трое', 'троих', 'троим', 'трижды', 'тройка', 'тройку',
    'третий', 'третья', 'третье', 'третьи', 'третьего', 'третьему', 'третьим', 'третьем', 'третью', 'третьей', 'третьих'],
  3,
  'unit',
);

addForms(['четыре', 'четырех', 'четырем', 'четырьмя', 'четверо', 'четверых', 'четырежды', 'четверка', 'четверку'], 4, 'unit');
addStem('четверт', ORDINAL, 4, 'unit');

addForms(['пять', 'пяти', 'пятью', 'пятеро', 'пятерых', 'пятерка', 'пятерку'], 5, 'unit');
addStem('пят', ORDINAL, 5, 'unit');
addForms(['шесть', 'шести', 'шестью', 'шестеро'], 6, 'unit');
addStem('шест', ORDINAL, 6, 'unit');
addForms(['семь', 'семи', 'семью'], 7, 'unit');
addStem('седьм', ORDINAL, 7, 'unit');
addForms(['восемь', 'восьми', 'восемью', 'восьмью'], 8, 'unit');
addStem('восьм', ORDINAL, 8, 'unit');
addForms(['девять', 'девяти', 'девятью'], 9, 'unit');
addStem('девят', ORDINAL, 9, 'unit');

const TEENS: readonly (readonly [string, number])[] = [
  ['десят', 10], ['одиннадцат', 11], ['двенадцат', 12], ['тринадцат', 13], ['четырнадцат', 14],
  ['пятнадцат', 15], ['шестнадцат', 16], ['семнадцат', 17], ['восемнадцат', 18], ['девятнадцат', 19],
];
for (const [stem, value] of TEENS) {
  addStem(stem, CARDINAL_SOFT, value, 'teen');
  addStem(stem, ORDINAL, value, 'teen');
}

addStem('двадцат', [...CARDINAL_SOFT, ...ORDINAL], 20, 'ten');
addStem('тридцат', [...CARDINAL_SOFT, ...ORDINAL], 30, 'ten');
addForms(['сорок', 'сорока'], 40, 'ten');
addStem('сороков', ORDINAL, 40, 'ten');
addForms(['пятьдесят', 'пятидесяти', 'пятьюдесятью'], 50, 'ten');
addStem('пятидесят', ORDINAL, 50, 'ten');
addForms(['шестьдесят', 'шестидесяти', 'шестьюдесятью'], 60, 'ten');
addStem('шестидесят', ORDINAL, 60, 'ten');
addForms(['семьдесят', 'семидесяти', 'семьюдесятью'], 70, 'ten');
addStem('семидесят', ORDINAL, 70, 'ten');
addForms(['восемьдесят', 'восьмидесяти', 'восемьюдесятью', 'восьмьюдесятью'], 80, 'ten');
addStem('восьмидесят', ORDINAL, 80, 'ten');
addForms(['девяносто', 'девяноста'], 90, 'ten');
addStem('девяност', ORDINAL, 90, 'ten');
addForms(['сто', 'ста'], 100, 'hundred');
addStem('сот', ORDINAL, 100, 'hundred');

export interface NumberOccurrence {
  value: number;
  /** Индекс первого слова числа. */
  start: number;
  /** Индекс последнего слова числа («сорок пять» — два слова). */
  end: number;
}

function isDigits(text: string): boolean {
  return /^\d+$/.test(text);
}

function canFollow(previous: NumberWordKind, next: NumberWordKind): boolean {
  if (previous === 'hundred') return next === 'ten' || next === 'teen' || next === 'unit';
  if (previous === 'ten') return next === 'unit';
  return false;
}

/** Находит все числа в ответе: «45», «сорок пять», «третьего», «дважды». */
export function extractNumbers(tokens: readonly Token[]): NumberOccurrence[] {
  const result: NumberOccurrence[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined) break;

    if (isDigits(token.text)) {
      result.push({ value: Number(token.text), start: index, end: index });
      index++;
      continue;
    }

    const word = NUMBER_WORDS.get(token.text);
    if (word === undefined) {
      index++;
      continue;
    }

    let value = word.value;
    let lastKind = word.kind;
    let end = index;
    for (;;) {
      const nextToken = tokens[end + 1];
      const next = nextToken === undefined ? undefined : NUMBER_WORDS.get(nextToken.text);
      if (nextToken === undefined || next === undefined || nextToken.segment !== token.segment) break;
      if (!canFollow(lastKind, next.kind)) break;
      value += next.value;
      lastKind = next.kind;
      end++;
    }

    result.push({ value, start: index, end });
    index = end + 1;
  }

  return result;
}

function isNumberToken(token: Token): boolean {
  return isDigits(token.text) || NUMBER_WORDS.has(token.text);
}

const UNIT_PATTERNS: readonly (readonly [UnitKind, readonly WordPattern[]])[] = (
  Object.entries(UNIT_WORDS) as [UnitKind, readonly string[]][]
).map(([kind, words]) => [kind, words.flatMap((word) => compilePhrase(word))]);

export function unitKindOf(token: Token): UnitKind | null {
  for (const [kind, patterns] of UNIT_PATTERNS) {
    if (patterns.some((pattern) => matchesWord(token, pattern))) return kind;
  }
  return null;
}

/** Сколько слов после числа просматривается в поисках единицы («45 полных минут»). */
const UNIT_WINDOW = 2;

/** Единица измерения, стоящая сразу после числа. */
export function findAttachedUnit(tokens: readonly Token[], numberEnd: number): UnitKind | null {
  for (let index = numberEnd + 1; index <= numberEnd + UNIT_WINDOW; index++) {
    const token = tokens[index];
    if (token === undefined || isNumberToken(token)) return null;
    const kind = unitKindOf(token);
    if (kind !== null) return kind;
  }
  return null;
}

/**
 * Проверяет числовой ответ. fields — слова каждого поля ответа
 * (у одиночного вопроса одно поле, у составного — все заполненные поля).
 */
export function checkNumber(fields: readonly (readonly Token[])[], check: NumberCheck): boolean {
  if (check.rejectPhrases && fields.some((tokens) => containsAnyPhrase(tokens, check.rejectPhrases ?? []))) {
    return false;
  }

  let found = false;
  for (const tokens of fields) {
    for (const occurrence of extractNumbers(tokens)) {
      const option = check.options.find((candidate) => candidate.value === occurrence.value);
      if (option === undefined) return false;
      if (isNegated(tokens, occurrence.start)) return false;

      const unit = findAttachedUnit(tokens, occurrence.end);
      if (unit !== null && !option.units.includes(unit)) return false;
      if (unit === null && option.unitRequired === true) return false;
      found = true;
    }
  }

  if (found) return true;
  const aliases = check.aliases ?? [];
  return fields.some((tokens) => containsAnyPhrase(tokens, aliases));
}
