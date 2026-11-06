import { useEffect, useRef } from 'react';
import type { Question } from '../grading/types';
import { useRemaining } from '../hooks/useRemaining';
import type { AttemptSummary } from '../storage/storage';
import type { Answers } from '../utils/answers';
import { RetakeCountdown } from './RetakeCountdown';
import { ReviewList } from './ReviewList';
import { SummaryDetails } from './SummaryDetails';

export interface FinishedAttempt {
  summary: AttemptSummary;
  /** Тексты ответов сотрудника. */
  answers: Answers;
  /** Срок блокировки пересдачи (только для неуспешной попытки). */
  lockedUntil: number | null;
}

interface ResultScreenProps {
  questions: readonly Question[];
  attempt: FinishedAttempt;
  onHome: () => void;
}

export function ResultScreen({ questions, attempt, onHome }: ResultScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { summary, answers, lockedUntil } = attempt;
  const remaining = useRemaining(summary.passed ? null : lockedUntil);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="stack">
      <section className="card card--result" aria-labelledby="result-title">
        <SummaryDetails
          summary={summary}
          totalQuestions={questions.length}
          title="Результат аттестации"
          titleId="result-title"
          titleRef={headingRef}
          animateStamp
        />
        {!summary.passed && lockedUntil !== null && <RetakeCountdown until={lockedUntil} remaining={remaining} />}
      </section>

      <section className="card" aria-labelledby="review-title">
        <h2 id="review-title" className="card__title">
          {summary.passed ? 'Разбор по вопросам' : 'Ваши ответы'}
        </h2>
        <p className="note">
          {summary.passed
            ? 'Ваши ответы и правильные ответы. Тексты ответов не сохраняются: после перехода на главную или обновления страницы останется только итоговая сводка.'
            : 'Правильные ответы не показываются, чтобы пересдача была честной. Ваши ответы сохранены в этом браузере: их можно посмотреть на главной до следующей попытки.'}
        </p>
        <ReviewList questions={questions} results={summary.results} answers={answers} showCorrect={summary.passed} />
      </section>

      <div className="actions">
        <button type="button" className="button" onClick={onHome}>
          На главную
        </button>
      </div>
    </div>
  );
}
