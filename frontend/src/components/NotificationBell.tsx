import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, Check, Info, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export interface NotificationItem {
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

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const campusId = user?.campus_id;

  const fetchNotifications = useCallback(async () => {
    if (!campusId) return;
    try {
      const res = await api.get<NotificationItem[]>('/notifications', {
        params: { campus_id: campusId },
      });
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [campusId]);

  useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    if (!campusId || unreadCount === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));

    try {
      await api.post('/notifications/mark-read', { campus_id: campusId });
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
      void fetchNotifications();
    }
  };

  const toggleDropdown = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && unreadCount > 0) {
      void handleMarkAllRead();
    }
  };

  const onViewAll = () => {
    setIsOpen(false);
    const role = (user?.role ?? '').toString().toLowerCase();
    navigate(role === 'doctor' ? '/doctor/notifications' : '/nurse/notifications');
  };

  const renderIcon = (type: string) => {
    if (type === 'low_stock' || type === 'warning' || type.startsWith('inventory.')) {
      return <AlertTriangle size={15} color="#f59e0b" />;
    }
    if (type.startsWith('branch_request.') || type === 'request') {
      return <Info size={15} color="#d44974" />;
    }
    return <Check size={15} color="#10b981" />;
  };

  return (
    <div className="notification-bell-wrap">
      <button
        type="button"
        onClick={toggleDropdown}
        className="button ghost topbar-notification"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={2.3} />
        {unreadCount > 0 && <span className="topbar-notification-dot" aria-hidden="true" />}
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 55,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div className="notification-dropdown">
            <div className="notification-dropdown-header">
              <div className="notification-dropdown-title">
                <Bell size={16} strokeWidth={2.3} />
                <span>Notifications</span>
              </div>
              <button
                type="button"
                className="notification-dropdown-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
              >
                <X size={16} />
              </button>
            </div>

            <div className="notification-dropdown-list">
              {notifications.length === 0 ? (
                <div className="notification-dropdown-empty">No notifications found</div>
              ) : (
                notifications.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className={`notification-item${!item.is_read ? ' unread' : ''}`}
                  >
                    <div className="notification-item-icon">{renderIcon(item.type)}</div>
                    <div className="notification-item-body">
                      <p className="notification-item-message">
                        {item.message.replace(/\[req:\d+\]/g, '')}
                      </p>
                      <span className="notification-item-time">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="notification-dropdown-footer">
              <button
                type="button"
                onClick={onViewAll}
                className="notification-dropdown-viewall"
              >
                View all notifications →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};