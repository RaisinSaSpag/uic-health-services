interface ClinicalAssessmentProps {
  form: any;
  handleChange: (field: string, value: any) => void;
}

export function ClinicalAssessment({ form, handleChange }: ClinicalAssessmentProps) {
  return (
    <div style={sectionCard}>
      <h3 style={sectionTitle}>Clinical Assessment</h3>
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
            <span>{form.referredToDoctor ? 'Interim Care / Advice' : 'Treatment Plan'}</span>
            <textarea
              rows={3}
              value={form.treatmentPlan}
              onChange={(e) => handleChange('treatmentPlan', e.target.value)}
              placeholder={
                form.referredToDoctor
                  ? 'e.g. Advised to rest...'
                  : 'e.g. Rest, hydration...'
              }
            />
          </label>
        </div>
      </div>
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
  borderBottom: '1px solid #f1f5f9',
  paddingBottom: '0.75rem',
};