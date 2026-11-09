import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  RefreshCw,
  Search,
  X,
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
  { value: 'prescription.dispensed_fifo', label: 'Prescription Dispensed (FIFO)' },
  { value: 'prescription.cancelled', label: 'Prescription Cancelled' },
];

function humanizeAction(action: string): string {
  return action
    .replace('.', ' — ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderReadableData(data: Record<string, unknown> | null, tone: 'green' | 'red') {
  if (!data || Object.keys(data).length === 0) return null;

  const bgColor = tone === 'green' ? '#f0fdf4' : '#fef2f2';
  const borderColor = tone === 'green' ? '#bbf7d0' : '#fecaca';
  const keyColor = tone === 'green' ? '#166534' : '#991b1b';
  const valueColor = tone === 'green' ? '#064e3b' : '#7f1d1d';

  return (
    <div style={{ background: bgColor, padding: '1rem', borderRadius: '8px', border: `1px solid ${borderColor}`, marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Object.entries(data).map(([key, value]) => {
        const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const displayValue = value === null ? 'None' : String(value);

        return (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${borderColor}`, paddingBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', color: keyColor, fontWeight: 500 }}>{formattedKey}:</span>
            <span style={{ fontSize: '0.85rem', color: valueColor, fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>
              {displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
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

  // 🚨 Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<any | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

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

  const handleRowClick = async (log: AuditLog) => {
    setSelectedLog(log);
    setTransactionDetails(null);

    // If this is a prescription dispense, fetch the patient name
    if (log.action === 'prescription.dispensed_fifo' || log.action === 'prescription.dispensed') {
      setIsFetchingDetails(true);
      try {
        const res = await api.get(`/prescriptions/${log.entity_id}`);
        setTransactionDetails(res.data);
      } catch (err) {
        console.error("Could not fetch prescription details", err);
      } finally {
        setIsFetchingDetails(false);
      }
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
                    <tr 
                      key={log.id} 
                      onClick={() => void handleRowClick(log)}
                      style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
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

      {/* 🚨 Transaction Detail Modal */}
      {selectedLog && (
        <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
            <div className="modal-head">
              <h3>Transaction Details</h3>
              <button className="button ghost" onClick={() => setSelectedLog(null)}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Action</span>
                  <p style={{ margin: '0.25rem 0 0 0', fontWeight: 500 }}>{humanizeAction(selectedLog.action)}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Date & Time</span>
                  <p style={{ margin: '0.25rem 0 0 0' }}>{formatDateTime(selectedLog.created_at)}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Performed By</span>
                  <p style={{ margin: '0.25rem 0 0 0' }}>{selectedLog.user ? userDisplayName(selectedLog.user) : 'System'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Entity</span>
                  <p style={{ margin: '0.25rem 0 0 0', fontFamily: 'monospace', fontSize: '0.85rem' }}>{selectedLog.entity_type} #{selectedLog.entity_id}</p>
                </div>
              </div>

              {/* Patient / Prescription Info */}
              {isFetchingDetails ? (
                <p className="muted" style={{ fontSize: '0.85rem' }}>Fetching details...</p>
              ) : transactionDetails ? (
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a3224a', textTransform: 'uppercase' }}>Prescription Details</span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    <div>
                      <span className="muted">Patient:</span>
                      <div style={{ fontWeight: 600 }}>
                        {transactionDetails.consultation?.patient?.user?.first_name} {transactionDetails.consultation?.patient?.user?.last_name}
                      </div>
                    </div>
                    <div>
                      <span className="muted">Medicine:</span>
                      <div style={{ fontWeight: 600 }}>{transactionDetails.medicine?.name}</div>
                    </div>
                    <div>
                      <span className="muted">Quantity:</span>
                      <div style={{ fontWeight: 600 }}>{transactionDetails.quantity}</div>
                    </div>
                    <div>
                      <span className="muted">Dosage:</span>
                      <div style={{ fontWeight: 600 }}>{transactionDetails.dosage_instructions || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

              {/* 🚨 READABLE NEW VALUES */}
              {selectedLog.new_values_json && Object.keys(selectedLog.new_values_json).length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase' }}>Details</span>
                  {renderReadableData(selectedLog.new_values_json, 'green')}
                </div>
              )}

              {/* 🚨 READABLE OLD VALUES (If applicable) */}
              {selectedLog.old_values_json && Object.keys(selectedLog.old_values_json).length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase' }}>Previous Data</span>
                  {renderReadableData(selectedLog.old_values_json, 'red')}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}