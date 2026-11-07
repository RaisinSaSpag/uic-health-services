import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  ArrowLeft,
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
  MessageSquare,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { PaginatedResponse, Referral } from '../types/hsms';

type NurseSection =
  | 'dashboard'
  | 'search'
  | 'print'
  | 'reports'
  | 'inventory'
  | 'referrals'
  | 'about'
  | 'chat'
  | 'notifications';
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
  { key: 'chat', label: 'Messages', icon: MessageSquare },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];

const searchTargetOptions: Array<{ key: SearchTarget; label: string; icon: LucideIcon }> = [
  { key: 'student', label: 'Student', icon: GraduationCap },
  { key: 'employee', label: 'Employee', icon: Briefcase },
];

const referralStatusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending_doctor', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

function normalizeText(value: string | null | undefined): string {
  if (!value || value.trim() === '') return 'N/A';
  if (value === 'walk_in') return 'Walk-In';
  if (value === 'scheduled') return 'Scheduled';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeVital(value: string | number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  return suffix ? `${value} ${suffix}` : String(value);
}

function parseReferralId(value: string | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
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
    if (isDetailMode) return;
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
    if (normalizedSearch === '') return referrals;

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
      navigate('/nurse/inventory');
      return;
    }
    if (section === 'chat') {
      navigate('/nurse/chat');
      return;
    }
    if (section === 'notifications') {
      navigate('/nurse/notifications');
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

  // Shared styles
  const sectionCard: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '1.5rem 1.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    display: 'block',
    marginBottom: 4,
  };

  const valueStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.95rem',
    color: '#0f172a',
    lineHeight: 1.45,
  };

  return (
    <div className="nurse-dashboard-page" style={{ minHeight: '100vh', display: 'flex' }}>
      {/* SIDEBAR */}
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
              <div
                className={`nurse-nav-item${isSearchExpanded ? ' open' : ''}`}
                key={menuItem.key}
              >
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

      {/* MAIN */}
      <main
        className={`nurse-dashboard-main${isDetailMode ? ' referral-detail-main' : ''}`}
        style={{ flex: 1, overflowY: 'auto', height: '100vh', padding: '1.75rem 2rem 2.5rem' }}
      >
        {!isDetailMode ? (
          /* ──────────── LIST VIEW ──────────── */
          <section style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 650, color: '#0f172a' }}>
                Referral Consultations
              </h2>
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                View referral updates and doctor notes.
              </p>
            </div>

            {/* Filters */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '1.25rem',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <label className="field" style={{ flex: 1, minWidth: 220 }} htmlFor="nurse-referrals-search">
                <span>Search</span>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    id="nurse-referrals-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Patient, reason, or status…"
                    style={{ paddingLeft: 36 }}
                  />
                </div>
              </label>

              <label className="field" style={{ width: 220 }}>
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

            {/* Table card */}
            <div style={sectionCard}>
              {loading ? (
                <p className="muted" style={{ margin: 0 }}>
                  Loading referrals…
                </p>
              ) : filteredReferrals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <Stethoscope size={32} strokeWidth={1.5} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                  <p className="muted" style={{ margin: 0 }}>
                    No referrals found for this filter.
                  </p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table aria-label="Nurse referrals table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Status</th>
                        <th>Referred</th>
                        <th style={{ width: 100 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReferrals.map((referral) => (
                        <tr key={referral.id}>
                          <td style={{ fontWeight: 500 }}>
                            {userDisplayName(referral.consultation?.patient?.user)}
                          </td>
                          <td>
                            <StatusBadge status={referral.status} />
                          </td>
                          <td className="muted" style={{ fontSize: '0.9rem' }}>
                            {formatDateTime(referral.referred_at)}
                          </td>
                          <td>
                            <button
                              className="button ghost"
                              onClick={() => navigate(`/nurse/referrals/${referral.id}`)}
                              type="button"
                              style={{ padding: '0.35rem 0.75rem' }}
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
            </div>
          </section>
        ) : (
          /* ──────────── DETAIL VIEW ──────────── */
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 650, color: '#0f172a' }}>
                  Referral Consultation
                </h2>
                {detailReferral && (
                  <p className="muted" style={{ margin: '0.3rem 0 0', fontSize: '0.9rem' }}>
                    #{detailReferral.id} · {userDisplayName(detailReferral.consultation?.patient?.user)}
                  </p>
                )}
              </div>
              <button
                className="button ghost"
                onClick={() => navigate('/nurse/referrals')}
                type="button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={17} />
                Back to list
              </button>
            </div>

            {loadingDetail || !detailReferral ? (
              <div style={{ ...sectionCard, textAlign: 'center', padding: '3rem' }}>
                <p className="muted" style={{ margin: 0 }}>
                  Loading referral details…
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1fr)',
                  gap: '1.5rem',
                  alignItems: 'start',
                }}
              >
                {/* ── Left: Nurse Consultation ── */}
                <div style={sectionCard}>
                  <h3
                    style={{
                      margin: '0 0 1.25rem',
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      color: '#a3224a',
                      borderBottom: '2px solid #fce7f3',
                      paddingBottom: '0.65rem',
                    }}
                  >
                    Nurse Consultation
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    <div>
                      <span style={labelStyle}>Patient</span>
                      <p style={{ ...valueStyle, fontWeight: 560 }}>
                        {userDisplayName(detailReferral.consultation?.patient?.user)}
                      </p>
                    </div>

                    <div>
                      <span style={labelStyle}>Consultation Type</span>
                      <p style={valueStyle}>
                        {normalizeText(detailReferral.consultation?.consultation_type)}
                      </p>
                    </div>

                    <div>
                      <span style={labelStyle}>Chief Complaint</span>
                      <p
                        style={{
                          ...valueStyle,
                          background: '#f8fafc',
                          padding: '0.7rem 0.85rem',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {detailReferral.consultation?.chief_complaint ?? 'N/A'}
                      </p>
                    </div>

                    <div>
                      <span style={labelStyle}>Diagnosis</span>
                      <p style={valueStyle}>{detailReferral.consultation?.diagnosis ?? 'N/A'}</p>
                    </div>

                    <div>
                      <span style={labelStyle}>Remarks</span>
                      <p style={valueStyle}>{detailReferral.consultation?.remarks ?? 'N/A'}</p>
                    </div>

                    {/* Vitals */}
                    <div
                      style={{
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '1rem',
                        marginTop: 4,
                      }}
                    >
                      <span style={{ ...labelStyle, marginBottom: 8 }}>Vitals</span>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.6rem 1rem',
                          fontSize: '0.9rem',
                        }}
                      >
                        <div>
                          <span className="muted">BP</span>
                          <div style={{ fontWeight: 500 }}>
                            {normalizeVital(detailReferral.consultation?.blood_pressure)}
                          </div>
                        </div>
                        <div>
                          <span className="muted">Pulse</span>
                          <div style={{ fontWeight: 500 }}>
                            {normalizeVital(detailReferral.consultation?.pulse_bpm, 'bpm')}
                          </div>
                        </div>
                        <div>
                          <span className="muted">Temp</span>
                          <div style={{ fontWeight: 500 }}>
                            {normalizeVital(detailReferral.consultation?.temperature_c, '°C')}
                          </div>
                        </div>
                        <div>
                          <span className="muted">Weight</span>
                          <div style={{ fontWeight: 500 }}>
                            {normalizeVital(detailReferral.consultation?.weight_kg, 'kg')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Referral Reason */}
                    <div
                      style={{
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '1rem',
                        marginTop: 4,
                      }}
                    >
                      <span style={labelStyle}>Referral Reason</span>
                      <p style={{ ...valueStyle, color: '#b91c1c', fontWeight: 500 }}>
                        {detailReferral.referral_reason || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Right: Doctor Notes ── */}
                <div style={sectionCard}>
                  <h3
                    style={{
                      margin: '0 0 1.25rem',
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      color: '#a3224a',
                      borderBottom: '2px solid #fce7f3',
                      paddingBottom: '0.65rem',
                    }}
                  >
                    Doctor Notes
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
                    {/* Status */}
                    <div>
                      <span style={labelStyle}>Status</span>
                      <div style={{ marginTop: 4 }}>
                        <StatusBadge status={detailReferral.status} />
                      </div>
                    </div>

                    {/* Doctor Remarks */}
                    <div>
                      <span style={labelStyle}>Doctor Remarks</span>
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '0.9rem 1rem',
                          fontSize: '0.95rem',
                          color: '#0f172a',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          minHeight: 100,
                        }}
                      >
                        {detailReferral.doctor_remarks || 'No remarks provided yet.'}
                      </div>
                    </div>

                    {/* Prescription */}
                    <div>
                      <span style={labelStyle}>Prescription</span>
                      <div
                        style={{
                          background: '#fdf2f8',
                          border: '1px solid #fbcfe8',
                          borderRadius: 8,
                          padding: '0.9rem 1rem',
                          fontSize: '0.95rem',
                          color: '#0f172a',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          minHeight: 100,
                        }}
                      >
                        {detailReferral.prescription || 'No prescription provided yet.'}
                      </div>
                    </div>

                    {/* Final diagnosis / treatment if available */}
                    {(detailReferral.final_diagnosis || detailReferral.treatment_plan) && (
                      <div
                        style={{
                          borderTop: '1px solid #e2e8f0',
                          paddingTop: '1.15rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                        }}
                      >
                        {detailReferral.final_diagnosis && (
                          <div>
                            <span style={labelStyle}>Final Diagnosis</span>
                            <p style={valueStyle}>{detailReferral.final_diagnosis}</p>
                          </div>
                        )}
                        {detailReferral.treatment_plan && (
                          <div>
                            <span style={labelStyle}>Treatment Plan</span>
                            <p style={valueStyle}>{detailReferral.treatment_plan}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}