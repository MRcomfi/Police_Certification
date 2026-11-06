import { useState, type FormEvent } from 'react';
import { PASS_THRESHOLD } from '../grading/grade';
import type { Question } from '../grading/types';
import { useRemaining } from '../hooks/useRemaining';
import { RETAKE_LOCK_MINUTES, type AttemptSummary, type LastAttemptRecord } from '../storage/storage';
import { plural } from '../utils/format';
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, normalizeNickname, validateNickname } from '../utils/nickname';
import { ConfirmDialog } from './ConfirmDialog';
import { RetakeCountdown } from './RetakeCountdown';
import { ReviewList } from './ReviewList';
import { StatusList } from './StatusList';
import { SummaryDetails } from './SummaryDetails';

interface StartScreenProps {
  questions: readonly Question[];
  nickname: string;
  passed: AttemptSummary | null;
  lastAttempt: LastAttemptRecord | null;
  notice: string | null;
  onNicknameChange: (value: string) => void;
  onStart: () => void;
  onReset: () => void;
}

export function StartScreen({
  questions,
  nickname,
  passed,
  lastAttempt,
  notice,
  onNicknameChange,
  onStart,
  onReset,
}: StartScreenProps) {
  const [touched, setTouched] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const totalQuestions = questions.length;

  const remaining = useRemaining(passed === null && lastAttempt !== null ? lastAttempt.lockedUntil : null);
  const locked = remaining > 0;

  const nicknameError = validateNickname(normalizeNickname(nickname));
  const canStart = passed === null && !locked && nicknameError === null;
  const showNicknameError = touched && nicknameError !== null && passed === null;

  let startHint = 'Ответы можно менять до завершения попытки.';
  if (passed !== null) startHint = 'Аттестация уже сдана, повторная попытка не требуется.';
  else if (locked) startHint = 'Кнопка станет активной после окончания блокировки.';
  else if (nicknameError !== null) startHint = 'Чтобы начать, введите игровой ник.';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (canStart) onStart();
  };

  return (
    <div className="stack">
      {notice !== null && (
        <div className="alert" role="alert">
          {notice}
        </div>
      )}

      <section className="card" aria-labelledby="rules-title">
        <h2 id="rules-title" className="card__title">
          Правила аттестации
        </h2>
        <ul className="rules">
          <li>Аттестация состоит из {totalQuestions} вопросов, ответы даются в свободной форме.</li>
          <li>
            В некоторых вопросах нужно перечислить несколько пунктов — по одному в каждом поле, в любом
            порядке.
          </li>
          <li>
            Составные вопросы оцениваются частично: все пункты — 1 балл, не менее половины — 0,5 балла, меньше —
            0 баллов.
          </li>
          <li>
            Для сдачи нужно не менее {PASS_THRESHOLD} полностью правильных ответов (1 балл из 1). Частичные
            ответы увеличивают сумму баллов, но в порог не входят.
          </li>
          <li>
            При неудаче пересдача станет доступна через {RETAKE_LOCK_MINUTES}{' '}
            {plural(RETAKE_LOCK_MINUTES, ['минуту', 'минуты', 'минут'])}.
          </li>
        </ul>
      </section>

      {passed !== null && (
        <section className="card card--result" aria-labelledby="passed-title">
          <SummaryDetails summary={passed} totalQuestions={totalQuestions} title="Ваш результат" titleId="passed-title" />
          <h3 className="card__subtitle">Статус по вопросам</h3>
          <StatusList results={passed.results} />
        </section>
      )}

      {passed === null && lastAttempt !== null && (
        <section className="card card--result" aria-labelledby="last-title">
          <SummaryDetails
            summary={lastAttempt.summary}
            totalQuestions={totalQuestions}
            title="Последняя попытка"
            titleId="last-title"
          />
          <RetakeCountdown until={lastAttempt.lockedUntil} remaining={remaining} />
          {lastAttempt.answers !== null ? (
            <a className="button button--secondary summary__link" href="#my-answers">
              Посмотреть мои ответы
            </a>
          ) : (
            <>
              <h3 className="card__subtitle">Статус по вопросам</h3>
              <StatusList results={lastAttempt.summary.results} />
            </>
          )}
        </section>
      )}

      <section className="card card--action" aria-labelledby="start-title">
        <h2 id="start-title" className="card__title">
          Начало аттестации
        </h2>
        <form className="start-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="nickname">
              Игровой ник <span className="field__required">(обязательно)</span>
            </label>
            <input
              id="nickname"
              className="input"
              type="text"
              value={passed !== null ? passed.nickname : nickname}
              disabled={passed !== null}
              maxLength={NICKNAME_MAX_LENGTH + 16}
              autoComplete="nickname"
              spellCheck={false}
              required
              aria-required="true"
              aria-invalid={showNicknameError}
              aria-describedby={showNicknameError ? 'nickname-hint nickname-error' : 'nickname-hint'}
              onChange={(event) => onNicknameChange(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            <p id="nickname-hint" className="field__hint">
              От {NICKNAME_MIN_LENGTH} до {NICKNAME_MAX_LENGTH} символов, пробелы по краям не учитываются.
            </p>
            {showNicknameError && (
              <p id="nickname-error" className="field__error">
                {nicknameError}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="button button--primary button--large"
            disabled={!canStart}
            aria-describedby="start-hint"
          >
            Начать аттестацию
          </button>
          <p id="start-hint" className="field__hint">
            {startHint}
          </p>
        </form>
      </section>

      {passed === null && lastAttempt !== null && lastAttempt.answers !== null && (
        <section id="my-answers" className="card answers" aria-labelledby="answers-title" tabIndex={-1}>
          <h2 id="answers-title" className="card__title">
            Ваши ответы в последней попытке
          </h2>
          <p className="note">
            Для каждого вопроса показан ваш ответ и его оценка. Правильные ответы не показываются, чтобы пересдача
            была честной. Для составных вопросов указано, сколько пунктов засчитано.
          </p>
          <ReviewList
            questions={questions}
            results={lastAttempt.summary.results}
            answers={lastAttempt.answers}
            showCorrect={false}
          />
        </section>
      )}

      <section className="card card--muted" aria-labelledby="reset-title">
        <h2 id="reset-title" className="card__title card__title--small">
          Сброс прогресса
        </h2>
        <p className="note">
          Удаляет все данные аттестации в этом браузере: сохранённый результат, ваши ответы, ник, незавершённую
          попытку и таймер пересдачи.
        </p>
        <div className="reset">
          <button
            type="button"
            className="button button--danger-outline"
            disabled={locked}
            aria-describedby={locked ? 'reset-locked' : undefined}
            onClick={() => setResetOpen(true)}
          >
            Сбросить прогресс
          </button>
          {locked && (
            <p id="reset-locked" className="field__hint">
              Сброс станет доступен после окончания блокировки.
            </p>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={resetOpen}
        title="Сбросить прогресс?"
        cancelLabel="Отмена"
        confirmLabel="Сбросить"
        danger
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          setTouched(false);
          onReset();
        }}
      >
        <p>
          Будут удалены сохранённый результат, ник, незавершённая попытка и таймер. Это действие нельзя
          отменить.
        </p>
      </ConfirmDialog>
    </div>
  );
}
