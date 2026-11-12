import { Video } from 'lucide-react';
import { userDisplayName } from '../../lib/format';

interface ConsultationPathProps {
  form: any;
  doctors: any[];
  handleReferralToggle: (v: boolean) => void;
  handleChange: (field: string, value: any) => void;
}

export function ConsultationPath({ form, doctors, handleReferralToggle, handleChange }: ConsultationPathProps) {
  return (
    <div style={sectionCard}>
      <h3 style={sectionTitle}>Consultation Path</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: form.referredToDoctor ? '1.5rem' : 0 }}>
        <button type="button" onClick={() => handleReferralToggle(false)} style={{ textAlign: 'left', padding: '1rem', borderRadius: 10, border: form.referredToDoctor ? '1.5px solid #e2e8f0' : '1.5px solid #a3224a', background: form.referredToDoctor ? '#f8fafc' : '#fdf2f4', cursor: 'pointer' }}>
          <div style={{ fontWeight: 600, color: form.referredToDoctor ? '#475569' : '#a3224a' }}>Walk-in</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Nurse handles the patient in clinic</div>
        </button>
        <button type="button" onClick={() => handleReferralToggle(true)} style={{ textAlign: 'left', padding: '1rem', borderRadius: 10, border: form.referredToDoctor ? '1.5px solid #a3224a' : '1.5px solid #e2e8f0', background: form.referredToDoctor ? '#fdf2f4' : '#f8fafc', cursor: 'pointer' }}>
          <div style={{ fontWeight: 600, color: form.referredToDoctor ? '#a3224a' : '#475569' }}>Telemed</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Requires doctor assessment</div>
        </button>
      </div>

      {form.referredToDoctor && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <label className="field">
            <span>Assign Doctor *</span>
            <select required value={form.referralDoctorId} onChange={(e) => handleChange('referralDoctorId', e.target.value)}>
              <option value="">— Select a doctor —</option>
              {doctors.map((doc) => <option key={doc.id} value={doc.id}>Dr. {userDisplayName(doc)}</option>)}
            </select>
          </label>
          <label className="field">
            <span><Video size={14} /> Google Meet Link (Optional)</span>
            <input type="url" placeholder="https://meet.google.com/…" value={form.telemedLink} onChange={(e) => handleChange('telemedLink', e.target.value)} />
          </label>
          <label className="field">
            <span>Referral Notes (Optional)</span>
            <textarea rows={3} value={form.referralNotes} onChange={(e) => handleChange('referralNotes', e.target.value)} placeholder="Extra context for the doctor…" />
          </label>
        </div>
      )}
    </div>
  );
}

const sectionCard: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', padding: '1.5rem 1.75rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const sectionTitle: React.CSSProperties = { margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600, color: '#1a2332', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' };
