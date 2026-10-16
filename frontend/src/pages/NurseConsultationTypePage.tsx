import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  Activity,
  ArrowLeftCircle,
  BarChart3,
  Briefcase,
  CalendarDays,
  ChevronDown,
  CircleUserRound,
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
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import { userDisplayName } from '../lib/format';
import type { Patient } from '../types/hsms';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about' | 'chat' | 'notifications';
type NurseRecordsPatientType = 'student' | 'employee';
type ConsultationTypeParam = 'walk-in' | 'scheduled';

interface NurseMenuItem {
  key: NurseSection;
  label: string;
  icon: LucideIcon;
}

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

function normalizePatientType(value: string | null | undefined): NurseRecordsPatientType {
  return value === 'employee' ? 'employee' : 'student';
}

export function NurseConsultationTypePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { patientId: rawPatientId } = useParams<{ patientId: string }>();

  const patientId = useMemo(() => {
    const parsedId = Number(rawPatientId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return null;
    }

    return parsedId;
  }, [rawPatientId]);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<NurseSection>('search');
  const [isSearchOpen, setIsSearchOpen] = useState(true);

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const patientType = useMemo(() => normalizePatientType(patient?.patient_type), [patient?.patient_type]);

  const loadPatient = useCallback(async (): Promise<void> => {
    if (!patientId) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.get<Patient>(`/patients/${patientId}`);
      setPatient(response.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load selected patient.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadPatient();
  }, [loadPatient]);

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

    if (section === 'referrals') {
      navigate('/nurse/referrals');
      return;
    }

    if (section === 'about') {
      navigate('/nurse/about');
      return;
    }

    if (section === 'search') {
      setIsSearchOpen((current) => !current);
      return;
    }

    setIsSearchOpen(false);
  };

  const onSearchTargetSelect = (target: NurseRecordsPatientType): void => {
    setIsSearchOpen(true);
    navigate(`/nurse/records/${target}`);
  };

  const redirectToForm = (type: ConsultationTypeParam): void => {
    if (!patientId) {
      return;
    }

    navigate(`/nurse/patients/${patientId}/new-consultation/${type}`);
  };

  if (!patientId) {
    return <Navigate to="/nurse" replace />;
  }

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
                    <button
                      className={`nurse-search-option${patientType === 'student' ? ' active' : ''}`}
                      onClick={() => onSearchTargetSelect('student')}
                      tabIndex={isSearchOpen ? 0 : -1}
                      type="button"
                    >
                      <GraduationCap className="nurse-search-option-icon" size={18} strokeWidth={2.2} />
                      <span>Student</span>
                    </button>

                    <button
                      className={`nurse-search-option${patientType === 'employee' ? ' active' : ''}`}
                      onClick={() => onSearchTargetSelect('employee')}
                      tabIndex={isSearchOpen ? 0 : -1}
                      type="button"
                    >
                      <Briefcase className="nurse-search-option-icon" size={18} strokeWidth={2.2} />
                      <span>Employee</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="nurse-dashboard-main nurse-dashboard-main-detail">
        <section className="panel nurse-consultation-type-page">
          <div className="nurse-patient-detail-head">
            <div>
              <h2>New Consultation</h2>
              <p className="muted small">
                {loading
                  ? 'Loading patient context...'
                  : `Select consultation type for ${patient ? userDisplayName(patient.user) : 'the selected patient'}.`}
              </p>
            </div>

            <div className="action-row">
              <button
                aria-label="Back to patient"
                className="button ghost nurse-patient-back-icon-button"
                onClick={() => navigate(`/nurse/patients/${patientId}`)}
                title="Back to patient"
                type="button"
              >
                <ArrowLeftCircle size={21} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <article className="nurse-patient-summary">
            <div className="nurse-avatar-card" aria-hidden="true">
              <CircleUserRound className="nurse-avatar-icon" size={84} strokeWidth={1.4} />
            </div>

            <div className="nurse-patient-summary-main">
              <h3>{patient ? userDisplayName(patient.user) : 'Patient'}</h3>
              <p>{patientType === 'student' ? 'Student' : 'Employee'}</p>
            </div>
          </article>

          <div className="nurse-consultation-type-grid">
            <button
              className="button ghost nurse-consultation-type-button"
              onClick={() => redirectToForm('walk-in')}
              type="button"
            >
              <Activity size={24} strokeWidth={2.2} />
              <span>Walk-in</span>
            </button>

            <button
              className="button ghost nurse-consultation-type-button"
              onClick={() => redirectToForm('scheduled')}
              type="button"
            >
              <CalendarDays size={24} strokeWidth={2.2} />
              <span>Scheduled</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
