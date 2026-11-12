import { User, MapPin, Video } from 'lucide-react';
import { userDisplayName } from '../../lib/format';
import type { Referral } from '../../types/hsms';

function calculateAge(birthDate: string | null | undefined): string {
  if (!birthDate) return 'N/A';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} years old`;
}

function normalizeVital(value: string | number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  return suffix ? `${value} ${suffix}` : String(value);
}

interface Props {
  referral: Referral;
  campuses: { id: number; name: string }[];
}

export function NurseAssessmentCard({ referral, campuses }: Props) {
  const consultation = referral.consultation;
  const patient = consultation?.patient;
  const patientName = userDisplayName(patient?.user);

  const age = calculateAge(patient?.birth_date);
  const homeCampus = patient?.campus?.name || campuses.find(c => c.id === patient?.campus_id)?.name || 'N/A';
  const walkInCampus = consultation?.campus?.name || campuses.find(c => c.id === consultation?.campus_id)?.name || 'N/A';

  const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
  const valueStyle: React.CSSProperties = { margin: 0, fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.45 };

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem 1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600, color: '#a3224a', borderBottom: '2px solid #fce7f3', paddingBottom: '0.65rem' }}>
        Nurse Assessment
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} color="#a3224a" />
            <div><span style={labelStyle}>Patient</span><p style={{ margin: 0, fontWeight: 600 }}>{patientName}</p></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16 }} />
            <div><span style={labelStyle}>Age</span><p style={{ margin: 0 }}>{age}</p></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color="#a3224a" />
            <div><span style={labelStyle}>Home Campus</span><p style={{ margin: 0 }}>{homeCampus}</p></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color="#059669" />
            <div><span style={labelStyle}>Walk-in Campus</span><p style={{ margin: 0 }}>{walkInCampus}</p></div>
          </div>
        </div>

        <div><span style={labelStyle}>Consultation Type</span><p style={valueStyle}>{consultation?.consultation_type}</p></div>
        <div><span style={labelStyle}>Chief Complaint</span><p style={{ ...valueStyle, background: '#f8fafc', padding: '0.7rem', borderRadius: 8 }}>{consultation?.chief_complaint ?? 'N/A'}</p></div>
        <div><span style={labelStyle}>Nurse Remarks</span><p style={valueStyle}>{consultation?.remarks ?? 'N/A'}</p></div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <span style={{ ...labelStyle, marginBottom: 8 }}>Vitals</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem', fontSize: '0.9rem' }}>
            <div><span className="muted">BP</span><div style={{ fontWeight: 500 }}>{normalizeVital(consultation?.blood_pressure)}</div></div>
            <div><span className="muted">Pulse</span><div style={{ fontWeight: 500 }}>{normalizeVital(consultation?.pulse_bpm, 'bpm')}</div></div>
            <div><span className="muted">Temp</span><div style={{ fontWeight: 500 }}>{normalizeVital(consultation?.temperature_c, '°C')}</div></div>
            <div><span className="muted">Weight</span><div style={{ fontWeight: 500 }}>{normalizeVital(consultation?.weight_kg, 'kg')}</div></div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <span style={labelStyle}>Referral Reason</span>
          <p style={{ ...valueStyle, color: '#b91c1c', fontWeight: 500 }}>{referral.referral_reason || 'N/A'}</p>
        </div>

        {consultation?.is_telemed && consultation?.telemed_link && (
          <div style={{ padding: '1rem', background: '#fdf2f8', borderRadius: 10, border: '1px solid #fbcfe8' }}>
            <span style={{ ...labelStyle, color: '#a3224a' }}>Telemed Consultation</span>
            <a href={consultation.telemed_link} target="_blank" rel="noopener noreferrer" className="button primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '0.45rem 0.9rem', fontSize: '0.875rem' }}>
              <Video size={15} /> Join Video Call
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
