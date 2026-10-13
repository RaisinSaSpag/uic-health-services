import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftCircle,
  BarChart3,
  Briefcase,
  ChevronDown,
  GraduationCap,
  Info,
  LayoutDashboard,
  Package,
  Printer,
  Search,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError, notifyInfo } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { PaginatedResponse, Referral } from '../types/hsms';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about';
type SearchTarget = 'student' | 'employee';

interface NurseMenuItem {
  key: NurseSection;
  label: string;
  icon: LucideIcon;
}

const nurseMenuItems: NurseMenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'search', label: 'Search Records', icon: Search },
  { key: 'print', label: 'Print Prescription', icon: Printer },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'referrals', label: 'Referrals', icon: Stethoscope },
  { key: 'about', label: 'About', icon: Info },
];

const searchTargetOptions: Array<{ key: SearchTarget; label: string; icon: LucideIcon }> = [
  { key: 'student', label: 'Student', icon: GraduationCap },
  { key: 'employee', label: 'Employee', icon: Briefcase },
];

const referralStatusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending_doctor', label: 'pending_doctor' },
  { value: 'in_progress', label: 'in_progress' },
  { value: 'completed', label: 'completed' },
];

function normalizeText(value: string | null | undefined): string {
  if (!value || value.trim() === '') {
    return 'N/A';
  }

  return value.replace(/_/g, ' ');
}

function normalizeVital(value: string | number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  return suffix ? `${value} ${suffix}` : String(value);
}

function parseReferralId(value: string | undefined): number | null {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function NurseReferralsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { referralId: rawReferralId } = useParams<{ referralId: string }>();

  const [activeSection, setActiveSection] = useState<NurseSection>('referrals');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('student');

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [detailReferral, setDetailReferral] = useState<Referral | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const routeReferralId = useMemo(() => parseReferralId(rawReferralId), [rawReferralId]);
  const isDetailMode = routeReferralId !== null;

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const loadReferrals = useCallback(async () => {
    if (isDetailMode) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.get<PaginatedResponse<Referral>>('/referrals', {
        params: {
          per_page: 100,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });

      setReferrals(response.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load nurse referrals.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [isDetailMode, statusFilter]);

  const loadReferralDetail = useCallback(async () => {
    if (!routeReferralId) {
      setDetailReferral(null);
      return;
    }

    setLoadingDetail(true);

    try {
      const response = await api.get<Referral>(`/referrals/${routeReferralId}`);
      setDetailReferral(response.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load selected referral.'), 'Load Failed');
      navigate('/nurse/referrals');
    } finally {
      setLoadingDetail(false);
    }
  }, [navigate, routeReferralId]);

  useEffect(() => {
    if (isDetailMode) {
      void loadReferralDetail();
      return;
    }

    void loadReferrals();
  }, [isDetailMode, loadReferralDetail, loadReferrals]);

  const filteredReferrals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch === '') {
      return referrals;
    }

    return referrals.filter((referral) => {
      const values = [
        userDisplayName(referral.consultation?.patient?.user).toLowerCase(),
        (referral.referral_reason ?? '').toLowerCase(),
        normalizeText(referral.status).toLowerCase(),
      ];

      return values.some((value) => value.includes(normalizedSearch));
    });
  }, [referrals, search]);

  const onMenuClick = (section: NurseSection): void => {
    if (section === 'inventory') {
      void notifyInfo('Inventory is coming soon.', 'Coming Soon');
      return;
    }

    setActiveSection(section);

    if (section === 'dashboard') {
      navigate('/nurse');
      return;
    }

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

  const onFilterChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setStatusFilter(event.target.value);
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

      <div className={`nurse-dashboard-main nurse-dashboard-main-detail${isDetailMode ? ' referral-detail-main' : ''}`}>
        {!isDetailMode ? (
          <section className="panel nurse-records-panel">
            <div className="panel-head nurse-records-head">
              <div>
                <h2>Referral Consultations</h2>
                <p className="muted small">View referral updates and doctor notes.</p>
              </div>
            </div>

            <div className="nurse-records-toolbar referral-list-toolbar">
              <label className="field nurse-records-search" htmlFor="nurse-referrals-search">
                <span>Search Referrals</span>
                <input
                  id="nurse-referrals-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by patient, referral reason, or status"
                />
              </label>

              <label className="field inline-field referral-status-field">
                <span>Status</span>
                <select value={statusFilter} onChange={onFilterChange}>
                  {referralStatusOptions.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <p className="muted">Loading referrals...</p>
            ) : filteredReferrals.length === 0 ? (
              <p className="empty-state">No referrals found for this filter.</p>
            ) : (
              <div className="table-wrap">
                <table aria-label="Nurse referrals table" className="referral-list-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Status</th>
                      <th>Referred</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReferrals.map((referral) => (
                      <tr key={referral.id}>
                        <td>{userDisplayName(referral.consultation?.patient?.user)}</td>
                        <td>
                          <StatusBadge status={referral.status} />
                        </td>
                        <td>{formatDateTime(referral.referred_at)}</td>
                        <td className="referral-list-action-cell">
                          <button
                            className="button ghost referral-view-button"
                            onClick={() => navigate(`/nurse/referrals/${referral.id}`)}
                            type="button"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Referral Consultation Detail</h2>
                </div>
                <button
                  aria-label="Back to referrals"
                  className="button ghost referral-back-icon-button"
                  onClick={() => navigate('/nurse/referrals')}
                  title="Back to referrals"
                  type="button"
                >
                  <ArrowLeftCircle size={18} strokeWidth={2.2} />
                </button>
              </div>
            </section>

            <section className="panel referral-workbench referral-workbench-detail">
              {loadingDetail || !detailReferral ? (
                <p className="muted">Loading referral details...</p>
              ) : (
                <div className="referral-compare-grid">
                  <article className="nurse-consultation-detail-panel">
                    <h3>Nurse Consultation Details</h3>
                    <table>
                      <tbody>
                        <tr>
                          <td>Patient</td>
                          <td>{userDisplayName(detailReferral.consultation?.patient?.user)}</td>
                        </tr>
                        <tr>
                          <td>Consultation Type</td>
                          <td>{normalizeText(detailReferral.consultation?.consultation_type)}</td>
                        </tr>
                        <tr>
                          <td>Chief Complaint</td>
                          <td>{detailReferral.consultation?.chief_complaint ?? 'N/A'}</td>
                        </tr>
                        <tr>
                          <td>Diagnosis</td>
                          <td>{detailReferral.consultation?.diagnosis ?? 'N/A'}</td>
                        </tr>
                        <tr>
                          <td>Remarks</td>
                          <td>{detailReferral.consultation?.remarks ?? 'N/A'}</td>
                        </tr>
                        <tr>
                          <td>Blood Pressure</td>
                          <td>{normalizeVital(detailReferral.consultation?.blood_pressure)}</td>
                        </tr>
                        <tr>
                          <td>Pulse</td>
                          <td>{normalizeVital(detailReferral.consultation?.pulse_bpm, 'bpm')}</td>
                        </tr>
                        <tr>
                          <td>Temperature</td>
                          <td>{normalizeVital(detailReferral.consultation?.temperature_c, 'C')}</td>
                        </tr>
                        <tr>
                          <td>Weight</td>
                          <td>{normalizeVital(detailReferral.consultation?.weight_kg, 'kg')}</td>
                        </tr>
                        <tr>
                          <td>Referral Reason</td>
                          <td>{detailReferral.referral_reason}</td>
                        </tr>
                      </tbody>
                    </table>
                  </article>

                  <article className="nurse-consultation-detail-panel">
                    <h3>Doctor Notes</h3>

                    <label className="field full-width">
                      <span>Doctor Remarks</span>
                      <textarea rows={6} value={detailReferral.doctor_remarks ?? ''} readOnly />
                    </label>

                    <label className="field full-width">
                      <span>Prescription</span>
                      <textarea rows={6} value={detailReferral.prescription ?? ''} readOnly />
                    </label>
                  </article>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
