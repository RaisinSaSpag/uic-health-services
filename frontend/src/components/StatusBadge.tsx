import { memo } from 'react';
import { humanizeStatus } from '../lib/format';

interface StatusBadgeProps {
  status: string | null | undefined;
}

const statusToneMap: Record<string, string> = {
  // Consultation statuses
  pending_consultation: 'warning',
  nurse_assessment: 'primary',
  referred_to_doctor: 'warning',
  nurse_finalization: 'primary',
  completed: 'success',
  cancelled: 'danger',
  
  // Referral statuses
  pending_doctor: 'warning',
  in_progress: 'primary',
  
  // 🚨 Branch Request statuses (Chain of Custody)
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  shipped: 'primary',
  received: 'warning',
};

export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps) {
  const safeStatus = status ?? 'unknown';
  const tone = statusToneMap[safeStatus] ?? 'neutral';

  return (
    <span 
      className={`status-badge ${tone}`} 
      style={{ 
        whiteSpace: 'nowrap', 
        display: 'inline-flex', 
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '120px', // 🚨 Forces minimum width to prevent overlap
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {humanizeStatus(safeStatus)}
    </span>
  );
});