import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import { StatusBadge } from '../components/StatusBadge';

interface Campus {
  id: number;
  code: string;
  name: string;
  address?: string;
}

interface Medicine {
  id: number;
  name: string;
  category: string;
}

interface BranchRequest {
  id: number;
  from_campus_id: number;
  to_campus_id: number;
  medicine_id: number;
  quantity_requested: number;
  status: string;
  requested_by: number;
  approved_by: number | null;
  created_at: string;
  medicine?: Medicine;
  from_campus?: Campus;
  to_campus?: Campus;
  requested_by_user?: { id: number; first_name: string; last_name: string };
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

export function NurseInventoryRequestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<BranchRequest[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'incoming' | 'outgoing' | 'all'>('incoming');

  // Modal
  const [isModalOpen, setModalOpen] = useState(false);
  const [formToCampus, setFormToCampus] = useState<number | ''>('');
  const [formMedicine, setFormMedicine] = useState<number | ''>('');
  const [formQuantity, setFormQuantity] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const campusId = user?.campus_id ?? null;

  const loadAll = useCallback(async () => {
    if (!campusId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [requestsRes, campusesRes, medicinesRes] = await Promise.all([
        api.get<BranchRequest[]>('/branch-requests', { params: { campus_id: campusId } }),
        api.get<Campus[]>('/campuses', { params: { exclude_id: campusId } }),
        api.get<Medicine[]>('/medicines'),
      ]);

      setRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
      setCampuses(Array.isArray(campusesRes.data) ? campusesRes.data : []);
      setMedicines(Array.isArray(medicinesRes.data) ? medicinesRes.data : []);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load branch requests.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredRequests = useMemo(() => {
    let list = requests;

    if (tab === 'incoming' && campusId) {
      list = list.filter((r) => r.to_campus_id === campusId);
    } else if (tab === 'outgoing' && campusId) {
      list = list.filter((r) => r.from_campus_id === campusId);
    }

    const normalized = search.trim().toLowerCase();
    if (normalized === '') return list;

    return list.filter((request) => {
      const medicineName = request.medicine?.name?.toLowerCase() ?? '';
      const status = request.status?.toLowerCase() ?? '';
      const fromName = request.from_campus?.name?.toLowerCase() ?? '';
      const toName = request.to_campus?.name?.toLowerCase() ?? '';
      return (
        medicineName.includes(normalized) ||
        status.includes(normalized) ||
        fromName.includes(normalized) ||
        toName.includes(normalized)
      );
    });
  }, [requests, tab, campusId, search]);

  const openModal = (): void => {
    setFormToCampus('');
    setFormMedicine('');
    setFormQuantity('');
    setModalOpen(true);
  };

  const closeModal = (): void => {
    setModalOpen(false);
    setFormToCampus('');
    setFormMedicine('');
    setFormQuantity('');
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!campusId || submitting) return;

    setSubmitting(true);
    try {
      await api.post('/branch-requests', {
        from_campus_id: campusId,
        to_campus_id: formToCampus,
        medicine_id: formMedicine,
        quantity_requested: formQuantity,
      });

      void notifySuccess('Request sent to supplying campus.', 'Request Submitted');
      closeModal();
      await loadAll();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to submit request.'), 'Request Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (request: BranchRequest): Promise<void> => {
    const confirmed = await Swal.fire({
      icon: 'question',
      title: 'Approve request?',
      html: `<p>Approve <strong>${request.quantity_requested}</strong> units of <strong>${request.medicine?.name}</strong>?</p>`,
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#16a34a',
      cancelButtonText: 'Cancel',
    });

    if (!confirmed.isConfirmed) return;

    try {
      await api.patch(`/branch-requests/${request.id}/approve`);
      void notifySuccess('Request approved.', 'Approved');
      await loadAll();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to approve request.'), 'Approve Failed');
    }
  };

  const handleReject = async (request: BranchRequest): Promise<void> => {
    const { value: reason, isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Reject request?',
      input: 'text',
      inputLabel: 'Reason (optional)',
      inputPlaceholder: 'e.g., Insufficient stock',
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Cancel',
    });

    if (!isConfirmed) return;

    try {
      await api.patch(`/branch-requests/${request.id}/reject`, {
        reason: reason || '',
      });
      void notifySuccess('Request rejected.', 'Rejected');
      await loadAll();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to reject request.'), 'Reject Failed');
    }
  };

  const handleComplete = async (request: BranchRequest): Promise<void> => {
    const confirmed = await Swal.fire({
      icon: 'question',
      title: 'Mark as completed?',
      text: 'This confirms the medicine has been received.',
      showCancelButton: true,
      confirmButtonText: 'Complete',
      confirmButtonColor: '#16a34a',
      cancelButtonText: 'Cancel',
    });

    if (!confirmed.isConfirmed) return;

    try {
      await api.patch(`/branch-requests/${request.id}/complete`);
      void notifySuccess('Request completed.', 'Completed');
      await loadAll();
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to complete request.'), 'Complete Failed');
    }
  };

  const onMenuClick = (item: MenuItem): void => {
    if (item.path !== '/nurse/inventory/requests') {
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
            const isActive = item.key === 'requests';
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
              <h2>Branch Requests</h2>
              <p className="muted small">Request and manage medicine transfers between campuses.</p>
            </div>
            <div className="nurse-dashboard-actions">
              <button
                className="button ghost nurse-refresh-button"
                onClick={() => void loadAll()}
                type="button"
                disabled={loading}
              >
                <RefreshCw className={`nurse-refresh-icon${loading ? ' spinning' : ''}`} size={16} strokeWidth={2.2} />
              </button>
              <button className="button" onClick={openModal} type="button">
                <Plus size={16} strokeWidth={2.2} />
                New Request
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head nurse-dashboard-consultation-head">
            <div className="nurse-dashboard-consultation-title-wrap" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={tab === 'incoming' ? 'button' : 'button ghost'}
                onClick={() => setTab('incoming')}
                type="button"
              >
                Incoming
              </button>
              <button
                className={tab === 'outgoing' ? 'button' : 'button ghost'}
                onClick={() => setTab('outgoing')}
                type="button"
              >
                Outgoing
              </button>
              <button
                className={tab === 'all' ? 'button' : 'button ghost'}
                onClick={() => setTab('all')}
                type="button"
              >
                All
              </button>
            </div>
            <label className="nurse-records-search nurse-dashboard-consultation-search">
              <Search className="nurse-dashboard-consultation-search-icon" size={16} strokeWidth={2.25} />
              <input
                placeholder="Search..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search branch requests"
              />
            </label>
          </div>

          {loading ? (
            <p className="muted">Loading requests...</p>
          ) : filteredRequests.length === 0 ? (
            <p className="empty-state">No branch requests found.</p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Branch requests table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => {
                    const isIncoming = campusId && request.to_campus_id === campusId;
                    const isPending = request.status === 'pending';
                    const isApproved = request.status === 'approved';

                    return (
                      <tr key={request.id}>
                        <td>{request.medicine?.name ?? 'Unknown'}</td>
                        <td>{request.from_campus?.name ?? `Campus ${request.from_campus_id}`}</td>
                        <td>{request.to_campus?.name ?? `Campus ${request.to_campus_id}`}</td>
                        <td>{request.quantity_requested}</td>
                        <td>
                          <StatusBadge status={request.status} />
                        </td>
                        <td>{formatDateTime(request.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            {isIncoming && isPending && (
                              <>
                                <button
                                  className="button ghost"
                                  onClick={() => void handleApprove(request)}
                                  title="Approve"
                                  type="button"
                                >
                                  <CheckCircle2 size={16} strokeWidth={2.2} />
                                </button>
                                <button
                                  className="button ghost"
                                  onClick={() => void handleReject(request)}
                                  title="Reject"
                                  type="button"
                                >
                                  <XCircle size={16} strokeWidth={2.2} />
                                </button>
                              </>
                            )}
                            {isIncoming && isApproved && (
                              <button
                                className="button ghost"
                                onClick={() => void handleComplete(request)}
                                title="Complete"
                                type="button"
                              >
                                <Send size={16} strokeWidth={2.2} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              <h3>New Branch Request</h3>
              <button className="button ghost" onClick={closeModal} type="button">
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <label>
                Supplying Campus
                <select
                  required
                  value={formToCampus}
                  onChange={(event) => setFormToCampus(event.target.value ? Number(event.target.value) : '')}
                >
                  <option value="">Select campus...</option>
                  {campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Medicine
                <select
                  required
                  value={formMedicine}
                  onChange={(event) => setFormMedicine(event.target.value ? Number(event.target.value) : '')}
                >
                  <option value="">Select medicine...</option>
                  {medicines.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>
                      {medicine.name} ({medicine.category})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  required
                  min={1}
                  value={formQuantity}
                  onChange={(event) => setFormQuantity(event.target.value ? Number(event.target.value) : '')}
                  placeholder="e.g., 50"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button ghost" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}