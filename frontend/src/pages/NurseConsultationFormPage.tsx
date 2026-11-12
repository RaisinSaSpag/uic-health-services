import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, UserRound, Video, ClipboardList, Pill } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import { userDisplayName } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import type { Patient, UserRecord, PaginatedResponse } from '../types/hsms';

interface ConsultationFormState {
  consultationDate: string;
  consultationTime: string;
  referredToDoctor: boolean;
  telemedLink: string;
  referralNotes: string;
  referralDoctorId: string;
  bloodPressure: string;
  pulseBpm: string;
  temperatureC: string;
  weightKg: string;
  lastMenstrualPeriod: string;
  complaints: string;
  remarks: string;
  treatmentPlan: string;
}

interface ApiStockResponse {
  id: number;
  available_quantity: number;
  date_received: string;
  expiration_date: string;
  medicine: {
    name: string;
  };
}

interface AvailableStock {
  stock_in_id: number;
  medicine_name: string;
  quantity_remaining: number;
  batch_info: string;
}

interface DispensedItem {
  name: string;
  qty: number;
  stockId: number | null;
}

interface Campus {
  id: number;
  name: string;
}

const toNullableText = (v: string) => (v.trim() === '' ? null : v.trim());
const toNullableInteger = (v: string) => {
  if (!v || v.trim() === '' || v === '0') return null;
  const p = Number.parseInt(v, 10);
  return Number.isNaN(p) ? null : p;
};
const toNullableDecimal = (v: string) => {
  if (!v || v.trim() === '' || v === '0') return null;
  const p = Number.parseFloat(v);
  return Number.isNaN(p) ? null : p;
};

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const getNowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function NurseConsultationFormPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<UserRecord[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Medicine Dispensing State
  const [availableStock, setAvailableStock] = useState<AvailableStock[]>([]);
  const [medicineSearchText, setMedicineSearchText] = useState<string>('');
  const [dispenseQuantity, setDispenseQuantity] = useState<string>('1');
  const [dispensedItems, setDispensedItems] = useState<DispensedItem[]>([]);
  const [dispensingCampusId, setDispensingCampusId] = useState<string>(
    user?.campus_id ? String(user.campus_id) : ''
  );

  const [form, setForm] = useState<ConsultationFormState>({
    consultationDate: getToday(),
    consultationTime: getNowTime(),
    referredToDoctor: false,
    telemedLink: '',
    referralNotes: '',
    referralDoctorId: '',
    bloodPressure: '',
    pulseBpm: '',
    temperatureC: '',
    weightKg: '',
    lastMenstrualPeriod: '',
    complaints: '',
    remarks: '',
    treatmentPlan: '',
  });

  const loadPatient = useCallback(async () => {
    if (!patientId) return;
    try {
      const res = await api.get<Patient>(`/patients/${patientId}`);
      setPatient(res.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load patient.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const loadDoctors = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<UserRecord>>('/doctors', { params: { per_page: 100 } });
      setDoctors(res.data.data);
    } catch {
      // Non-fatal
    }
  }, []);

  const loadCampuses = useCallback(async () => {
    try {
      const res = await api.get<Campus[]>('/campuses');
      setCampuses(res.data);
    } catch {
      // Non-fatal
    }
  }, []);

  const loadMedicines = useCallback(async () => {
    if (!dispensingCampusId) return;

    try {
      const res = await api.get<ApiStockResponse[]>('/inventory/available', { 
        params: { campus_id: Number(dispensingCampusId) } 
      });
      
      const mappedStock: AvailableStock[] = res.data.map((item) => ({
        stock_in_id: item.id,
        medicine_name: item.medicine?.name || 'Unknown Medicine',
        quantity_remaining: item.available_quantity,
        batch_info: item.expiration_date ? `Exp: ${item.expiration_date}` : 'No expiry',
      }));

      setAvailableStock(mappedStock);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load medicines.'), 'Inventory Error');
    }
  }, [dispensingCampusId]);

  useEffect(() => {
    void loadPatient();
    void loadDoctors();
    void loadCampuses();
  }, [loadPatient, loadDoctors, loadCampuses]);

  useEffect(() => {
    void loadMedicines();
  }, [loadMedicines]);

  const handleChange = (field: keyof ConsultationFormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleReferralToggle = (referred: boolean) => {
    setForm((prev) => ({ ...prev, referredToDoctor: referred }));
  };

  const handleAddMedicine = () => {
    const name = medicineSearchText.trim();
    if (!name) {
      void notifyError('Please enter a medicine name.', 'Invalid Medicine');
      return;
    }

    const qty = parseInt(dispenseQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      void notifyError('Please enter a valid quantity.', 'Invalid Quantity');
      return;
    }

    const matchedStock = availableStock.find(
      (s) => `${s.medicine_name} (${s.batch_info})` === name || s.medicine_name === name
    );

    if (matchedStock) {
      if (qty > matchedStock.quantity_remaining) {
        void notifyError(`Only ${matchedStock.quantity_remaining} left in stock for this batch.`, 'Insufficient Stock');
        return;
      }
      
      setAvailableStock((prev) =>
        prev.map((s) =>
          s.stock_in_id === matchedStock.stock_in_id
            ? { ...s, quantity_remaining: s.quantity_remaining - qty }
            : s
        )
      );
      
      setDispensedItems((prev) => [
        ...prev,
        { name: matchedStock.medicine_name, qty, stockId: matchedStock.stock_in_id }
      ]);
    } else {
      setDispensedItems((prev) => [
        ...prev,
        { name, qty, stockId: null }
      ]);
    }

    setMedicineSearchText('');
    setDispenseQuantity('1');
  };

  const handleRemoveMedicine = (index: number) => {
    const itemToRemove = dispensedItems[index];
    
    if (itemToRemove.stockId) {
      setAvailableStock((prev) =>
        prev.map((s) =>
          s.stock_in_id === itemToRemove.stockId
            ? { ...s, quantity_remaining: s.quantity_remaining + itemToRemove.qty }
            : s
        )
      );
    }
    
    setDispensedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!patient) return;

    if (form.referredToDoctor && !form.referralDoctorId) {
      void notifyError('Please select a doctor for the referral.', 'Missing Doctor');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        patient_id: patient.id,
        consultation_type: form.referredToDoctor ? 'telemed' : 'walk_in',
        consultation_date: form.consultationDate,
        consultation_time: form.consultationTime,
        chief_complaint: form.complaints,
        blood_pressure: toNullableText(form.bloodPressure),
        pulse_bpm: toNullableInteger(form.pulseBpm),
        temperature_c: toNullableDecimal(form.temperatureC),
        weight_kg: toNullableDecimal(form.weightKg),
        last_menstrual_period: toNullableText(form.lastMenstrualPeriod),
        remarks: toNullableText(form.remarks),
        treatment_plan: toNullableText(form.treatmentPlan),
        referred_to_doctor: form.referredToDoctor,
        is_telemed: form.referredToDoctor && !!form.telemedLink.trim(),
        telemed_link: form.referredToDoctor ? toNullableText(form.telemedLink) : null,
        referral_notes: form.referredToDoctor ? toNullableText(form.referralNotes) : null,
      };

      const consultRes = await api.post('/consultations', payload);
      const consultationId = consultRes.data.id;

      if (form.referredToDoctor && form.referralDoctorId) {
        try {
          await api.post('/referrals', {
            consultation_id: consultationId,
            doctor_id: Number(form.referralDoctorId),
            referral_reason: form.remarks || form.referralNotes || 'Nurse requested doctor assessment.',
          });
        } catch (referralErr) {
          try {
            await api.patch(`/consultations/${consultationId}`, { action: 'cancel' });
          } catch {}
          throw new Error('Consultation was recorded but the referral could not be created.');
        }
      }

      for (const item of dispensedItems) {
        if (item.stockId) {
          await api.post('/inventory/dispense', {
            stock_in_id: item.stockId,
            quantity_dispensed: item.qty,
          });
        }
      }

      if (dispensedItems.some((i) => !i.stockId)) {
        const customMeds = dispensedItems.filter((i) => !i.stockId).map((i) => `${i.qty}x ${i.name}`).join(', ');
        console.log('Custom medicines dispensed (not deducted from inventory):', customMeds);
      }

      void notifySuccess(
        form.referredToDoctor
          ? 'Consultation recorded and referral sent to doctor.'
          : 'Consultation recorded successfully.',
        'Success'
      );
      navigate(`/nurse/patients/${patient.id}`);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to save consultation.'), 'Save Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ maxWidth: 880, margin: '3rem auto', textAlign: 'center' }}>
        <p className="muted">Loading patient details…</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="page" style={{ maxWidth: 880, margin: '3rem auto', textAlign: 'center' }}>
        <p>Patient not found.</p>
        <Link to="/nurse/records/student" className="button ghost" style={{ marginTop: '1rem' }}>
          Back to records
        </Link>
      </div>
    );
  }

  const sectionCard: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e8ecf1',
    padding: '1.5rem 1.75rem',
    marginBottom: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const sectionTitle: React.CSSProperties = {
    margin: '0 0 1.25rem',
    fontSize: '1.05rem',
    fontWeight: 600,
    color: '#1a2332',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '0.75rem',
  };

  const fieldGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.25rem',
  };

  return (
    <div className="page" style={{ maxWidth: 880, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        <Link
          to={`/nurse/patients/${patient.id}`}
          className="button ghost"
          style={{ padding: '0.5rem', borderRadius: 8, flexShrink: 0 }}
          title="Back to patient"
        >
          <ArrowLeft size={20} />
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 650, color: '#111827' }}>
              New Consultation
            </h2>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: form.referredToDoctor ? '#e0f2fe' : '#fdf2f4',
                color: form.referredToDoctor ? '#0369a1' : '#a3224a',
                padding: '0.2rem 0.55rem',
                borderRadius: 6,
              }}
            >
              {form.referredToDoctor ? 'Telemed' : 'Walk-In'}
            </span>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
            {patient.user?.first_name} {patient.user?.last_name}
            <span style={{ margin: '0 0.4rem', opacity: 0.5 }}>·</span>
            <span style={{ fontFamily: 'monospace' }}>{patient.patient_number}</span>
          </p>
        </div>
      </div>

      <form onSubmit={submitForm}>
        <div style={sectionCard}>
          <h3 style={sectionTitle}>
            <ClipboardList size={18} strokeWidth={2} color="#a3224a" />
            Vitals & Timing
          </h3>
          <div style={fieldGrid}>
            <label className="field">
              <span>Date *</span>
              <input
                type="date"
                required
                value={form.consultationDate}
                onChange={(e) => handleChange('consultationDate', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Time *</span>
              <input
                type="time"
                required
                value={form.consultationTime}
                onChange={(e) => handleChange('consultationTime', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Blood Pressure (Optional)</span>
              <input
                type="text"
                placeholder="120/80"
                value={form.bloodPressure}
                onChange={(e) => handleChange('bloodPressure', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Pulse (bpm) (Optional)</span>
              <input
                type="number"
                placeholder="75"
                value={form.pulseBpm}
                onChange={(e) => handleChange('pulseBpm', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Temperature (°C) (Optional)</span>
              <input
                type="number"
                step="0.1"
                placeholder="36.5"
                value={form.temperatureC}
                onChange={(e) => handleChange('temperatureC', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Weight (kg) (Optional)</span>
              <input
                type="number"
                step="0.1"
                placeholder="65"
                value={form.weightKg}
                onChange={(e) => handleChange('weightKg', e.target.value)}
              />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Last Menstrual Period (Optional)</span>
              <input
                type="date"
                value={form.lastMenstrualPeriod}
                onChange={(e) => handleChange('lastMenstrualPeriod', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div style={sectionCard}>
          <h3 style={sectionTitle}>
            <Stethoscope size={18} strokeWidth={2} color="#a3224a" />
            Clinical Assessment
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label className="field">
              <span>Chief Complaints / Symptoms *</span>
              <textarea
                required
                rows={3}
                value={form.complaints}
                onChange={(e) => handleChange('complaints', e.target.value)}
                placeholder="Describe the patient's main symptoms…"
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <label className="field">
                <span>
                  Nurse's Remark
                  {form.referredToDoctor && ' *'}
                </span>
                <textarea
                  rows={3}
                  required={form.referredToDoctor}
                  value={form.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder={
                    form.referredToDoctor
                      ? 'Explain why the doctor needs to see this patient'
                      : 'Enter nurse remarks here...'
                  }
                />
              </label>

              <label className="field">
                <span>
                  {form.referredToDoctor ? 'Interim Care / Advice' : 'Treatment Plan'}
                </span>
                <textarea
                  rows={3}
                  value={form.treatmentPlan}
                  onChange={(e) => handleChange('treatmentPlan', e.target.value)}
                  placeholder={
                    form.referredToDoctor
                      ? 'e.g. Advised to rest and hydrate while waiting for the doctor…'
                      : 'e.g. Rest, hydration, paracetamol…'
                  }
                />
              </label>
            </div>
          </div>
        </div>

        <div style={sectionCard}>
          <h3 style={sectionTitle}>
            <Pill size={18} strokeWidth={2} color="#a3224a" />
            Dispense Medicine
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <label className="field" style={{ marginBottom: '0.5rem' }}>
              <span>Dispensing Campus (Inventory Source)</span>
              <select
                value={dispensingCampusId}
                onChange={(e) => {
                  setDispensingCampusId(e.target.value);
                  setDispensedItems([]);
                  setMedicineSearchText('');
                }}
                style={{ maxWidth: '300px' }}
              >
                <option value="">— Select Campus —</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Medicine Name (Type to search inventory, or enter custom)</span>
                <input
                  type="text"
                  list="medicine-options"
                  placeholder="e.g. Paracetamol (or custom medicine)"
                  value={medicineSearchText}
                  onChange={(e) => setMedicineSearchText(e.target.value)}
                  disabled={!dispensingCampusId}
                />
                <datalist id="medicine-options">
                  {availableStock
                    .filter((s) => s.quantity_remaining > 0)
                    .map((s) => (
                      <option 
                        key={s.stock_in_id} 
                        value={`${s.medicine_name} (${s.batch_info})`}
                      >
                        {s.quantity_remaining} left
                      </option>
                    ))}
                </datalist>
              </label>
              <label className="field" style={{ width: '120px' }}>
                <span>Qty</span>
                <input
                  type="number"
                  min="1"
                  value={dispenseQuantity}
                  onChange={(e) => setDispenseQuantity(e.target.value)}
                  disabled={!dispensingCampusId}
                />
              </label>
              <button
                type="button"
                className="button ghost"
                onClick={handleAddMedicine}
                disabled={!medicineSearchText.trim() || parseInt(dispenseQuantity, 10) <= 0}
                style={{ padding: '0.75rem 1.5rem', marginBottom: '2px' }}
              >
                Add
              </button>
            </div>

            {dispensedItems.length > 0 && (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.9rem', color: '#475569' }}>Medicines to Dispense:</strong>
                <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', color: '#1a2332', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {dispensedItems.map((item, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '400px' }}>
                      <span>
                        {item.qty}x {item.name}
                        {!item.stockId && <span style={{ color: '#a3224a', fontSize: '0.75rem', marginLeft: '0.5rem' }}>(Not in inventory)</span>}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveMedicine(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div style={sectionCard}>
          <h3 style={sectionTitle}>
            <UserRound size={18} strokeWidth={2} color="#a3224a" />
            Consultation Path
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginBottom: form.referredToDoctor ? '1.5rem' : 0,
            }}
          >
            <button
              type="button"
              onClick={() => handleReferralToggle(false)}
              style={{
                textAlign: 'left',
                padding: '1rem 1.1rem',
                borderRadius: 10,
                border: form.referredToDoctor ? '1.5px solid #e2e8f0' : '1.5px solid #a3224a',
                background: form.referredToDoctor ? '#f8fafc' : '#fdf2f4',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontWeight: 600, color: form.referredToDoctor ? '#475569' : '#a3224a', marginBottom: 4 }}>
                Walk-in
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                Nurse handles the patient in clinic
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleReferralToggle(true)}
              style={{
                textAlign: 'left',
                padding: '1rem 1.1rem',
                borderRadius: 10,
                border: form.referredToDoctor ? '1.5px solid #a3224a' : '1.5px solid #e2e8f0',
                background: form.referredToDoctor ? '#fdf2f4' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontWeight: 600, color: form.referredToDoctor ? '#a3224a' : '#475569', marginBottom: 4 }}>
                Telemed
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                Requires doctor assessment
              </div>
            </button>
          </div>

          {form.referredToDoctor && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '1.35rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <label className="field">
                <span>Assign Doctor *</span>
                <select
                  required
                  value={form.referralDoctorId}
                  onChange={(e) => handleChange('referralDoctorId', e.target.value)}
                >
                  <option value="">— Select a doctor —</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {userDisplayName(doc)}
                    </option>
                  ))}
                </select>
              </label>

              {doctors.length === 0 && (
                <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                  No doctors available. Please contact the coordinator.
                </p>
              )}

              <label className="field">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Video size={14} color="#a3224a" />
                  Google Meet Link <span className="muted" style={{ fontWeight: 400 }}>(Optional)</span>
                </span>
                <input
                  type="url"
                  placeholder="https://meet.google.com/…"
                  value={form.telemedLink}
                  onChange={(e) => handleChange('telemedLink', e.target.value)}
                />
              </label>

              <label className="field">
                <span>
                  Referral Notes <span className="muted" style={{ fontWeight: 400 }}>(Optional)</span>
                </span>
                <textarea
                  rows={3}
                  value={form.referralNotes}
                  onChange={(e) => handleChange('referralNotes', e.target.value)}
                  placeholder="Extra context for the doctor…"
                />
              </label>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '0.5rem',
            paddingTop: '0.5rem',
          }}
        >
          <Link
            to={`/nurse/patients/${patient.id}`}
            className="button ghost"
            style={{ minWidth: 100 }}
          >
            Cancel
          </Link>
          <button
            className="button"
            type="submit"
            disabled={submitting}
            style={{ minWidth: 160, background: '#a3224a', borderColor: '#a3224a', color: '#fff' }}
          >
            {submitting ? 'Saving…' : 'Save Consultation'}
          </button>
        </div>
      </form>
    </div>
  );
}