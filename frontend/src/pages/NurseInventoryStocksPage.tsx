import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit3,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
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

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const loadMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<Medicine[]>('/medicines');
      setMedicines(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load medicines.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMedicines();
  }, [loadMedicines]);

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
        void notifySuccess(`${formName} added to catalog.`, 'Medicine Added');
      }

      closeModal();
      await loadMedicines();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to save medicine.'), 'Save Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (medicine: Medicine): Promise<void> => {
    const confirmed = await Swal.fire({
      icon: 'warning',
      title: 'Delete medicine?',
      html: `<p>Are you sure you want to remove <strong>${medicine.name}</strong> from the catalog?</p>`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Cancel',
    });

    if (!confirmed.isConfirmed) return;

    try {
      await api.delete(`/medicines/${medicine.id}`);
      void notifySuccess(`${medicine.name} removed.`, 'Deleted');
      await loadMedicines();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to delete medicine.'), 'Delete Failed');
    }
  };

  const onMenuClick = (item: MenuItem): void => {
    if (item.path !== '/nurse/inventory/stocks') {
      navigate(item.path);
    }
  };

  return (
    <div className="nurse-dashboard-page">
      <aside className="nurse-sidebar" aria-label="Inventory sidebar">
        <div className="nurse-sidebar-brand">
          <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
          <div className="nurse-sidebar-identity">
            <h3>{userName}</h3>
            <p>{campusName}</p>
          </div>
        </div>

        <nav className="nurse-sidebar-nav" aria-label="Inventory navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === 'stocks';
            return (
              <div className="nurse-nav-item" key={item.key}>
                <button
                  className={`nurse-side-link${isActive ? ' active' : ''}`}
                  onClick={() => onMenuClick(item)}
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

      <div className="nurse-dashboard-main">
        <section className="panel">
          <div className="panel-head nurse-dashboard-head">
            <div>
              <h2>Medicine Catalog</h2>
              <p className="muted small">All medicines available in the system.</p>
            </div>
            <div className="nurse-dashboard-actions">
              <button
                className="button ghost nurse-refresh-button"
                onClick={() => void loadMedicines()}
                type="button"
                disabled={loading}
              >
                <RefreshCw
                  className={`nurse-refresh-icon${loading ? ' spinning' : ''}`}
                  size={16}
                  strokeWidth={2.2}
                />
              </button>
              <button className="button" onClick={openAddModal} type="button">
                <Plus size={16} strokeWidth={2.2} />
                Add Medicine
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head nurse-dashboard-consultation-head">
            <div className="nurse-dashboard-consultation-title-wrap">
              <h3 className="nurse-dashboard-consultation-title">Medicines</h3>
            </div>
            <label className="nurse-records-search nurse-dashboard-consultation-search">
              <Search className="nurse-dashboard-consultation-search-icon" size={16} strokeWidth={2.25} />
              <input
                placeholder="Search by name or category..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search medicines"
              />
            </label>
          </div>

          {loading ? (
            <p className="muted">Loading medicines...</p>
          ) : filteredMedicines.length === 0 ? (
            <p className="empty-state">
              {medicines.length === 0
                ? 'No medicines in the catalog yet. Click "Add Medicine" to start.'
                : 'No medicines matched your search.'}
            </p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Medicine catalog table">
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Category</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((medicine) => (
                    <tr key={medicine.id}>
                      <td>{medicine.name}</td>
                      <td>{medicine.category}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            className="button ghost"
                            onClick={() => openEditModal(medicine)}
                            title="Edit"
                            type="button"
                          >
                            <Edit3 size={16} strokeWidth={2.2} />
                          </button>
                          <button
                            className="button ghost"
                            onClick={() => void handleDelete(medicine)}
                            title="Delete"
                            type="button"
                          >
                            <Trash2 size={16} strokeWidth={2.2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingMedicine ? 'Edit Medicine' : 'Add Medicine'}</h3>
              <button className="button ghost" onClick={closeModal} type="button">
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <label>
                Medicine Name
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  placeholder="e.g., Paracetamol 500mg"
                />
              </label>

              <label>
                Category
                <input
                  type="text"
                  required
                  value={formCategory}
                  onChange={(event) => setFormCategory(event.target.value)}
                  placeholder="e.g., Pain Relief"
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? 'Saving...' : editingMedicine ? 'Save Changes' : 'Add Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}