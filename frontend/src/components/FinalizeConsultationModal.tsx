import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import type { Consultation } from '../types/hsms';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  consultation: Consultation | null;
  onSuccess: () => void;
}

interface PrescriptionRecord {
  id: number;
  medicine?: { name: string };
  quantity: number;
  dosage_instructions?: string | null;
  status: string;
}

export function FinalizeConsultationModal({ isOpen, onClose, consultation, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [nurseNotes, setNurseNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [loadingRx, setLoadingRx] = useState(false);

  // Fetch pending prescriptions when the modal opens
  useEffect(() => {
    if (!isOpen || !consultation) return;
    setNurseNotes('');

    const loadPrescriptions = async () => {
      setLoadingRx(true);
      try {
        const res = await api.get<PrescriptionRecord[]>('/prescriptions', {
          params: { consultation_id: consultation.id },
        });
        setPrescriptions(res.data || []);
      } catch {
        setPrescriptions([]);
      } finally {
        setLoadingRx(false);
      }
    };
    void loadPrescriptions();
  }, [isOpen, consultation?.id]);

  if (!isOpen || !consultation) return null;

  const handleDispense = async (rxId: number) => {
    try {
      await api.post(`/prescriptions/${rxId}/dispense-fifo`);
      notifySuccess('Medicine dispensed and stock deducted.', 'Dispensed');
      setPrescriptions((prev) =>
        prev.map((rx) => (rx.id === rxId ? { ...rx, status: 'dispensed' } : rx)),
      );
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to dispense medicine.'), 'Dispense Failed');
    }
  };

  const handleMarkUnavailable = async (rxId: number) => {
    try {
      await api.post(`/prescriptions/${rxId}/mark-unavailable`, {
        reason: 'Out of stock at campus',
      });
      notifySuccess('Marked unavailable. Doctor notified.', 'Update');
      setPrescriptions((prev) =>
        prev.map((rx) => (rx.id === rxId ? { ...rx, status: 'unavailable' } : rx)),
      );
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to mark as unavailable.'), 'Action Failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Block finalization if there are still pending prescriptions
    const pending = prescriptions.filter((rx) => rx.status === 'pending');
    if (pending.length > 0) {
      void notifyError(
        'Please dispense or mark all pending prescriptions before finalizing.',
        'Pending Prescriptions',
      );
      return;
    }

    setLoading(true);
    try {
      const medicalRecord = (consultation as any).medical_record;
      
      await api.patch(`/consultations/${consultation.id}`, {
        action: 'complete', // 🚨 CRITICAL FIX: Backend requires this key to route the action
        summary: medicalRecord?.summary || 'Consultation finalized by nurse',
        final_diagnosis: medicalRecord?.final_diagnosis || 'See doctor notes',
        treatment_plan: medicalRecord?.treatment_plan || 'See doctor notes',
        prescription: medicalRecord?.prescription || null,
        follow_up_date: medicalRecord?.follow_up_date || null,
        nurse_finalization_notes: nurseNotes.trim() || null,
      });

      notifySuccess('Consultation finalized and closed.', 'Finalized');
      onSuccess();
      onClose();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to finalize consultation.'), 'Error');
    } finally {
      setLoading(false);
    }
  };

  const medicalRecord = (consultation as any).medical_record;
  const prescriptionText = medicalRecord?.prescription || consultation.referral?.prescription || '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-head">
          <h3>Finalize Consultation</h3>
          <button className="button ghost" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p className="muted small" style={{ margin: 0 }}>
            Review the Doctor's notes and dispense any prescribed medicines before finalizing.
          </p>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Final Diagnosis</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 500 }}>{medicalRecord?.final_diagnosis || 'N/A'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Treatment Plan</span>
              <p style={{ margin: '0.25rem 0 0 0' }}>{medicalRecord?.treatment_plan || 'N/A'}</p>
            </div>
          </div>

          {/* Unified Prescriptions Section */}
          <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
              Prescribed Medicines
            </span>

            {loadingRx ? (
              <p className="muted small" style={{ margin: 0 }}>Loading prescriptions...</p>
            ) : (
              <>
                {/* Display structured catalog meds if any */}
                {prescriptions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: prescriptionText ? '1rem' : 0 }}>
                    {prescriptions.map((rx) => (
                      <div key={rx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1fae5' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{rx.medicine?.name || 'Unknown Medicine'}</div>
                          <div className="muted small" style={{ fontSize: '0.8rem' }}>
                            Qty: {rx.quantity} · {rx.dosage_instructions || 'No dosage specified'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: rx.status === 'dispensed' ? '#059669' : rx.status === 'unavailable' ? '#b45309' : '#64748b', fontWeight: 600, marginTop: 4, textTransform: 'uppercase' }}>
                            {rx.status}
                          </div>
                        </div>
                        {rx.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" className="button success" onClick={() => handleDispense(rx.id)} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: '#059669', borderColor: '#059669' }}>
                              Dispense (FIFO)
                            </button>
                            <button type="button" className="button ghost" onClick={() => handleMarkUnavailable(rx.id)} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', color: '#b45309', borderColor: '#fde68a' }}>
                              Mark Unavailable
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Display Free-Text Prescription */}
                {prescriptionText && (
                  <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1fae5' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', marginBottom: '0.25rem' }}>Free-Text Prescription</div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{prescriptionText}</p>
                  </div>
                )}

                {/* If neither exist */}
                {prescriptions.length === 0 && !prescriptionText && (
                  <p className="muted small" style={{ margin: 0 }}>No medicines prescribed.</p>
                )}
              </>
            )}
          </div>

          <label className="field">
            <span>Nurse Finalization Notes (Optional)</span>
            <textarea
              rows={3}
              value={nurseNotes}
              onChange={(e) => setNurseNotes(e.target.value)}
              placeholder="Add any final remarks, e.g., 'Student advised to rest for 1 hour before returning to class.'"
            />
          </label>

          <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="button ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary" disabled={loading} style={{ background: '#059669', borderColor: '#059669' }}>
              {loading ? 'Finalizing...' : 'Finalize Consultation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}