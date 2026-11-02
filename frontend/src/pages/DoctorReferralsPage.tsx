import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Stethoscope, 
  Info, 
  MessageSquare, 
  ArrowLeft,
  Video,
  Plus
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
  
  // Form State
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [doctorRemarks, setDoctorRemarks] = useState('');
  const [prescriptionText, setPrescriptionText] = useState('');
  const [saving, setSaving] = useState(false);

  // Medicines Catalog State
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('');

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
      
      // Load existing data if it exists
      setFinalDiagnosis(response.data.final_diagnosis ?? '');
      setTreatmentPlan(response.data.treatment_plan ?? '');
      setDoctorRemarks(response.data.doctor_remarks ?? '');
      setPrescriptionText(response.data.prescription ?? '');

      // Load Medicines Catalog if not already loaded
      if (medicines.length === 0) {
        const medRes = await api.get<PaginatedResponse<Medicine>>('/medicines', { params: { per_page: 100 } });
        setMedicines(medRes.data.data);
      }
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load selected referral.'), 'Load Failed');
      navigate('/doctor/referrals');
    } finally {
      setLoadingDetail(false);
    }
  }, [navigate, routeReferralId, medicines.length]);

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

  const handleAddMedicineToPrescription = () => {
    if (!selectedMedicineId) return;
    const med = medicines.find(m => m.id === Number(selectedMedicineId));
    if (!med) return;
    
    const newText = prescriptionText.trim() 
      ? `${prescriptionText.trim()}\n- ${med.name}` 
      : `- ${med.name}`;
      
    setPrescriptionText(newText);
    setSelectedMedicineId('');
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
    <div className="nurse-dashboard-page" style={{ minHeight: '100vh', display: 'flex' }}>
      {/* SIDEBAR */}
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

      {/* MAIN CONTENT */}
      <main className="nurse-dashboard-main" style={{ flex: 1, minHeight: '100vh' }}>
        {!isDetailMode ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Referral Consultations</h2>
                <p className="muted small">View and manage nurse referral consultations.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Search Referrals</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by patient, referral reason, or status"
                />
              </label>

              <label className="field" style={{ width: '250px' }}>
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
                <table>
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
                        <td>
                          <button
                            className="button ghost"
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
          <section className="panel">
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Referral Consultation Detail</h2>
              <button
                className="button ghost"
                onClick={() => navigate('/doctor/referrals')}
                type="button"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={18} /> Back
              </button>
            </div>

            {loadingDetail || !detailReferral ? (
              <p className="muted">Loading referral details...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Left Side: Nurse Details */}
                <article>
                  <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Nurse Consultation Details</h3>
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

                {/* Right Side: Doctor Assessment */}
                <article>
                  <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Doctor Assessment</h3>
                  
                  <label className="field full-width">
                    <span>Final Diagnosis *</span>
                    <textarea
                      rows={2}
                      value={finalDiagnosis}
                      onChange={(e) => setFinalDiagnosis(e.target.value)}
                      placeholder="Enter final diagnosis (e.g., Upper Respiratory Tract Infection)"
                      disabled={isCompleted || saving}
                    />
                  </label>

                  <label className="field full-width" style={{ marginTop: '1rem' }}>
                    <span>Treatment Plan *</span>
                    <textarea
                      rows={2}
                      value={treatmentPlan}
                      onChange={(e) => setTreatmentPlan(e.target.value)}
                      placeholder="Enter treatment plan (e.g., Rest and hydration, follow up in 3 days)"
                      disabled={isCompleted || saving}
                    />
                  </label>

                  <label className="field full-width" style={{ marginTop: '1rem' }}>
                    <span>Doctor Remarks *</span>
                    <textarea
                      rows={3}
                      value={doctorRemarks}
                      onChange={(e) => setDoctorRemarks(e.target.value)}
                      placeholder="Enter your clinical assessment, findings, and recommendations"
                      disabled={isCompleted || saving}
                    />
                  </label>

                  <div className="field full-width" style={{ marginTop: '1rem' }}>
                    <span>Prescription (Optional)</span>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select 
                        value={selectedMedicineId} 
                        onChange={(e) => setSelectedMedicineId(e.target.value)}
                        disabled={isCompleted || saving}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="">-- Select a medicine to add --</option>
                        {medicines.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.category})</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        className="button secondary" 
                        onClick={handleAddMedicineToPrescription}
                        disabled={!selectedMedicineId || isCompleted || saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                    
                    <textarea
                      rows={4}
                      value={prescriptionText}
                      onChange={(e) => setPrescriptionText(e.target.value)}
                      placeholder="Selected medicines will appear here. You can add dosage instructions."
                      disabled={isCompleted || saving}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
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
        )}
      </main>
    </div>
  );
}