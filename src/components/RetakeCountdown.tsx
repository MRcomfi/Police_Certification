import { formatCountdown, formatTime } from '../utils/format';

interface RetakeCountdownProps {
  /** Момент окончания блокировки. */
  until: number;
  /** Сколько осталось, мс (из хука useRemaining родителя). */
  remaining: number;
}

/** Обратный отсчёт до пересдачи в формате ММ:СС. */
export function RetakeCountdown({ until, remaining }: RetakeCountdownProps) {
  const locked = remaining > 0;

  return (
    <div className={`retake ${locked ? 'retake--locked' : 'retake--open'}`}>
      {locked && (
        <>
          <p className="retake__label">Пересдача будет доступна через</p>
          <p className="retake__timer" role="timer">
            {formatCountdown(remaining)}
          </p>
          <p className="retake__hint">в {formatTime(until)} по часам этого устройства</p>
        </>
      )}
      {/* Живая область сообщает экранным читалкам о снятии блокировки, но не о каждой секунде. */}
      <p className="retake__status" aria-live="polite">
        {locked ? '' : 'Пересдача доступна.'}
      </p>
    </div>
  );
}
