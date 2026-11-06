import type { QuestionStatus } from '../grading/types';
import { STATUS_LABELS } from '../utils/format';

export function StatusBadge({ status }: { status: QuestionStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>;
}
