import { useEffect, useState } from 'react';
import { ArchiveRestore, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';

export interface ArchivedItem {
  id: number;
  stock_in_id: number;
  medicine_id: number | null;
  medicine_name: string | null;
  medicine_category: string | null;
  campus_id: number | null;
  campus_name: string | null;
  date_received: string | null;
  expiration_date: string | null;
  batch_quantity: number | null;
  quantity_archived: number;
  reason: string | null;
  archived_by_id: number | null;
  archived_by_name: string | null;
  archived_at: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campusId: number | null;
  onChanged?: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return 'N/A';
  }
}

export function ArchivedMedicinesModal({ isOpen, onClose, campusId, onChanged }: Props) {
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async (): Promise<void> => {
    if (!campusId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const response = await api.get<ArchivedItem[]>('/inventory/archived', {
        params: { campus_id: campusId },
      });
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load archived medicines.'), 'Load Failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, campusId]);

  if (!isOpen) return null;

  const handleRestore = async (item: ArchivedItem): Promise<void> => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await api.post(`/inventory/archived/${item.id}/restore`);
      void notifySuccess(
        `${item.medicine_name ?? 'Medicine'} restored to active stock.`,
        'Restored'
      );
      await load();
      onChanged?.();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to restore medicine.'), 'Restore Failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: ArchivedItem): Promise<void> => {
    if (busyId) return;
    const confirmed = window.confirm(
      `Permanently delete archived record for "${item.medicine_name ?? 'Medicine'}"?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setBusyId(item.id);
    try {
      await api.delete(`/inventory/archived/${item.id}`);
      void notifySuccess(
        `${item.medicine_name ?? 'Medicine'} archive record deleted.`,
        'Deleted'
      );
      await load();
      onChanged?.();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to delete archive record.'), 'Delete Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: '960px', width: '95%' }}
      >
        <div className="modal-head">
          <h3>Archived Medicines</h3>
          <button className="button ghost" onClick={onClose} type="button">
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <div className="modal-form" style={{ display: 'block', padding: '1rem 1.5rem' }}>
          {loading ? (
            <p className="muted" style={{ textAlign: 'center' }}>Loading archived medicines...</p>
          ) : items.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>
              No archived medicines.
            </p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Archived medicines table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Batch Qty</th>
                    <th>Archived</th>
                    <th>Received</th>
                    <th>Expires</th>
                    <th>Reason</th>
                    <th>By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.medicine_name ?? 'Unknown'}</td>
                      <td>{item.medicine_category ?? 'â€”'}</td>
                      <td>{item.batch_quantity ?? 'â€”'}</td>
                      <td>{item.quantity_archived}</td>
                      <td>{formatDate(item.date_received)}</td>
                      <td>{formatDate(item.expiration_date)}</td>
                      <td>{item.reason ?? 'â€”'}</td>
                      <td>{item.archived_by_name ?? 'Unknown'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            className="button success"
                            onClick={() => void handleRestore(item)}
                            title="Restore to active stock"
                            type="button"
                            disabled={busyId === item.id}
                          >
                            <ArchiveRestore size={14} strokeWidth={2.2} />
                          </button>
                          <button
                            className="button danger"
                            onClick={() => void handleDelete(item)}
                            title="Delete permanently"
                            type="button"
                            disabled={busyId === item.id}
                          >
                            <Trash2 size={14} strokeWidth={2.2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}