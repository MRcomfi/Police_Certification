import type { RefObject } from 'react';
import { PASS_THRESHOLD } from '../grading/grade';
import type { AttemptSummary } from '../storage/storage';
import { formatDateTime, formatPoints } from '../utils/format';

interface SummaryDetailsProps {
  summary: AttemptSummary;
  totalQuestions: number;
  title: string;
  titleId: string;
  /** Ссылка на заголовок, если экран переносит на него фокус. */
  titleRef?: RefObject<HTMLHeadingElement | null>;
  /** Печать «ставится» с короткой анимацией (только сразу после завершения). */
  animateStamp?: boolean;
}

/** Итоговая сводка: печать со статусом, ник, баллы, число полностью правильных ответов, дата и время. */
export function SummaryDetails({
  summary,
  totalQuestions,
  title,
  titleId,
  titleRef,
  animateStamp = false,
}: SummaryDetailsProps) {
  const stampClass = ['stamp', summary.passed ? 'stamp--pass' : 'stamp--fail', animateStamp ? 'stamp--animate' : '']
    .join(' ')
    .trim();

  return (
    <div className="summary">
      <div className="summary__head">
        <h2 id={titleId} className="card__title" tabIndex={titleRef ? -1 : undefined} ref={titleRef}>
          {title}
        </h2>
        <p className={stampClass}>{summary.passed ? 'Аттестация сдана' : 'Аттестация не сдана'}</p>
      </div>
      <dl className="summary__grid">
        <div className="summary__item summary__item--wide">
          <dt>Игровой ник</dt>
          <dd className="summary__nickname">{summary.nickname}</dd>
        </div>
        <div className="summary__item">
          <dt>Сумма баллов</dt>
          <dd>
            <span className="summary__value">{formatPoints(summary.score)}</span> из {totalQuestions}
          </dd>
        </div>
        <div className="summary__item">
          <dt>Полностью правильных ответов</dt>
          <dd>
            <span className="summary__value">{summary.fullCount}</span> из {totalQuestions}
          </dd>
        </div>
        <div className="summary__item summary__item--wide">
          <dt>Дата и время завершения</dt>
          <dd>{formatDateTime(summary.finishedAt)}</dd>
        </div>
      </dl>
      <p className="note">
        Для сдачи нужно не менее {PASS_THRESHOLD} полностью правильных ответов. Частичные ответы (0,5 балла)
        увеличивают сумму баллов, но не учитываются в пороге сдачи.
      </p>
    </div>
  );
}
