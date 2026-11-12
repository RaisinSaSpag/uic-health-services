import { Stethoscope } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { formatDateTime, userDisplayName } from '../../lib/format';
import type { Referral } from '../../types/hsms';

interface Props {
  referrals: Referral[];
  loading: boolean;
  onSelectReferral: (id: number) => void;
}

export function ReferralList({ referrals, loading, onSelectReferral }: Props) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {loading ? (
        <p className="muted" style={{ margin: 0 }}>Loading referrals…</p>
      ) : referrals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <Stethoscope size={32} strokeWidth={1.5} style={{ color: '#cbd5e1', marginBottom: 12, margin: '0 auto' }} />
          <p className="muted" style={{ margin: 0 }}>No active referrals found for this filter.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Patient</th><th>Status</th><th>Referred At</th><th style={{ width: 100 }}>Action</th></tr>
            </thead>
            <tbody>
              {referrals.map((referral) => (
                <tr key={referral.id}>
                  <td style={{ fontWeight: 500 }}>{userDisplayName(referral.consultation?.patient?.user)}</td>
                  <td><StatusBadge status={referral.status} /></td>
                  <td className="muted" style={{ fontSize: '0.9rem' }}>{formatDateTime(referral.referred_at)}</td>
                  <td>
                    <button className="button ghost" onClick={() => onSelectReferral(referral.id)} type="button" style={{ padding: '0.35rem 0.75rem' }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}