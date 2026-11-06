import { useEffect, useRef, type KeyboardEvent } from 'react';
import { MAX_ANSWER_LENGTH } from '../grading/grade';
import type { Question } from '../grading/types';
import { plural } from '../utils/format';

interface QuestionViewProps {
  question: Question;
  number: number;
  answer: readonly string[];
  onChange: (fieldIndex: number, value: string) => void;
}

/** Enter в поле ответа ничего не отправляет и не завершает тест. */
function preventEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.preventDefault();
}

/** Текст вопроса и поля ответа. Перемонтируется при смене вопроса (key) и ставит фокус в первое поле. */
export function QuestionView({ question, number, answer, onChange }: QuestionViewProps) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const baseId = `question-${question.id}`;
  const textId = `${baseId}-text`;

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  return (
    <div className="question">
      <h2 id={textId} className="question__text">
        <span className="question__number">{number}</span> {question.text}
      </h2>

      {question.kind === 'single' ? (
        <div className="field">
          <label className="field__label" htmlFor={`${baseId}-answer`}>
            Ваш ответ
          </label>
          <input
            ref={firstInputRef}
            id={`${baseId}-answer`}
            className="input"
            type="text"
            value={answer[0] ?? ''}
            maxLength={MAX_ANSWER_LENGTH}
            autoComplete="off"
            aria-describedby={`${textId} ${baseId}-hint`}
            onChange={(event) => onChange(0, event.target.value)}
            onKeyDown={preventEnter}
          />
          <p id={`${baseId}-hint`} className="field__hint">
            {question.hint}
          </p>
        </div>
      ) : (
        <fieldset className="composite">
          <legend id={`${baseId}-instruction`} className="composite__legend">
            Укажите {question.items.length} {plural(question.items.length, ['пункт', 'пункта', 'пунктов'])} в
            любом порядке, по одному в каждом поле
          </legend>
          <div className="composite__grid">
            {question.items.map((_, index) => {
              const inputId = `${baseId}-item-${index + 1}`;
              return (
                <div className="field" key={inputId}>
                  <label className="field__label" htmlFor={inputId}>
                    Пункт {index + 1}
                  </label>
                  <input
                    ref={index === 0 ? firstInputRef : undefined}
                    id={inputId}
                    className="input"
                    type="text"
                    value={answer[index] ?? ''}
                    maxLength={MAX_ANSWER_LENGTH}
                    autoComplete="off"
                    aria-describedby={index === 0 ? `${textId} ${baseId}-instruction` : undefined}
                    onChange={(event) => onChange(index, event.target.value)}
                    onKeyDown={preventEnter}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
