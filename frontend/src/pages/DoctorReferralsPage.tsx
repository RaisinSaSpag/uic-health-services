import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Stethoscope,
  Info,
  MessageSquare,
  ArrowLeft,
  Video,
  Search,
  User,
  MapPin,
} from 'lucide-react';
import { api } from '../lib/api';
import { confirmAction, notifyError, notifySuccess } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import type { PaginatedResponse, Referral } from '../types/hsms';

// --- Types & Constants ---

type DoctorSection = 'dashboard' | 'referrals' | 'about' | 'chat' | 'notifications';

interface DoctorMenuItem {
  key: DoctorSection;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
}

interface ApiStockResponse {
  id: number;
  available_quantity: number;
  expiration_date: string;
  medicine: {
    name: string;
  };
}

interface Campus {
  id: number;
  name: string;
}

// 🚨 NEW: Structured item for the doctor's list
interface PrescribedItem {
  name: string;
  qty: number;
  stockId: number | null;
}

const DOCTOR_MENU_ITEMS: DoctorMenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'referrals', label: 'Referrals', icon: Stethoscope },
  { key: 'about', label: 'About', icon: Info },
  { key: 'chat', label: 'Messages', icon: MessageSquare },
];

const REFERRAL_STATUS_OPTIONS = [
  { value: '', label: 'Active (Pending + In Progress)' },
  { value: 'pending_doctor', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
];

// --- Helper Functions ---

function parseReferralId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

function calculateAge(birthDate: string | null | undefined): string {
  if (!birthDate) return 'N/A';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} years old`;
}

// --- Sub-components ---

interface SidebarProps {
  doctorName: string;
  activeSection: DoctorSection;
  onMenuClick: (section: DoctorSection) => void;
}

function Sidebar({ doctorName, activeSection, onMenuClick }: SidebarProps) {
  return (
    <aside className="nurse-sidebar" aria-label="Doctor sidebar" style={{ minHeight: '100vh' }}>
      <div className="nurse-sidebar-brand">
        <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
        <div className="nurse-sidebar-identity">
          <h3>{doctorName}</h3>
          <p>Doctor</p>
        </div>
      </div>
      <nav className="nurse-sidebar-nav">
        {DOCTOR_MENU_ITEMS.map(({ key, label, icon: Icon }) => (
          <div className="nurse-nav-item" key={key}>
            <button
              className={`nurse-side-link${activeSection === key ? ' active' : ''}`}
              onClick={() => onMenuClick(key)}
              type="button"
            >
              <Icon className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">{label}</span>
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}

interface ReferralListProps {
  referrals: Referral[];
  loading: boolean;
  search: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onSelectReferral: (id: number) => void;
}

function ReferralList({
  referrals,
  loading,
  search,
  statusFilter,
  onSearchChange,
  onFilterChange,
  onSelectReferral,
}: ReferralListProps) {
  return (
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
            <input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Patient, reason, or status…" style={{ paddingLeft: 36 }} />
          </div>
        </label>
        <label className="field" style={{ width: 240 }}>
          <span>Status</span>
          <select value={statusFilter} onChange={onFilterChange}>
            {REFERRAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

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
                <tr>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Referred At</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td style={{ fontWeight: 500 }}>{userDisplayName(referral.consultation?.patient?.user)}</td>
                    <td><StatusBadge status={referral.status} /></td>
                    <td className="muted" style={{ fontSize: '0.9rem' }}>{formatDateTime(referral.referred_at)}</td>
                    <td>
                      <button className="button ghost" onClick={() => onSelectReferral(referral.id)} type="button" style={{ padding: '0.35rem 0.75rem' }}>
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
  );
}

interface NurseAssessmentCardProps {
  referral: Referral;
  campuses: Campus[];
}

function NurseAssessmentCard({ referral, campuses }: NurseAssessmentCardProps) {
  const consultation = referral.consultation;
  const patient = consultation?.patient;
  const patientName = userDisplayName(patient?.user);

  const age = calculateAge(patient?.birth_date);
  const homeCampus = patient?.campus?.name 
    || campuses.find(c => c.id === patient?.campus_id)?.name 
    || 'N/A';
    
  const walkInCampus = consultation?.campus?.name 
    || campuses.find(c => c.id === consultation?.campus_id)?.name 
    || 'N/A';

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
    <div style={sectionCard}>
      <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600, color: '#a3224a', borderBottom: '2px solid #fce7f3', paddingBottom: '0.65rem' }}>
        Nurse Assessment
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} color="#a3224a" />
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Patient</span>
              <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{patientName}</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16 }} />
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Age</span>
              <p style={{ margin: 0, fontWeight: 500, color: '#0f172a' }}>{age}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color="#a3224a" />
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Home Campus</span>
              <p style={{ margin: 0, fontWeight: 500, color: '#0f172a' }}>{homeCampus}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color="#059669" />
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Walk-in Campus</span>
              <p style={{ margin: 0, fontWeight: 500, color: '#0f172a' }}>{walkInCampus}</p>
            </div>
          </div>
        </div>

        <div>
          <span style={labelStyle}>Consultation Type</span>
          <p style={valueStyle}>{normalizeText(consultation?.consultation_type)}</p>
        </div>

        <div>
          <span style={labelStyle}>Chief Complaint</span>
          <p style={{ ...valueStyle, background: '#f8fafc', padding: '0.7rem 0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            {consultation?.chief_complaint ?? 'N/A'}
          </p>
        </div>

        {/* 🚨 REMOVED: Nurse Diagnosis */}

        <div>
          <span style={labelStyle}>Nurse Remarks</span>
          <p style={valueStyle}>{consultation?.remarks ?? 'N/A'}</p>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: 4 }}>
          <span style={{ ...labelStyle, marginBottom: 8 }}>Vitals</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem', fontSize: '0.9rem' }}>
            <div><span className="muted">BP</span><div style={{ fontWeight: 500 }}>{normalizeVital(consultation?.blood_pressure)}</div></div>
            <div><span className="muted">Pulse</span><div style={{ fontWeight: 500 }}>{normalizeVital(consultation?.pulse_bpm, 'bpm')}</div></div>
            <div><span className="muted">Temp</span><div style={{ fontWeight: 500 }}>{normalizeVital(consultation?.temperature_c, '°C')}</div></div>
            <div><span className="muted">Weight</span><div style={{ fontWeight: 500 }}>{normalizeVital(consultation?.weight_kg, 'kg')}</div></div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: 4 }}>
          <span style={labelStyle}>Referral Reason</span>
          <p style={{ ...valueStyle, color: '#b91c1c', fontWeight: 500 }}>{referral.referral_reason || 'N/A'}</p>
        </div>

        {consultation?.is_telemed && consultation?.telemed_link && (
          <div style={{ marginTop: 4, padding: '1rem 1.1rem', background: '#fdf2f8', borderRadius: 10, border: '1px solid #fbcfe8' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a3224a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Telemed Consultation
            </div>
            <a href={consultation.telemed_link} target="_blank" rel="noopener noreferrer" className="button primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '0.45rem 0.9rem', fontSize: '0.875rem' }}>
              <Video size={15} /> Join Video Call
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Page Component ---

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
  const [campuses, setCampuses] = useState<Campus[]>([]);

  // Form State
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [doctorRemarks, setDoctorRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Prescription State
  const [availableStock, setAvailableStock] = useState<ApiStockResponse[]>([]);
  const [medicineSearchText, setMedicineSearchText] = useState('');
  const [prescribedMeds, setPrescribedMeds] = useState<PrescribedItem[]>([]);
  const [prescriptionQuantity, setPrescriptionQuantity] = useState<string>('1');

  const routeReferralId = useMemo(() => parseReferralId(rawReferralId), [rawReferralId]);
  const isDetailMode = routeReferralId !== null;
  const doctorName = useMemo(() => userDisplayName(user), [user]);

  useEffect(() => {
    const fetchCampuses = async () => {
      try {
        const res = await api.get<Campus[]>('/campuses');
        setCampuses(res.data || []);
      } catch {
        /* non-fatal */
      }
    };
    void fetchCampuses();
  }, []);

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
      
      // Parse existing prescription string into structured items
      if (response.data.prescription) {
        const lines = response.data.prescription.split('\n').filter(m => m.trim() !== '');
        const parsedMeds = lines.map(line => {
          const match = line.match(/^-\s*(\d+)x\s*(.+)$/);
          if (match) {
            return { qty: parseInt(match[1], 10), name: match[2].trim(), stockId: null };
          }
          return { qty: 1, name: line.replace(/^-/, '').trim(), stockId: null };
        });
        setPrescribedMeds(parsedMeds);
      } else {
        setPrescribedMeds([]);
      }

      // 🚨 FIX: Force the use of the Doctor's campus ID to avoid 403 Forbidden errors
      const doctorCampusId = user?.campus_id;
      
      if (doctorCampusId) {
        try {
          const res = await api.get<ApiStockResponse[]>('/inventory/available', {
            params: { campus_id: Number(doctorCampusId) },
          });
          setAvailableStock(res.data || []);
        } catch (err) {
          console.error('Failed to load inventory for Doctor campus:', doctorCampusId);
        }
      }

    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load selected referral.'), 'Load Failed');
      navigate('/doctor/referrals');
    } finally {
      setLoadingDetail(false);
    }
  }, [navigate, routeReferralId, user?.campus_id]);

  useEffect(() => {
    if (isDetailMode) {
      void loadReferralDetail();
    } else {
      void loadReferrals();
    }
  }, [isDetailMode, loadReferralDetail, loadReferrals]);

  const filteredReferrals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return referrals;

    return referrals.filter((referral) => {
      const values = [
        userDisplayName(referral.consultation?.patient?.user).toLowerCase(),
        (referral.referral_reason ?? '').toLowerCase(),
        normalizeText(referral.status).toLowerCase(),
      ];
      return values.some((val) => val.includes(normalizedSearch));
    });
  }, [referrals, search]);

  const handleFilterChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setStatusFilter(event.target.value);
  };

  const handleMenuClick = (section: DoctorSection): void => {
    setActiveSection(section);
    if (section === 'dashboard') navigate('/doctor');
    else if (section === 'chat') navigate('/doctor/chat');
    else if (section === 'about') navigate('/doctor/about');
  };

  // 🚨 Updated to use the quantity and stock ID
  const handleAddMedicine = () => {
    if (!medicineSearchText.trim()) return;
    
    const qty = parseInt(prescriptionQuantity, 10) || 1;
    
    const matchedStock = availableStock.find(
      (s) => `${s.medicine?.name} (Exp: ${s.expiration_date})` === medicineSearchText || s.medicine?.name === medicineSearchText
    );

    setPrescribedMeds(prev => [
      ...prev,
      { name: medicineSearchText.trim(), qty, stockId: matchedStock ? matchedStock.id : null }
    ]);
    
    setMedicineSearchText('');
    setPrescriptionQuantity('1');
  };

  const handleRemoveMedicine = (index: number) => {
    setPrescribedMeds(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateReferral = async (action: 'in_progress' | 'complete'): Promise<void> => {
    if (!detailReferral) return;

    if (action === 'complete') {
      if (!finalDiagnosis.trim()) {
        await notifyError('Final Diagnosis is required to complete this referral.', 'Missing Details');
        return;
      }
      if (!treatmentPlan.trim()) {
        await notifyError('Treatment Plan is required to complete this referral.', 'Missing Details');
        return;
      }
      if (!doctorRemarks.trim()) {
        await notifyError("Doctor's Remark is required to complete this referral.", 'Missing Details');
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
        const prescriptionString = prescribedMeds.map(m => `- ${m.qty}x ${m.name}`).join('\n');
        
        const structuredPrescriptions = prescribedMeds
          .filter(m => m.stockId !== null)
          .map(m => ({
            medicine_id: m.stockId as number,
            quantity: m.qty,
            dosage_instructions: null
          }));

        await api.patch(`/referrals/${detailReferral.id}`, {
          action: 'complete',
          final_diagnosis: finalDiagnosis.trim(),
          treatment_plan: treatmentPlan.trim(),
          doctor_remarks: doctorRemarks.trim(),
          prescription: prescriptionString || '',
          prescriptions: structuredPrescriptions, // 🚨 SEND THE STRUCTURED ARRAY
        });

        await notifySuccess(`Referral #${detailReferral.id} completed.`, 'Referral Completed');
        navigate('/doctor/referrals');
      } catch (err) {
        await notifyError(
          getErrorMessage(err, `Failed to complete referral #${detailReferral.id}.`),
          'Update Failed'
        );
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
        setDetailReferral((prev) => (prev ? { ...prev, status: 'in_progress' } : null));
      } catch (err) {
        await notifyError(
          getErrorMessage(err, `Failed to update referral #${detailReferral.id}.`),
          'Update Failed'
        );
      } finally {
        setSaving(false);
      }
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleUpdateReferral('complete');
  };

  const canSetInProgress = detailReferral?.status === 'pending_doctor';
  const canComplete = detailReferral
    ? ['pending_doctor', 'in_progress'].includes(detailReferral.status)
    : false;
  const isCompleted = detailReferral?.status === 'completed';

  const sectionCard: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '1.5rem 1.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  return (
    <div className="nurse-dashboard-page" style={{ minHeight: '100vh', display: 'flex' }}>
      <Sidebar
        doctorName={doctorName}
        activeSection={activeSection}
        onMenuClick={handleMenuClick}
      />

      <main className="nurse-dashboard-main" style={{ flex: 1, padding: '1.75rem 2rem 2.5rem', width: '100%' }}>
        {!isDetailMode ? (
          <ReferralList
            referrals={filteredReferrals}
            loading={loading}
            search={search}
            statusFilter={statusFilter}
            onSearchChange={setSearch}
            onFilterChange={handleFilterChange}
            onSelectReferral={(id) => navigate(`/doctor/referrals/${id}`)}
          />
        ) : (
          <div style={{ width: '100%', maxWidth: '100%', padding: '0 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 650, color: '#0f172a' }}>Referral Consultation</h2>
                {detailReferral && (
                  <p className="muted" style={{ margin: '0.3rem 0 0', fontSize: '0.9rem' }}>
                    #{detailReferral.id} · {userDisplayName(detailReferral.consultation?.patient?.user)}
                  </p>
                )}
              </div>
              <button
                className="button ghost"
                onClick={() => navigate('/doctor/referrals')}
                type="button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={17} /> Back to list
              </button>
            </div>

            {loadingDetail || !detailReferral ? (
              <div style={{ ...sectionCard, textAlign: 'center', padding: '3rem' }}>
                <p className="muted" style={{ margin: 0 }}>Loading referral details…</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(450px, 1.5fr)', gap: '2rem', alignItems: 'start', width: '100%' }}>
                <NurseAssessmentCard referral={detailReferral} campuses={campuses} />

                <form style={sectionCard} onSubmit={handleFormSubmit}>
                  <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600, color: '#a3224a', borderBottom: '2px solid #fce7f3', paddingBottom: '0.65rem' }}>
                    Doctor Assessment
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <label className="field">
                      <span>Final Diagnosis *</span>
                      <input
                        type="text"
                        value={finalDiagnosis}
                        onChange={(e) => setFinalDiagnosis(e.target.value)}
                        disabled={isCompleted || saving}
                        required
                        placeholder="Enter final diagnosis..."
                      />
                    </label>

                    <label className="field">
                      <span>Treatment Plan *</span>
                      <textarea
                        rows={2}
                        value={treatmentPlan}
                        onChange={(e) => setTreatmentPlan(e.target.value)}
                        placeholder="e.g. Rest and hydration, follow up in 3 days"
                        disabled={isCompleted || saving}
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Doctor's Remark *</span>
                      <textarea
                        rows={3}
                        value={doctorRemarks}
                        onChange={(e) => setDoctorRemarks(e.target.value)}
                        placeholder="Clinical assessment, findings, and recommendations"
                        disabled={isCompleted || saving}
                        required
                      />
                    </label>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.2rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1a2332', display: 'block', marginBottom: 8 }}>
                        Prescribed Medicines
                      </span>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
                        <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                          <input
                            type="text"
                            list="doctor-medicine-options"
                            placeholder="Type to search inventory or enter custom..."
                            value={medicineSearchText}
                            onChange={(e) => setMedicineSearchText(e.target.value)}
                            disabled={isCompleted || saving}
                            style={{ width: '100%' }}
                          />
                          <datalist id="doctor-medicine-options">
                            {availableStock
                              .filter((s) => s.available_quantity > 0)
                              .map((s) => (
                                <option
                                  key={s.id}
                                  value={`${s.medicine?.name} (Exp: ${s.expiration_date})`}
                                >
                                  {s.available_quantity} left
                                </option>
                              ))}
                          </datalist>
                        </label>

                        <label className="field" style={{ width: '80px', marginBottom: 0 }}>
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={prescriptionQuantity}
                            onChange={(e) => setPrescriptionQuantity(e.target.value)}
                            disabled={isCompleted || saving}
                            style={{ width: '100%', textAlign: 'center' }}
                          />
                        </label>

                        <button
                          type="button"
                          className="button ghost"
                          onClick={handleAddMedicine}
                          disabled={isCompleted || saving || !medicineSearchText.trim()}
                          style={{ padding: '0.5rem 1rem', height: 'fit-content', marginBottom: '2px' }}
                        >
                          Add
                        </button>
                      </div>

                      {prescribedMeds.length > 0 && (
                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#1a2332', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {prescribedMeds.map((med, idx) => (
                              <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>- {med.qty}x {med.name}</span>
                                {!isCompleted && !saving && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMedicine(idx)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {(canSetInProgress || canComplete) && (
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', paddingTop: '1.35rem', borderTop: '1px solid #e2e8f0' }}>
                      {canSetInProgress && (
                        <button
                          className="button secondary"
                          onClick={() => void handleUpdateReferral('in_progress')}
                          disabled={saving}
                          type="button"
                          style={{ flex: 1 }}
                        >
                          Mark In Progress
                        </button>
                      )}
                      {canComplete && (
                        <button
                          className="button success"
                          type="submit"
                          disabled={saving}
                          style={{ flex: 1, background: '#059669', borderColor: '#059669' }}
                        >
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
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}