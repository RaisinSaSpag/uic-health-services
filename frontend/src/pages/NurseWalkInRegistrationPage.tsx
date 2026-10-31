import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { useAuth } from '../context/AuthContext';

export function NurseWalkInRegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const isInjury = searchParams.get('type') === 'injury';
  
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '', // <-- Added email
    age: '',
    sex: 'male',
    patient_category: 'college',
    course_program: '',
    year_level: '',
    section: '',
    remarks: '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await api.post('/patients', {
        ...form,
        patient_type: form.patient_category === 'employee' ? 'employee' : 'student',
        campus_id: user?.campus_id, 
      });
      
      notifySuccess('Walk-in patient registered successfully!');
      navigate(`/nurse/patients/${res.data.id}/new-consultation`);
    } catch (err) {
      void notifyError('Failed to register walk-in patient.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{isInjury ? '🩹 Log Injury — Walk-In' : 'Register Walk-In Patient'}</h2>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              {isInjury ? 'Register the patient and start an injury consultation.' : 'Create a profile for a patient without an existing account.'}
            </p>
          </div>
          <button className="button ghost" onClick={() => navigate('/nurse')} type="button">
            ← Back to Dashboard
          </button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>First Name</span>
            <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </label>
          <label className="field">
            <span>Last Name</span>
            <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </label>

          <label className="field full-width">
            <span>UIC Email Address</span>
            <input required type="email" placeholder="student@uic.edu.ph" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <small className="muted" style={{ marginTop: '0.25rem', display: 'block' }}>Student's default password will be their email address.</small>
          </label>

          <label className="field">
            <span>Age</span>
            <input required type="number" min="1" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
          </label>
          <label className="field">
            <span>Sex</span>
            <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          <label className="field full-width">
            <span>Patient Category</span>
            <select value={form.patient_category} onChange={(e) => setForm({ ...form, patient_category: e.target.value })}>
              <option value="grade_school">Grade School</option>
              <option value="high_school">High School</option>
              <option value="college">College</option>
              <option value="employee">Employee</option>
            </select>
          </label>

          {form.patient_category !== 'employee' && (
            <>
              <label className="field">
                <span>Program</span>
                <input placeholder="e.g., BSIT" value={form.course_program} onChange={(e) => setForm({ ...form, course_program: e.target.value })} />
              </label>
              <label className="field">
                <span>Year Level</span>
                <input placeholder="e.g., 2nd Year" value={form.year_level} onChange={(e) => setForm({ ...form, year_level: e.target.value })} />
              </label>
              <label className="field">
                <span>Section</span>
                <input placeholder="e.g., A" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
              </label>
            </>
          )}

          <label className="field">
            <span>Date</span>
            <input readOnly value={new Date().toLocaleDateString()} style={{ background: '#eee' }} />
          </label>
          <label className="field">
            <span>Actual Time</span>
            <input readOnly value={new Date().toLocaleTimeString()} style={{ background: '#eee' }} />
          </label>

          <label className="field full-width" style={{ marginTop: '1rem' }}>
            <span>{isInjury ? 'Describe the Injury' : 'Remarks / Notes'}</span>
            <textarea placeholder={isInjury ? 'Describe the injury...' : 'Any initial notes...'} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </label>

          <div className="field full-width">
            <button className="button primary" type="submit" disabled={loading}>
              {loading ? 'Registering...' : (isInjury ? 'Register & Start Injury Consultation' : 'Register & Start Consultation')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}