import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import type { Patient, LookupRecord } from '../types/hsms';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  onSuccess: () => void;
}

export function EnrollmentRollUpModal({ isOpen, onClose, patient, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [campuses, setCampuses] = useState<LookupRecord[]>([]);
  
  const [form, setForm] = useState({
    category: 'college',
    campus_id: patient.campus_id || 2,
    student_level: 'college',
    grade_level: '',
    course_program: '',
    year_level: '',
    section: '',
    change_reason: 'Moved up to next academic level',
  });

  useEffect(() => {
    if (isOpen) {
      // Load campuses when modal opens
      const loadCampuses = async () => {
        try {
          const res = await api.get<LookupRecord[]>('/campuses');
          setCampuses(res.data);
        } catch {
          // Non-fatal
        }
      };
      void loadCampuses();
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post(`/patients/${patient.id}/enrollments/roll-up`, form);
      notifySuccess('Patient academic status updated successfully.', 'Moved Up');
      onSuccess();
      onClose();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to roll up patient.'), 'Update Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-head">
          <h3>Move Up Academic Level</h3>
          <button className="button ghost" onClick={onClose} type="button">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p className="muted small" style={{ margin: 0, marginBottom: '0.5rem' }}>
            This will close the current enrollment and create a new one for <strong>{patient.user?.first_name} {patient.user?.last_name}</strong>. Historical records will be preserved.
          </p>

          <label className="field">
            <span>New Category *</span>
            <select 
              value={form.category} 
              onChange={(e) => {
                const cat = e.target.value;
                let campus = form.campus_id;
                if (cat === 'grade_school') campus = 4;
                if (cat === 'high_school') campus = 5;
                if (cat === 'senior_high_school') campus = 6;
                setForm({ 
                  ...form, 
                  category: cat, 
                  campus_id: campus,
                  student_level: cat === 'college' ? 'college' : 'basic'
                });
              }} 
              required
            >
              <option value="grade_school">Grade School</option>
              <option value="high_school">Junior High School</option>
              <option value="senior_high_school">Senior High School</option>
              <option value="college">College</option>
              <option value="employee">Employee</option>
            </select>
          </label>

          <label className="field">
            <span>New Campus *</span>
            <select 
              value={form.campus_id} 
              onChange={(e) => setForm({ ...form, campus_id: Number(e.target.value) })} 
              required
            >
              {campuses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {form.category === 'college' && (
            <>
              <label className="field">
                <span>Course / Program *</span>
                <input required value={form.course_program} onChange={(e) => setForm({ ...form, course_program: e.target.value })} placeholder="e.g. BSIT" />
              </label>
              <label className="field">
                <span>Year Level *</span>
                <input required value={form.year_level} onChange={(e) => setForm({ ...form, year_level: e.target.value })} placeholder="e.g. 1st Year" />
              </label>
            </>
          )}

          {(form.category === 'grade_school' || form.category === 'high_school' || form.category === 'senior_high_school') && (
            <label className="field">
              <span>Grade Level *</span>
              <input required value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} placeholder="e.g. Grade 7" />
            </label>
          )}

          <label className="field">
            <span>Section (Optional)</span>
            <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="e.g. A" />
          </label>

          <label className="field">
            <span>Reason / Notes</span>
            <input required value={form.change_reason} onChange={(e) => setForm({ ...form, change_reason: e.target.value })} />
          </label>

          <div className="modal-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="button ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? 'Processing...' : 'Confirm Move Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}