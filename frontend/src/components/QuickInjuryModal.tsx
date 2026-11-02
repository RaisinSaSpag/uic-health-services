import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import { userDisplayName } from '../lib/format';

interface QuickInjuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickInjuryModal({ isOpen, onClose, onSuccess }: QuickInjuryModalProps) {
  const [injurySearchTerm, setInjurySearchTerm] = useState('');
  const [injurySearchResults, setInjurySearchResults] = useState<any[]>([]);
  const [injurySearching, setInjurySearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [injurySubmitting, setInjurySubmitting] = useState(false);
  const [injuryForm, setInjuryForm] = useState({
    first_name: '',
    last_name: '',
    patient_category: 'college',
    campus_id: 1,
    chief_complaint: '',
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInjurySearchTerm('');
      setInjurySearchResults([]);
      setSelectedPatient(null);
      setInjuryForm({ first_name: '', last_name: '', patient_category: 'college', campus_id: 1, chief_complaint: '' });
    }
  }, [isOpen]);

  // Search handler
  useEffect(() => {
    if (injurySearchTerm.length < 2) {
      setInjurySearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setInjurySearching(true);
      try {
        const res = await api.get(`/patients/search?q=${injurySearchTerm}`);
        setInjurySearchResults(res.data);
      } catch (err) {
        // ignore
      } finally {
        setInjurySearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [injurySearchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInjurySubmitting(true);
    try {
      const payload = selectedPatient 
        ? { patient_id: selectedPatient.id, chief_complaint: injuryForm.chief_complaint }
        : injuryForm;

      await api.post('/patients/quick-injury', payload);
      void notifySuccess('Injury logged successfully.', 'Success');
      onSuccess();
      onClose();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to log injury.'), 'Error');
    } finally {
      setInjurySubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Quick Injury Log</h3>
          <button className="button ghost" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Search existing patient */}
          <label className="field">
            <span>Search Existing Patient (Optional)</span>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} size={18} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={selectedPatient ? userDisplayName(selectedPatient.user) : injurySearchTerm}
                onChange={(e) => {
                  setInjurySearchTerm(e.target.value);
                  setSelectedPatient(null);
                }}
                style={{ paddingLeft: '35px', width: '100%' }}
              />
            </div>
          </label>

          {/* Search Results Dropdown */}
          {injurySearchResults.length > 0 && !selectedPatient && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto' }}>
              {injurySearchResults.map((p) => (
                <div 
                  key={p.id} 
                  onClick={() => { setSelectedPatient(p); setInjurySearchResults([]); }}
                  style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', hover: { background: '#f8fafc' } }}
                >
                  <strong>{p.first_name} {p.last_name}</strong> <span className="muted">({p.patient_number})</span>
                </div>
              ))}
            </div>
          )}

          {/* New Patient Fields (only show if no selected patient) */}
          {!selectedPatient && (
            <>
              <div style={{ display: 'flex', gap: '15px' }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>First Name</span>
                  <input type="text" required value={injuryForm.first_name} onChange={(e) => setInjuryForm({ ...injuryForm, first_name: e.target.value })} />
                </label>
                <label className="field" style={{ flex: 1 }}>
                  <span>Last Name</span>
                  <input type="text" required value={injuryForm.last_name} onChange={(e) => setInjuryForm({ ...injuryForm, last_name: e.target.value })} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>Category</span>
                  <select value={injuryForm.patient_category} onChange={(e) => setInjuryForm({ ...injuryForm, patient_category: e.target.value })}>
                    <option value="grade_school">Grade School</option>
                    <option value="high_school">High School</option>
                    <option value="college">College</option>
                    <option value="employee">Employee</option>
                  </select>
                </label>
                <label className="field" style={{ flex: 1 }}>
                  <span>Campus ID</span>
                  <input type="number" required value={injuryForm.campus_id} onChange={(e) => setInjuryForm({ ...injuryForm, campus_id: Number(e.target.value) })} />
                </label>
              </div>
            </>
          )}

          <label className="field">
            <span>Chief Complaint / Injury Details</span>
            <textarea 
              required 
              rows={3} 
              value={injuryForm.chief_complaint} 
              onChange={(e) => setInjuryForm({ ...injuryForm, chief_complaint: e.target.value })} 
              placeholder="e.g. Sprained left ankle during PE class"
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="button ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary" disabled={injurySubmitting}>
              {injurySubmitting ? 'Logging...' : 'Log Injury'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}