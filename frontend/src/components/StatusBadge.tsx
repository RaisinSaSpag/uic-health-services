import { memo } from 'react';
import { humanizeStatus } from '../lib/format';

interface StatusBadgeProps {
  status: string | null | undefined;
}

const statusToneMap: Record<string, string> = {
  pending_consultation: 'warning',
  nurse_assessment: 'primary',
  referred_to_doctor: 'warning',
  nurse_finalization: 'primary',
  completed: 'success',
  cancelled: 'danger',
  pending_doctor: 'warning',
  in_progress: 'primary',
};

export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps) {
  const safeStatus = status ?? 'unknown';
  const tone = statusToneMap[safeStatus] ?? 'neutral';

  return <span className={`status-badge ${tone}`}>{humanizeStatus(safeStatus)}</span>;
});
