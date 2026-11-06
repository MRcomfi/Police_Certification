import { isBlank } from '../grading/text';
import type { Question, QuestionResult } from '../grading/types';
import type { Answers } from '../utils/answers';
import { StatusBadge } from './StatusBadge';

function UserAnswer({ question, fields }: { question: Question; fields: readonly string[] }) {
  const filled = fields.filter((field) => !isBlank(field)).map((field) => field.trim());
  if (filled.length === 0) return <p className="review__empty">Не заполнено</p>;
  if (question.kind === 'single') return <p className="review__text">{filled[0]}</p>;
  return (
    <ul className="review__fields">
      {filled.map((field, index) => (
        <li key={index}>{field}</li>
      ))}
    </ul>
  );
}

function CorrectAnswer({ question }: { question: Question }) {
  if (question.kind === 'single') return <p className="review__text">{question.answer}</p>;
  return (
    <ul className="review__fields">
      {question.items.map((item) => (
        <li key={item.label}>{item.label}</li>
      ))}
    </ul>
  );
}

interface ReviewListProps {
  questions: readonly Question[];
  results: readonly QuestionResult[];
  answers: Answers;
  /** Показывать правильные ответы (только после успешной сдачи). */
  showCorrect: boolean;
}

/** Разбор по вопросам: ответ сотрудника, статус и (после сдачи) правильный ответ. */
export function ReviewList({ questions, results, answers, showCorrect }: ReviewListProps) {
  return (
    <ol className="review">
      {questions.map((question, index) => {
        const result = results[index];
        if (result === undefined) return null;
        return (
          <li key={question.id} className={`review__item review__item--${result.status}`}>
            <div className="review__head">
              <h3 className="review__question">
                <span className="review__number">{index + 1}</span> {question.text}
              </h3>
              <div className="review__status">
                <StatusBadge status={result.status} />
                {result.total !== undefined && (
                  <span className="review__count">
                    Засчитано {result.matched ?? 0} из {result.total}
                  </span>
                )}
              </div>
            </div>
            <div className="review__block">
              <p className="review__label">Ваш ответ</p>
              <UserAnswer question={question} fields={answers[index] ?? []} />
            </div>
            {showCorrect && (
              <div className="review__block review__block--correct">
                <p className="review__label">Правильный ответ</p>
                <CorrectAnswer question={question} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
