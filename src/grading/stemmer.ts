/**
 * Упрощённый стеммер русского языка (алгоритм Snowball / Портера).
 *
 * Отбрасывает окончания, чтобы разные формы слова сравнивались как одно слово:
 * «судья», «судьи», «судей» → «суд»; «главы», «глав», «главам» → «глав».
 * Ключевые слова и ответы проходят через одну и ту же функцию, поэтому
 * важна не лингвистическая точность, а одинаковый результат для форм одного слова.
 */

const VOWELS = 'аеиоуыэюя';

function isVowel(char: string): boolean {
  return char !== '' && VOWELS.includes(char);
}

interface Ending {
  suffix: string;
  /** Окончание отбрасывается, только если перед ним стоит «а» или «я». */
  afterAYa: boolean;
}

function endings(afterAYa: readonly string[], plain: readonly string[]): readonly Ending[] {
  return [
    ...afterAYa.map((suffix) => ({ suffix, afterAYa: true })),
    ...plain.map((suffix) => ({ suffix, afterAYa: false })),
  ];
}

const PERFECTIVE_GERUND = endings(['в', 'вши', 'вшись'], ['ив', 'ивши', 'ившись', 'ыв', 'ывши', 'ывшись']);

const REFLEXIVE = endings([], ['ся', 'сь']);

const ADJECTIVE = endings(
  [],
  [
    'ее', 'ие', 'ые', 'ое', 'ими', 'ыми', 'ей', 'ий', 'ый', 'ой', 'ем', 'им', 'ым', 'ом',
    'его', 'ого', 'ему', 'ому', 'их', 'ых', 'ую', 'юю', 'ая', 'яя', 'ою', 'ею',
  ],
);

const PARTICIPLE = endings(['ем', 'нн', 'вш', 'ющ', 'щ'], ['ивш', 'ывш', 'ующ']);

const VERB = endings(
  ['ла', 'на', 'ете', 'йте', 'ли', 'й', 'л', 'ем', 'н', 'ло', 'но', 'ет', 'ют', 'ны', 'ть', 'ешь', 'нно'],
  [
    'ила', 'ыла', 'ена', 'ейте', 'уйте', 'ите', 'или', 'ыли', 'ей', 'уй', 'ил', 'ыл', 'им', 'ым',
    'ен', 'ило', 'ыло', 'ено', 'ят', 'ует', 'уют', 'ит', 'ыт', 'ены', 'ить', 'ыть', 'ишь', 'ую', 'ю',
  ],
);

const NOUN = endings(
  [],
  [
    'а', 'ев', 'ов', 'ие', 'ье', 'е', 'иями', 'ями', 'ами', 'еи', 'ии', 'и', 'ией', 'ей', 'ой', 'ий',
    'й', 'иям', 'ям', 'ием', 'ем', 'ам', 'ом', 'о', 'у', 'ах', 'иях', 'ях', 'ы', 'ь', 'ию', 'ью', 'ю',
    'ия', 'ья', 'я',
  ],
);

/**
 * Отбрасывает самое длинное подходящее окончание из списка, если оно целиком
 * лежит в области RV. Возвращает null, если окончание не найдено или не выполнено условие.
 */
function removeEnding(word: string, rv: number, list: readonly Ending[]): string | null {
  let best: Ending | null = null;
  for (const ending of list) {
    if (word.length - ending.suffix.length < rv || !word.endsWith(ending.suffix)) continue;
    if (best === null || ending.suffix.length > best.suffix.length) best = ending;
  }
  if (best === null) return null;

  const start = word.length - best.suffix.length;
  if (best.afterAYa) {
    const previous = word.charAt(start - 1);
    if (start - 1 < rv || (previous !== 'а' && previous !== 'я')) return null;
  }
  return word.slice(0, start);
}

/** Начало области после первого сочетания «гласная + согласная», начиная с позиции from. */
function regionAfterVowelConsonant(word: string, from: number): number {
  for (let i = from + 1; i < word.length; i++) {
    if (isVowel(word.charAt(i - 1)) && !isVowel(word.charAt(i))) return i + 1;
  }
  return word.length;
}

function removeIfInRegion(word: string, suffix: string, region: number): string | null {
  return word.endsWith(suffix) && word.length - suffix.length >= region ? word.slice(0, -suffix.length) : null;
}

/** Возвращает основу слова. Слово должно быть в нижнем регистре, «ё» заменена на «е». */
export function stemRussian(input: string): string {
  if (!/[а-я]/.test(input)) return input;

  let rv = input.length;
  for (let i = 0; i < input.length; i++) {
    if (isVowel(input.charAt(i))) {
      rv = i + 1;
      break;
    }
  }
  const r1 = regionAfterVowelConsonant(input, 0);
  const r2 = regionAfterVowelConsonant(input, r1);

  let word = input;

  // Шаг 1: деепричастия, либо возвратные + прилагательные/причастия/глаголы/существительные.
  const gerund = removeEnding(word, rv, PERFECTIVE_GERUND);
  if (gerund !== null) {
    word = gerund;
  } else {
    word = removeEnding(word, rv, REFLEXIVE) ?? word;
    const adjective = removeEnding(word, rv, ADJECTIVE);
    if (adjective !== null) {
      word = removeEnding(adjective, rv, PARTICIPLE) ?? adjective;
    } else {
      word = removeEnding(word, rv, VERB) ?? removeEnding(word, rv, NOUN) ?? word;
    }
  }

  // Шаг 2: конечная «и».
  word = removeIfInRegion(word, 'и', rv) ?? word;

  // Шаг 3: словообразовательные окончания в области R2.
  word = removeIfInRegion(word, 'ость', r2) ?? removeIfInRegion(word, 'ост', r2) ?? word;

  // Шаг 4: превосходная степень, двойная «н», мягкий знак.
  const superlative = removeIfInRegion(word, 'ейше', rv) ?? removeIfInRegion(word, 'ейш', rv);
  if (superlative !== null) {
    word = superlative;
    if (removeIfInRegion(word, 'нн', rv) !== null) word = word.slice(0, -1);
  } else if (removeIfInRegion(word, 'нн', rv) !== null) {
    word = word.slice(0, -1);
  } else {
    word = removeIfInRegion(word, 'ь', rv) ?? word;
  }

  return word;
}
