import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { confirmAction, notifyError, notifySuccess } from '../lib/alerts';
import { userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import { useAuth } from '../context/AuthContext';
import type { PaginatedResponse, Referral } from '../types/hsms';

import { DoctorSidebar, type DoctorSection } from '../components/doctor/DoctorSidebar';
import { ReferralList } from '../components/doctor/ReferralList';
import { NurseAssessmentCard } from '../components/doctor/NurseAssessmentCard';
import { DoctorAssessmentForm } from '../components/doctor/DoctorAssessmentForm';

interface ApiStockResponse { id: number; available_quantity: number; expiration_date: string; medicine: { name: string } }
interface Campus { id: number; name: string }
interface PrescribedItem { name: string; qty: number; stockId: number | null }

function parseReferralId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return 'N/A';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
  const [campuses, setCampuses] = useState<Campus[]>([]);

  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [doctorRemarks, setDoctorRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const [availableStock, setAvailableStock] = useState<ApiStockResponse[]>([]);
  const [medicineSearchText, setMedicineSearchText] = useState('');
  const [prescribedMeds, setPrescribedMeds] = useState<PrescribedItem[]>([]);
  const [prescriptionQuantity, setPrescriptionQuantity] = useState<string>('1');

  const routeReferralId = useMemo(() => parseReferralId(rawReferralId), [rawReferralId]);
  const isDetailMode = routeReferralId !== null;
  const doctorName = useMemo(() => userDisplayName(user), [user]);

  useEffect(() => {
    api.get<Campus[]>('/campuses').then(res => setCampuses(res.data || [])).catch(() => {});
  }, []);

  const loadReferrals = useCallback(async () => {
    if (isDetailMode) return;
    setLoading(true);
    try {
      const response = await api.get<PaginatedResponse<Referral>>('/referrals', { params: { per_page: 100, ...(statusFilter ? { status: statusFilter } : {}) } });
      setReferrals(response.data.data.filter((r) => r.status !== 'completed') || []);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load doctor referrals.'), 'Load Failed');
    } finally { setLoading(false); }
  }, [isDetailMode, statusFilter]);

  const loadReferralDetail = useCallback(async () => {
    if (!routeReferralId) { setDetailReferral(null); return; }
    setLoadingDetail(true);
    try {
      const response = await api.get<Referral>(`/referrals/${routeReferralId}`);
      setDetailReferral(response.data);
      setFinalDiagnosis(response.data.final_diagnosis ?? '');
      setTreatmentPlan(response.data.treatment_plan ?? '');
      setDoctorRemarks(response.data.doctor_remarks ?? '');
      
      if (response.data.prescription) {
        const meds = response.data.prescription.split('\n').filter(m => m.trim() !== '').map(line => {
          const match = line.match(/^-\s*(\d+)x\s*(.+)$/);
          return match ? { qty: parseInt(match[1], 10), name: match[2].trim(), stockId: null } : { qty: 1, name: line.replace(/^-/, '').trim(), stockId: null };
        });
        setPrescribedMeds(meds);
      } else { setPrescribedMeds([]); }

      const doctorCampusId = user?.campus_id;
      if (doctorCampusId) {
        try {
          const res = await api.get<ApiStockResponse[]>('/inventory/available', { params: { campus_id: Number(doctorCampusId) } });
          setAvailableStock(res.data || []);
        } catch { console.error('Failed to load inventory'); }
      }
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load selected referral.'), 'Load Failed');
      navigate('/doctor/referrals');
    } finally { setLoadingDetail(false); }
  }, [navigate, routeReferralId, user?.campus_id]);

  useEffect(() => { isDetailMode ? void loadReferralDetail() : void loadReferrals(); }, [isDetailMode, loadReferralDetail, loadReferrals]);

  const filteredReferrals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return referrals;
    return referrals.filter((r) => [userDisplayName(r.consultation?.patient?.user).toLowerCase(), (r.referral_reason ?? '').toLowerCase(), normalizeText(r.status).toLowerCase()].some(v => v.includes(normalizedSearch)));
  }, [referrals, search]);

  const handleMenuClick = (section: DoctorSection) => {
    setActiveSection(section);
    if (section === 'dashboard') navigate('/doctor');
    else if (section === 'chat') navigate('/doctor/chat');
    else if (section === 'about') navigate('/doctor/about');
  };

  const handleUpdateReferral = async (action: 'in_progress' | 'complete') => {
    if (!detailReferral) return;
    if (action === 'complete') {
      if (!finalDiagnosis.trim() || !treatmentPlan.trim() || !doctorRemarks.trim()) {
        await notifyError('Please fill in all required fields.', 'Missing Details'); return;
      }
      const confirmed = await confirmAction({ title: 'Complete this referral?', text: `Referral #${detailReferral.id} will be marked as complete.`, confirmButtonText: 'Complete Referral', cancelButtonText: 'Cancel' });
      if (!confirmed) return;
      setSaving(true);
      try {
        const prescriptionString = prescribedMeds.map(m => `- ${m.qty}x ${m.name}`).join('\n');
        const structuredPrescriptions = prescribedMeds.filter(m => m.stockId !== null).map(m => ({ medicine_id: m.stockId, quantity: m.qty, dosage_instructions: null }));
        await api.patch(`/referrals/${detailReferral.id}`, { action: 'complete', final_diagnosis: finalDiagnosis.trim(), treatment_plan: treatmentPlan.trim(), doctor_remarks: doctorRemarks.trim(), prescription: prescriptionString || '', prescriptions: structuredPrescriptions });
        await notifySuccess(`Referral #${detailReferral.id} completed.`, 'Referral Completed');
        navigate('/doctor/referrals');
      } catch (err) {
        await notifyError(getErrorMessage(err, `Failed to complete referral.`), 'Update Failed');
      } finally { setSaving(false); }
    } else {
      const confirmed = await confirmAction({ title: 'Mark in progress?', text: `Referral #${detailReferral.id} will be updated.`, confirmButtonText: 'Mark In Progress', cancelButtonText: 'Cancel' });
      if (!confirmed) return;
      setSaving(true);
      try {
        await api.patch(`/referrals/${detailReferral.id}`, { action: 'in_progress' });
        await notifySuccess(`Referral updated.`, 'Referral Updated');
        setDetailReferral((prev) => (prev ? { ...prev, status: 'in_progress' } : null));
      } catch (err) {
        await notifyError(getErrorMessage(err, `Failed to update referral.`), 'Update Failed');
      } finally { setSaving(false); }
    }
  };

  const sectionCard: React.CSSProperties = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem 1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

  return (
    <div className="nurse-dashboard-page" style={{ minHeight: '100vh', display: 'flex' }}>
      <DoctorSidebar doctorName={doctorName} activeSection={activeSection} onMenuClick={handleMenuClick} />

      <main className="nurse-dashboard-main" style={{ flex: 1, padding: '1.75rem 2rem 2.5rem', width: '100%' }}>
        {!isDetailMode ? (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 650, color: '#0f172a' }}>Referral Consultations</h2>
                <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>View and manage nurse referral consultations.</p>
              </div>
              <button
                type="button"
                className="button ghost"
                onClick={() => void loadReferrals()}
                disabled={loading}
                title="Refresh referrals"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 1rem' }}
              >
                <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: 1, minWidth: 220 }}>
                <span>Search</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient, reason, or status…" />
              </label>
              <label className="field" style={{ width: 240 }}>
                <span>Status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Active (Pending + In Progress)</option>
                  <option value="pending_doctor">Pending</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </label>
            </div>
            <ReferralList referrals={filteredReferrals} loading={loading} onSelectReferral={(id) => navigate(`/doctor/referrals/${id}`)} />
          </section>
        ) : (
          <div style={{ width: '100%', maxWidth: '100%', padding: '0 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 650, color: '#0f172a' }}>Referral Consultation</h2>
                {detailReferral && <p className="muted" style={{ margin: '0.3rem 0 0', fontSize: '0.9rem' }}>#{detailReferral.id} · {userDisplayName(detailReferral.consultation?.patient?.user)}</p>}
              </div>
              <button className="button ghost" onClick={() => navigate('/doctor/referrals')} type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={17} /> Back to list</button>
            </div>

            {loadingDetail || !detailReferral ? (
              <div style={{ ...sectionCard, textAlign: 'center', padding: '3rem' }}><p className="muted" style={{ margin: 0 }}>Loading referral details…</p></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(450px, 1.5fr)', gap: '2rem', alignItems: 'start', width: '100%' }}>
                <NurseAssessmentCard referral={detailReferral} campuses={campuses} />
                <DoctorAssessmentForm 
                  finalDiagnosis={finalDiagnosis} setFinalDiagnosis={setFinalDiagnosis}
                  treatmentPlan={treatmentPlan} setTreatmentPlan={setTreatmentPlan}
                  doctorRemarks={doctorRemarks} setDoctorRemarks={setDoctorRemarks}
                  prescribedMeds={prescribedMeds} setPrescribedMeds={setPrescribedMeds}
                  medicineSearchText={medicineSearchText} setMedicineSearchText={setMedicineSearchText}
                  prescriptionQuantity={prescriptionQuantity} setPrescriptionQuantity={setPrescriptionQuantity}
                  availableStock={availableStock}
                  isCompleted={detailReferral.status === 'completed'} saving={saving}
                  canSetInProgress={detailReferral.status === 'pending_doctor'} canComplete={['pending_doctor', 'in_progress'].includes(detailReferral.status)}
                  onSubmit={(e) => { e.preventDefault(); void handleUpdateReferral('complete'); }}
                  onMarkInProgress={() => void handleUpdateReferral('in_progress')}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}