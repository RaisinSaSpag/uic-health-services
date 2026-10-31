import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import type { Patient } from '../types/hsms';

type ConsultationTypeParam = 'walk-in' | 'scheduled';

interface ConsultationFormState {
  consultationDate: string;
  consultationTime: string;
  referredToDoctor: boolean;
  telemedLink: string;
  referralNotes: string;
  bloodPressure: string;
  pulseBpm: string;
  temperatureC: string;
  weightKg: string;
  lastMenstrualPeriod: string;
  complaints: string;
  diagnosis: string;
  remarks: string;
}

// Helper functions
const toNullableText = (v: string) => (v.trim() === '' ? null : v.trim());
const toNullableInteger = (v: string) => {
  const p = Number.parseInt(v, 10);
  return Number.isNaN(p) ? null : p;
};
const toNullableDecimal = (v: string) => {
  const p = Number.parseFloat(v);
  return Number.isNaN(p) ? null : p;
};
const getToday = () => new Date().toISOString().split('T')[0];
const getNowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function NurseConsultationFormPage() {
  const { patientId, consultationType } = useParams<{ patientId: string; consultationType: string }>();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState<ConsultationFormState>({
    consultationDate: getToday(),
    consultationTime: getNowTime(),
    referredToDoctor: false,
    telemedLink: '',
    referralNotes: '',
    bloodPressure: '',
    pulseBpm: '',
    temperatureC: '',
    weightKg: '',
    lastMenstrualPeriod: '',
    complaints: '',
    diagnosis: '',
    remarks: '',
  });

  const type = useMemo<ConsultationTypeParam>(() => {
    return consultationType === 'scheduled' ? 'scheduled' : 'walk-in';
  }, [consultationType]);

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

  useEffect(() => {
    void loadPatient();
  }, [loadPatient]);

  const handleChange = (field: keyof ConsultationFormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setSubmitting(true);

    try {
      const payload = {
        patient_id: patient.id,
        consultation_type: type === 'walk-in' ? 'walk_in' : 'scheduled',
        consultation_date: form.consultationDate,
        consultation_time: form.consultationTime,
        chief_complaint: form.complaints,
        blood_pressure: toNullableText(form.bloodPressure),
        pulse_bpm: toNullableInteger(form.pulseBpm),
        temperature_c: toNullableDecimal(form.temperatureC),
        weight_kg: toNullableDecimal(form.weightKg),
        last_menstrual_period: toNullableText(form.lastMenstrualPeriod),
        diagnosis: toNullableText(form.diagnosis),
        remarks: toNullableText(form.remarks),
        
        // Referral / Telemed
        referred_to_doctor: form.referredToDoctor,
        is_telemed: form.referredToDoctor && !!form.telemedLink.trim(),
        telemed_link: form.referredToDoctor ? toNullableText(form.telemedLink) : null,
        referral_notes: form.referredToDoctor ? toNullableText(form.referralNotes) : null,
      };

      await api.post('/consultations', payload);
      
      void notifySuccess('Consultation recorded successfully.', 'Success');
      navigate(`/nurse/patients/${patient.id}`);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to save consultation.'), 'Save Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page"><p>Loading patient details...</p></div>;
  if (!patient) return <div className="page"><p>Patient not found.</p></div>;

  return (
    <div 
      style={{ 
        backgroundImage: 'url("/login-background.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
        padding: '2rem 1rem'
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to={`/nurse/patients/${patient.id}`} className="button ghost" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.8)' }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>New Consultation</h2>
            <p style={{ margin: 0, color: '#f0f0f0', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
              Patient: {patient.user?.first_name} {patient.user?.last_name} ({patient.patient_number})
            </p>
          </div>
        </div>

        {/* FORM CONTAINER WITH FROSTED GLASS EFFECT */}
        <form 
          onSubmit={submitForm} 
          style={{ 
            background: 'rgba(255, 255, 255, 0.9)', 
            backdropFilter: 'blur(12px)', 
            borderRadius: '12px', 
            padding: '2rem', 
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)', 
            border: '1px solid rgba(255,255,255,0.5)' 
          }}
        >
          
          {/* SECTION: Date & Vitals */}
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', color: '#333' }}>Vitals & Timing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <label className="field">
              <span>Date</span>
              <input type="date" required value={form.consultationDate} onChange={(e) => handleChange('consultationDate', e.target.value)} />
            </label>
            <label className="field">
              <span>Time</span>
              <input type="time" required value={form.consultationTime} onChange={(e) => handleChange('consultationTime', e.target.value)} />
            </label>
            
            <label className="field">
              <span>Blood Pressure</span>
              <input type="text" placeholder="e.g. 120/80" value={form.bloodPressure} onChange={(e) => handleChange('bloodPressure', e.target.value)} />
            </label>
            <label className="field">
              <span>Pulse (bpm)</span>
              <input type="number" placeholder="e.g. 75" value={form.pulseBpm} onChange={(e) => handleChange('pulseBpm', e.target.value)} />
            </label>
            
            <label className="field">
              <span>Temperature (Â°C)</span>
              <input type="number" step="0.1" placeholder="e.g. 36.5" value={form.temperatureC} onChange={(e) => handleChange('temperatureC', e.target.value)} />
            </label>
            <label className="field">
              <span>Weight (kg)</span>
              <input type="number" step="0.1" placeholder="e.g. 65" value={form.weightKg} onChange={(e) => handleChange('weightKg', e.target.value)} />
            </label>
            
            <label className="field" style={{ gridColumn: 'span 2' }}>
              <span>Last Menstrual Period (Optional)</span>
              <input type="date" value={form.lastMenstrualPeriod} onChange={(e) => handleChange('lastMenstrualPeriod', e.target.value)} />
            </label>
          </div>

          {/* SECTION: Clinical Info */}
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', color: '#333' }}>Clinical Assessment</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
            <label className="field">
              <span>Chief Complaints / Symptoms *</span>
              <textarea required rows={3} value={form.complaints} onChange={(e) => handleChange('complaints', e.target.value)} placeholder="Describe the patient's symptoms..." />
            </label>
            <label className="field">
              <span>Diagnosis (Nurse)</span>
              <textarea rows={2} value={form.diagnosis} onChange={(e) => handleChange('diagnosis', e.target.value)} placeholder="Optional if referring to doctor" />
            </label>
            <label className="field">
              <span>Remarks / Treatment Plan</span>
              <textarea rows={2} value={form.remarks} onChange={(e) => handleChange('remarks', e.target.value)} placeholder="E.g., Rest, hydration, paracetamol..." />
            </label>
          </div>

          {/* SECTION: Path / Referral */}
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', color: '#333' }}>Consultation Path</h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="field">
              <span>Select Path *</span>
              <select 
                value={form.referredToDoctor ? 'referral' : 'triage'} 
                onChange={(e) => handleChange('referredToDoctor', e.target.value === 'referral')}
                style={{ fontWeight: 'bold', borderColor: '#d44974' }}
              >
                <option value="triage">Triage (Nurse handles patient in clinic)</option>
                <option value="referral">Referral (Requires Doctor / Telemed)</option>
              </select>
            </label>
          </div>

          {/* Conditional Referral Fields */}
          {form.referredToDoctor && (
            <div style={{ background: 'rgba(240, 247, 255, 0.9)', padding: '1.5rem', borderRadius: '8px', border: '1px solid #cce5ff', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <label className="field">
                <span>Google Meet Link (Optional)</span>
                <input type="url" placeholder="https://meet.google.com/..." value={form.telemedLink} onChange={(e) => handleChange('telemedLink', e.target.value)} />
              </label>
              <label className="field">
                <span>Referral Notes (Required for doctor)</span>
                <textarea rows={3} value={form.referralNotes} onChange={(e) => handleChange('referralNotes', e.target.value)} placeholder="Explain why the doctor needs to see this patient..." required={form.referredToDoctor} />
              </label>
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid #ddd', paddingTop: '1.5rem' }}>
            <button className="button" type="submit" disabled={submitting} style={{ minWidth: '150px' }}>
              {submitting ? 'Saving...' : 'Save Consultation'}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
}