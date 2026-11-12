interface VitalsFormProps {
  form: any;
  handleChange: (field: string, value: any) => void;
}

export function VitalsForm({ form, handleChange }: VitalsFormProps) {
  const fieldGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.25rem',
  };

  return (
    <div style={sectionCard}>
      <h3 style={sectionTitle}>Vitals & Timing</h3>
      <div style={fieldGrid}>
        <label className="field">
          <span>Date *</span>
          <input type="date" required value={form.consultationDate} onChange={(e) => handleChange('consultationDate', e.target.value)} />
        </label>
        <label className="field">
          <span>Time *</span>
          <input type="time" required value={form.consultationTime} onChange={(e) => handleChange('consultationTime', e.target.value)} />
        </label>
        <label className="field">
          <span>Blood Pressure (Optional)</span>
          <input type="text" placeholder="120/80" value={form.bloodPressure} onChange={(e) => handleChange('bloodPressure', e.target.value)} />
        </label>
        <label className="field">
          <span>Pulse (bpm) (Optional)</span>
          <input type="number" placeholder="75" value={form.pulseBpm} onChange={(e) => handleChange('pulseBpm', e.target.value)} />
        </label>
        <label className="field">
          <span>Temperature (°C) (Optional)</span>
          <input type="number" step="0.1" placeholder="36.5" value={form.temperatureC} onChange={(e) => handleChange('temperatureC', e.target.value)} />
        </label>
        <label className="field">
          <span>Weight (kg) (Optional)</span>
          <input type="number" step="0.1" placeholder="65" value={form.weightKg} onChange={(e) => handleChange('weightKg', e.target.value)} />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Last Menstrual Period (Optional)</span>
          <input type="date" value={form.lastMenstrualPeriod} onChange={(e) => handleChange('lastMenstrualPeriod', e.target.value)} />
        </label>
      </div>
    </div>
  );
}

const sectionCard: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', padding: '1.5rem 1.75rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const sectionTitle: React.CSSProperties = { margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600, color: '#1a2332', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' };
