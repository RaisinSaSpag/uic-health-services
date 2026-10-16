import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  RefreshCw,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventoryBasePath } from '../lib/useInventoryBasePath';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { PaginatedResponse } from '../types/hsms';

interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values_json: Record<string, unknown> | null;
  new_values_json: Record<string, unknown> | null;
  created_at: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
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

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'medicine.created', label: 'Medicine Created' },
  { value: 'medicine.updated', label: 'Medicine Updated' },
  { value: 'medicine.deleted', label: 'Medicine Deleted' },
  { value: 'inventory.stocked_in', label: 'Stock In' },
  { value: 'inventory.dispensed', label: 'Dispensed' },
  { value: 'inventory.archived', label: 'Archived' },
  { value: 'branch_request.created', label: 'Request Created' },
  { value: 'branch_request.approved', label: 'Request Approved' },
  { value: 'branch_request.rejected', label: 'Request Rejected' },
  { value: 'branch_request.completed', label: 'Request Completed' },
  { value: 'prescription.created', label: 'Prescription Created' },
  { value: 'prescription.dispensed', label: 'Prescription Dispensed' },
  { value: 'prescription.cancelled', label: 'Prescription Cancelled' },
];

function humanizeAction(action: string): string {
  return action
    .replace('.', ' Ã¢â‚¬â€ ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function NurseInventoryHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { basePath } = useInventoryBasePath();

  const resolvedMenuItems = useMemo(
    () =>
      menuItems.map((item) => ({
        ...item,
        path: item.path.replace('/nurse/inventory', basePath),
      })),
    [basePath],
  );

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const campusId = user?.campus_id ?? null;

  const loadLogs = useCallback(async () => {
    if (!campusId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        campus_id: campusId,
        per_page: 50,
      };

      if (actionFilter) {
        params.action = actionFilter;
      }

      const response = await api.get<PaginatedResponse<AuditLog>>('/history-log', { params });
      setLogs(response.data.data ?? []);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load history log.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [campusId, actionFilter]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (normalized === '') return logs;

    return logs.filter((log) => {
      const userName = log.user ? userDisplayName(log.user).toLowerCase() : '';
      const action = log.action.toLowerCase();
      const entityType = log.entity_type.toLowerCase();
      return (
        action.includes(normalized) ||
        entityType.includes(normalized) ||
        userName.includes(normalized)
      );
    });
  }, [logs, search]);

  const onMenuClick = (item: MenuItem): void => {
    if (item.path !== '/nurse/inventory/history') {
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
            const isActive = item.key === 'history';
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
              <h2>Activity History</h2>
              <p className="muted small">All inventory activity at {campusName}.</p>
            </div>
            <button
              className="button ghost nurse-refresh-button"
              onClick={() => void loadLogs()}
              type="button"
              disabled={loading}
            >
              <RefreshCw className={`nurse-refresh-icon${loading ? ' spinning' : ''}`} size={16} strokeWidth={2.2} />
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head nurse-dashboard-consultation-head">
            <div className="nurse-dashboard-consultation-title-wrap" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                style={{ padding: '0.5rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #e0e0e0' }}
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <label className="nurse-records-search nurse-dashboard-consultation-search">
              <Search className="nurse-dashboard-consultation-search-icon" size={16} strokeWidth={2.25} />
              <input
                placeholder="Search activity..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search history"
              />
            </label>
          </div>

          {loading ? (
            <p className="muted">Loading activity...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="empty-state">No activity records found.</p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Activity history table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.created_at)}</td>
                      <td>{humanizeAction(log.action)}</td>
                      <td>{log.entity_type} #{log.entity_id ?? '-'}</td>
                      <td>{log.user ? userDisplayName(log.user) : 'System'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}