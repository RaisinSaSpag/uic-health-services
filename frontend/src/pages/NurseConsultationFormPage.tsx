import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import { useAuth } from '../context/AuthContext';
import type { Patient, UserRecord, PaginatedResponse } from '../types/hsms';

import { VitalsForm } from '../components/consultation/VitalsForm';
import { ClinicalAssessment } from '../components/consultation/ClinicalAssessment';
import { MedicineDispenser } from '../components/consultation/MedicineDispenser';
import { ConsultationPath } from '../components/consultation/ConsultationPath';

const toNullableText = (v: string) => (v.trim() === '' ? null : v.trim());
const toNullableInteger = (v: string) => { if (!v || v.trim() === '' || v === '0') return null; const p = parseInt(v, 10); return isNaN(p) ? null : p; };
const toNullableDecimal = (v: string) => { if (!v || v.trim() === '' || v === '0') return null; const p = parseFloat(v); return isNaN(p) ? null : p; };
const getToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const getNowTime = () => { const d = new Date(); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

export function NurseConsultationFormPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<UserRecord[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [availableStock, setAvailableStock] = useState<any[]>([]);
  const [medicineSearchText, setMedicineSearchText] = useState('');
  const [dispenseQuantity, setDispenseQuantity] = useState('1');
  const [dispensedItems, setDispensedItems] = useState<any[]>([]);
  const [dispensingCampusId, setDispensingCampusId] = useState(user?.campus_id ? String(user.campus_id) : '');

  const [form, setForm] = useState({
    consultationDate: getToday(), consultationTime: getNowTime(), referredToDoctor: false,
    telemedLink: '', referralNotes: '', referralDoctorId: '', bloodPressure: '', pulseBpm: '', temperatureC: '',
    weightKg: '', lastMenstrualPeriod: '', complaints: '', remarks: '', treatmentPlan: '',
  });

  const loadPatient = useCallback(async () => {
    if (!patientId) return;
    try { const res = await api.get<Patient>(`/patients/${patientId}`); setPatient(res.data); }
    catch (err) { void notifyError(getErrorMessage(err, 'Unable to load patient.'), 'Load Failed'); }
    finally { setLoading(false); }
  }, [patientId]);

  const loadDoctors = useCallback(async () => {
    try { const res = await api.get<PaginatedResponse<UserRecord>>('/doctors', { params: { per_page: 100 } }); setDoctors(res.data.data); } catch {}
  }, []);

  const loadCampuses = useCallback(async () => {
    try { const res = await api.get<any[]>('/campuses'); setCampuses(res.data); } catch {}
  }, []);

  const loadMedicines = useCallback(async () => {
    if (!dispensingCampusId) return;
    try {
      const res = await api.get<any[]>('/inventory/available', { params: { campus_id: Number(dispensingCampusId) } });
      setAvailableStock(res.data.map(item => ({ stock_in_id: item.id, medicine_name: item.medicine?.name || 'Unknown', quantity_remaining: item.available_quantity, batch_info: item.expiration_date ? `Exp: ${item.expiration_date}` : 'No expiry' })));
    } catch (err) { void notifyError(getErrorMessage(err, 'Unable to load medicines.'), 'Inventory Error'); }
  }, [dispensingCampusId]);

  useEffect(() => { void loadPatient(); void loadDoctors(); void loadCampuses(); }, [loadPatient, loadDoctors, loadCampuses]);
  useEffect(() => { void loadMedicines(); }, [loadMedicines]);

  const handleChange = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));
  const handleReferralToggle = (v: boolean) => setForm((prev) => ({ ...prev, referredToDoctor: v }));

  const handleAddMedicine = () => {
    const name = medicineSearchText.trim();
    if (!name) return;
    const qty = parseInt(dispenseQuantity, 10);
    if (isNaN(qty) || qty <= 0) return;
    const matched = availableStock.find(s => `${s.medicine_name} (${s.batch_info})` === name || s.medicine_name === name);
    if (matched) {
      if (qty > matched.quantity_remaining) { void notifyError('Not enough stock.', 'Error'); return; }
      setAvailableStock(prev => prev.map(s => s.stock_in_id === matched.stock_in_id ? { ...s, quantity_remaining: s.quantity_remaining - qty } : s));
      setDispensedItems(prev => [...prev, { name: matched.medicine_name, qty, stockId: matched.stock_in_id }]);
    } else { setDispensedItems(prev => [...prev, { name, qty, stockId: null }]); }
    setMedicineSearchText(''); setDispenseQuantity('1');
  };

  const handleRemoveMedicine = (index: number) => {
    const item = dispensedItems[index];
    if (item.stockId) setAvailableStock(prev => prev.map(s => s.stock_in_id === item.stockId ? { ...s, quantity_remaining: s.quantity_remaining + item.qty } : s));
    setDispensedItems(prev => prev.filter((_, i) => i !== index));
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    if (form.referredToDoctor && !form.referralDoctorId) { void notifyError('Select a doctor.', 'Error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        patient_id: patient.id, consultation_type: form.referredToDoctor ? 'telemed' : 'walk_in',
        consultation_date: form.consultationDate, consultation_time: form.consultationTime,
        chief_complaint: form.complaints, blood_pressure: toNullableText(form.bloodPressure),
        pulse_bpm: toNullableInteger(form.pulseBpm), temperature_c: toNullableDecimal(form.temperatureC),
        weight_kg: toNullableDecimal(form.weightKg), last_menstrual_period: toNullableText(form.lastMenstrualPeriod),
        remarks: toNullableText(form.remarks), treatment_plan: toNullableText(form.treatmentPlan),
        referred_to_doctor: form.referredToDoctor, is_telemed: form.referredToDoctor && !!form.telemedLink.trim(),
        telemed_link: form.referredToDoctor ? toNullableText(form.telemedLink) : null,
        referral_notes: form.referredToDoctor ? toNullableText(form.referralNotes) : null,
      };
      const consultRes = await api.post('/consultations', payload);
      
      if (form.referredToDoctor && form.referralDoctorId) {
        await api.post('/referrals', { consultation_id: consultRes.data.id, doctor_id: Number(form.referralDoctorId), referral_reason: form.remarks || form.referralNotes || 'Nurse requested doctor assessment.' });
      }
      for (const item of dispensedItems) {
        if (item.stockId) await api.post('/inventory/dispense', { stock_in_id: item.stockId, quantity_dispensed: item.qty });
      }
      void notifySuccess('Consultation saved.', 'Success');
      navigate(`/nurse/patients/${patient.id}`);
    } catch (err) { void notifyError(getErrorMessage(err, 'Unable to save consultation.'), 'Save Failed'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="page" style={{ textAlign: 'center', marginTop: '3rem' }}><p>Loading...</p></div>;
  if (!patient) return <div className="page" style={{ textAlign: 'center', marginTop: '3rem' }}><p>Patient not found.</p></div>;

  return (
    <div className="page" style={{ maxWidth: 880, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to={`/nurse/patients/${patient.id}`} className="button ghost" style={{ padding: '0.5rem', borderRadius: 8 }}><ArrowLeft size={20} /></Link>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 650 }}>New Consultation</h2>
          <p style={{ margin: 0, color: '#64748b' }}>{patient.user?.first_name} {patient.user?.last_name} · {patient.patient_number}</p>
        </div>
      </div>

      <form onSubmit={submitForm}>
        <VitalsForm form={form} handleChange={handleChange} />
        <ClinicalAssessment form={form} handleChange={handleChange} />
        <MedicineDispenser 
          campuses={campuses} dispensingCampusId={dispensingCampusId} setDispensingCampusId={setDispensingCampusId}
          availableStock={availableStock} medicineSearchText={medicineSearchText} setMedicineSearchText={setMedicineSearchText}
          dispenseQuantity={dispenseQuantity} setDispenseQuantity={setDispenseQuantity}
          dispensedItems={dispensedItems} handleAddMedicine={handleAddMedicine} handleRemoveMedicine={handleRemoveMedicine}
        />
        <ConsultationPath form={form} doctors={doctors} handleReferralToggle={handleReferralToggle} handleChange={handleChange} />
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <Link to={`/nurse/patients/${patient.id}`} className="button ghost">Cancel</Link>
          <button type="submit" className="button" disabled={submitting} style={{ background: '#a3224a', color: '#fff' }}>{submitting ? 'Saving…' : 'Save Consultation'}</button>
        </div>
      </form>
    </div>
  );
}
