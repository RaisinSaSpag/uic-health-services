import { useCallback, useEffect, useState } from 'react';
import { Plus, CheckCircle2, X, Calendar } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import { formatDate } from '../lib/format';

interface AcademicTerm {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export function CoordinatorTermsPage() {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AcademicTerm[]>('/academic-terms');
      setTerms(res.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to load terms.'), 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleActivate = async (id: number) => {
    try {
      await api.patch(`/academic-terms/${id}/activate`);
      void notifySuccess('Academic Term activated! KPIs will now reset to this term.', 'Success');
      void loadData();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to activate term.'), 'Error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/academic-terms', formData);
      void notifySuccess('Term created successfully.', 'Success');
      setIsModalOpen(false);
      setFormData({ name: '', start_date: '', end_date: '' });
      void loadData();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to create term.'), 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page" style={{ padding: '1.5rem' }}>
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={24} color="#d44974" />
            Academic Terms
          </h2>
          <p className="muted" style={{ marginTop: '0.25rem' }}>Manage semesters and set the active term for the clinic dashboard KPIs.</p>
        </div>
        <button className="button primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Add New Term
        </button>
      </div>

      <div className="panel">
        {loading ? (
          <p className="muted">Loading terms...</p>
        ) : terms.length === 0 ? (
          <p className="empty-state">No academic terms created yet. Click "Add New Term" to start.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Term Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.id} style={{ backgroundColor: term.is_active ? '#f0fdf4' : 'transparent' }}>
                    <td className="font-medium">{term.name}</td>
                    <td>{formatDate(term.start_date)}</td>
                    <td>{formatDate(term.end_date)}</td>
                    <td>
                      {term.is_active ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#16a34a', fontWeight: 600 }}>
                          <CheckCircle2 size={16} /> Active
                        </span>
                      ) : (
                        <span className="muted">Inactive</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {!term.is_active && (
                          <button className="button secondary sm" onClick={() => handleActivate(term.id)}>
                            Set Active
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Add Academic Term</h3>
              <button className="button ghost" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <label className="field">
                <span>Term Name (e.g., 1st Semester 2026-2027)</span>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="1st Semester 2026-2027" />
              </label>
              <div style={{ display: 'flex', gap: '15px' }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>Start Date</span>
                  <input type="date" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                </label>
                <label className="field" style={{ flex: 1 }}>
                  <span>End Date</span>
                  <input type="date" required value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="button ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Term'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}