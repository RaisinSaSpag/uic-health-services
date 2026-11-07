export function GradeSchoolForm({ form, setForm, isJHS }: { form: any; setForm: (val: any) => void; isJHS: boolean; }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
      
      <label className="field">
        <span>Grade Level *</span>
        <input required placeholder={isJHS ? "e.g. Grade 8" : "e.g. Grade 4"} value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} />
      </label>
      
      <label className="field">
        <span>Section</span>
        <input placeholder={isJHS ? "e.g. Section A" : "e.g. St. Jude"} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
      </label>

      {isJHS && (
        <>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Growth & Pubertal Disclosures</span>
            <textarea rows={2} placeholder="Optional adolescent physical changes..." value={form.special_health_concern} onChange={(e) => setForm({ ...form, special_health_concern: e.target.value })} />
          </label>
          
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.self_carry_permit} onChange={(e) => setForm({ ...form, self_carry_permit: e.target.checked })} />
              <span style={{ fontSize: '0.9rem' }}>Self-Carry Asthma / Inhaler Permit</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.extracurricular_clearance} onChange={(e) => setForm({ ...form, extracurricular_clearance: e.target.checked })} />
              <span style={{ fontSize: '0.9rem' }}>Interscholastic / Club Clearance</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.counseling_authorization} onChange={(e) => setForm({ ...form, counseling_authorization: e.target.checked })} />
              <span style={{ fontSize: '0.9rem' }}>Counseling Check-in Consent</span>
            </label>
          </div>
        </>
      )}

      {!isJHS && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          <label className="field">
            <span>Immunization Status</span>
            <select value={form.immunization_status} onChange={(e) => setForm({ ...form, immunization_status: e.target.value })}>
              <option value="">Select...</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          
          {/* FIXED CHECKBOX LAYOUT */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={form.fit_for_school} 
                onChange={(e) => setForm({ ...form, fit_for_school: e.target.checked })} 
                style={{ width: '1.2rem', height: '1.2rem' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Fit for Regular School Activities</span>
            </label>
          </div>

          <label className="field">
            <span>Special Health Concern</span>
            <textarea rows={2} value={form.special_health_concern} onChange={(e) => setForm({ ...form, special_health_concern: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}