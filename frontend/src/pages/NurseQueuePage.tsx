import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  GraduationCap,
  Info,
  LayoutDashboard,
  Package,
  Printer,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { Consultation, PaginatedResponse } from '../types/hsms';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about';
type SearchTarget = 'student' | 'employee';

interface NurseDashboardStats {
  totalPatients: number;
  studentPatients: number;
  employeePatients: number;
  todayConsultations: number;
  completedRegularConsultations: number;
  referralConsultations: number;
}

interface NurseMenuItem {
  key: NurseSection;
  label: string;
  icon: LucideIcon;
}

const defaultDashboardStats: NurseDashboardStats = {
  totalPatients: 0,
  studentPatients: 0,
  employeePatients: 0,
  todayConsultations: 0,
  completedRegularConsultations: 0,
  referralConsultations: 0,
};

const nurseMenuItems: NurseMenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'search',
    label: 'Search Records',
    icon: Search,
  },
  {
    key: 'print',
    label: 'Print Prescription',
    icon: Printer,
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: BarChart3,
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
];

const searchTargetOptions: Array<{ key: SearchTarget; label: string; icon: LucideIcon }> = [
  {
    key: 'student',
    label: 'Student',
    icon: GraduationCap,
  },
  {
    key: 'employee',
    label: 'Employee',
    icon: Briefcase,
  },
];

function truncateText(value: string, maxLength = 72): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return 'Not provided';
  }

  return value.replace(/_/g, ' ');
}

function consultationFlowLabel(consultation: Consultation): string {
  return consultation.referred_to_doctor ? 'Referral' : 'Walk-in/Scheduled';
}

function consultationActivityDateLabel(consultation: Consultation): string {
  return formatDateTime(
    consultation.consulted_at ?? consultation.completed_at ?? consultation.started_at ?? consultation.submitted_at,
  );
}

export function NurseQueuePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<NurseDashboardStats>(defaultDashboardStats);
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([]);
  const [recentConsultationSearch, setRecentConsultationSearch] = useState('');
  const [activeSection, setActiveSection] = useState<NurseSection>('dashboard');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('student');
  const [loading, setLoading] = useState(true);

  const nurseName = useMemo(() => userDisplayName(user), [user]);
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
  const philippineTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
    [],
  );
  const [philippineTime, setPhilippineTime] = useState(() => philippineTimeFormatter.format(new Date()));

  const todayDateParam = useMemo(() => {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      const [
        totalPatientsResponse,
        studentPatientsResponse,
        employeePatientsResponse,
        todayConsultationsResponse,
        regularConsultationsResponse,
        referralConsultationsResponse,
        recentConsultationsResponse,
      ] = await Promise.all([
        api.get<PaginatedResponse<unknown>>('/patients', {
          params: { per_page: 1 },
        }),
        api.get<PaginatedResponse<unknown>>('/patients', {
          params: { patient_type: 'student', per_page: 1 },
        }),
        api.get<PaginatedResponse<unknown>>('/patients', {
          params: { patient_type: 'employee', per_page: 1 },
        }),
        api.get<PaginatedResponse<Consultation>>('/consultations', {
          params: {
            submitted_date: todayDateParam,
            per_page: 1,
          },
        }),
        api.get<PaginatedResponse<Consultation>>('/consultations', {
          params: {
            submitted_date: todayDateParam,
            referred_to_doctor: 0,
            per_page: 1,
          },
        }),
        api.get<PaginatedResponse<Consultation>>('/consultations', {
          params: {
            submitted_date: todayDateParam,
            referred_to_doctor: 1,
            per_page: 1,
          },
        }),
        api.get<PaginatedResponse<Consultation>>('/consultations', {
          params: { per_page: 50 },
        }),
      ]);

      setStats({
        totalPatients: totalPatientsResponse.data.total,
        studentPatients: studentPatientsResponse.data.total,
        employeePatients: employeePatientsResponse.data.total,
        todayConsultations: todayConsultationsResponse.data.total,
        completedRegularConsultations: regularConsultationsResponse.data.total,
        referralConsultations: referralConsultationsResponse.data.total,
      });

      setRecentConsultations(recentConsultationsResponse.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load nurse dashboard data.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [todayDateParam]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const updateTime = (): void => {
      setPhilippineTime(philippineTimeFormatter.format(new Date()));
    };

    updateTime();

    const timer = window.setInterval(updateTime, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [philippineTimeFormatter]);

  const filteredRecentConsultations = useMemo(() => {
    const normalizedSearch = recentConsultationSearch.trim().toLowerCase();

    if (normalizedSearch === '') {
      return recentConsultations;
    }

    return recentConsultations.filter((consultation) => {
      const searchableValues = [
        userDisplayName(consultation.patient?.user).toLowerCase(),
        normalizeText(consultation.consultation_type).toLowerCase(),
        consultationFlowLabel(consultation).toLowerCase(),
        (consultation.chief_complaint ?? '').toLowerCase(),
        normalizeText(consultation.status).toLowerCase(),
        consultationActivityDateLabel(consultation).toLowerCase(),
      ];

      return searchableValues.some((value) => value.includes(normalizedSearch));
    });
  }, [recentConsultationSearch, recentConsultations]);

  const onMenuClick = (section: NurseSection): void => {
    setActiveSection(section);

    if (section === 'inventory') {
      navigate('/nurse/inventory');
      return;
    }

    setActiveSection(section);

    if (section === 'print') {
      navigate('/nurse/print-prescription');
      return;
    }

    if (section === 'reports') {
      navigate('/nurse/reports');
      return;
    }

    if (section === 'about') {
      navigate('/nurse/about');
      return;
    }

    if (section === 'referrals') {
      navigate('/nurse/referrals');
      return;
    }

    if (section === 'search') {
      setIsSearchOpen((current) => !current);
      return;
    }

    setIsSearchOpen(false);
  };

  const onSearchTargetSelect = (target: SearchTarget): void => {
    setSearchTarget(target);
    setActiveSection('search');
    setIsSearchOpen(false);
    navigate(`/nurse/records/${target}`);
  };

  return (
    <div className="nurse-dashboard-page">
      <aside className="nurse-sidebar" aria-label="Nurse sidebar">
        <div className="nurse-sidebar-brand">
          <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
          <div className="nurse-sidebar-identity">
            <h3>{nurseName}</h3>
            <p>{campusName}</p>
          </div>
        </div>

        <nav className="nurse-sidebar-nav" aria-label="Nurse navigation">
          {nurseMenuItems.map((menuItem) => {
            const MenuIcon = menuItem.icon;
            const isSearchMenu = menuItem.key === 'search';
            const isSearchExpanded = isSearchMenu && isSearchOpen;

            return (
              <div className={`nurse-nav-item${isSearchExpanded ? ' open' : ''}`} key={menuItem.key}>
                <button
                  className={`nurse-side-link${activeSection === menuItem.key ? ' active' : ''}`}
                  onClick={() => onMenuClick(menuItem.key)}
                  aria-expanded={isSearchMenu ? isSearchOpen : undefined}
                  aria-controls={isSearchMenu ? 'nurse-search-options' : undefined}
                  type="button"
                >
                  <MenuIcon className="nurse-side-icon" size={18} strokeWidth={2.2} />
                  <span className="nurse-side-label">{menuItem.label}</span>
                  {isSearchMenu && (
                    <ChevronDown
                      className={`nurse-side-caret${isSearchOpen ? ' open' : ''}`}
                      size={16}
                      strokeWidth={2.6}
                    />
                  )}
                </button>

                {isSearchMenu && (
                  <div
                    className={`nurse-sidebar-submenu${isSearchOpen ? ' open' : ''}`}
                    id="nurse-search-options"
                    role="menu"
                    aria-hidden={!isSearchOpen}
                  >
                    {searchTargetOptions.map((target) => (
                      <button
                        key={target.key}
                        className={`nurse-search-option${searchTarget === target.key ? ' active' : ''}`}
                        onClick={() => onSearchTargetSelect(target.key)}
                        tabIndex={isSearchOpen ? 0 : -1}
                        type="button"
                      >
                        <target.icon className="nurse-search-option-icon" size={18} strokeWidth={2.2} />
                        <span>{target.label}</span>
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
              <h2>Nurse Dashboard</h2>
            </div>

            <div className="nurse-dashboard-actions">
              <div className="nurse-datetime" aria-live="polite">
                <span className="muted small">{todayLabel}</span>
                <span className="nurse-current-time">{philippineTime} PHT</span>
              </div>
              <button
                className="button ghost nurse-refresh-button"
                onClick={() => void loadDashboard()}
                aria-label={loading ? 'Refreshing dashboard' : 'Refresh dashboard'}
                title="Refresh dashboard"
                type="button"
                disabled={loading}
              >
                <RefreshCw
                  className={`nurse-refresh-icon${loading ? ' spinning' : ''}`}
                  size={16}
                  strokeWidth={2.2}
                />
              </button>
            </div>
          </div>

        </section>

        <section className="nurse-kpi-grid" aria-label="Dashboard metrics">
          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <Users className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Total Registered Patients</p>
            </div>
            <p className="nurse-kpi-value">{stats.totalPatients}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <GraduationCap className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Student Patients</p>
            </div>
            <p className="nurse-kpi-value">{stats.studentPatients}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <Briefcase className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Employee Patients</p>
            </div>
            <p className="nurse-kpi-value">{stats.employeePatients}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <CalendarDays className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Today's Consultations</p>
            </div>
            <p className="nurse-kpi-value">{stats.todayConsultations}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <CheckCircle2 className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Today's Walk-in/Scheduled</p>
            </div>
            <p className="nurse-kpi-value">{stats.completedRegularConsultations}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <ArrowUpRight className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Today's Referral Consultations</p>
            </div>
            <p className="nurse-kpi-value">{stats.referralConsultations}</p>
          </article>
        </section>

        <section className="panel">
          <div className="panel-head nurse-dashboard-consultation-head">
            <div className="nurse-dashboard-consultation-title-wrap">
              <h3 className="nurse-dashboard-consultation-title">Recent Consultations</h3>
            </div>
            <label
              className="nurse-records-search nurse-dashboard-consultation-search"
              htmlFor="nurse-dashboard-consultation-search"
            >
              <Search className="nurse-dashboard-consultation-search-icon" size={16} strokeWidth={2.25} aria-hidden="true" />
              <input
                id="nurse-dashboard-consultation-search"
                placeholder="Search recent consultations..."
                value={recentConsultationSearch}
                onChange={(event) => setRecentConsultationSearch(event.target.value)}
                aria-label="Search recent consultations"
              />
            </label>
          </div>

          {loading ? (
            <p className="muted">Loading dashboard data...</p>
          ) : recentConsultations.length === 0 ? (
            <p className="empty-state">No consultations are available yet.</p>
          ) : filteredRecentConsultations.length === 0 ? (
            <p className="empty-state">No recent consultations matched your search.</p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Recent consultations table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Consultation Type</th>
                    <th>Flow</th>
                    <th>Chief Complaint</th>
                    <th>Status</th>
                    <th>Consulted</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecentConsultations.map((consultation) => (
                    <tr key={consultation.id}>
                      <td>{userDisplayName(consultation.patient?.user)}</td>
                      <td>{normalizeText(consultation.consultation_type)}</td>
                      <td>{consultationFlowLabel(consultation)}</td>
                      <td>{truncateText(consultation.chief_complaint)}</td>
                      <td>
                        <StatusBadge status={consultation.status} />
                      </td>
                      <td>{consultationActivityDateLabel(consultation)}</td>
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
