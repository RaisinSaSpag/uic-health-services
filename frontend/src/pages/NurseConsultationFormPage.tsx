import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, UserRound, Video, ClipboardList } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import { userDisplayName } from '../lib/format';
import type { Patient, UserRecord, PaginatedResponse } from '../types/hsms';

type ConsultationTypeParam = 'walk-in' | 'scheduled';

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
  diagnosis: string;
  remarks: string;
}

// 🚨 UPDATED HELPERS: Treat blank or "0" as null so the backend accepts it
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
const getToday = () => new Date().toISOString().split('T')[0];
const getNowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function NurseConsultationFormPage() {
  const { patientId, consultationType } = useParams<{ patientId: string; consultationType: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const loadDoctors = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<UserRecord>>('/doctors', { params: { per_page: 100 } });
      setDoctors(res.data.data);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void loadPatient();
    void loadDoctors();
  }, [loadPatient, loadDoctors]);

  const handleChange = (field: keyof ConsultationFormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        referred_to_doctor: form.referredToDoctor,
        is_telemed: form.referredToDoctor && !!form.telemedLink.trim(),
        telemed_link: form.referredToDoctor ? toNullableText(form.telemedLink) : null,
        referral_notes: form.referredToDoctor ? toNullableText(form.referralNotes) : null,
      };

      const consultRes = await api.post('/consultations', payload);
      const consultationId = consultRes.data.id;

      if (form.referredToDoctor && form.referralDoctorId) {
        await api.post('/referrals', {
          consultation_id: consultationId,
          doctor_id: Number(form.referralDoctorId),
          referral_reason: form.remarks || form.referralNotes || 'Nurse requested doctor assessment.',
        });
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
        <Link to="/nurse/patients" className="button ghost" style={{ marginTop: '1rem' }}>
          Back to patients
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
      {/* Header */}
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
                background: type === 'scheduled' ? '#e0f2fe' : '#fdf2f4',
                color: type === 'scheduled' ? '#0369a1' : '#a3224a',
                padding: '0.2rem 0.55rem',
                borderRadius: 6,
              }}
            >
              {type === 'scheduled' ? 'Scheduled' : 'Walk-in'}
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
        {/* Vitals & Timing */}
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

        {/* Clinical Assessment */}
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
            <label className="field">
              <span>
                Diagnosis (Nurse)
                {!form.referredToDoctor && ' *'}
              </span>
              <textarea
                rows={2}
                required={!form.referredToDoctor}
                value={form.diagnosis}
                onChange={(e) => handleChange('diagnosis', e.target.value)}
                placeholder={
                  form.referredToDoctor
                    ? 'Optional — doctor will provide the diagnosis'
                    : 'Required for triage-only visits'
                }
              />
            </label>
            <label className="field">
              <span>
                Remarks / Treatment Plan
                {form.referredToDoctor && ' *'}
              </span>
              <textarea
                rows={2}
                required={form.referredToDoctor}
                value={form.remarks}
                onChange={(e) => handleChange('remarks', e.target.value)}
                placeholder={
                  form.referredToDoctor
                    ? 'Explain why the doctor needs to see this patient'
                    : 'e.g. Rest, hydration, paracetamol…'
                }
              />
            </label>
          </div>
        </div>

        {/* Consultation Path */}
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
              onClick={() => handleChange('referredToDoctor', false)}
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
                Triage only
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                Nurse handles the patient in clinic
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleChange('referredToDoctor', true)}
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
                Refer to doctor
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                Requires doctor assessment or telemed
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

        {/* Actions */}
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