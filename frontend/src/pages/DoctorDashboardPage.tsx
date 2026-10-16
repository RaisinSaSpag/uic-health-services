import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Info,
  LayoutDashboard,
  MessageSquare,
  Package,
  RefreshCw,
  Search,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { Consultation, PaginatedResponse, Referral } from '../types/hsms';

type DoctorSection = 'dashboard' | 'inventory' | 'referrals' | 'about' | 'chat' | 'notifications';

interface DoctorMenuItem {
  key: DoctorSection;
  label: string;
  icon: LucideIcon;
}

interface DoctorDashboardStats {
  totalReferrals: number;
  pendingReferrals: number;
  inProgressReferrals: number;
  completedReferrals: number;
}

const doctorMenuItems: DoctorMenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: Package,
  },
  {
    key: 'referrals',
    label: 'Referrals',
    icon: Stethoscope,
  },
  {
    key: 'about',
    label: 'About',
    icon: Info,
  },
 {
    key: 'chat',
    label: 'Messages',
    icon: MessageSquare,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: Bell,
  },
];
const doctorInventorySubItems: Array<{ key: string; label: string; path: string }> = [
  { key: 'inventory_dashboard', label: 'Dashboard', path: '/doctor/inventory' },
  { key: 'inventory_stocks', label: 'Stocks', path: '/doctor/inventory/stocks' },
  { key: 'inventory_requests', label: 'Branch Requests', path: '/doctor/inventory/requests' },
  { key: 'inventory_history', label: 'History', path: '/doctor/inventory/history' },
  { key: 'inventory_reports', label: 'Reports', path: '/doctor/inventory/reports' },
  { key: 'inventory_about', label: 'About', path: '/doctor/inventory/about' },
];

const defaultStats: DoctorDashboardStats = {
  totalReferrals: 0,
  pendingReferrals: 0,
  inProgressReferrals: 0,
  completedReferrals: 0,
};

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return 'Not provided';
  }

  return value.replace(/_/g, ' ');
}

function truncateText(value: string, maxLength = 84): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function DoctorDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSection, setActiveSection] = useState<DoctorSection>('dashboard');
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [stats, setStats] = useState<DoctorDashboardStats>(defaultStats);
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([]);
  const [recentSearch, setRecentSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const doctorName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    [],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      const [allReferralsResponse, pendingReferralsResponse, inProgressReferralsResponse, completedReferralsResponse, recentConsultationsResponse] =
        await Promise.all([
          api.get<PaginatedResponse<Referral>>('/referrals', { params: { per_page: 1 } }),
          api.get<PaginatedResponse<Referral>>('/referrals', { params: { status: 'pending_doctor', per_page: 1 } }),
          api.get<PaginatedResponse<Referral>>('/referrals', { params: { status: 'in_progress', per_page: 1 } }),
          api.get<PaginatedResponse<Referral>>('/referrals', { params: { status: 'completed', per_page: 1 } }),
          api.get<PaginatedResponse<Consultation>>('/consultations', {
            params: {
              referred_to_doctor: 1,
              per_page: 50,
            },
          }),
        ]);

      setStats({
        totalReferrals: allReferralsResponse.data.total,
        pendingReferrals: pendingReferralsResponse.data.total,
        inProgressReferrals: inProgressReferralsResponse.data.total,
        completedReferrals: completedReferralsResponse.data.total,
      });

      setRecentConsultations(recentConsultationsResponse.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load doctor dashboard data.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const filteredRecentConsultations = useMemo(() => {
    const normalizedSearch = recentSearch.trim().toLowerCase();

    if (normalizedSearch === '') {
      return recentConsultations;
    }

    return recentConsultations.filter((consultation) => {
      const searchableValues = [
        userDisplayName(consultation.patient?.user).toLowerCase(),
        normalizeText(consultation.consultation_type).toLowerCase(),
        normalizeText(consultation.status).toLowerCase(),
        (consultation.chief_complaint ?? '').toLowerCase(),
        (consultation.referral?.referral_reason ?? '').toLowerCase(),
      ];

      return searchableValues.some((value) => value.includes(normalizedSearch));
    });
  }, [recentConsultations, recentSearch]);

  const onMenuClick = (section: DoctorSection): void => {
    setActiveSection(section);

    if (section === 'dashboard') {
      navigate('/doctor');
      return;
    }

    if (section === 'inventory') {
      setIsInventoryOpen((current) => !current);
      return;
    }

    
    if (section === 'chat') {
      navigate('/doctor/chat');
      return;
    }

    if (section === 'notifications') {
      navigate('/doctor/notifications');
      return;
    }

    if (section === 'referrals') {
      navigate('/doctor/referrals');
      return;
    }

    if (section === 'about') {
      navigate('/doctor/about');
    }
  };

  const onInventorySubItemClick = (path: string): void => {
    navigate(path);
  };

  return (
    <div className="nurse-dashboard-page">
      <aside className="nurse-sidebar" aria-label="Doctor sidebar">
        <div className="nurse-sidebar-brand">
          <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
          <div className="nurse-sidebar-identity">
            <h3>{doctorName}</h3>
            <p>{campusName}</p>
          </div>
        </div>

        <nav className="nurse-sidebar-nav" aria-label="Doctor navigation">
          {doctorMenuItems.map((menuItem) => {
            const MenuIcon = menuItem.icon;

            return (
              <div className="nurse-nav-item" key={menuItem.key}>
                <button
                  className={`nurse-side-link${activeSection === menuItem.key ? ' active' : ''}`}
                  onClick={() => onMenuClick(menuItem.key)}
                  type="button"
                >
                  <MenuIcon className="nurse-side-icon" size={18} strokeWidth={2.2} />
                  <span className="nurse-side-label">{menuItem.label}</span>
                </button>
                {menuItem.key === 'inventory' && isInventoryOpen && (
                  <div className="nurse-sidebar-submenu open" role="menu">
                    {doctorInventorySubItems.map((subItem) => (
                      <button
                        key={subItem.key}
                        className="nurse-search-option"
                        onClick={() => onInventorySubItemClick(subItem.path)}
                        type="button"
                      >
                        <span>{subItem.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="nurse-dashboard-main">
        <section className="panel">
          <div className="panel-head nurse-dashboard-head">
            <div>
              <h2>Doctor Dashboard</h2>
              <p className="muted small">{todayLabel}</p>
            </div>

            <button
              className="button ghost nurse-refresh-button"
              onClick={() => void loadDashboard()}
              aria-label={loading ? 'Refreshing dashboard' : 'Refresh dashboard'}
              title="Refresh dashboard"
              type="button"
              disabled={loading}
            >
              <RefreshCw className={`nurse-refresh-icon${loading ? ' spinning' : ''}`} size={16} strokeWidth={2.2} />
            </button>
          </div>
        </section>

        <section className="nurse-kpi-grid" aria-label="Doctor metrics">
          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <ClipboardCheck className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Total Referral Consultations</p>
            </div>
            <p className="nurse-kpi-value">{stats.totalReferrals}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <ArrowUpRight className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Pending Referrals</p>
            </div>
            <p className="nurse-kpi-value">{stats.pendingReferrals}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <Stethoscope className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">In Progress Referrals</p>
            </div>
            <p className="nurse-kpi-value">{stats.inProgressReferrals}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <CheckCircle2 className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Completed Referrals</p>
            </div>
            <p className="nurse-kpi-value">{stats.completedReferrals}</p>
          </article>
        </section>

        <section className="panel">
          <div className="panel-head nurse-dashboard-consultation-head">
            <div className="nurse-dashboard-consultation-title-wrap">
              <h3 className="nurse-dashboard-consultation-title">Recent Referral Consultations</h3>
            </div>

            <label className="nurse-records-search nurse-dashboard-consultation-search" htmlFor="doctor-dashboard-search">
              <Search className="nurse-dashboard-consultation-search-icon" size={16} strokeWidth={2.25} aria-hidden="true" />
              <input
                id="doctor-dashboard-search"
                ref={searchInputRef}
                placeholder="Search referral consultations..."
                value={recentSearch}
                onChange={(event) => setRecentSearch(event.target.value)}
                aria-label="Search referral consultations"
              />
            </label>
          </div>

          {loading ? (
            <p className="muted">Loading dashboard data...</p>
          ) : recentConsultations.length === 0 ? (
            <p className="empty-state">No referral consultations are available yet.</p>
          ) : filteredRecentConsultations.length === 0 ? (
            <p className="empty-state">No referral consultations matched your search.</p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Recent referral consultations table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Consultation Type</th>
                    <th>Chief Complaint</th>
                    <th>Referral Reason</th>
                    <th>Status</th>
                    <th>Consulted</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecentConsultations.map((consultation) => (
                    <tr key={consultation.id}>
                      <td>{userDisplayName(consultation.patient?.user)}</td>
                      <td>{normalizeText(consultation.consultation_type)}</td>
                      <td>{truncateText(consultation.chief_complaint)}</td>
                      <td>{truncateText(consultation.referral?.referral_reason ?? 'Not provided')}</td>
                      <td>
                        <StatusBadge status={consultation.referral?.status ?? consultation.status} />
                      </td>
                      <td>
                        {formatDateTime(
                          consultation.consulted_at ?? consultation.completed_at ?? consultation.started_at ?? consultation.submitted_at,
                        )}
                      </td>
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
