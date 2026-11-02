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
  MessageSquare,
  Package,
  Printer,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { QuickInjuryModal } from '../components/QuickInjuryModal';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { Consultation, PaginatedResponse } from '../types/hsms';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about' | 'chat';
type SearchTarget = 'student' | 'employee';

interface NurseDashboardStats {
  totalPatients: number;
  studentPatients: number;
  employeePatients: number;
  termConsultations: number;
  termWalkins: number;
  termReferrals: number;
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
  termConsultations: 0,
  termWalkins: 0,
  termReferrals: 0,
};

const nurseMenuItems: NurseMenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'search', label: 'Search Records', icon: Search },
  { key: 'print', label: 'Print Prescription', icon: Printer },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'referrals', label: 'Referrals', icon: Stethoscope },
  { key: 'about', label: 'About', icon: Info },
  { key: 'chat', label: 'Messages', icon: MessageSquare },
];

const searchTargetOptions: Array<{ key: SearchTarget; label: string; icon: LucideIcon }> = [
  { key: 'student', label: 'Student', icon: GraduationCap },
  { key: 'employee', label: 'Employee', icon: Briefcase },
];

function truncateText(value: string, maxLength = 72): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return 'Not provided';
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
  const [activeTermName, setActiveTermName] = useState<string | null>(null);
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([]);
  const [recentConsultationSearch, setRecentConsultationSearch] = useState('');
  const [activeSection, setActiveSection] = useState<NurseSection>('dashboard');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('student');
  const [loading, setLoading] = useState(true);

  const [isInjuryModalOpen, setIsInjuryModalOpen] = useState(false);

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()),
    [],
  );
  const philippineTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
    [],
  );
  const [philippineTime, setPhilippineTime] = useState(() => philippineTimeFormatter.format(new Date()));

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Active Term
      let startDate: string | null = null;
      let endDate: string | null = null;
      try {
        const termRes = await api.get('/academic-terms');
        const activeTerm = termRes.data.find((t: any) => t.is_active);
        if (activeTerm) {
          setActiveTermName(activeTerm.name);
          startDate = activeTerm.start_date.split('T')[0];
          endDate = activeTerm.end_date.split('T')[0];
        } else {
          setActiveTermName(null);
        }
      } catch {
        setActiveTermName(null);
      }

      // 2. Fetch All-Time Totals
      const [
        totalPatientsResponse,
        studentPatientsResponse,
        employeePatientsResponse,
      ] = await Promise.all([
        api.get<PaginatedResponse<unknown>>('/patients', { params: { per_page: 1 } }),
        api.get<PaginatedResponse<unknown>>('/patients', { params: { patient_type: 'student', per_page: 1 } }),
        api.get<PaginatedResponse<unknown>>('/patients', { params: { patient_type: 'employee', per_page: 1 } }),
      ]);

      // 3. Fetch Term-Based Totals
      let termConsultations = 0;
      let termWalkins = 0;
      let termReferrals = 0;

      if (startDate && endDate) {
        const [termConsRes, termWalkinRes, termRefRes] = await Promise.all([
          api.get<PaginatedResponse<Consultation>>('/consultations', { params: { date_from: startDate, date_to: endDate, per_page: 1 } }),
          api.get<PaginatedResponse<Consultation>>('/consultations', { params: { date_from: startDate, date_to: endDate, referred_to_doctor: 0, per_page: 1 } }),
          api.get<PaginatedResponse<Consultation>>('/consultations', { params: { date_from: startDate, date_to: endDate, referred_to_doctor: 1, per_page: 1 } }),
        ]);
        termConsultations = termConsRes.data.total;
        termWalkins = termWalkinRes.data.total;
        termReferrals = termRefRes.data.total;
      }

      // 4. Fetch Recent Consultations
      const recentConsultationsResponse = await api.get<PaginatedResponse<Consultation>>('/consultations', { params: { per_page: 20 } });

      setStats({
        totalPatients: totalPatientsResponse.data.total,
        studentPatients: studentPatientsResponse.data.total,
        employeePatients: employeePatientsResponse.data.total,
        termConsultations,
        termWalkins,
        termReferrals,
      });

      setRecentConsultations(recentConsultationsResponse.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load nurse dashboard data.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const updateTime = (): void => setPhilippineTime(philippineTimeFormatter.format(new Date()));
    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, [philippineTimeFormatter]);

  const filteredRecentConsultations = useMemo(() => {
    const normalizedSearch = recentConsultationSearch.trim().toLowerCase();
    if (normalizedSearch === '') return recentConsultations;
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
    if (section === 'inventory') { navigate('/nurse/inventory'); return; }
    if (section === 'chat') { navigate('/nurse/chat'); return; }
    if (section === 'print') { navigate('/nurse/print-prescription'); return; }
    if (section === 'reports') { navigate('/nurse/reports'); return; }
    if (section === 'about') { navigate('/nurse/about'); return; }
    if (section === 'referrals') { navigate('/nurse/referrals'); return; }
    if (section === 'search') { setIsSearchOpen((current) => !current); return; }
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
                    <ChevronDown className={`nurse-side-caret${isSearchOpen ? ' open' : ''}`} size={16} strokeWidth={2.6} />
                  )}
                </button>

                {isSearchMenu && (
                  <div className={`nurse-sidebar-submenu${isSearchOpen ? ' open' : ''}`} id="nurse-search-options" role="menu" aria-hidden={!isSearchOpen}>
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
              {activeTermName && <p className="muted" style={{ margin: '0.25rem 0 0 0' }}>Active Term: {activeTermName}</p>}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem', alignItems: 'center' }}>
              <button className="button primary" onClick={() => navigate('/nurse/walk-in')}>+ Register Walk-In</button>
              <button className="button" style={{ background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsInjuryModalOpen(true)}>
                <AlertCircle size={16} /> Quick Injury Log
              </button>
            </div>

            <div className="nurse-dashboard-actions">
              <div className="nurse-datetime" aria-live="polite">
                <span className="muted small">{todayLabel}</span>
                <span className="nurse-current-time">{philippineTime} PHT</span>
              </div>
              <button className="button ghost nurse-refresh-button" onClick={() => void loadDashboard()} disabled={loading}>
                <RefreshCw className={`nurse-refresh-icon${loading ? ' spinning' : ''}`} size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </section>

        {/* ALL-TIME TOTALS ROW */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All-Time Totals</h3>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        </div>

        <section className="nurse-kpi-grid" aria-label="All-time metrics" style={{ marginBottom: '2rem' }}>
          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap"><Users className="nurse-kpi-icon" size={16} strokeWidth={2.2} /></span>
              <p className="nurse-kpi-label">Total Registered Patients</p>
            </div>
            <p className="nurse-kpi-value">{stats.totalPatients}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap"><GraduationCap className="nurse-kpi-icon" size={16} strokeWidth={2.2} /></span>
              <p className="nurse-kpi-label">Total Student Patients</p>
            </div>
            <p className="nurse-kpi-value">{stats.studentPatients}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap"><Briefcase className="nurse-kpi-icon" size={16} strokeWidth={2.2} /></span>
              <p className="nurse-kpi-label">Total Employee Patients</p>
            </div>
            <p className="nurse-kpi-value">{stats.employeePatients}</p>
          </article>
        </section>

        {/* ACTIVE TERM TOTALS ROW */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {activeTermName ? `Current Term (${activeTermName})` : 'Current Term (No Active Term Set)'}
          </h3>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        </div>

        <section className="nurse-kpi-grid" aria-label="Current term metrics">
          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap"><CalendarDays className="nurse-kpi-icon" size={16} strokeWidth={2.2} /></span>
              <p className="nurse-kpi-label">Consultations This Term</p>
            </div>
            <p className="nurse-kpi-value">{stats.termConsultations}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap"><CheckCircle2 className="nurse-kpi-icon" size={16} strokeWidth={2.2} /></span>
              <p className="nurse-kpi-label">Walk-in/Scheduled This Term</p>
            </div>
            <p className="nurse-kpi-value">{stats.termWalkins}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap"><ArrowUpRight className="nurse-kpi-icon" size={16} strokeWidth={2.2} /></span>
              <p className="nurse-kpi-label">Referral Consultations This Term</p>
            </div>
            <p className="nurse-kpi-value">{stats.termReferrals}</p>
          </article>
        </section>

        <section className="panel" style={{ marginTop: '2rem' }}>
          <div className="panel-head nurse-dashboard-consultation-head">
            <div className="nurse-dashboard-consultation-title-wrap">
              <h3 className="nurse-dashboard-consultation-title">Recent Consultations</h3>
            </div>
            <label className="nurse-records-search nurse-dashboard-consultation-search" htmlFor="nurse-dashboard-consultation-search">
              <Search className="nurse-dashboard-consultation-search-icon" size={16} strokeWidth={2.25} aria-hidden="true" />
              <input
                id="nurse-dashboard-consultation-search"
                placeholder="Search recent consultations..."
                value={recentConsultationSearch}
                onChange={(event) => setRecentConsultationSearch(event.target.value)}
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
                    <tr 
                      key={consultation.id}
                      onClick={() => navigate(`/nurse/patients/${consultation.patient_id}`)}
                      style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td>{userDisplayName(consultation.patient?.user)}</td>
                      <td>{normalizeText(consultation.consultation_type)}</td>
                      <td>{consultationFlowLabel(consultation)}</td>
                      <td>{truncateText(consultation.chief_complaint)}</td>
                      <td><StatusBadge status={consultation.status} /></td>
                      <td>{consultationActivityDateLabel(consultation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <QuickInjuryModal isOpen={isInjuryModalOpen} onClose={() => setIsInjuryModalOpen(false)} onSuccess={() => void loadDashboard()} />
    </div>
  );
}