import type { FormEvent } from 'react';

interface Props {
  finalDiagnosis: string;
  setFinalDiagnosis: (v: string) => void;
  treatmentPlan: string;
  setTreatmentPlan: (v: string) => void;
  doctorRemarks: string;
  setDoctorRemarks: (v: string) => void;
  prescribedMeds: { name: string; qty: number; stockId: number | null }[];
  setPrescribedMeds: React.Dispatch<React.SetStateAction<{ name: string; qty: number; stockId: number | null }[]>>;
  medicineSearchText: string;
  setMedicineSearchText: (v: string) => void;
  prescriptionQuantity: string;
  setPrescriptionQuantity: (v: string) => void;
  availableStock: any[];
  isCompleted: boolean;
  saving: boolean;
  canSetInProgress: boolean;
  canComplete: boolean;
  onSubmit: (e: FormEvent) => void;
  onMarkInProgress: () => void;
}

export function DoctorAssessmentForm({
  finalDiagnosis, setFinalDiagnosis, treatmentPlan, setTreatmentPlan, doctorRemarks, setDoctorRemarks,
  prescribedMeds, setPrescribedMeds, medicineSearchText, setMedicineSearchText, prescriptionQuantity, setPrescriptionQuantity,
  availableStock, isCompleted, saving, canSetInProgress, canComplete, onSubmit, onMarkInProgress
}: Props) {
  
  const addMedicine = () => {
    if (!medicineSearchText.trim()) return;
    const qty = parseInt(prescriptionQuantity, 10) || 1;
    const matchedStock = availableStock.find((s) => `${s.medicine?.name} (Exp: ${s.expiration_date})` === medicineSearchText || s.medicine?.name === medicineSearchText);
    setPrescribedMeds(prev => [...prev, { name: medicineSearchText.trim(), qty, stockId: matchedStock ? matchedStock.id : null }]);
    setMedicineSearchText('');
    setPrescriptionQuantity('1');
  };

  const removeMedicine = (index: number) => {
    setPrescribedMeds(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <form style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem 1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }} onSubmit={onSubmit}>
      <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600, color: '#a3224a', borderBottom: '2px solid #fce7f3', paddingBottom: '0.65rem' }}>
        Doctor Assessment
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <label className="field"><span>Final Diagnosis *</span><input type="text" value={finalDiagnosis} onChange={(e) => setFinalDiagnosis(e.target.value)} disabled={isCompleted || saving} required placeholder="Enter final diagnosis..." /></label>
        <label className="field"><span>Treatment Plan *</span><textarea rows={2} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} disabled={isCompleted || saving} required placeholder="e.g. Rest and hydration..." /></label>
        <label className="field"><span>Doctor's Remark *</span><textarea rows={3} value={doctorRemarks} onChange={(e) => setDoctorRemarks(e.target.value)} disabled={isCompleted || saving} required placeholder="Clinical assessment, findings..." /></label>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.2rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'block', marginBottom: 8 }}>Prescribed Medicines</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
            <label className="field" style={{ flex: 1, marginBottom: 0 }}>
              <input type="text" list="doctor-medicine-options" placeholder="Type to search..." value={medicineSearchText} onChange={(e) => setMedicineSearchText(e.target.value)} disabled={isCompleted || saving} style={{ width: '100%' }} />
              <datalist id="doctor-medicine-options">
                {availableStock.filter((s) => s.available_quantity > 0).map((s) => (
                  <option key={s.id} value={`${s.medicine?.name} (Exp: ${s.expiration_date})`}>{s.available_quantity} left</option>
                ))}
              </datalist>
            </label>
            <label className="field" style={{ width: '80px', marginBottom: 0 }}>
              <input type="number" min="1" placeholder="Qty" value={prescriptionQuantity} onChange={(e) => setPrescriptionQuantity(e.target.value)} disabled={isCompleted || saving} style={{ width: '100%', textAlign: 'center' }} />
            </label>
            <button type="button" className="button ghost" onClick={addMedicine} disabled={isCompleted || saving || !medicineSearchText.trim()} style={{ padding: '0.5rem 1rem' }}>Add</button>
          </div>
          {prescribedMeds.length > 0 && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {prescribedMeds.map((med, idx) => (
                  <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>- {med.qty}x {med.name}</span>
                    {!isCompleted && !saving && <button type="button" onClick={() => removeMedicine(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>Remove</button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {(canSetInProgress || canComplete) && (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', paddingTop: '1.35rem', borderTop: '1px solid #e2e8f0' }}>
          {canSetInProgress && <button className="button secondary" onClick={onMarkInProgress} disabled={saving} type="button" style={{ flex: 1 }}>Mark In Progress</button>}
          {canComplete && <button className="button success" type="submit" disabled={saving} style={{ flex: 1, background: '#059669', borderColor: '#059669' }}>{saving ? 'Saving…' : 'Complete Referral'}</button>}
        </div>
      )}
      {isCompleted && <div style={{ marginTop: '1.5rem', padding: '0.85rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534', fontWeight: 500 }}>This referral has been completed.</div>}
    </form>
  );
}
