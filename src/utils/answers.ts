import { fieldCount } from '../grading/grade';
import { isBlank } from '../grading/text';
import type { Question } from '../grading/types';

export type Answers = readonly (readonly string[])[];

/** Пустые ответы: по одной строке на каждое поле каждого вопроса. */
export function createEmptyAnswers(questions: readonly Question[]): string[][] {
  return questions.map((question) => Array.from({ length: fieldCount(question) }, () => ''));
}

/** Новый массив ответов с изменённым полем. */
export function withAnswer(answers: Answers, questionIndex: number, fieldIndex: number, value: string): string[][] {
  return answers.map((fields, qIndex) => {
    if (qIndex !== questionIndex) return [...fields];
    const updated = [...fields];
    while (updated.length <= fieldIndex) updated.push('');
    updated[fieldIndex] = value;
    return updated;
  });
}

/** Ответы стоят ровно напротив текущих вопросов и у каждого вопроса нужное число полей. */
export function answersMatch(questionIds: readonly number[], answers: Answers, questions: readonly Question[]): boolean {
  return (
    questionIds.length === questions.length &&
    answers.length === questions.length &&
    questions.every((question, index) => questionIds[index] === question.id && answers[index]?.length === fieldCount(question))
  );
}

/**
 * Переставляет ответы под текущий список вопросов по id вопроса.
 * Ответы удалённых вопросов отбрасываются, у новых вопросов (или при изменении числа полей) — пустые поля.
 */
export function alignAnswers(questionIds: readonly number[], answers: Answers, questions: readonly Question[]): string[][] {
  return questions.map((question) => {
    const count = fieldCount(question);
    const index = questionIds.indexOf(question.id);
    const fields = index === -1 ? undefined : answers[index];
    return fields !== undefined && fields.length === count
      ? [...fields]
      : Array.from({ length: count }, () => '');
  });
}

/** Есть ли у вопроса хотя бы одно заполненное поле. */
export function hasAnyAnswer(fields: readonly string[] | undefined): boolean {
  return (fields ?? []).some((field) => !isBlank(field));
}

export function countAnswered(answers: Answers): number {
  return answers.filter(hasAnyAnswer).length;
}

export interface IncompleteQuestions {
  /** Номера вопросов без ответа. */
  unanswered: number[];
  /** Номера составных вопросов, где заполнены не все поля. */
  partiallyFilled: number[];
}

export function findIncomplete(questions: readonly Question[], answers: Answers): IncompleteQuestions {
  const unanswered: number[] = [];
  const partiallyFilled: number[] = [];
  questions.forEach((question, index) => {
    const fields = answers[index] ?? [];
    if (!hasAnyAnswer(fields)) unanswered.push(index + 1);
    else if (question.kind === 'composite' && fields.some(isBlank)) partiallyFilled.push(index + 1);
  });
  return { unanswered, partiallyFilled };
}
