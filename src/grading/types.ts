/**
 * Типы данных аттестации и результатов оценки.
 */

/** Единицы измерения, которые распознаёт проверка числовых ответов. */
export type UnitKind =
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years'
  | 'grams'
  | 'kilograms'
  | 'milligrams'
  | 'pieces'
  | 'stars'
  | 'levels'
  | 'hits'
  | 'times'
  | 'ranks';

/** Один из допустимых правильных числовых ответов. */
export interface NumberOption {
  /** Правильное число. */
  value: number;
  /**
   * Единицы, допустимые для этого числа. Если сразу после числа стоит другая
   * известная единица (например, «45 секунд» вместо минут), ответ не засчитывается.
   */
  units: readonly UnitKind[];
  /** Единица обязательна: без неё число неоднозначно (например, «72» без «часа»). */
  unitRequired?: boolean;
}

/** Проверка числового ответа. */
export interface NumberCheck {
  type: 'number';
  options: readonly NumberOption[];
  /** Фразы, которые засчитываются вместо числа (например, название ранга). */
  aliases?: readonly string[];
  /** Фразы, при наличии которых ответ не засчитывается. */
  rejectPhrases?: readonly string[];
}

/** Проверка утвердительного ответа («да»). */
export interface YesCheck {
  type: 'yes';
  /** Фразы, означающие «да». */
  yesPhrases: readonly string[];
  /** Фразы-отрицания: если встречается любая из них, ответ не засчитывается. */
  negativePhrases: readonly string[];
}

export type SingleCheck = NumberCheck | YesCheck;

/** Пункт засчитывается, если найдена любая из фраз. */
export interface PhrasesMatch {
  type: 'phrases';
  phrases: readonly string[];
}

/**
 * Пункт засчитывается, только если найдена хотя бы одна фраза из каждой группы
 * (например, названы все три фракции). Группы могут быть в разных полях.
 */
export interface AllGroupsMatch {
  type: 'allOf';
  groups: readonly (readonly string[])[];
}

export type ItemMatch = PhrasesMatch | AllGroupsMatch | NumberCheck;

/** Обязательный пункт составного вопроса. */
export interface CompositeItem {
  /** Формулировка пункта для показа правильного ответа. */
  label: string;
  match: ItemMatch;
}

interface QuestionBase {
  id: number;
  text: string;
}

/** Вопрос с одним полем ответа. */
export interface SingleQuestion extends QuestionBase {
  kind: 'single';
  /** Подсказка под полем. Не должна раскрывать ответ. */
  hint: string;
  /** Правильный ответ для показа после успешной сдачи. */
  answer: string;
  check: SingleCheck;
}

/** Вопрос с несколькими обязательными пунктами: одно поле на каждый пункт. */
export interface CompositeQuestion extends QuestionBase {
  kind: 'composite';
  items: readonly CompositeItem[];
}

export type Question = SingleQuestion | CompositeQuestion;

export type QuestionStatus = 'correct' | 'partial' | 'incorrect' | 'empty';

export type Points = 0 | 0.5 | 1;

/** Результат оценки одного вопроса (без текста ответа). */
export interface QuestionResult {
  questionId: number;
  points: Points;
  status: QuestionStatus;
  /** Только для составных вопросов: число засчитанных пунктов. */
  matched?: number;
  /** Только для составных вопросов: число обязательных пунктов. */
  total?: number;
}

/** Итог оценки всей попытки. */
export interface AttemptGrade {
  results: QuestionResult[];
  /** Сумма баллов (может содержать половины). */
  score: number;
  /** Число вопросов, получивших полный балл. */
  fullCount: number;
  passed: boolean;
}
