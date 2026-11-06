import { useState } from 'react';
import type { Question } from '../grading/types';
import {
  countAnswered,
  findIncomplete,
  hasAnyAnswer,
  type Answers,
  type IncompleteQuestions,
} from '../utils/answers';
import { ConfirmDialog } from './ConfirmDialog';
import { QuestionView } from './QuestionView';

interface QuizScreenProps {
  questions: readonly Question[];
  answers: Answers;
  currentIndex: number;
  nickname: string;
  onAnswerChange: (questionIndex: number, fieldIndex: number, value: string) => void;
  onNavigate: (index: number) => void;
  onFinish: () => void;
}

export function QuizScreen({
  questions,
  answers,
  currentIndex,
  nickname,
  onAnswerChange,
  onNavigate,
  onFinish,
}: QuizScreenProps) {
  const [incomplete, setIncomplete] = useState<IncompleteQuestions | null>(null);

  const total = questions.length;
  const question = questions[currentIndex];
  const answered = countAnswered(answers);
  if (question === undefined) return null;

  const requestFinish = () => {
    const found = findIncomplete(questions, answers);
    if (found.unanswered.length === 0 && found.partiallyFilled.length === 0) {
      onFinish();
    } else {
      setIncomplete(found);
    }
  };

  const returnToAnswers = () => {
    const first = Math.min(...(incomplete?.unanswered ?? []), ...(incomplete?.partiallyFilled ?? []));
    setIncomplete(null);
    if (Number.isFinite(first)) onNavigate(first - 1);
  };

  const finishAnyway = () => {
    setIncomplete(null);
    onFinish();
  };

  return (
    <section className="card card--action quiz" aria-label="Прохождение аттестации">
      <div className="quiz__header">
        <p className="quiz__counter">
          Вопрос {currentIndex + 1} из {total}
        </p>
        <p className="quiz__nickname">
          Сотрудник: <span>{nickname}</span>
        </p>
      </div>

      <div className="progress">
        <div className="progress__label" id="progress-label">
          Заполнено ответов: {answered} из {total}
        </div>
        {/* Один блок на вопрос: заполненные — синие, текущий — с рамкой. */}
        <div
          className="blocks"
          role="progressbar"
          aria-labelledby="progress-label"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
        >
          {answers.map((fields, index) => (
            <span
              key={index}
              className={[
                'blocks__cell',
                hasAnyAnswer(fields) ? 'blocks__cell--filled' : '',
                index === currentIndex ? 'blocks__cell--current' : '',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      <QuestionView
        key={question.id}
        question={question}
        number={currentIndex + 1}
        answer={answers[currentIndex] ?? []}
        onChange={(fieldIndex, value) => onAnswerChange(currentIndex, fieldIndex, value)}
      />

      <div className="quiz__nav">
        <button
          type="button"
          className="button"
          disabled={currentIndex === 0}
          onClick={() => onNavigate(currentIndex - 1)}
        >
          Назад
        </button>
        <button
          type="button"
          className="button"
          disabled={currentIndex === total - 1}
          onClick={() => onNavigate(currentIndex + 1)}
        >
          Далее
        </button>
        <button type="button" className="button button--primary quiz__finish" onClick={requestFinish}>
          Завершить
        </button>
      </div>

      <ConfirmDialog
        open={incomplete !== null}
        title="Завершить аттестацию?"
        cancelLabel="Вернуться к ответам"
        confirmLabel="Завершить всё равно"
        onCancel={returnToAnswers}
        onConfirm={finishAnyway}
      >
        {incomplete !== null && incomplete.unanswered.length > 0 && (
          <p>
            Вопросы без ответа: <strong>{incomplete.unanswered.join(', ')}</strong>.
          </p>
        )}
        {incomplete !== null && incomplete.partiallyFilled.length > 0 && (
          <p>
            Заполнены не все поля в вопросах: <strong>{incomplete.partiallyFilled.join(', ')}</strong>.
          </p>
        )}
        <p>Пустые поля не засчитываются. После завершения изменить ответы будет нельзя.</p>
      </ConfirmDialog>
    </section>
  );
}
