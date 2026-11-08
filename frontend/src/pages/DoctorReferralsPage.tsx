import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Stethoscope,
  Info,
  MessageSquare,
  ArrowLeft,
  Video,
  Search,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import { confirmAction, notifyError, notifySuccess } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import type { PaginatedResponse, Referral, Medicine } from '../types/hsms';

type DoctorSection = 'dashboard' | 'referrals' | 'about' | 'chat' | 'notifications';

interface DoctorMenuItem {
  key: DoctorSection;
  label: string;
  icon: any;
}

interface PrescriptionRow {
  id: string;
  medicine_id: string;
  quantity: number;
  dosage_instructions: string;
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
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return 'N/A';
  if (value === 'walk_in') return 'Walk-In';
  if (value === 'scheduled') return 'Scheduled';
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

  // Form State
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [doctorRemarks, setDoctorRemarks] = useState('');
  const [prescriptionText, setPrescriptionText] = useState('');
  const [saving, setSaving] = useState(false);

  // Medicines + Prescription Rows
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [prescriptionRows, setPrescriptionRows] = useState<PrescriptionRow[]>([]);

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
      setReferrals(activeReferrals || []);
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
      setFinalDiagnosis(response.data.final_diagnosis ?? '');
      setTreatmentPlan(response.data.treatment_plan ?? '');
      setDoctorRemarks(response.data.doctor_remarks ?? '');
      setPrescriptionText(response.data.prescription ?? '');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load selected referral.'), 'Load Failed');
      navigate('/doctor/referrals');
    } finally {
      setLoadingDetail(false);
    }
  }, [navigate, routeReferralId]);

  // Load medicines once
  useEffect(() => {
    let isMounted = true;
    const fetchMedicines = async () => {
      try {
        const medRes = await api.get<PaginatedResponse<Medicine>>('/medicines', { params: { per_page: 100 } });
        if (isMounted) setMedicines(medRes.data.data || []);
      } catch { /* non-fatal */ }
    };
    void fetchMedicines();
    return () => { isMounted = false; };
  }, []);

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

  const addPrescriptionRow = () => {
    setPrescriptionRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), medicine_id: '', quantity: 1, dosage_instructions: '' },
    ]);
  };

  const updatePrescriptionRow = (id: string, patch: Partial<PrescriptionRow>) => {
    setPrescriptionRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removePrescriptionRow = (id: string) => {
    setPrescriptionRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateReferral = async (action: 'in_progress' | 'complete'): Promise<void> => {
    if (!detailReferral) return;

    if (action === 'complete') {
      if (finalDiagnosis.trim() === '') {
        void notifyError('Final Diagnosis is required to complete this referral.', 'Missing Details');
        return;
      }
      if (treatmentPlan.trim() === '') {
        void notifyError('Treatment Plan is required to complete this referral.', 'Missing Details');
        return;
      }
      if (doctorRemarks.trim() === '') {
        void notifyError('Doctor remarks are required to complete this referral.', 'Missing Details');
        return;
      }
      const confirmed = await confirmAction({
        title: 'Complete this referral?',
        text: `Referral #${detailReferral.id} will be marked as complete.`,
        confirmButtonText: 'Complete Referral',
        cancelButtonText: 'Cancel',
      });
      if (!confirmed) return;

      setSaving(true);
      try {
        await api.patch(`/referrals/${detailReferral.id}`, {
          action: 'complete',
          final_diagnosis: finalDiagnosis.trim(),
          treatment_plan: treatmentPlan.trim(),
          doctor_remarks: doctorRemarks.trim(),
          prescription: prescriptionText.trim() || null,
          prescriptions: prescriptionRows
            .filter((row) => row.medicine_id && row.quantity > 0)
            .map((row) => ({
              medicine_id: Number(row.medicine_id),
              quantity: row.quantity,
              dosage_instructions: row.dosage_instructions.trim() || null,
            })),
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

  const sectionCard: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '1.5rem 1.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    display: 'block',
    marginBottom: 4,
  };

  const valueStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.95rem',
    color: '#0f172a',
    lineHeight: 1.45,
  };

  return (
    <div className="nurse-dashboard-page" style={{ minHeight: '100vh', display: 'flex' }}>
      <aside className="nurse-sidebar" aria-label="Doctor sidebar" style={{ minHeight: '100vh' }}>
        <div className="nurse-sidebar-brand">
          <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
          <div className="nurse-sidebar-identity">
            <h3>{doctorName}</h3>
            <p>Doctor</p>
          </div>
        </div>
        <nav className="nurse-sidebar-nav">
          {doctorMenuItems.map((menuItem) => {
            const Icon = menuItem.icon;
            return (
              <div className="nurse-nav-item" key={menuItem.key}>
                <button
                  className={`nurse-side-link${activeSection === menuItem.key ? ' active' : ''}`}
                  onClick={() => onMenuClick(menuItem.key)}
                  type="button"
                >
                  <Icon className="nurse-side-icon" size={18} strokeWidth={2.2} />
                  <span className="nurse-side-label">{menuItem.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="nurse-dashboard-main" style={{ flex: 1, padding: '1.75rem 2rem 2.5rem' }}>
        {!isDetailMode ? (
          <section>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 650, color: '#0f172a' }}>
                Referral Consultations
              </h2>
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                View and manage nurse referral consultations.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: 1, minWidth: 220 }}>
                <span>Search</span>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient, reason, or status…" style={{ paddingLeft: 36 }} />
                </div>
              </label>
              <label className="field" style={{ width: 240 }}>
                <span>Status</span>
                <select value={statusFilter} onChange={onFilterChange}>
                  {referralStatusOptions.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={sectionCard}>
              {loading ? (
                <p className="muted" style={{ margin: 0 }}>Loading referrals…</p>
              ) : filteredReferrals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <Stethoscope size={32} strokeWidth={1.5} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                  <p className="muted" style={{ margin: 0 }}>No active referrals found for this filter.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Status</th>
                        <th>Referred At</th>
                        <th style={{ width: 100 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReferrals.map((referral) => (
                        <tr key={referral.id}>
                          <td style={{ fontWeight: 500 }}>{userDisplayName(referral.consultation?.patient?.user)}</td>
                          <td><StatusBadge status={referral.status} /></td>
                          <td className="muted" style={{ fontSize: '0.9rem' }}>{formatDateTime(referral.referred_at)}</td>
                          <td>
                            <button className="button ghost" onClick={() => navigate(`/doctor/referrals/${referral.id}`)} type="button" style={{ padding: '0.35rem 0.75rem' }}>
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 650, color: '#0f172a' }}>Referral Consultation</h2>
                {detailReferral && (
                  <p className="muted" style={{ margin: '0.3rem 0 0', fontSize: '0.9rem' }}>
                    #{detailReferral.id} · {userDisplayName(detailReferral.consultation?.patient?.user)}
                  </p>
                )}
              </div>
              <button className="button ghost" onClick={() => navigate('/doctor/referrals')} type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={17} /> Back to list
              </button>
            </div>

            {loadingDetail || !detailReferral ? (
              <div style={{ ...sectionCard, textAlign: 'center', padding: '3rem' }}>
                <p className="muted" style={{ margin: 0 }}>Loading referral details…</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.25fr)', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left: Nurse Assessment */}
                <div style={sectionCard}>
                  <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600, color: '#a3224a', borderBottom: '2px solid #fce7f3', paddingBottom: '0.65rem' }}>
                    Nurse Assessment
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    <div>
                      <span style={labelStyle}>Patient</span>
                      <p style={{ ...valueStyle, fontWeight: 560 }}>{userDisplayName(detailReferral.consultation?.patient?.user)}</p>
                    </div>
                    <div>
                      <span style={labelStyle}>Consultation Type</span>
                      <p style={valueStyle}>{normalizeText(detailReferral.consultation?.consultation_type)}</p>
                    </div>
                    <div>
                      <span style={labelStyle}>Chief Complaint</span>
                      <p style={{ ...valueStyle, background: '#f8fafc', padding: '0.7rem 0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        {detailReferral.consultation?.chief_complaint ?? 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span style={labelStyle}>Nurse Diagnosis</span>
                      <p style={valueStyle}>{detailReferral.consultation?.diagnosis ?? 'N/A'}</p>
                    </div>
                    <div>
                      <span style={labelStyle}>Nurse Remarks</span>
                      <p style={valueStyle}>{detailReferral.consultation?.remarks ?? 'N/A'}</p>
                    </div>
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: 4 }}>
                      <span style={{ ...labelStyle, marginBottom: 8 }}>Vitals</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem', fontSize: '0.9rem' }}>
                        <div><span className="muted">BP</span><div style={{ fontWeight: 500 }}>{normalizeVital(detailReferral.consultation?.blood_pressure)}</div></div>
                        <div><span className="muted">Pulse</span><div style={{ fontWeight: 500 }}>{normalizeVital(detailReferral.consultation?.pulse_bpm, 'bpm')}</div></div>
                        <div><span className="muted">Temp</span><div style={{ fontWeight: 500 }}>{normalizeVital(detailReferral.consultation?.temperature_c, '°C')}</div></div>
                        <div><span className="muted">Weight</span><div style={{ fontWeight: 500 }}>{normalizeVital(detailReferral.consultation?.weight_kg, 'kg')}</div></div>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: 4 }}>
                      <span style={labelStyle}>Referral Reason</span>
                      <p style={{ ...valueStyle, color: '#b91c1c', fontWeight: 500 }}>{detailReferral.referral_reason || 'N/A'}</p>
                    </div>
                    {detailReferral.consultation?.is_telemed && detailReferral.consultation?.telemed_link && (
                      <div style={{ marginTop: 4, padding: '1rem 1.1rem', background: '#fdf2f8', borderRadius: 10, border: '1px solid #fbcfe8' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a3224a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          Telemed Consultation
                        </div>
                        <a href={detailReferral.consultation.telemed_link} target="_blank" rel="noopener noreferrer" className="button primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '0.45rem 0.9rem', fontSize: '0.875rem' }}>
                          <Video size={15} /> Join Video Call
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Doctor Assessment */}
                <div style={sectionCard}>
                  <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600, color: '#a3224a', borderBottom: '2px solid #fce7f3', paddingBottom: '0.65rem' }}>
                    Doctor Assessment
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <label className="field">
                      <span>Final Diagnosis *</span>
                      <textarea rows={2} value={finalDiagnosis} onChange={(e) => setFinalDiagnosis(e.target.value)} placeholder="e.g. Upper Respiratory Tract Infection" disabled={isCompleted || saving} />
                    </label>
                    <label className="field">
                      <span>Treatment Plan *</span>
                      <textarea rows={2} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} placeholder="e.g. Rest and hydration, follow up in 3 days" disabled={isCompleted || saving} />
                    </label>
                    <label className="field">
                      <span>Doctor Remarks *</span>
                      <textarea rows={3} value={doctorRemarks} onChange={(e) => setDoctorRemarks(e.target.value)} placeholder="Clinical assessment, findings, and recommendations" disabled={isCompleted || saving} />
                    </label>

                    {/* Structured prescriptions */}
                    <div className="field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span>Prescribed Medicines (from catalog)</span>
                        <button type="button" className="button secondary" onClick={addPrescriptionRow} disabled={isCompleted || saving} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>
                          <Plus size={14} /> Add
                        </button>
                      </div>

                      {prescriptionRows.length === 0 ? (
                        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                          No catalog medicines selected. Use the free-text below for external prescriptions.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {prescriptionRows.map((row) => (
                            <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <select
                                value={row.medicine_id}
                                onChange={(e) => updatePrescriptionRow(row.id, { medicine_id: e.target.value })}
                                disabled={isCompleted || saving}
                                style={{ flex: 2, padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                              >
                                <option value="">— Select medicine —</option>
                                {medicines.map((m) => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min={1}
                                value={row.quantity}
                                onChange={(e) => updatePrescriptionRow(row.id, { quantity: Number(e.target.value) })}
                                disabled={isCompleted || saving}
                                style={{ width: 80, padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                                placeholder="Qty"
                              />
                              <input
                                type="text"
                                value={row.dosage_instructions}
                                onChange={(e) => updatePrescriptionRow(row.id, { dosage_instructions: e.target.value })}
                                disabled={isCompleted || saving}
                                style={{ flex: 2, padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                                placeholder="Dosage (e.g. 1 tab every 6 hours)"
                              />
                              <button
                                type="button"
                                className="button ghost"
                                onClick={() => removePrescriptionRow(row.id)}
                                disabled={isCompleted || saving}
                                title="Remove"
                                style={{ padding: '0.5rem' }}
                              >
                                <Trash2 size={16} color="#ef4444" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Free-text prescription for external items */}
                    <div className="field">
                      <span>Additional Free-Text Prescription (Optional)</span>
                      <textarea
                        rows={3}
                        value={prescriptionText}
                        onChange={(e) => setPrescriptionText(e.target.value)}
                        placeholder="For medicines not in catalog (e.g. 'Also recommended: throat lozenges from pharmacy.')"
                        disabled={isCompleted || saving}
                      />
                    </div>
                  </div>

                  {(canSetInProgress || canComplete) && (
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', paddingTop: '1.35rem', borderTop: '1px solid #e2e8f0' }}>
                      {canSetInProgress && (
                        <button className="button secondary" onClick={() => void updateReferral('in_progress')} disabled={saving} type="button" style={{ flex: 1 }}>
                          Mark In Progress
                        </button>
                      )}
                      {canComplete && (
                        <button className="button success" onClick={() => void updateReferral('complete')} disabled={saving} type="button" style={{ flex: 1, background: '#059669', borderColor: '#059669' }}>
                          {saving ? 'Saving…' : 'Complete Referral'}
                        </button>
                      )}
                    </div>
                  )}

                  {isCompleted && (
                    <div style={{ marginTop: '1.5rem', padding: '0.85rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534', fontSize: '0.9rem', fontWeight: 500 }}>
                      This referral has been completed.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}