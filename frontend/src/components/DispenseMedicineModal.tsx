import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';

export interface DispenseBatch {
  medicine_stock_in_id: number;
  date_received: string | null;
  expiration_date: string | null;
  quantity: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  medicineName: string;
  medicineCategory: string;
  batches: DispenseBatch[];
  onSubmit: (medicineStockInId: number, quantity: number) => Promise<void>;
}

const NO_DATE = '__NO_DATE__';

function normalizeDate(value: string | null | undefined): string {
  if (!value) return NO_DATE;
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return NO_DATE;
  }
}

function displayDate(value: string | null | undefined): string {
  const normalized = normalizeDate(value);
  if (normalized === NO_DATE) return 'No Date';
  try {
    return new Date(normalized).toLocaleDateString();
  } catch {
    return normalized;
  }
}

export function DispenseMedicineModal({
  isOpen,
  onClose,
  medicineName,
  medicineCategory,
  batches,
  onSubmit,
}: Props) {
  const [selectedDateReceived, setSelectedDateReceived] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const distinctReceiveDates = useMemo(() => {
    return Array.from(new Set(batches.map((b) => normalizeDate(b.date_received))));
  }, [batches]);

  const filteredBatches = useMemo(() => {
    if (!selectedDateReceived) return batches;
    return batches.filter(
      (b) => normalizeDate(b.date_received) === normalizeDate(selectedDateReceived)
    );
  }, [batches, selectedDateReceived]);

  const distinctExpirationDates = useMemo(() => {
    return Array.from(new Set(filteredBatches.map((b) => normalizeDate(b.expiration_date))));
  }, [filteredBatches]);

  const selectedBatch = useMemo(
    () => batches.find((b) => b.medicine_stock_in_id === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const maxQuantity = selectedBatch ? selectedBatch.quantity : 0;

  useEffect(() => {
    if (isOpen) {
      setSelectedDateReceived('');
      setExpirationDate('');
      setSelectedBatchId(null);
      setQuantity('');
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (submitting) return;

    const parsed = parseInt(quantity, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return;
    }
    if (!selectedBatchId) {
      return;
    }
    if (parsed > maxQuantity) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(selectedBatchId, parsed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h3>Dispense: {medicineName}</h3>
          <button className="button ghost" onClick={onClose} type="button" disabled={submitting}>
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="muted small" style={{ textAlign: 'left' }}>
            <strong>Category:</strong> {medicineCategory}
          </div>

          <label>
            Date Received
            <select
              value={selectedDateReceived}
              onChange={(event) => {
                setSelectedDateReceived(event.target.value);
                setExpirationDate('');
                setSelectedBatchId(null);
                setQuantity('');
              }}
              disabled={submitting}
            >
              <option value="">-- All Dates --</option>
              {distinctReceiveDates.map((d) => (
                <option key={d} value={d}>
                  {d === NO_DATE ? 'No Date' : displayDate(d)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Expiration Date
            <select
              value={expirationDate}
              onChange={(event) => {
                const val = event.target.value;
                setExpirationDate(val);
                const match = filteredBatches.find(
                  (b) => normalizeDate(b.expiration_date) === normalizeDate(val)
                );
                setSelectedBatchId(match ? match.medicine_stock_in_id : null);
                setQuantity('');
              }}
              disabled={submitting || !selectedDateReceived}
            >
              <option value="">-- Select expiration date --</option>
              {distinctExpirationDates.map((d) => (
                <option key={d} value={d}>
                  {d === NO_DATE ? 'No Expiry' : displayDate(d)}
                </option>
              ))}
            </select>
          </label>

          {selectedBatch && (
            <div className="muted small" style={{ textAlign: 'left' }}>
              <strong>Available in batch:</strong> {maxQuantity} units
            </div>
          )}

          <label>
            Quantity to Dispense
            <input
              type="number"
              min={1}
              max={maxQuantity || undefined}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder={selectedBatch ? `Max: ${maxQuantity}` : 'Select a batch first'}
              disabled={submitting || !selectedBatchId}
              required
            />
          </label>

          <div className="modal-actions">
            <button
              type="button"
              className="button ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button"
              disabled={submitting || !selectedBatchId || !quantity}
            >
              {submitting ? 'Dispensing...' : 'Dispense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}