import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyBanner } from '../lib/alerts';
import { normalizeRoleName, userDisplayName } from '../lib/format';
import type { PaginatedResponse, RoleName } from '../types/hsms';

interface NavItem {
  to: string;
  label: string;
  roles: RoleName[];
}

const navItems: NavItem[] = [
  {
    to: '/patient',
    label: 'Patient Portal',
    roles: ['student', 'employee'],
  },
  {
    to: '/nurse',
    label: 'Nurse Dashboard',
    roles: ['nurse', 'admin'],
  },
  {
    to: '/doctor',
    label: 'Doctor Referrals',
    roles: ['doctor', 'admin'],
  },
  {
    to: '/admin',
    label: 'Audit Logs',
    roles: ['admin'],
  },
];

export function AppShell() {
  const { user, hasRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const currentRole = normalizeRoleName(user?.role);
  const isClinician = currentRole === 'nurse' || currentRole === 'doctor';
  const [notificationCount, setNotificationCount] = useState(0);
  const [isBannerEnabled, setIsBannerEnabled] = useState(true);
  const previousNotificationCountRef = useRef<number | null>(null);

  const notificationStorageKey = useMemo(() => {
    if (!user) {
      return null;
    }

    return `hsms-notification-count:${user.id}:${currentRole}`;
  }, [currentRole, user]);

  const bannerPreferenceStorageKey = useMemo(() => {
    if (!user) {
      return null;
    }

    return `hsms-notification-banner-enabled:${user.id}:${currentRole}`;
  }, [currentRole, user]);

  useEffect(() => {
    if (!isClinician) {
      setIsBannerEnabled(true);
      return;
    }

    if (!bannerPreferenceStorageKey) {
      setIsBannerEnabled(true);
      return;
    }

    const storedValue = window.sessionStorage.getItem(bannerPreferenceStorageKey);

    if (storedValue === null) {
      setIsBannerEnabled(true);
      return;
    }

    setIsBannerEnabled(storedValue === '1');
  }, [bannerPreferenceStorageKey, isClinician]);

  const pollNotifications = useCallback(async (): Promise<void> => {
    if (!isClinician) {
      setNotificationCount(0);
      previousNotificationCountRef.current = null;
      return;
    }

    try {
      const response = await api.get<PaginatedResponse<unknown>>('/referrals', {
        params:
          currentRole === 'doctor'
            ? {
                status: 'pending_doctor',
                per_page: 1,
              }
            : {
                status: 'completed',
                per_page: 1,
              },
      });

      const currentCount = response.data.total;
      let previousCount = previousNotificationCountRef.current;

      if (previousCount === null && notificationStorageKey) {
        const storedValue = window.sessionStorage.getItem(notificationStorageKey);

        if (storedValue !== null) {
          const parsed = Number(storedValue);
          previousCount = Number.isNaN(parsed) ? null : parsed;
        }
      }

      if (isBannerEnabled && previousCount !== null && currentCount > previousCount) {
        if (currentRole === 'doctor') {
          void notifyBanner('A new referral consultation was sent by a nurse.', 'New Referral', 'info');
        } else {
          void notifyBanner('A doctor completed a referral with remarks and prescription.', 'Referral Completed', 'success');
        }
      }

      previousNotificationCountRef.current = currentCount;
      setNotificationCount(currentCount);

      if (notificationStorageKey) {
        window.sessionStorage.setItem(notificationStorageKey, String(currentCount));
      }
    } catch {
      // Silent polling failure by design.
    }
  }, [currentRole, isBannerEnabled, isClinician, notificationStorageKey]);

  useEffect(() => {
    void pollNotifications();
  }, [pollNotifications]);

  useEffect(() => {
    if (!isClinician) {
      return;
    }

    const timer = window.setInterval(() => {
      void pollNotifications();
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isClinician, pollNotifications]);

  const onNotificationClick = (): void => {
    if (currentRole === 'doctor') {
      navigate('/doctor/referrals');
      return;
    }

    if (currentRole === 'nurse') {
      navigate('/nurse/referrals');
    }
  };

  const onToggleBanners = (): void => {
    setIsBannerEnabled((current) => {
      const nextValue = !current;

      if (bannerPreferenceStorageKey) {
        window.sessionStorage.setItem(bannerPreferenceStorageKey, nextValue ? '1' : '0');
      }

      return nextValue;
    });
  };

  const hideNurseDashboardNavItem = currentRole === 'nurse' && location.pathname.startsWith('/nurse');
  const visibleNav = navItems
    .filter((item) => hasRole(item.roles))
    .filter((item) => !(hideNurseDashboardNavItem && item.to === '/nurse'));
  const isWideLayoutRoute = location.pathname.startsWith('/nurse') || location.pathname.startsWith('/doctor');
  const isWorkspaceLayoutRoute = location.pathname.startsWith('/patient') || location.pathname.startsWith('/admin');
  const layoutMainClassName = `layout-main${isWideLayoutRoute ? ' layout-main-wide' : ''}${isWorkspaceLayoutRoute ? ' layout-main-workspace' : ''}`;

  return (
    <div className="layout-shell">
      <header className="topbar">
        <div className="brand-group">
          <img
            alt="UIC Health Services Management System logo"
            className="brand-logo"
            src="/login-logo.png"
          />
          <div className="brand">
            <span className="brand-text">UIC Health Services Management System</span>
          </div>
        </div>

        {visibleNav.length > 0 && (
          <nav className="nav-links" aria-label="Main navigation">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="user-strip">
          <div className="identity">
            <strong>{userDisplayName(user)}</strong>
            <span className="muted role-chip">{currentRole || 'unknown role'}</span>
          </div>

          {isClinician && (
            <>
              <button
                className={`button ghost topbar-banner-toggle${isBannerEnabled ? ' active' : ''}`}
                onClick={onToggleBanners}
                type="button"
                aria-label={isBannerEnabled ? 'Disable notification banners for this session' : 'Enable notification banners for this session'}
                title={isBannerEnabled ? 'Banner popups enabled (session)' : 'Banner popups disabled (session)'}
              >
                Banners: {isBannerEnabled ? 'On' : 'Off'}
              </button>

              <button
                className="button ghost topbar-notification"
                onClick={onNotificationClick}
                type="button"
                aria-label="Notifications"
                title={currentRole === 'doctor' ? 'View pending referrals' : 'View referral updates'}
              >
                <Bell size={19} strokeWidth={2.3} />
                {notificationCount > 0 && <span className="topbar-notification-dot" aria-hidden="true" />}
              </button>
            </>
          )}
          <button className="button ghost" onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      <main className={layoutMainClassName}>
        <Outlet />
      </main>
    </div>
  );
}
