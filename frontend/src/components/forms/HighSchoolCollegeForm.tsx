export function HighSchoolCollegeForm({ form, setForm, category }: { form: any; setForm: (val: any) => void; category: string; }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
      {category === 'senior_high_school' && (
        <>
          <label className="field"><span>Track / Strand *</span><input required placeholder="e.g. STEM / ABM" value={form.course_program} onChange={(e) => setForm({ ...form, course_program: e.target.value })} /></label>
          <label className="field"><span>Grade Level *</span><input required placeholder="Grade 11 or 12" value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} /></label>
          <label className="field"><span>Section</span><input placeholder="e.g. St. Lorenzo" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></label>
          
          {/* 🚨 REMOVED: SHS checkboxes (OTC, Sports, Work Immersion, 18+ Self-Consent) */}
          {/* 🚨 REMOVED: Hazard Disclosure */}
        </>
      )}
      
      {category === 'college' && (
        <>
          <label className="field"><span>Course / Program *</span><input required placeholder="e.g. BS Nursing" value={form.course_program} onChange={(e) => setForm({ ...form, course_program: e.target.value })} /></label>
          <label className="field"><span>Year Level *</span><input required placeholder="e.g. 2nd Year" value={form.year_level} onChange={(e) => setForm({ ...form, year_level: e.target.value })} /></label>
          <label className="field"><span>Section</span><input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></label>
          <label className="field"><span>Student ID Number *</span><input required placeholder="e.g. 2024-00123" value={form.student_id_number} onChange={(e) => setForm({ ...form, student_id_number: e.target.value })} /></label>
          
          {/* 🚨 REMOVED: College checkboxes (FERPA, Immunization Titer) */}
          {/* 🚨 REMOVED: Insurance Provider, Policy Number, Dorm/Housing Profile */}

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