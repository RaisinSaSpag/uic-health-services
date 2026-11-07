export function HighSchoolCollegeForm({ form, setForm, category }: { form: any; setForm: (val: any) => void; category: string; }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
      {category === 'senior_high_school' && (
        <>
          <label className="field"><span>Track / Strand *</span><input required placeholder="e.g. STEM / ABM" value={form.course_program} onChange={(e) => setForm({ ...form, course_program: e.target.value })} /></label>
          <label className="field"><span>Grade Level *</span><input required placeholder="Grade 11 or 12" value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} /></label>
          <label className="field"><span>Section</span><input placeholder="e.g. St. Lorenzo" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></label>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.otc_consent_given} onChange={(e) => setForm({ ...form, otc_consent_given: e.target.checked })} /><span style={{ fontSize: '0.9rem' }}>OTC Medication Consent</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.sports_clearance} onChange={(e) => setForm({ ...form, sports_clearance: e.target.checked })} /><span style={{ fontSize: '0.9rem' }}>Varsity & Sports Clearance</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.work_immersion_clearance} onChange={(e) => setForm({ ...form, work_immersion_clearance: e.target.checked })} /><span style={{ fontSize: '0.9rem' }}>Work Immersion Clearance</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.self_consent_18plus} onChange={(e) => setForm({ ...form, self_consent_18plus: e.target.checked })} /><span style={{ fontSize: '0.9rem' }}>Legal Age (18+) Self-Consent</span></label>
          </div>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>Hazard Disclosure</span><textarea rows={2} value={form.dorm_housing_profile} onChange={(e) => setForm({ ...form, dorm_housing_profile: e.target.value })} /></label>
        </>
      )}
      {category === 'college' && (
        <>
          <label className="field"><span>Course / Program *</span><input required placeholder="e.g. BS Nursing" value={form.course_program} onChange={(e) => setForm({ ...form, course_program: e.target.value })} /></label>
          <label className="field"><span>Year Level *</span><input required placeholder="e.g. 2nd Year" value={form.year_level} onChange={(e) => setForm({ ...form, year_level: e.target.value })} /></label>
          <label className="field"><span>Section</span><input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></label>
          <label className="field"><span>Student ID Number *</span><input required placeholder="e.g. 2024-00123" value={form.student_id_number} onChange={(e) => setForm({ ...form, student_id_number: e.target.value })} /></label>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.ferpa_hipaa_waiver} onChange={(e) => setForm({ ...form, ferpa_hipaa_waiver: e.target.checked })} /><span style={{ fontSize: '0.9rem' }}>FERPA / HIPAA Waiver</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.immunization_titer_proof} onChange={(e) => setForm({ ...form, immunization_titer_proof: e.target.checked })} /><span style={{ fontSize: '0.9rem' }}>Immunization Titer Proof</span></label>
          </div>
          <label className="field"><span>Insurance Provider</span><input value={form.insurance_provider} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })} /></label>
          <label className="field"><span>Policy Number</span><input value={form.insurance_policy_number} onChange={(e) => setForm({ ...form, insurance_policy_number: e.target.value })} /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>Dorm/Housing Profile</span><textarea rows={2} value={form.dorm_housing_profile} onChange={(e) => setForm({ ...form, dorm_housing_profile: e.target.value })} /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>Substance Abuse / Chronic Management History</span><textarea rows={2} value={form.substance_abuse_history} onChange={(e) => setForm({ ...form, substance_abuse_history: e.target.value })} /></label>
        </>
      )}
      {category === 'employee' && (
        <>
          <label className="field"><span>Employee ID *</span><input required placeholder="e.g. EMP-998" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} /></label>
          <label className="field"><span>Department / Office *</span><input required placeholder="e.g. IT Services" value={form.office_unit_department} onChange={(e) => setForm({ ...form, office_unit_department: e.target.value })} /></label>
          <label className="field"><span>Job Title</span><input placeholder="e.g. Lab Technician" value={form.position_job_title} onChange={(e) => setForm({ ...form, position_job_title: e.target.value })} /></label>
          <label className="field"><span>Employment Status</span><select value={form.employment_status} onChange={(e) => setForm({ ...form, employment_status: e.target.value })}><option value="">Select...</option><option value="Full-time">Full-time</option><option value="Part-time">Part-time</option><option value="Contractual">Contractual</option></select></label>
        </>
      )}
    </div>
  );
}