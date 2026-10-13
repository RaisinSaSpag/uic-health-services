import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
import { useAuth } from '../context/AuthContext';
import { notifyInfo } from '../lib/alerts';
import { userDisplayName } from '../lib/format';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about';
type SearchTarget = 'student' | 'employee';

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

const prescriptionAssetPath = '/prescription.png';

export function NursePrintPrescriptionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const printDelayTimerRef = useRef<number | null>(null);

  const [activeSection, setActiveSection] = useState<NurseSection>('print');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('student');
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  useEffect(() => {
    const image = new window.Image();
    image.src = prescriptionAssetPath;
  }, []);

  useEffect(() => {
    const onAfterPrint = (): void => {
      setIsPreparingPrint(false);
    };

    window.addEventListener('afterprint', onAfterPrint);

    return () => {
      window.removeEventListener('afterprint', onAfterPrint);

      if (printDelayTimerRef.current !== null) {
        window.clearTimeout(printDelayTimerRef.current);
        printDelayTimerRef.current = null;
      }
    };
  }, []);

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

    if (section === 'search') {
      setIsSearchOpen((current) => !current);
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

    setIsSearchOpen(false);
  };

  const onSearchTargetSelect = (target: SearchTarget): void => {
    setSearchTarget(target);
    setActiveSection('search');
    setIsSearchOpen(true);
    navigate(`/nurse/records/${target}`);
  };

  const onPrintPrescription = (): void => {
    if (isPreparingPrint) {
      return;
    }

    setIsPreparingPrint(true);

    window.requestAnimationFrame(() => {
      printDelayTimerRef.current = window.setTimeout(() => {
        printDelayTimerRef.current = null;
        window.print();

        window.setTimeout(() => {
          setIsPreparingPrint(false);
        }, 240);
      }, 90);
    });
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

      <div className="nurse-dashboard-main nurse-dashboard-main-records">
        <section className="panel nurse-print-page">
          <div className="panel-head nurse-print-head">
            <div>
              <h2>Print Documents</h2>
              <p className="muted small">Select document type to print</p>
            </div>
          </div>

          <article className="nurse-print-document-card">
            <header className="nurse-print-document-head">
              <div>
                <h3>Prescription</h3>
                <p className="nurse-print-document-meta">Print prescription form</p>
              </div>

              <button
                className={`button nurse-print-action-button${isPreparingPrint ? ' is-preparing' : ''}`}
                onClick={onPrintPrescription}
                type="button"
                aria-busy={isPreparingPrint}
                disabled={isPreparingPrint}
              >
                <Printer
                  className={`nurse-print-action-icon${isPreparingPrint ? ' spinning' : ''}`}
                  size={16}
                  strokeWidth={2.4}
                />
                <span>{isPreparingPrint ? 'Opening Print Preview...' : 'Print Prescription'}</span>
              </button>
            </header>

            <div className="nurse-print-preview" aria-hidden="true">
              <Printer className="nurse-print-preview-icon" size={44} strokeWidth={1.8} />
              <h4>Prescription Form Ready</h4>
              <p>Click print to continue.</p>
              <span>Official Rx Prescription format</span>
            </div>

            <div className="nurse-print-only-sheet" aria-hidden="true">
              <img src={prescriptionAssetPath} alt="Prescription form" loading="eager" decoding="async" />
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
