import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, RefreshCw, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { AuditLog, PaginatedResponse } from '../types/hsms';

interface AuditFilterState {
  action: string;
  entity_type: string;
  user_id: string;
}

export function CoordinatorAuditPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilterState>({
    action: '',
    entity_type: '',
    user_id: '',
  });

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<PaginatedResponse<AuditLog>>('/audit-logs', {
        params: {
          page,
          per_page: 20,
          action: filters.action || undefined,
          entity_type: filters.entity_type || undefined,
          user_id: filters.user_id || undefined,
        },
      });
      setLogs(response.data.data);
      setLastPage(response.data.last_page);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load audit logs.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const applyFilters = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setPage(1); // Reset to page 1 when applying new filters
    void loadAuditLogs();
  };

  const formatPayload = (value: Record<string, unknown> | null | undefined): string => {
    if (!value || Object.keys(value).length === 0) return 'No details';
    return JSON.stringify(value, null, 2);
  };

  return (
    <div className="page" style={{ padding: '1.5rem' }}>
      <header className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <button 
            onClick={() => navigate('/coordinator')}
            style={{ background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem', padding: 0 }}
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={24} color="#d44974" />
            System Audit Logs
          </h2>
          <p className="muted">View all system activities, logins, and data changes.</p>
        </div>
      </header>

      {/* Filters */}
      <div className="panel mb-4">
        <form onSubmit={applyFilters} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="field" style={{ flex: 1, minWidth: '200px' }}>
            <span>Action</span>
            <input 
              type="text" 
              placeholder="e.g., user.created" 
              value={filters.action} 
              onChange={(e) => setFilters({ ...filters, action: e.target.value })} 
            />
          </label>
          <label className="field" style={{ flex: 1, minWidth: '200px' }}>
            <span>Entity Type</span>
            <input 
              type="text" 
              placeholder="e.g., consultation" 
              value={filters.entity_type} 
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })} 
            />
          </label>
          <button type="submit" className="button primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={16} /> Filter
          </button>
          <button type="button" className="button ghost" onClick={() => { setFilters({ action: '', entity_type: '', user_id: '' }); setPage(1); void loadAuditLogs(); }}>
            <RefreshCw size={16} /> Reset
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p className="muted" style={{ padding: '2rem', textAlign: 'center' }}>Loading audit logs...</p>
        ) : logs.length === 0 ? (
          <p className="muted" style={{ padding: '2rem', textAlign: 'center' }}>No logs found matching your filters.</p>
        ) : (
          <div className="table-wrap">
            <table style={{ margin: 0 }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>Timestamp</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>Actor</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>Action</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>Entity</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.created_at)}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                      {log.user ? userDisplayName(log.user) : 'System'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                      {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <details>
                        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#d44974' }}>View JSON</summary>
                        <pre style={{ fontSize: '0.75rem', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem', maxWidth: '300px', overflowX: 'auto' }}>
                          {formatPayload(log.new_values || log.old_values)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <span className="muted small">Page {page} of {lastPage}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="button ghost sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft size={16} /> Prev
            </button>
            <button className="button ghost sm" disabled={page === lastPage} onClick={() => setPage(p => Math.min(lastPage, p + 1))}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}