export function GradeSchoolForm({ 
  form, 
  setForm, 
  isJHS 
}: { 
  form: any; 
  setForm: (val: any) => void; 
  isJHS: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
      
      <label className="field">
        <span>Grade Level *</span>
        <input required placeholder={isJHS ? "e.g. Grade 8" : "e.g. Grade 4"} value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} />
      </label>
      
      <label className="field">
        <span>Section (Optional)</span>
        <input placeholder={isJHS ? "e.g. Section A" : "e.g. St. Jude"} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
      </label>

      {/* JHS ONLY FIELDS */}
      {isJHS && (
        <>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Growth & Pubertal Disclosures (Optional)</span>
            <textarea rows={2} placeholder="Optional adolescent physical changes..." value={form.special_health_concern} onChange={(e) => setForm({ ...form, special_health_concern: e.target.value })} />
          </label>
          
          {/* 🚨 REMOVED: JHS checkboxes (Self-Carry, Interscholastic, Counseling) */}
        </>
      )}
    </div>
  );
}