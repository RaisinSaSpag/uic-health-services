import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Building2,
  Filter,
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
import type { Campus } from '../types/hsms';

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

function StockBadge({ quantity }: { quantity: number }) {
  if (quantity === 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
        Out of stock
      </span>
    );
  }
  if (quantity <= 20) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
        Low · {quantity}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
      {quantity} units
    </span>
  );
}

export function NurseInventoryStocksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { basePath, isDoctor } = useInventoryBasePath();
  
  // 🚨 NEW: Read URL params for the KPI card links
  const [searchParams] = useSearchParams();

  const isCoordinator = user?.role === 'coordinator';

  const resolvedMenuItems = useMemo(
    () =>
      menuItems.map((item) => ({
        ...item,
        path: item.path.replace('/nurse/inventory', basePath),
      })),
    [basePath],
  );

  // Campus State
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [campusStockMap, setCampusStockMap] = useState<Record<number, number>>({});
  const [search, setSearch] = useState('');
  
  // 🚨 NEW: Initialize filter from URL param
  const [stockFilter, setStockFilter] = useState<'all' | 'out' | 'low' | 'healthy' | 'expiring'>(
    (searchParams.get('filter') as any) || 'all'
  );
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

  const isViewingOwnCampus = selectedCampusId === user?.campus_id || isCoordinator;
  const canWrite = isViewingOwnCampus;

  useEffect(() => {
    const loadCampuses = async () => {
      try {
        const res = await api.get<Campus[]>('/campuses');
        setCampuses(res.data);
        if (user?.campus_id) {
          setSelectedCampusId(user.campus_id);
        } else if (res.data.length > 0) {
          setSelectedCampusId(res.data[0].id);
        }
      } catch (err) {
        void notifyError('Failed to load campuses.', 'Error');
      }
    };
    void loadCampuses();
  }, [user?.campus_id]);

  const loadData = useCallback(async () => {
    if (!selectedCampusId) return;
    setLoading(true);
    try {
      const [medRes, availRes] = await Promise.all([
        api.get<Medicine[]>('/medicines'),
        api.get<AvailableStockItem[]>('/inventory/available', { params: { campus_id: selectedCampusId } })
      ]);

      const rawMeds = Array.isArray(medRes.data) ? medRes.data : [];
      const rawStock = Array.isArray(availRes.data) ? availRes.data : [];

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
  }, [selectedCampusId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 🚨 NEW FILTER LOGIC
  const filteredMedicines = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    
    return medicines.filter((medicine) => {
      const stock = campusStockMap[medicine.id] || 0;
      
      // Text Search Filter
      const matchesSearch = normalized === '' || 
        medicine.name.toLowerCase().includes(normalized) ||
        medicine.category.toLowerCase().includes(normalized);

      // Stock Level Filter
      let matchesStock = true;
      if (stockFilter === 'out') matchesStock = stock === 0;
      if (stockFilter === 'low') matchesStock = stock > 0 && stock <= 20;
      if (stockFilter === 'healthy') matchesStock = stock > 20;
      
      // For Expiring, we just show items that have stock for now
      // (To do this properly, the availableStocks endpoint would need to return expiration dates)
      if (stockFilter === 'expiring') matchesStock = stock > 0; 

      return matchesSearch && matchesStock;
    });
  }, [medicines, search, stockFilter, campusStockMap]);

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
        await api.patch(`/medicines/${editingMedicine.id}`, { name: formName.trim(), category: formCategory.trim() });
        void notifySuccess(`${formName} updated.`, 'Medicine Updated');
      } else {
        await api.post('/medicines', { name: formName.trim(), category: formCategory.trim() });
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

  const submitStockIn = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (stockInSubmitting || !stockInMedicine || !selectedCampusId) return;
    const quantity = parseInt(stockInQuantity, 10);
    if (quantity < 1) { void notifyError('Invalid quantity.', 'Error'); return; }

    setStockInSubmitting(true);
    try {
      await api.post('/inventory/stock-in', {
        medicine_id: stockInMedicine.id,
        campus_id: selectedCampusId,
        quantity: quantity,
        date_received: stockInDateReceived,
        expiration_date: stockInExpirationDate,
      });
      void notifySuccess(`Added ${quantity} units.`, 'Stock Added');
      setStockInOpen(false);
      await loadData();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to add stock.'), 'Stock-In Failed');
    } finally {
      setStockInSubmitting(false);
    }
  };

  const submitDispense = async (id: number, qty: number): Promise<void> => {
    try {
      await api.post('/inventory/dispense', { stock_in_id: id, quantity_dispensed: qty });
      void notifySuccess(`Dispensed ${qty} unit(s).`, 'Dispensed');
      setDispenseOpen(false);
      await loadData();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to dispense.'), 'Error');
    }
  };

  const submitArchive = async (id: number, qty: number, reason: string): Promise<void> => {
    try {
      await api.post('/inventory/archive', { stock_in_id: id, quantity: qty, reason });
      void notifySuccess(`Archived ${qty} unit(s).`, 'Archived');
      setArchiveOpen(false);
      await loadData();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to archive.'), 'Error');
    }
  };

  return (
    <div className="nurse-dashboard-page">
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
            <button className="nurse-side-link back-to-dashboard" onClick={() => navigate(basePath === '/doctor/inventory' ? '/doctor' : '/nurse')} type="button">
              <ArrowLeft className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">Back to Dashboard</span>
            </button>
          </div>
          {resolvedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === 'stocks';
            return (
              <div className="nurse-nav-item" key={item.key}>
                <button className={`nurse-side-link${isActive ? ' active' : ''}`} onClick={() => navigate(item.path)} type="button">
                  <Icon className="nurse-side-icon" size={18} strokeWidth={2.2} />
                  <span className="nurse-side-label">{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="main-content" style={{ padding: '1.5rem' }}>
        <header className="page-header" style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
              <Package size={24} color="#d44974" />
              Medicine Inventory
            </h1>
            <p className="muted" style={{ margin: '0.25rem 0 0 0' }}>Manage and monitor active drug stock levels.</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {!isCoordinator && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Building2 size={16} color="#64748b" />
                <select
                  value={selectedCampusId || ''}
                  onChange={(e) => setSelectedCampusId(Number(e.target.value))}
                  style={{ border: 'none', background: 'transparent', fontWeight: 500, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                >
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.id === user?.campus_id ? '(My Campus)' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {!isDoctor && isCoordinator && (
              <button className="button secondary" onClick={() => setArchivedOpen(true)} type="button">
                <Archive size={16} /> <span>Archived</span>
              </button>
            )}

            {canWrite && !isDoctor && !isCoordinator && (
              <button className="button secondary" onClick={() => setArchivedOpen(true)} type="button">
                <Archive size={16} /> <span>Archived</span>
              </button>
            )}
          </div>
        </header>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Search Bar */}
          <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
            <input
              type="text"
              placeholder="Search medicines by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white' }}
            />
          </div>

          {/* Stock Filter */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 0.5rem' }}>
            <Filter size={16} color="#64748b" style={{ marginLeft: '0.5rem' }} />
            <select 
              value={stockFilter} 
              onChange={(e) => setStockFilter(e.target.value as any)}
              style={{ padding: '0.75rem 0.5rem', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', fontWeight: 500, color: '#0f172a' }}
            >
              <option value="all">All Stock Levels</option>
              <option value="out">Out of Stock</option>
              <option value="low">Low Stock (≤ 20)</option>
              <option value="healthy">Healthy Stock (&gt; 20)</option>
              <option value="expiring">Expiring Soon</option>
            </select>
          </div>

          <button className="button ghost" onClick={() => void loadData()} type="button" style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '0 1rem' }}>
            <RefreshCw size={18} className={loading ? 'spinner' : ''} />
          </button>
          
          {canWrite && (
            <button className="button primary" onClick={openAddModal} type="button">
              <Plus size={16} /> Add Medicine
            </button>
          )}
        </div>

        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <p className="muted" style={{ padding: '2rem', textAlign: 'center' }}>Loading inventory...</p>
          ) : filteredMedicines.length === 0 ? (
            <p className="muted" style={{ padding: '2rem', textAlign: 'center' }}>No medicines found.</p>
          ) : (
            <div className="table-wrap">
              <table style={{ margin: 0 }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>Medicine Name</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>Category</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>Stock Level</th>
                    {!isDoctor && <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((medicine) => {
                    const stock = campusStockMap[medicine.id] || 0;
                    return (
                      <tr key={medicine.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', fontWeight: 500 }}>{medicine.name}</td>
                        <td style={{ padding: '1rem', color: '#64748b' }}>{medicine.category}</td>
                        <td style={{ padding: '1rem' }}><StockBadge quantity={stock} /></td>
                        {!isDoctor && (
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                              {canWrite ? (
                                <>
                                  <button className="button ghost sm" onClick={() => { setStockInMedicine(medicine); setStockInQuantity(''); setStockInDateReceived(new Date().toISOString().slice(0, 10)); setStockInExpirationDate(''); setStockInOpen(true); }} title="Stock-In">
                                    <PackagePlus size={16} color="#16a34a" />
                                  </button>
                                  <button className="button ghost sm" onClick={() => { setDispenseMedicine(medicine); setDispenseOpen(true); }} disabled={stock === 0} title="Dispense">
                                    <MinusCircle size={16} color={stock === 0 ? '#cbd5e1' : '#e11d48'} />
                                  </button>
                                  <button className="button ghost sm" onClick={() => { setArchiveMedicine(medicine); setArchiveOpen(true); }} disabled={stock === 0} title="Archive">
                                    <Archive size={16} color={stock === 0 ? '#cbd5e1' : '#d97706'} />
                                  </button>
                                </>
                              ) : (
                                <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.75rem', borderRadius: '4px', fontWeight: 600 }}>Read-only</span>
                              )}

                              {isCoordinator && (
                                <>
                                  <button className="button ghost sm" onClick={() => openEditModal(medicine)} title="Edit">
                                    <Edit3 size={16} />
                                  </button>
                                  <button className="button ghost sm" onClick={async () => {
                                    if (window.confirm(`Delete ${medicine.name}?`)) {
                                      await api.delete(`/medicines/${medicine.id}`);
                                      void loadData();
                                    }
                                  }} title="Delete">
                                    <Trash2 size={16} color="#ef4444" />
                                  </button>
                                </>
                              )}
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

      {/* Modals */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingMedicine ? 'Edit Medicine' : 'Add Medicine'}</h3>
              <button className="button ghost" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <label>Name<input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required /></label>
              <label>Category<input type="text" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} required /></label>
              <div className="modal-actions">
                <button type="button" className="button ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isStockInOpen && stockInMedicine && (
        <div className="modal-backdrop" onClick={() => setStockInOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Stock-In: {stockInMedicine.name}</h3><button className="button ghost" onClick={() => setStockInOpen(false)}><X size={18} /></button></div>
            <form onSubmit={submitStockIn} className="modal-form">
              <label>Quantity<input type="number" min="1" value={stockInQuantity} onChange={(e) => setStockInQuantity(e.target.value)} required /></label>
              <label>Date Received<input type="date" value={stockInDateReceived} onChange={(e) => setStockInDateReceived(e.target.value)} required /></label>
              <label>Expiration Date<input type="date" value={stockInExpirationDate} onChange={(e) => setStockInExpirationDate(e.target.value)} required /></label>
              <div className="modal-actions">
                <button type="button" className="button ghost" onClick={() => setStockInOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={stockInSubmitting}>Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DispenseMedicineModal isOpen={isDispenseOpen} onClose={() => setDispenseOpen(false)} medicineName={dispenseMedicine?.name ?? ''} medicineCategory={dispenseMedicine?.category ?? ''} batches={dispenseBatches} onSubmit={submitDispense} />
      <ArchiveMedicineModal isOpen={isArchiveOpen} onClose={() => setArchiveOpen(false)} medicineName={archiveMedicine?.name ?? ''} medicineCategory={archiveMedicine?.category ?? ''} batches={archiveBatches} onSubmit={submitArchive} />
      <ArchivedMedicinesModal isOpen={isArchivedOpen} onClose={() => setArchivedOpen(false)} campusId={selectedCampusId} onChanged={() => void loadData()} />
    </div>
  );
}