import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Package,
  RefreshCw,
  Search,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventoryBasePath } from '../lib/useInventoryBasePath';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';

interface Campus {
  id: number;
  name: string;
}

interface Medicine {
  id: number;
  name: string;
  category: string;
}

interface BranchStockItem {
  id: number;
  medicine_id: number;
  campus_id: number;
  quantity: number;
  available_quantity?: number;
  date_received: string;
  expiration_date: string;
  medicine?: Medicine;
  campus?: Campus;
}

interface GroupedBranchStock {
  medicine_id: number;
  medicine_name: string;
  category: string;
  campus_id: number;
  campus_name: string;
  total_available: number;
  batches_count: number;
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

export function NurseInventoryOtherBranchPage() {
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

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('');
  const [branchStocks, setBranchStocks] = useState<GroupedBranchStock[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Request Transfer Modal State
  const [isRequestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<GroupedBranchStock | null>(null);
  const [requestQuantity, setRequestQuantity] = useState<string>('1');
  const [requestNotes, setRequestNotes] = useState<string>('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const userName = useMemo(() => userDisplayName(user), [user]);
  const currentCampusName = useMemo(() => user?.campus ?? 'Main Campus', [user]);

  // Load List of Other Campuses
  const loadCampuses = useCallback(async () => {
    try {
      const res = await api.get<Campus[]>('/campuses');
      const allCampuses = Array.isArray(res.data) ? res.data : [];
      // Filter out user's current campus
      const otherCampuses = allCampuses.filter((c) => c.id !== user?.campus_id);
      setCampuses(otherCampuses);

      if (otherCampuses.length > 0 && !selectedCampusId) {
        setSelectedCampusId(otherCampuses[0].id.toString());
      }
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load campuses list.'), 'Load Failed');
    }
  }, [user?.campus_id, selectedCampusId]);

  // Fetch Stock for Selected Branch
  const loadBranchStocks = useCallback(async () => {
    if (!selectedCampusId) return;
    setLoading(true);

    try {
      const res = await api.get<BranchStockItem[]>('/inventory/available', {
        params: { campus_id: selectedCampusId },
      });

      const items = Array.isArray(res.data) ? res.data : [];

      // Group stock entries by medicine
      const groupedMap: Record<number, GroupedBranchStock> = {};

      items.forEach((item) => {
        const medId = item.medicine_id;
        const available = item.available_quantity ?? item.quantity ?? 0;

        if (!groupedMap[medId]) {
          groupedMap[medId] = {
            medicine_id: medId,
            medicine_name: item.medicine?.name ?? `Medicine #${medId}`,
            category: item.medicine?.category ?? 'General',
            campus_id: item.campus_id,
            campus_name: item.campus?.name ?? 'Branch Campus',
            total_available: 0,
            batches_count: 0,
          };
        }

        groupedMap[medId].total_available += available;
        groupedMap[medId].batches_count += 1;
      });

      setBranchStocks(Object.values(groupedMap));
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load branch stock items.'), 'Load Failed');
      setBranchStocks([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCampusId]);

  useEffect(() => {
    void loadCampuses();
  }, [loadCampuses]);

  useEffect(() => {
    if (selectedCampusId) {
      void loadBranchStocks();
    }
  }, [selectedCampusId, loadBranchStocks]);

  const filteredStocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branchStocks;

    return branchStocks.filter(
      (item) =>
        item.medicine_name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [branchStocks, search]);

  const openRequestModal = (item: GroupedBranchStock) => {
    setSelectedStockItem(item);
    setRequestQuantity('1');
    setRequestNotes('');
    setRequestModalOpen(true);
  };

  const closeRequestModal = () => {
    setRequestModalOpen(false);
    setSelectedStockItem(null);
    setRequestQuantity('1');
    setRequestNotes('');
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRequest || !selectedStockItem) return;

    const qty = parseInt(requestQuantity, 10);
    if (!Number.isInteger(qty) || qty < 1) {
      void notifyError('Quantity requested must be at least 1.', 'Invalid Quantity');
      return;
    }

    if (qty > selectedStockItem.total_available) {
      void notifyError(
        `Requested quantity cannot exceed available branch stock (${selectedStockItem.total_available}).`,
        'Exceeds Available Stock'
      );
      return;
    }

    setSubmittingRequest(true);
    try {
      await api.post('/branch-requests', {
        medicine_id: selectedStockItem.medicine_id,
        from_campus_id: selectedStockItem.campus_id, // requested branch
        to_campus_id: user?.campus_id, // target receiving branch
        quantity_requested: qty,
        notes: requestNotes.trim() || undefined,
      });

      void notifySuccess(
        `Transfer request for ${qty} unit(s) of ${selectedStockItem.medicine_name} submitted successfully!`,
        'Request Sent'
      );

      closeRequestModal();
      navigate(basePath === '/doctor/inventory' ? '/doctor/inventory/requests' : '/nurse/inventory/requests');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to submit branch transfer request.'), 'Request Failed');
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="avatar">{userName.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-role">{isDoctor ? 'Doctor' : 'Nurse'}</span>
          </div>
        </div>

        <div className="sidebar-campus">
          <Package size={16} />
          <span>{currentCampusName}</span>
        </div>

        <nav className="sidebar-nav">
          {resolvedMenuItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${item.key === 'stocks' ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="button ghost w-full flex items-center gap-2"
            onClick={() => navigate(basePath === '/doctor/inventory' ? '/doctor' : '/nurse')}
            type="button"
          >
            <ArrowLeft size={16} />
            <span>Back to Main Dashboard</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>Other Branch Inventory Stocks</h1>
            <p className="muted">View stock levels across other UIC campus branches and request transfers</p>
          </div>
        </header>

        {/* Branch Selector & Search Bar */}
        <div className="panel mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Branch Selector */}
            <div className="flex items-center gap-2">
              <Building2 className="text-[#d44974]" size={20} />
              <select
                value={selectedCampusId}
                onChange={(e) => setSelectedCampusId(e.target.value)}
                className="input font-medium text-gray-800"
              >
                {campuses.length === 0 ? (
                  <option value="">No other branches found</option>
                ) : (
                  campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Search Input */}
            <div className="search-bar relative md:col-span-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search medicine by name or category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>
              <button
                className="button ghost"
                onClick={() => void loadBranchStocks()}
                type="button"
                title="Refresh Branch Stocks"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Branch Stocks Table */}
        <div className="panel">
          {loading ? (
            <p className="muted text-center py-8">Loading stock levels for selected branch...</p>
          ) : filteredStocks.length === 0 ? (
            <p className="muted text-center py-8">
              No available medicine stocks found for this branch matching your query.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Category</th>
                    <th>Available Stock</th>
                    <th>Batches</th>
                    {!isDoctor && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map((item) => (
                    <tr key={item.medicine_id}>
                      <td className="font-medium">{item.medicine_name}</td>
                      <td className="muted">{item.category}</td>
                      <td className="font-semibold text-gray-800">{item.total_available} units</td>
                      <td className="muted">{item.batches_count} batch(es)</td>
                      {!isDoctor && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="button primary sm"
                            onClick={() => openRequestModal(item)}
                            title="Request Supply Transfer"
                            type="button"
                          >
                            <Send size={14} />
                            <span>Request Stock</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Request Stock Modal */}
      {isRequestModalOpen && selectedStockItem && (
        <div className="modal-backdrop" onClick={closeRequestModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Request Transfer: {selectedStockItem.medicine_name}</h3>
              <button className="button ghost" onClick={closeRequestModal} type="button">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendRequest} className="modal-form">
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm space-y-1 mb-2">
                <div>
                  <span className="font-semibold text-gray-700">Source Branch:</span>{' '}
                  <span className="text-gray-900">{selectedStockItem.campus_name}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Available at Branch:</span>{' '}
                  <span className="font-bold text-[#d44974]">{selectedStockItem.total_available} units</span>
                </div>
              </div>

              <label>
                Quantity Requested
                <input
                  type="number"
                  min="1"
                  max={selectedStockItem.total_available}
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(e.target.value)}
                  required
                />
              </label>

              <label>
                Notes / Justification
                <textarea
                  rows={3}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="e.g., Urgent replenishment for high patient demand..."
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button ghost" onClick={closeRequestModal}>
                  Cancel
                </button>
                <button type="submit" className="button primary" disabled={submittingRequest}>
                  {submittingRequest ? 'Sending Request...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
