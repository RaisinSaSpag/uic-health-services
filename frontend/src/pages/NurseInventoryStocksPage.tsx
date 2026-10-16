import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Edit3,
  Package,
  MinusCircle,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventoryBasePath } from '../lib/useInventoryBasePath';
import { DispenseMedicineModal, type DispenseBatch } from '../components/DispenseMedicineModal';
import { ArchiveMedicineModal, type ArchiveBatch } from '../components/ArchiveMedicineModal';
import { ArchivedMedicinesModal } from '../components/ArchivedMedicinesModal';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';

interface Medicine {
  id: number;
  name: string;
  category: string;
  created_at?: string;
  updated_at?: string;
  total_available?: number;
}

interface AvailableStockItem {
  id: number;
  medicine_id: number;
  campus_id: number;
  quantity: number;
  available_quantity?: number;
  date_received: string;
  expiration_date: string;
}

type InventorySection = 'dashboard' | 'stocks' | 'requests' | 'history' | 'reports' | 'about';

interface MenuItem {
  key: InventorySection;
  label: string;
  icon: LucideIcon;
  path: string;
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Package, path: '/nurse/inventory' },
  { key: 'stocks', label: 'Stocks', icon: Package, path: '/nurse/inventory/stocks' },
  { key: 'requests', label: 'Branch Requests', icon: Package, path: '/nurse/inventory/requests' },
  { key: 'history', label: 'History', icon: Package, path: '/nurse/inventory/history' },
  { key: 'reports', label: 'Reports', icon: Package, path: '/nurse/inventory/reports' },
  { key: 'about', label: 'About', icon: Package, path: '/nurse/inventory/about' },
];

export function NurseInventoryStocksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { basePath, isDoctor } = useInventoryBasePath();

  const resolvedMenuItems = useMemo(
    () =>
      menuItems.map((item) => ({
        ...item,
        path: item.path.replace('/nurse/inventory', basePath),
      })),
    [basePath],
  );

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [campusStockMap, setCampusStockMap] = useState<Record<number, number>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Stock-In modal state
  const [isStockInOpen, setStockInOpen] = useState(false);
  const [stockInMedicine, setStockInMedicine] = useState<Medicine | null>(null);
  const [stockInQuantity, setStockInQuantity] = useState('');
  const [stockInDateReceived, setStockInDateReceived] = useState('');
  const [stockInExpirationDate, setStockInExpirationDate] = useState('');
  const [stockInSubmitting, setStockInSubmitting] = useState(false);

  // Dispense modal state
  const [isDispenseOpen, setDispenseOpen] = useState(false);
  const [dispenseMedicine, setDispenseMedicine] = useState<Medicine | null>(null);
  const [dispenseBatches, setDispenseBatches] = useState<DispenseBatch[]>([]);
  const [, setDispenseLoadingBatches] = useState(false);

  // Archive modal state
  const [isArchiveOpen, setArchiveOpen] = useState(false);
  const [archiveMedicine, setArchiveMedicine] = useState<Medicine | null>(null);
  const [archiveBatches, setArchiveBatches] = useState<ArchiveBatch[]>([]);
    const [, setArchiveLoadingBatches] = useState(false);

  // Archived list modal state
  const [isArchivedOpen, setArchivedOpen] = useState(false);

  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [medRes, availRes] = await Promise.all([
        api.get<Medicine[]>('/medicines'),
        user?.campus_id ? api.get<AvailableStockItem[]>('/inventory/available', { params: { campus_id: user.campus_id } }) : Promise.resolve({ data: [] })
      ]);

      const rawMeds = Array.isArray(medRes.data) ? medRes.data : [];
      const rawStock = Array.isArray(availRes.data) ? availRes.data : [];

      // Calculate total stock per medicine for this campus
      const map: Record<number, number> = {};
      rawStock.forEach((item) => {
        const qty = item.available_quantity ?? item.quantity ?? 0;
        map[item.medicine_id] = (map[item.medicine_id] || 0) + qty;
      });

      setCampusStockMap(map);
      setMedicines(rawMeds);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load stock inventory.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [user?.campus_id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredMedicines = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (normalized === '') return medicines;

    return medicines.filter((medicine) => {
      return (
        medicine.name.toLowerCase().includes(normalized) ||
        medicine.category.toLowerCase().includes(normalized)
      );
    });
  }, [medicines, search]);

  const openAddModal = (): void => {
    setEditingMedicine(null);
    setFormName('');
    setFormCategory('');
    setModalOpen(true);
  };

  const openEditModal = (medicine: Medicine): void => {
    setEditingMedicine(medicine);
    setFormName(medicine.name);
    setFormCategory(medicine.category);
    setModalOpen(true);
  };

  const closeModal = (): void => {
    setModalOpen(false);
    setEditingMedicine(null);
    setFormName('');
    setFormCategory('');
  };

  const openStockInModal = (medicine: Medicine): void => {
    setStockInMedicine(medicine);
    setStockInQuantity('');
    setStockInDateReceived(new Date().toISOString().slice(0, 10));
    setStockInExpirationDate('');
    setStockInOpen(true);
  };

  const closeStockInModal = (): void => {
    setStockInOpen(false);
    setStockInMedicine(null);
    setStockInQuantity('');
    setStockInDateReceived('');
    setStockInExpirationDate('');
  };

  const submitStockIn = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (stockInSubmitting || !stockInMedicine) return;

    const quantity = parseInt(stockInQuantity, 10);
    if (!Number.isInteger(quantity) || quantity < 1) {
      void notifyError('Quantity must be at least 1.', 'Invalid Quantity');
      return;
    }
    if (!stockInDateReceived) {
      void notifyError('Date received is required.', 'Missing Date');
      return;
    }
    if (!stockInExpirationDate) {
      void notifyError('Expiration date is required.', 'Missing Date');
      return;
    }
    if (stockInExpirationDate <= stockInDateReceived) {
      void notifyError('Expiration date must be after date received.', 'Invalid Dates');
      return;
    }

    setStockInSubmitting(true);
    try {
      await api.post('/inventory/stock-in', {
        medicine_id: stockInMedicine.id,
        campus_id: user?.campus_id,
        quantity: quantity,
        date_received: stockInDateReceived,
        expiration_date: stockInExpirationDate,
      });

      void notifySuccess(
        `Added ${quantity} units of ${stockInMedicine.name} to stock.`,
        'Stock Added'
      );
      closeStockInModal();
      await loadData();
    } catch (err) {
      void notifyError(
        getErrorMessage(err, 'Unable to add stock.'),
        'Stock-In Failed'
      );
    } finally {
      setStockInSubmitting(false);
    }
  };

  const openDispenseModal = async (medicine: Medicine): Promise<void> => {
    setDispenseMedicine(medicine);
    setDispenseBatches([]);
    setDispenseLoadingBatches(true);
    setDispenseOpen(true);

    try {
      const response = await api.get<AvailableStockItem[]>('/inventory/available', {
        params: { campus_id: user?.campus_id },
      });

      const raw = Array.isArray(response.data) ? response.data : [];
      const filtered: DispenseBatch[] = raw
        .filter((r) => r.medicine_id === medicine.id)
        .map((r) => ({
          medicine_stock_in_id: r.id,
          date_received: r.date_received,
          expiration_date: r.expiration_date,
          quantity: r.available_quantity ?? r.quantity ?? 0,
        }))
        .filter((b) => b.quantity > 0);

      setDispenseBatches(filtered);

      if (filtered.length === 0) {
        void notifyError('No available batches for this medicine.', 'Nothing to Dispense');
      }
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load batches.'), 'Load Failed');
      setDispenseBatches([]);
    } finally {
      setDispenseLoadingBatches(false);
    }
  };

  const closeDispenseModal = (): void => {
    setDispenseOpen(false);
    setDispenseMedicine(null);
    setDispenseBatches([]);
    setDispenseLoadingBatches(false);
  };

  const submitDispense = async (medicineStockInId: number, quantity: number): Promise<void> => {
    try {
      await api.post('/inventory/dispense', {
        stock_in_id: medicineStockInId,
        quantity_dispensed: quantity,
      });

      void notifySuccess(
        `Dispensed ${quantity} unit${quantity === 1 ? '' : 's'}.`,
        'Dispensed'
      );
      closeDispenseModal();
      await loadData();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to dispense medicine.'), 'Dispense Failed');
    }
  };

  const openArchiveModal = async (medicine: Medicine): Promise<void> => {
    setArchiveMedicine(medicine);
    setArchiveBatches([]);
    setArchiveLoadingBatches(true);
    setArchiveOpen(true);

    try {
      const response = await api.get<AvailableStockItem[]>('/inventory/available', {
        params: { campus_id: user?.campus_id },
      });

      const raw = Array.isArray(response.data) ? response.data : [];
      const filtered: ArchiveBatch[] = raw
        .filter((r) => r.medicine_id === medicine.id)
        .map((r) => ({
          medicine_stock_in_id: r.id,
          date_received: r.date_received,
          expiration_date: r.expiration_date,
          quantity: r.available_quantity ?? r.quantity ?? 0,
        }))
        .filter((b) => b.quantity > 0);

      setArchiveBatches(filtered);

      if (filtered.length === 0) {
        void notifyError('No available batches for this medicine.', 'Nothing to Archive');
      }
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load batches.'), 'Load Failed');
      setArchiveBatches([]);
    } finally {
      setArchiveLoadingBatches(false);
    }
  };

  const closeArchiveModal = (): void => {
    setArchiveOpen(false);
    setArchiveMedicine(null);
    setArchiveBatches([]);
    setArchiveLoadingBatches(false);
  };

  const submitArchive = async (medicineStockInId: number, quantity: number, reason: string): Promise<void> => {
    try {
      await api.post('/inventory/archive', {
        stock_in_id: medicineStockInId,
        quantity: quantity,
        reason: reason,
      });

      void notifySuccess(
        `Archived ${quantity} unit${quantity === 1 ? '' : 's'}.`,
        'Archived'
      );
      closeArchiveModal();
      await loadData();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to archive medicine.'), 'Archive Failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      if (editingMedicine) {
        await api.patch(`/medicines/${editingMedicine.id}`, {
          name: formName.trim(),
          category: formCategory.trim(),
        });
        void notifySuccess(`${formName} updated.`, 'Medicine Updated');
      } else {
        await api.post('/medicines', {
          name: formName.trim(),
          category: formCategory.trim(),
        });
        void notifySuccess(`${formName} added to master catalog.`, 'Medicine Created');
      }

      closeModal();
      await loadData();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to save medicine.'), 'Save Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (medicine: Medicine): Promise<void> => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${medicine.name}" from the catalog?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/medicines/${medicine.id}`);
      void notifySuccess(`${medicine.name} deleted.`, 'Deleted');
      await loadData();
    } catch (err) {
      void notifyError(
        getErrorMessage(err, 'Unable to delete medicine. Ensure it has no associated records.'),
        'Delete Failed'
      );
    }
  };

  return (
    <div className="nurse-dashboard-page">
      {/* Sidebar Navigation */}
      <aside className="nurse-sidebar" aria-label="Inventory sidebar">
                <div className="nurse-sidebar-brand">
          <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
          <div className="nurse-sidebar-identity">
            <h3>{userName}</h3>
            <p>{isDoctor ? 'Doctor' : 'Nurse'} · {campusName}</p>
          </div>
        </div>

        <nav className="nurse-sidebar-nav" aria-label="Inventory navigation">
          <div className="nurse-nav-item">
            <button
              className="nurse-side-link back-to-dashboard"
              onClick={() => navigate(basePath === '/doctor/inventory' ? '/doctor' : '/nurse')}
              type="button"
            >
              <ArrowLeft className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">Back to Dashboard</span>
            </button>
          </div>

          {resolvedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === 'stocks';
            return (
              <div className="nurse-nav-item" key={item.key}>
                <button
                  className={`nurse-side-link${isActive ? ' active' : ''}`}
                  onClick={() => navigate(item.path)}
                  type="button"
                >
                  <Icon className="nurse-side-icon" size={18} strokeWidth={2.2} />
                  <span className="nurse-side-label">{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>Medicine Stocks Inventory</h1>
            <p className="muted">Manage and monitor active drug stock levels for {campusName}</p>
          </div>
          <div className="flex gap-2">
            {!isDoctor && (
              <>
                <button className="button secondary" onClick={() => setArchivedOpen(true)} type="button">
                  <Archive size={16} />
                  <span>Archived List</span>
                </button>
                <button className="button primary" onClick={openAddModal} type="button">
                  <Plus size={16} />
                  <span>Add New Drug</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Search & Stats Bar */}
        <div className="panel mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="search-bar flex-1 relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by drug name or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
            <button className="button ghost" onClick={() => void loadData()} type="button" title="Refresh">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Stocks Table */}
        <div className="panel">
          {loading ? (
            <p className="muted text-center py-8">Loading inventory stock levels...</p>
          ) : filteredMedicines.length === 0 ? (
            <p className="muted text-center py-8">No medicines found matching your criteria.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Category</th>
                    <th>Available Stock</th>
                    <th>Status</th>
                    {!isDoctor && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((medicine) => {
                    const totalStock = campusStockMap[medicine.id] || 0;
                    return (
                      <tr key={medicine.id}>
                        <td className="font-medium">{medicine.name}</td>
                        <td className="muted">{medicine.category}</td>
                        <td className="font-semibold text-gray-800">{totalStock} units</td>
                        <td>
                          {totalStock > 20 ? (
                            <span className="badge success">In Stock</span>
                          ) : totalStock > 0 ? (
                            <span className="badge warning">Low Stock</span>
                          ) : (
                            <span className="badge danger">Out of Stock</span>
                          )}
                        </td>
                        {!isDoctor && (
                          <td>
                            <div className="flex justify-end gap-1">
                              <button
                                className="button ghost sm"
                                onClick={() => openStockInModal(medicine)}
                                title="Add Stock (Stock-In)"
                                type="button"
                              >
                                <PackagePlus size={16} className="text-emerald-600" />
                              </button>
                              <button
                                className="button ghost sm"
                                onClick={() => void openDispenseModal(medicine)}
                                disabled={totalStock === 0}
                                title="Dispense Stock"
                                type="button"
                              >
                                <MinusCircle size={16} className={totalStock === 0 ? 'text-gray-300' : 'text-rose-600'} />
                              </button>
                              <button
                                className="button ghost sm"
                                onClick={() => void openArchiveModal(medicine)}
                                disabled={totalStock === 0}
                                title="Archive Stock"
                                type="button"
                              >
                                <Archive size={16} className={totalStock === 0 ? 'text-gray-300' : 'text-amber-600'} />
                              </button>
                              <button
                                className="button ghost sm"
                                onClick={() => openEditModal(medicine)}
                                title="Edit Catalog Info"
                                type="button"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                className="button ghost sm"
                                onClick={() => void handleDelete(medicine)}
                                title="Delete Catalog Definition"
                                type="button"
                              >
                                <Trash2 size={16} className="text-red-500" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Catalog Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingMedicine ? 'Edit Drug Info' : 'Add New Drug to Catalog'}</h3>
              <button className="button ghost" onClick={closeModal} type="button">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <label>
                Medicine Name
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Amoxicillin 500mg"
                  required
                />
              </label>
              <label>
                Category / Uses
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g., Antibiotic"
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="button ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Drug'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock-In Modal */}
      {isStockInOpen && stockInMedicine && (
        <div className="modal-backdrop" onClick={closeStockInModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Stock-In: {stockInMedicine.name}</h3>
              <button className="button ghost" onClick={closeStockInModal} type="button">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitStockIn} className="modal-form">
              <label>
                Quantity Received
                <input
                  type="number"
                  min="1"
                  value={stockInQuantity}
                  onChange={(e) => setStockInQuantity(e.target.value)}
                  required
                />
              </label>
              <label>
                Date Received
                <input
                  type="date"
                  value={stockInDateReceived}
                  onChange={(e) => setStockInDateReceived(e.target.value)}
                  required
                />
              </label>
              <label>
                Expiration Date
                <input
                  type="date"
                  value={stockInExpirationDate}
                  onChange={(e) => setStockInExpirationDate(e.target.value)}
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="button ghost" onClick={closeStockInModal}>
                  Cancel
                </button>
                <button type="submit" className="button primary" disabled={stockInSubmitting}>
                  {stockInSubmitting ? 'Adding...' : 'Confirm Stock-In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      <DispenseMedicineModal
        isOpen={isDispenseOpen}
        onClose={closeDispenseModal}
        medicineName={dispenseMedicine?.name ?? ''}
        medicineCategory={dispenseMedicine?.category ?? ''}
        batches={dispenseBatches}
        onSubmit={submitDispense}
      />

      {/* Archive Modal */}
      <ArchiveMedicineModal
        isOpen={isArchiveOpen}
        onClose={closeArchiveModal}
        medicineName={archiveMedicine?.name ?? ''}
        medicineCategory={archiveMedicine?.category ?? ''}
        batches={archiveBatches}
        onSubmit={submitArchive}
      />

      {/* Archived Medicines Log Modal */}
      <ArchivedMedicinesModal
        isOpen={isArchivedOpen}
        onClose={() => setArchivedOpen(false)}
        campusId={user?.campus_id ?? null}
        onChanged={() => void loadData()}
      />
    </div>
  );
}
