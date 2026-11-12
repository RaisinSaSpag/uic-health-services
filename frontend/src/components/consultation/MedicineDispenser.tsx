interface MedicineDispenserProps {
  campuses: any[];
  dispensingCampusId: string;
  setDispensingCampusId: (v: string) => void;
  availableStock: any[];
  medicineSearchText: string;
  setMedicineSearchText: (v: string) => void;
  dispenseQuantity: string;
  setDispenseQuantity: (v: string) => void;
  dispensedItems: any[];
  handleAddMedicine: () => void;
  handleRemoveMedicine: (idx: number) => void;
}

export function MedicineDispenser(props: MedicineDispenserProps) {
  return (
    <div style={sectionCard}>
      <h3 style={sectionTitle}>Dispense Medicine</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        <label className="field" style={{ marginBottom: '0.5rem' }}>
          <span>Dispensing Campus (Inventory Source)</span>
          <select value={props.dispensingCampusId} onChange={(e) => { props.setDispensingCampusId(e.target.value); }} style={{ maxWidth: '300px' }}>
            <option value="">— Select Campus —</option>
            {props.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: 1 }}>
            <span>Medicine Name</span>
            <input type="text" list="medicine-options" placeholder="e.g. Paracetamol..." value={props.medicineSearchText} onChange={(e) => props.setMedicineSearchText(e.target.value)} disabled={!props.dispensingCampusId} />
            <datalist id="medicine-options">
              {props.availableStock.filter((s) => s.quantity_remaining > 0).map((s) => (
                <option key={s.stock_in_id} value={`${s.medicine_name} (${s.batch_info})`}>{s.quantity_remaining} left</option>
              ))}
            </datalist>
          </label>
          <label className="field" style={{ width: '120px' }}>
            <span>Qty</span>
            <input type="number" min="1" value={props.dispenseQuantity} onChange={(e) => props.setDispenseQuantity(e.target.value)} disabled={!props.dispensingCampusId} />
          </label>
          <button type="button" className="button ghost" onClick={props.handleAddMedicine} disabled={!props.medicineSearchText.trim() || parseInt(props.dispenseQuantity, 10) <= 0} style={{ padding: '0.75rem 1.5rem', marginBottom: '2px' }}>Add</button>
        </div>

        {props.dispensedItems.length > 0 && (
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <strong style={{ fontSize: '0.9rem', color: '#475569' }}>Medicines to Dispense:</strong>
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {props.dispensedItems.map((item, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '400px' }}>
                  <span>{item.qty}x {item.name} {!item.stockId && <span style={{ color: '#a3224a', fontSize: '0.75rem' }}>(Not in inventory)</span>}</span>
                  <button type="button" onClick={() => props.handleRemoveMedicine(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const sectionCard: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', padding: '1.5rem 1.75rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const sectionTitle: React.CSSProperties = { margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600, color: '#1a2332', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' };
