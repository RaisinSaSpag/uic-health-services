import { useState, useEffect, type FormEvent, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/http';
import type { PatientIdentifyMatch } from '../types/hsms';
import { GradeSchoolForm } from '../components/forms/GradeSchoolForm';
import { HighSchoolCollegeForm } from '../components/forms/HighSchoolCollegeForm';

export function NurseWalkInRegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  void searchParams;

  const [searchForm, setSearchForm] = useState({ first_name: '', last_name: '', birth_date: '' });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PatientIdentifyMatch[]>([]);

  const [step, setStep] = useState<'identify' | 'results' | 'register'>('identify');
  const [regLoading, setRegLoading] = useState(false);

  // 🚨 CLEANED STATE: Removed all dead fields (consent, signature, hospital, etc.)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', birth_date: '', age: '', sex: 'male',
    patient_category: 'college', campus_id: user?.campus_id || 2, notes: '',
    student_level: 'college', grade_level: '', course_program: '', year_level: '', section: '', student_id_number: '',
    employee_id: '', employee_type: '', office_unit_department: '', position_job_title: '', employment_status: '',
    parent_guardian_name: '', parent_contact_number: '', parent_secondary_contact_number: '', parent_address: '',
    emergency_contact_name: '', emergency_contact_number: '', emergency_contact_relationship: '',
    current_medications: '', medication_instructions: '', allergies: '', existing_medical_condition: '',
    immunization_status: '', special_health_concern: '', fit_for_school: false, working_student: false, fit_to_work: false,
  });

  useEffect(() => {
    if (form.birth_date) {
      const birth = new Date(form.birth_date);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age >= 0 && age <= 120) setForm((prev) => ({ ...prev, age: age.toString() }));
    }
  }, [form.birth_date]);

  const handleIdentify = async (e: FormEvent) => {
    e.preventDefault();
    setSearchLoading(true);
    try {
      const res = await api.get('/patients/identify', { params: searchForm });
      setSearchResults(res.data.matches);
      setStep('results');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Search failed.'), 'Error');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    try {
      const payload = { 
        ...form, 
        patient_type: form.patient_category === 'employee' ? 'employee' : 'student',
      };
      const res = await api.post('/patients', payload);
      notifySuccess('Walk-in patient registered successfully!');
      navigate(`/nurse/patients/${res.data.id}/new-consultation`);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to register walk-in patient.'), 'Registration Failed');
    } finally {
      setRegLoading(false);
    }
  };

  const proceedToRegister = (match?: PatientIdentifyMatch) => {
    if (match) {
      setForm((prev) => ({ ...prev, first_name: match.first_name, last_name: match.last_name, birth_date: match.birth_date }));
    } else {
      setForm((prev) => ({ ...prev, first_name: searchForm.first_name, last_name: searchForm.last_name, birth_date: searchForm.birth_date }));
    }
    setStep('register');
  };

  const handleCategoryChange = (category: string) => {
    let campus_id = form.campus_id;
    if (category === 'grade_school') campus_id = 4;
    if (category === 'high_school') campus_id = 5;
    if (category === 'senior_high_school') campus_id = 6;
    setForm((prev) => ({ ...prev, patient_category: category, campus_id, student_level: category === 'college' ? 'college' : category === 'employee' ? '' : 'basic' }));
  };

  const isMinor = ['grade_school', 'high_school', 'senior_high_school'].includes(form.patient_category);

  const sectionStyle: CSSProperties = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' };
  const headingStyle: CSSProperties = { margin: '0 0 1.25rem 0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' };
  const badgeStyle: CSSProperties = { background: '#a3224a', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' };

  if (step === 'identify') {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a3224a', fontWeight: 700 }}>Step 1 of 2</span>
              <h2 style={{ margin: '0.2rem 0 0 0', color: '#0f172a', fontSize: '1.5rem' }}>Identify Walk-in Patient</h2>
            </div>
            <button className="button ghost" type="button" onClick={() => navigate('/nurse')}>Cancel & Return</button>
          </div>
          <form onSubmit={handleIdentify}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <label className="field"><span style={{ fontWeight: 500, fontSize: '0.9rem' }}>First Name</span><input required value={searchForm.first_name} onChange={(e) => setSearchForm({ ...searchForm, first_name: e.target.value })} placeholder="e.g. Maria" /></label>
              <label className="field"><span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Last Name</span><input required value={searchForm.last_name} onChange={(e) => setSearchForm({ ...searchForm, last_name: e.target.value })} placeholder="e.g. Santos" /></label>
              <label className="field"><span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Date of Birth</span><input required type="date" value={searchForm.birth_date} onChange={(e) => setSearchForm({ ...searchForm, birth_date: e.target.value })} /></label>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button className="button primary" type="submit" disabled={searchLoading} style={{ background: '#a3224a', borderColor: '#a3224a' }}>{searchLoading ? 'Searching...' : 'Search Patient Directory'}</button>
              <button className="button ghost" type="button" onClick={() => proceedToRegister()}>Skip Search & Register Directly</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div><h2 style={{ margin: 0, color: '#0f172a' }}>Search Results</h2><p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>Found {searchResults.length} matching record(s).</p></div>
            <button className="button ghost" type="button" onClick={() => setStep('identify')}>← Search Again</button>
          </div>
          {searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <p style={{ margin: 0, color: '#475569', fontWeight: 500 }}>No existing profile matched this name and date of birth.</p>
              <button className="button primary" style={{ marginTop: '1.25rem', background: '#a3224a', borderColor: '#a3224a' }} onClick={() => proceedToRegister()}>Create New Patient Profile</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {searchResults.map((match) => (
                <div key={match.patient_id} style={{ border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: '#0f172a' }}>{match.first_name} {match.last_name}</h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>DOB: {match.birth_date} | Patient No: <strong>{match.patient_number}</strong></p>
                    <span style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#fdf2f4', color: '#a3224a', textTransform: 'capitalize' }}>{match.current_enrollment?.category || 'Student'}</span>
                  </div>
                  <button className="button primary" type="button" style={{ background: '#a3224a', borderColor: '#a3224a' }} onClick={() => navigate(`/nurse/patients/${match.patient_id}/new-consultation`)}>Select & Start Consultation</button>
                </div>
              ))}
              <div style={{ marginTop: '1rem', textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}><button className="button ghost" type="button" onClick={() => proceedToRegister()}>None of these match? Register as New Patient</button></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a3224a', fontWeight: 700 }}>Step 2 of 2</span>
          <h2 style={{ margin: '0.2rem 0 0 0', color: '#0f172a', fontSize: '1.6rem' }}>Clinic Registration Form</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="button ghost" onClick={() => setStep('identify')} type="button">← Back</button>
          <button className="button ghost" onClick={() => navigate('/nurse')} type="button">Cancel</button>
        </div>
      </div>

      <form onSubmit={handleRegister}>
        <div style={sectionStyle}>
          <div style={headingStyle}><span style={badgeStyle}>1</span>Student / Patient Identity</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <label className="field"><span style={{ fontWeight: 500, fontSize: '0.9rem' }}>First Name *</span><input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
            <label className="field"><span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Last Name *</span><input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
            <label className="field"><span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Date of Birth *</span><input required type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></label>
            <label className="field"><span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Age *</span><input required type="number" min="1" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></label>
            <label className="field"><span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Sex *</span><select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}><option value="male">Male</option><option value="female">Female</option></select></label>
            <label className="field"><span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Email Address {isMinor ? '(Optional)' : '*'}</span><input required={!isMinor} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={isMinor ? 'Parent/Student Email' : 'student@uic.edu.ph'} /></label>
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <span style={{ display: 'block', fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Educational Level / Category *</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[{ id: 'grade_school', label: 'Grade School' },{ id: 'high_school', label: 'Junior High School' },{ id: 'senior_high_school', label: 'Senior High School' },{ id: 'college', label: 'College' },{ id: 'employee', label: 'Employee / Staff' }].map((cat) => (
                <button key={cat.id} type="button" onClick={() => handleCategoryChange(cat.id)} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: form.patient_category === cat.id ? '2px solid #a3224a' : '1px solid #cbd5e1', background: form.patient_category === cat.id ? '#fdf2f4' : '#ffffff', color: form.patient_category === cat.id ? '#a3224a' : '#475569', fontWeight: form.patient_category === cat.id ? 600 : 400, cursor: 'pointer', fontSize: '0.875rem' }}>{cat.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={headingStyle}><span style={badgeStyle}>2</span>{form.patient_category === 'employee' ? 'Employment Information' : 'Academic Classification'}</div>
          {(form.patient_category === 'grade_school' || form.patient_category === 'high_school') && <GradeSchoolForm form={form} setForm={setForm} isJHS={form.patient_category === 'high_school'} />}
          {(form.patient_category === 'senior_high_school' || form.patient_category === 'college' || form.patient_category === 'employee') && <HighSchoolCollegeForm form={form} setForm={setForm} category={form.patient_category} />}
        </div>

        <div style={sectionStyle}>
          <div style={headingStyle}><span style={badgeStyle}>3</span>Guardians & Emergency Contacts</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {isMinor && (
              <>
                <label className="field"><span>Primary Guardian Name *</span><input required value={form.parent_guardian_name} onChange={(e) => setForm({ ...form, parent_guardian_name: e.target.value })} /></label>
                <label className="field"><span>Primary Guardian Mobile *</span><input required value={form.parent_contact_number} onChange={(e) => setForm({ ...form, parent_contact_number: e.target.value })} /></label>
                <label className="field"><span>Secondary Phone (Optional)</span><input value={form.parent_secondary_contact_number} onChange={(e) => setForm({ ...form, parent_secondary_contact_number: e.target.value })} /></label>
                <label className="field"><span>Home Address (Optional)</span><input value={form.parent_address} onChange={(e) => setForm({ ...form, parent_address: e.target.value })} /></label>
              </>
            )}
            <label className="field"><span>Emergency Contact Person {isMinor ? '(Optional)' : '*'}</span><input required={!isMinor} value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder={isMinor ? "Leave blank if same as Guardian" : ""} /></label>
            <label className="field"><span>Emergency Mobile Number {isMinor ? '(Optional)' : '*'}</span><input required={!isMinor} value={form.emergency_contact_number} onChange={(e) => setForm({ ...form, emergency_contact_number: e.target.value })} placeholder={isMinor ? "Leave blank if same as Guardian" : ""} /></label>
            <label className="field"><span>Relationship to Patient (Optional)</span><input placeholder="e.g. Mother, Spouse, Guardian" value={form.emergency_contact_relationship} onChange={(e) => setForm({ ...form, emergency_contact_relationship: e.target.value })} /></label>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={headingStyle}><span style={badgeStyle}>4</span>Medical History</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <label className="field"><span>Known Allergies (Optional)</span><input placeholder="Type 'None' if no known allergies" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></label>
            <label className="field"><span>Chronic Medical Conditions (Optional)</span><input placeholder="Type 'None' if no chronic conditions" value={form.existing_medical_condition} onChange={(e) => setForm({ ...form, existing_medical_condition: e.target.value })} /></label>
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Current Daily Medications (Optional)</span><input placeholder="Type 'None' if no daily medications" value={form.current_medications} onChange={(e) => setForm({ ...form, current_medications: e.target.value })} /></label>

            {form.patient_category === 'grade_school' && (
              <>
                <label className="field">
                  <span>Immunization Status (Optional)</span>
                  <select value={form.immunization_status} onChange={(e) => setForm({ ...form, immunization_status: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="complete">Complete</option>
                    <option value="incomplete">Incomplete</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  <span>Special Health Concern (Optional)</span>
                  <textarea rows={2} value={form.special_health_concern} onChange={(e) => setForm({ ...form, special_health_concern: e.target.value })} />
                </label>
              </>
            )}

            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Nurse Remarks / Notes (Optional)</span><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
        </div>

        <div style={{ marginTop: '2rem', marginBottom: '4rem' }}>
          <button className="button primary" type="submit" disabled={regLoading} style={{ width: '100%', padding: '1rem', fontSize: '1.05rem', fontWeight: 600, borderRadius: '8px', background: '#a3224a', borderColor: '#a3224a', cursor: regLoading ? 'not-allowed' : 'pointer' }}>
            {regLoading ? 'Saving Profile & Opening Consultation...' : 'Register Patient & Begin Consultation'}
          </button>
        </div>
      </form>
    </div>
  );
}