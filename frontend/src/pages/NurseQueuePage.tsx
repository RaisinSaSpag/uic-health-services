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
  X,
  type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { Consultation, PaginatedResponse } from '../types/hsms';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about' | 'chat';
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
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([]);
  const [recentConsultationSearch, setRecentConsultationSearch] = useState('');
  const [activeSection, setActiveSection] = useState<NurseSection>('dashboard');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('student');
  const [loading, setLoading] = useState(true);

  // 🚨 Quick Injury Log Modal State
  const [isInjuryModalOpen, setIsInjuryModalOpen] = useState(false);
  const [injurySearchTerm, setInjurySearchTerm] = useState('');
  const [injurySearchResults, setInjurySearchResults] = useState<any[]>([]);
  const [injurySearching, setInjurySearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [injuryForm, setInjuryForm] = useState({
    first_name: '',
    last_name: '',
    patient_category: 'college',
    campus_id: '',
    chief_complaint: '',
  });
  const [injurySubmitting, setInjurySubmitting] = useState(false);

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
        api.get<PaginatedResponse<unknown>>('/patients', { params: { per_page: 1 } }),
        api.get<PaginatedResponse<unknown>>('/patients', { params: { patient_type: 'student', per_page: 1 } }),
        api.get<PaginatedResponse<unknown>>('/patients', { params: { patient_type: 'employee', per_page: 1 } }),
        api.get<PaginatedResponse<Consultation>>('/consultations', { params: { submitted_date: todayDateParam, per_page: 1 } }),
        api.get<PaginatedResponse<Consultation>>('/consultations', { params: { submitted_date: todayDateParam, referred_to_doctor: 0, per_page: 1 } }),
        api.get<PaginatedResponse<Consultation>>('/consultations', { params: { submitted_date: todayDateParam, referred_to_doctor: 1, per_page: 1 } }),
        api.get<PaginatedResponse<Consultation>>('/consultations', { params: { per_page: 50 } }),
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

  // Search patients for Quick Injury Log
  const searchPatientsForInjury = async (term: string) => {
    setInjurySearchTerm(term);
    if (term.length < 2) {
      setInjurySearchResults([]);
      return;
    }
    setInjurySearching(true);
    try {
      const res = await api.get('/patients/search', { params: { q: term } });
      setInjurySearchResults(res.data);
    } catch {
      setInjurySearchResults([]);
    } finally {
      setInjurySearching(false);
    }
  };

  const resetInjuryModal = () => {
    setIsInjuryModalOpen(false);
    setInjurySearchTerm('');
    setInjurySearchResults([]);
    setSelectedPatient(null);
    setInjuryForm({ first_name: '', last_name: '', patient_category: 'college', campus_id: '', chief_complaint: '' });
  };

  const submitInjuryLog = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!injuryForm.chief_complaint) {
      void notifyError('Please provide a chief complaint.', 'Missing Details');
      return;
    }

    if (!selectedPatient && (!injuryForm.first_name || !injuryForm.last_name || !injuryForm.campus_id)) {
      void notifyError('Please select a patient or fill in all new patient fields.', 'Missing Details');
      return;
    }

    setInjurySubmitting(true);
    try {
      const payload: any = {
        chief_complaint: injuryForm.chief_complaint,
      };

      if (selectedPatient) {
        payload.patient_id = selectedPatient.id;
      } else {
        payload.first_name = injuryForm.first_name;
        payload.last_name = injuryForm.last_name;
        payload.patient_category = injuryForm.patient_category;
        payload.campus_id = Number(injuryForm.campus_id);
      }

      const response = await api.post('/patients/quick-injury', payload);
      void notifySuccess('Injury logged successfully.', 'Success');
      resetInjuryModal();
      void loadDashboard();
      navigate(`/nurse/patients/${response.data.patient_id}`);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to log injury.'), 'Failed');
    } finally {
      setInjurySubmitting(false);
    }
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
            
            <div style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem', alignItems: 'center' }}>
              <button className="button primary" onClick={() => navigate('/nurse/walk-in')}>
                + Register Walk-In
              </button>
              
              {/* 🚨 Quick Injury Log Button */}
              <button 
                className="button" 
                style={{ background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }} 
                onClick={() => setIsInjuryModalOpen(true)}
              >
                <AlertCircle size={16} />
                Quick Injury Log
              </button>
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

      {/* 🚨 QUICK INJURY LOG MODAL (Option C) */}
      {isInjuryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !injurySubmitting && resetInjuryModal()}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '550px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={24} />
                Quick Injury Log
              </h2>
              <button
                onClick={resetInjuryModal}
                disabled={injurySubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitInjuryLog} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* 1. SEARCH EXISTING PATIENT */}
              {!selectedPatient && (
                <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', border: '1px solid #eee' }}>
                  <label className="field">
                    <span>1. Search Existing Patient (Name / ID)</span>
                    <input
                      placeholder="Type 2+ characters to search..."
                      value={injurySearchTerm}
                      onChange={(e) => void searchPatientsForInjury(e.target.value)}
                    />
                  </label>
                  
                  {injurySearching && <p className="muted small">Searching...</p>}
                  
                  {injurySearchResults.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0 0' }}>
                      {injurySearchResults.map((p) => (
                        <li key={p.id} style={{ padding: '0.5rem', borderBottom: '1px solid #eee', cursor: 'pointer', background: 'white', borderRadius: '4px', marginBottom: '0.25rem' }} onClick={() => setSelectedPatient(p)}>
                          <strong>{userDisplayName(p.user)}</strong> <span className="muted small">({p.patient_number})</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {injurySearchTerm.length >= 2 && !injurySearching && injurySearchResults.length === 0 && (
                    <p className="muted small" style={{ marginTop: '0.5rem' }}>No patient found. Fill out the form below to register them as new.</p>
                  )}
                </div>
              )}

              {/* 2. SELECTED PATIENT CONFIRMATION */}
              {selectedPatient && (
                <div style={{ background: '#e8f5e9', padding: '1rem', borderRadius: '8px', border: '1px solid #c8e6c9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: '#2e7d32' }}>✓ Logging injury for existing patient</strong>
                    <p style={{ margin: 0 }}>{userDisplayName(selectedPatient.user)} ({selectedPatient.patient_number})</p>
                  </div>
                  <button type="button" onClick={() => setSelectedPatient(null)} className="button ghost" style={{ color: '#c62828' }}>
                    Change
                  </button>
                </div>
              )}

              {/* 3. NEW PATIENT FIELDS (Only shown if no patient selected) */}
              {!selectedPatient && (
                <>
                  <p className="muted small" style={{ margin: 0 }}>2. Or register as new patient:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label className="field">
                      <span>First Name *</span>
                      <input
                        value={injuryForm.first_name}
                        onChange={(e) => setInjuryForm({ ...injuryForm, first_name: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Last Name *</span>
                      <input
                        value={injuryForm.last_name}
                        onChange={(e) => setInjuryForm({ ...injuryForm, last_name: e.target.value })}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label className="field">
                      <span>Category *</span>
                      <select
                        value={injuryForm.patient_category}
                        onChange={(e) => setInjuryForm({ ...injuryForm, patient_category: e.target.value })}
                      >
                        <option value="grade_school">Grade School</option>
                        <option value="high_school">High School</option>
                        <option value="college">College</option>
                        <option value="employee">Employee</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Campus *</span>
                      <select
                        value={injuryForm.campus_id}
                        onChange={(e) => setInjuryForm({ ...injuryForm, campus_id: e.target.value })}
                      >
                        <option value="">Select campus</option>
                        <option value="1">Main Campus</option>
                        <option value="2">Father Selga Campus</option>
                        <option value="3">Bonifacio Campus</option>
                        <option value="4">Bajada Grade School</option>
                        <option value="5">Bajada Junior High</option>
                        <option value="6">Bajada Senior High</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              {/* 4. CHIEF COMPLAINT (Always shown) */}
              <label className="field">
                <span>Injury / Chief Complaint *</span>
                <textarea
                  required
                  rows={3}
                  value={injuryForm.chief_complaint}
                  onChange={(e) => setInjuryForm({ ...injuryForm, chief_complaint: e.target.value })}
                  placeholder="E.g., Twisted ankle during PE class..."
                />
              </label>

              {/* 5. SUBMIT */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="button secondary" onClick={resetInjuryModal} disabled={injurySubmitting}>
                  Cancel
                </button>
                <button type="submit" className="button" style={{ background: '#dc2626', color: 'white' }} disabled={injurySubmitting}>
                  {injurySubmitting ? 'Logging...' : 'Log Injury'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}