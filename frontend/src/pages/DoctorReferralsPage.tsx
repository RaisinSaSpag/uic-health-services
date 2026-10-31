import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Stethoscope, 
  Info, 
  MessageSquare, 
  ArrowLeft,
  Video
} from 'lucide-react';
import { api } from '../lib/api';
import { confirmAction, notifyError, notifySuccess } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import type { PaginatedResponse, Referral } from '../types/hsms';

type DoctorSection = 'dashboard' | 'referrals' | 'about' | 'chat' | 'notifications';

interface DoctorMenuItem {
  key: DoctorSection;
  label: string;
  icon: any;
}

const doctorMenuItems: DoctorMenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'referrals', label: 'Referrals', icon: Stethoscope },
  { key: 'about', label: 'About', icon: Info },
  { key: 'chat', label: 'Messages', icon: MessageSquare },
];

const referralStatusOptions = [
  { value: '', label: 'Active (Pending + In Progress)' },
  { value: 'pending_doctor', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
];

function parseReferralId(value: string | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return 'N/A';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeVital(value: string | number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  return suffix ? `${value} ${suffix}` : String(value);
}

export function DoctorReferralsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { referralId: rawReferralId } = useParams<{ referralId: string }>();

  const [activeSection, setActiveSection] = useState<DoctorSection>('referrals');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [detailReferral, setDetailReferral] = useState<Referral | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [doctorRemarks, setDoctorRemarks] = useState('');
  const [prescriptionText, setPrescriptionText] = useState(''); // 🚨 #14: free-text prescription
  const [saving, setSaving] = useState(false);

  const routeReferralId = useMemo(() => parseReferralId(rawReferralId), [rawReferralId]);
  const isDetailMode = routeReferralId !== null;

  const doctorName = useMemo(() => userDisplayName(user), [user]);

  const loadReferrals = useCallback(async () => {
    if (isDetailMode) return;
    setLoading(true);
    try {
      const response = await api.get<PaginatedResponse<Referral>>('/referrals', {
        params: { per_page: 100, ...(statusFilter ? { status: statusFilter } : {}) },
      });
      const activeReferrals = response.data.data.filter((r) => r.status !== 'completed');
      setReferrals(activeReferrals);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load doctor referrals.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [isDetailMode, statusFilter]);

  const loadReferralDetail = useCallback(async () => {
    if (!routeReferralId) {
      setDetailReferral(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const response = await api.get<Referral>(`/referrals/${routeReferralId}`);
      setDetailReferral(response.data);
      setDoctorRemarks(response.data.doctor_remarks ?? '');
      setPrescriptionText(response.data.prescription ?? '');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load selected referral.'), 'Load Failed');
      navigate('/doctor/referrals');
    } finally {
      setLoadingDetail(false);
    }
  }, [navigate, routeReferralId]);

  useEffect(() => {
    if (isDetailMode) {
      void loadReferralDetail();
      return;
    }
    void loadReferrals();
  }, [isDetailMode, loadReferralDetail, loadReferrals]);

  const filteredReferrals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch === '') return referrals;
    return referrals.filter((referral) => {
      const values = [
        userDisplayName(referral.consultation?.patient?.user).toLowerCase(),
        (referral.referral_reason ?? '').toLowerCase(),
        normalizeText(referral.status).toLowerCase(),
      ];
      return values.some((value) => value.includes(normalizedSearch));
    });
  }, [referrals, search]);

  const onFilterChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setStatusFilter(event.target.value);
  };

  const onMenuClick = (section: DoctorSection): void => {
    setActiveSection(section);
    if (section === 'dashboard') { navigate('/doctor'); return; }
    if (section === 'chat') { navigate('/doctor/chat'); return; }
    if (section === 'about') { navigate('/doctor/about'); }
  };

  const updateReferral = async (action: 'in_progress' | 'complete'): Promise<void> => {
    if (!detailReferral) return;

    if (action === 'complete') {
      if (doctorRemarks.trim() === '') {
        void notifyError('Doctor remarks are required to complete this referral.', 'Missing Details');
        return;
      }
      const confirmed = await confirmAction({
        title: 'Complete this referral?',
        text: `Referral #${detailReferral.id} will be marked as complete${prescriptionText.trim() ? ' and prescription will be saved' : ''}.`,
        confirmButtonText: 'Complete Referral',
        cancelButtonText: 'Cancel',
      });
      if (!confirmed) return;

      setSaving(true);
      try {
        await api.patch(`/referrals/${detailReferral.id}`, {
          action: 'complete',
          doctor_remarks: doctorRemarks.trim(),
          prescription: prescriptionText.trim() || null,
        });

        await notifySuccess(`Referral #${detailReferral.id} completed.`, 'Referral Completed');
        navigate('/doctor/referrals');
      } catch (err) {
        void notifyError(getErrorMessage(err, `Failed to complete referral #${detailReferral.id}.`), 'Update Failed');
      } finally {
        setSaving(false);
      }
    } else {
      const confirmed = await confirmAction({
        title: 'Mark referral in progress?',
        text: `Referral #${detailReferral.id} will be updated to in_progress.`,
        confirmButtonText: 'Mark In Progress',
        cancelButtonText: 'Cancel',
      });
      if (!confirmed) return;

      setSaving(true);
      try {
        await api.patch(`/referrals/${detailReferral.id}`, { action: 'in_progress' });
        await notifySuccess(`Referral #${detailReferral.id} updated.`, 'Referral Updated');
        await loadReferralDetail();
      } catch (err) {
        void notifyError(getErrorMessage(err, `Failed to update referral #${detailReferral.id}.`), 'Update Failed');
      } finally {
        setSaving(false);
      }
    }
  };

  const canSetInProgress = detailReferral?.status === 'pending_doctor';
  const canComplete = detailReferral ? ['pending_doctor', 'in_progress'].includes(detailReferral.status) : false;
  const isCompleted = detailReferral?.status === 'completed';

  return (
    <div className="nurse-dashboard-layout">
      {/* SIDEBAR */}
      <aside className="nurse-sidebar">
        <div className="nurse-sidebar-profile">
          <div className="avatar">{doctorName.charAt(0)}</div>
          <div>
            <strong>{doctorName}</strong>
            <span className="muted">Doctor</span>
          </div>
        </div>
        <nav className="nurse-side-nav">
          {doctorMenuItems.map((menuItem) => {
            const Icon = menuItem.icon;
            return (
              <button
                key={menuItem.key}
                className={`nurse-side-link${activeSection === menuItem.key ? ' active' : ''}`}
                onClick={() => onMenuClick(menuItem.key)}
                type="button"
              >
                <Icon size={18} />
                {menuItem.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className={`nurse-dashboard-main nurse-dashboard-main-detail${isDetailMode ? ' referral-detail-main' : ''}`}>
        {!isDetailMode ? (
          <section className="panel nurse-records-panel">
            <div className="nurse-records-header">
              <div>
                <h2>Referral Consultations</h2>
                <p className="muted small">View and manage nurse referral consultations.</p>
              </div>
            </div>

            <div className="nurse-records-toolbar referral-list-toolbar">
              <label className="field nurse-records-search" htmlFor="doctor-referrals-search">
                <span>Search Referrals</span>
                <input
                  id="doctor-referrals-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by patient, referral reason, or status"
                />
              </label>

              <label className="field inline-field referral-status-field">
                <span>Status</span>
                <select value={statusFilter} onChange={onFilterChange}>
                  {referralStatusOptions.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <p className="muted">Loading referrals...</p>
            ) : filteredReferrals.length === 0 ? (
              <p className="empty-state">No active referrals found for this filter.</p>
            ) : (
              <div className="table-wrap">
                <table aria-label="Doctor referrals table" className="referral-list-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Status</th>
                      <th>Referred At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReferrals.map((referral) => (
                      <tr key={referral.id}>
                        <td>{userDisplayName(referral.consultation?.patient?.user)}</td>
                        <td>
                          <StatusBadge status={referral.status} />
                        </td>
                        <td>{formatDateTime(referral.referred_at)}</td>
                        <td className="referral-list-action-cell">
                          <button
                            className="button ghost referral-view-button"
                            onClick={() => navigate(`/doctor/referrals/${referral.id}`)}
                            type="button"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <>
            <div className="referral-detail-header">
              <div>
                <h2>Referral Consultation Detail</h2>
              </div>
              <button
                aria-label="Back to referrals"
                className="button ghost referral-back-icon-button"
                onClick={() => navigate('/doctor/referrals')}
                title="Back to referrals"
                type="button"
              >
                <ArrowLeft size={18} /> Back
              </button>
            </div>

            <section className="panel referral-workbench referral-workbench-detail">
              {loadingDetail || !detailReferral ? (
                <p className="muted">Loading referral details...</p>
              ) : (
                <div className="referral-compare-grid">
                  <article className="nurse-consultation-detail-panel">
                    <h3>Nurse Consultation Details</h3>
                    <table>
                      <tbody>
                        <tr><td>Patient</td><td>{userDisplayName(detailReferral.consultation?.patient?.user)}</td></tr>
                        <tr><td>Consultation Type</td><td>{normalizeText(detailReferral.consultation?.consultation_type)}</td></tr>
                        <tr><td>Chief Complaint</td><td>{detailReferral.consultation?.chief_complaint ?? 'N/A'}</td></tr>
                        <tr><td>Diagnosis</td><td>{detailReferral.consultation?.diagnosis ?? 'N/A'}</td></tr>
                        <tr><td>Remarks</td><td>{detailReferral.consultation?.remarks ?? 'N/A'}</td></tr>
                        <tr><td>Blood Pressure</td><td>{normalizeVital(detailReferral.consultation?.blood_pressure)}</td></tr>
                        <tr><td>Pulse</td><td>{normalizeVital(detailReferral.consultation?.pulse_bpm, 'bpm')}</td></tr>
                        <tr><td>Temperature</td><td>{normalizeVital(detailReferral.consultation?.temperature_c, 'C')}</td></tr>
                        <tr><td>Weight</td><td>{normalizeVital(detailReferral.consultation?.weight_kg, 'kg')}</td></tr>
                        <tr><td>Referral Reason</td><td>{detailReferral.referral_reason}</td></tr>
                      </tbody>
                    </table>

                    {/* Telemed Join Button */}
                    {detailReferral.consultation?.is_telemed && detailReferral.consultation?.telemed_link && (
                      <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px', border: '1px solid #90caf9' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#1565c0' }}>Telemed Consultation</h4>
                        <p className="small" style={{ margin: '0 0 1rem 0' }}>The nurse has requested a telemed session for this patient.</p>
                        <a 
                          href={detailReferral.consultation.telemed_link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="button primary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                        >
                          <Video size={18} />
                          Join Video Call
                        </a>
                      </div>
                    )}
                  </article>

                  <article className="doctor-referral-panel">
                    <h3>Doctor Assessment</h3>
                    <label className="field full-width">
                      <span>Doctor Remarks *</span>
                      <textarea
                        rows={4}
                        value={doctorRemarks}
                        onChange={(e) => setDoctorRemarks(e.target.value)}
                        placeholder="Enter your clinical assessment, findings, and recommendations"
                        disabled={isCompleted || saving}
                      />
                    </label>

                    {/* 🚨 #14: Free-text prescription (no dropdown — doctors type naturally) */}
                    <label className="field full-width" style={{ marginTop: '1rem' }}>
                      <span>Prescription (Optional)</span>
                      <textarea
                        rows={4}
                        value={prescriptionText}
                        onChange={(e) => setPrescriptionText(e.target.value)}
                        placeholder="E.g.,&#10;- Paracetamol 500mg — 1 tablet every 6 hours as needed for fever&#10;- Amoxicillin 500mg — 1 capsule 3x daily for 7 days"
                        disabled={isCompleted || saving}
                      />
                      <small className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                        Type the prescription as you would write it. Multiple medicines can be listed on separate lines.
                      </small>
                    </label>

                    <div className="referral-actions" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                      {canSetInProgress && (
                        <button
                          className="button secondary"
                          onClick={() => void updateReferral('in_progress')}
                          disabled={saving}
                          type="button"
                        >
                          Mark In Progress
                        </button>
                      )}
                      {canComplete && (
                        <button
                          className="button success"
                          onClick={() => void updateReferral('complete')}
                          disabled={saving}
                          type="button"
                        >
                          {saving ? 'Saving...' : 'Complete Referral'}
                        </button>
                      )}
                    </div>
                  </article>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}