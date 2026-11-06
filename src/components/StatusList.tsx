import type { QuestionResult } from '../grading/types';
import { StatusBadge } from './StatusBadge';

/** Статусы по вопросам без текстов ответов. Для составных — сколько пунктов засчитано. */
export function StatusList({ results }: { results: readonly QuestionResult[] }) {
  return (
    <ol className="status-list">
      {results.map((result, index) => (
        <li key={result.questionId} className="status-list__item">
          <span className="status-list__number">Вопрос {index + 1}</span>
          <StatusBadge status={result.status} />
          {result.total !== undefined && (
            <span className="status-list__count">
              Засчитано {result.matched ?? 0} из {result.total}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
