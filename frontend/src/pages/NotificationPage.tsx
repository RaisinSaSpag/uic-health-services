import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Info,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';

interface NotificationItem {
  id: number;
  branch_id: number;
  reference_id?: number | null;
  type: string;
  message: string;
  is_read: number;
  created_at: string;
  request_id?: number | null;
  request_status?: string | null;
}

type Filter = 'all' | 'unread';

const POLL_INTERVAL_MS = 30000;

export function NotificationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const campusId = user?.campus_id ?? null;
  const isDoctor = (user?.role ?? '').toString().toLowerCase() === 'doctor';

  const loadNotifications = useCallback(async () => {
    if (!campusId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get<NotificationItem[]>('/notifications', {
        params: { campus_id: campusId, per_page: 50 },
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load notifications.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const filteredItems = useMemo(() => {
    if (filter === 'unread') {
      return items.filter((n) => !n.is_read);
    }
    return items;
  }, [items, filter]);

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const handleMarkAllRead = async () => {
    if (!campusId || unreadCount === 0) return;

    setMarkingRead(true);

    // Optimistic update
    setItems((prev) => prev.map((n) => ({ ...n, is_read: 1 })));

    try {
      await api.post('/notifications/mark-read', { campus_id: campusId });
      void notifySuccess('All notifications marked as read.', 'Done');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to mark all as read.'), 'Update Failed');
      void loadNotifications();
    } finally {
      setMarkingRead(false);
    }
  };

  const onBack = (): void => {
    if (isDoctor) {
      navigate('/doctor');
    } else {
      navigate('/nurse');
    }
  };

  const renderIcon = (type: string) => {
    if (type.startsWith('inventory.') || type === 'low_stock' || type === 'warning') {
      return <AlertTriangle size={18} color="#f59e0b" strokeWidth={2.2} />;
    }
    if (type.startsWith('branch_request.') || type === 'request') {
      return <Info size={18} color="#d44974" strokeWidth={2.2} />;
    }
    return <Check size={18} color="#10b981" strokeWidth={2.2} />;
  };

  return (
    <div className="nurse-dashboard-page">
      <aside className="nurse-sidebar" aria-label="Notifications sidebar">
        <div className="nurse-sidebar-brand">
          <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
          <div className="nurse-sidebar-identity">
            <h3>{userName}</h3>
            <p>{campusName}</p>
          </div>
        </div>

        <nav className="nurse-sidebar-nav" aria-label="Notifications navigation">
          <div className="nurse-nav-item">
            <button
              className="nurse-side-link back-to-dashboard"
              onClick={onBack}
              type="button"
            >
              <ArrowLeft className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">Back to Dashboard</span>
            </button>
          </div>
          <div className="nurse-nav-item">
            <button className="nurse-side-link active" type="button">
              <Bell className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">Notifications</span>
            </button>
          </div>
        </nav>
      </aside>

      <div className="nurse-dashboard-main">
        <section className="panel">
          <div className="panel-head nurse-dashboard-head">
            <div>
              <h2>Notifications</h2>
              <p className="muted small">
                {campusName} · {unreadCount} unread
              </p>
            </div>
            <div className="nurse-dashboard-actions" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="button ghost nurse-refresh-button"
                onClick={() => void loadNotifications()}
                type="button"
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw className={loading ? 'spinning' : ''} size={16} strokeWidth={2.2} />
              </button>
              <button
                className="button"
                onClick={() => void handleMarkAllRead()}
                type="button"
                disabled={markingRead || unreadCount === 0}
              >
                {markingRead ? 'Marking...' : 'Mark all as read'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              className={`button ${filter === 'all' ? 'primary' : 'ghost'}`}
              onClick={() => setFilter('all')}
              type="button"
            >
              All ({items.length})
            </button>
            <button
              className={`button ${filter === 'unread' ? 'primary' : 'ghost'}`}
              onClick={() => setFilter('unread')}
              type="button"
            >
              Unread ({unreadCount})
            </button>
          </div>

          {loading && items.length === 0 ? (
            <p className="muted">Loading notifications...</p>
          ) : filteredItems.length === 0 ? (
            <p className="empty-state">
              {filter === 'unread'
                ? 'No unread notifications. You are all caught up.'
                : 'No notifications yet.'}
            </p>
          ) : (
            <div>
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.9rem 0.75rem',
                    borderBottom: '1px solid var(--border)',
                    background: !item.is_read ? 'rgba(253, 245, 248, 0.55)' : 'transparent',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flexShrink: 0, marginTop: '0.15rem' }}>
                    {renderIcon(item.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, color: '#333', lineHeight: 1.5 }}>
                      {item.message.replace(/\[req:\d+\]/g, '')}
                    </p>
                    <div
                      className="muted small"
                      style={{
                        marginTop: '0.25rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                      {!item.is_read ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#d44974',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <CheckCheck size={12} />
                          Unread
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}