import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
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
import { useAuth } from '../context/AuthContext';
import { userDisplayName } from '../lib/format';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about' | 'chat' | 'notifications';
type SearchTarget = 'student' | 'employee';

interface NurseMenuItem {
  key: NurseSection;
  label: string;
  icon: LucideIcon;
}

interface AboutPerson {
  name: string;
  role: string;
  campus?: string;
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

const healthTeamMembers: AboutPerson[] = [
  { name: 'Cabrera, Sheryl Lee B.', role: 'Nurse', campus: 'Fr. Selga' },
  { name: 'Ferolino, Necitas R.', role: 'Nurse', campus: 'Bonifacio' },
  { name: 'De Dios, Judee Andrea B.', role: 'Nurse', campus: 'Grade School Bajada' },
  { name: 'Padla, Reggie C.', role: 'Nurse', campus: 'JHS Bajada' },
  { name: 'Sepulveda, Cristina G.', role: 'Nurse', campus: 'SHS Bajada' },
  { name: 'Cadavas, Minda T.', role: 'Nurse', campus: 'Nurse reliever' },
  { name: 'Dr. Ritze H. Burgos', role: 'Physician', campus: 'All campuses/departments' },
  { name: 'Dr. Marie Angelique Go', role: 'Physician', campus: 'All campuses/departments' },
];

const developmentTeamMembers: AboutPerson[] = [
  { name: 'Sebastian Lex F. Ampon', role: 'Project Manager | Software Developer' },
  { name: 'Wam B. Ausan', role: 'Quality Assurance Tester' },
];

function initialsFromName(name: string): string {
  const cleanedName = name.replace(/^Dr\.\s+/i, '').trim();
  const parts = cleanedName.split(/\s+/).filter((part) => part !== '');

  if (parts.length === 0) {
    return 'NA';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function NurseAboutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<NurseSection>('about');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('student');

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

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

      <div className="nurse-dashboard-main nurse-dashboard-main-records nurse-dashboard-main-about">
        <section className="panel nurse-about-page">
          <header className="nurse-about-head">
            <h2>About</h2>
          </header>

          <section className="nurse-about-hero" aria-label="UIC Health Services Management System header image">
            <img src="/aboutpage-image.png" alt="UIC Health Services Management System" />
            <div className="nurse-about-hero-overlay">
              <h1>UIC Health Services Management System</h1>
            </div>
          </section>

          <section className="nurse-about-content" aria-label="About health service unit">
            <article className="nurse-about-row">
              <h3>OBJECTIVES OF THE HEALTH SERVICE UNIT</h3>
              <div>
                <p>
                  The School Clinic's of the University of the Immaculate Conception in coordination with the Department
                  of Health aims to monitor and improve status of all student and employee through the following
                  objective:
                </p>
                <ol>
                  <li>To maintain a healthy school environment.</li>
                  <li>
                    To provide health services to Student, Faculty, Personnel and Administrators who suffer any health
                    problem while in school.
                  </li>
                  <li>
                    To render first aid treatment in cases of emergency and disaster-related incidents.
                  </li>
                  <li>
                    To monitor the health status of the individuals members of the academic community annual laboratory,
                    medical and dental check.
                  </li>
                  <li>
                    To provide values for learning by conducting health-related talks and symposium in all levels of the
                    academic community.
                  </li>
                </ol>
              </div>
            </article>

            <article className="nurse-about-row">
              <h3>Vision</h3>
              <div>
                <p>
                  A transformed society where persons live their dignity as children of God in justice,peace and love
                  with each other and with all creation.
                </p>
              </div>
            </article>

            <article className="nurse-about-row">
              <h3>Mission</h3>
              <div>
                <p className="nurse-about-strong">
                  We, the members of the UIC family with strong faith in God inspired by MARY, the Mother of God and
                  your Mother and guided by the life giving Del Espiritu Santo commit ourselves to:
                </p>
                <ol>
                  <li>Love and respect God and our neighbor on our personal and communal life.</li>
                  <li>Respect the dignity of the human person, especially the poor.</li>
                  <li>Work for justice, promote peace and preserve the integrity of creation.</li>
                  <li>
                    Promote and strengthen our Filipino culture and values in the midst of modernization and
                    globalization.
                  </li>
                  <li>
                    Exercise leadership in the pursuit of academic excellence in humanities, science and technology.
                  </li>
                </ol>
              </div>
            </article>

            <article className="nurse-about-row">
              <h3>Goal</h3>
              <div>
                <p>
                  In order for us to approximate our vision and live our mission, we dedicate all our human resources to
                  transform the member of UIC family to become enlightened empowered, pro-action and liberated Christian
                  leaders living in Human and harmonious community for love of God and our country.
                </p>
              </div>
            </article>

            <article className="nurse-about-row">
              <h3>Function of the Clinic</h3>
              <div>
                <p className="nurse-about-strong">
                  The clinic is concerned with the health and safety of all student and employees. It gives primary
                  emphasis on health promotion accident/disease prevention, immediate care and follow-up. All clinic in
                  the three (3) campuses have following functions:
                </p>
                <ol>
                  <li>
                    Serves as a Health Center with adequate medical/dental equipment and supplies. The Staff readers
                    initials and immediate care to all Students, Faculty, Personnel and Administrators.
                  </li>
                  <li>Conducts consultations concerning health.</li>
                  <li>
                    Provides health programs to promote and maintain optimum level pf health(e.g.first and training
                    lectures on health and diseases, coordinates with Department of Health, monthly programs, and posting
                    of health-related articles and information).
                  </li>
                  <li>
                    Schedules and assists all Pupils and Students in their annuals laboratory( complete blood current
                    routine routine urinalysis, and medical and dental examinations.
                  </li>
                  <li>Provides immediate care to those who need first aid treatment, and;</li>
                  <li>
                    Contacts and inform the parents or guardians of pupils and students if any untoward indecent(e.g
                    emergency coordination children brought to the hospital, ect.) has occured.
                  </li>
                </ol>
              </div>
            </article>

            <article className="nurse-about-row nurse-about-row-team nurse-about-row-team-health">
              <h3>Nurses and Doctors of the University</h3>
              <div>
                <div className="nurse-about-team-grid">
                  {healthTeamMembers.map((member, index) => (
                    <article className="nurse-about-profile-card" key={member.name}>
                      <div className={`nurse-about-profile-top tone-${index % 3}`}>
                        <div className={`nurse-about-profile-badge tone-${index % 3}`} aria-hidden="true">
                          <span>{initialsFromName(member.name)}</span>
                        </div>
                      </div>

                      <div className="nurse-about-profile-bottom">
                        <h4>{member.name}</h4>
                        <p className="nurse-about-profile-role nurse-about-profile-role-health">{member.role}</p>
                        <p className="nurse-about-profile-campus">{member.campus}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </article>

            <article className="nurse-about-row nurse-about-row-team nurse-about-row-team-dev">
              <h3>System Development Team</h3>
              <div>
                <div className="nurse-about-team-grid nurse-about-team-grid-dev">
                  {developmentTeamMembers.map((member, index) => (
                    <article className="nurse-about-profile-card" key={member.name}>
                      <div className={`nurse-about-profile-top tone-${index % 3}`}>
                        <div className={`nurse-about-profile-badge tone-${index % 3}`} aria-hidden="true">
                          <span>{initialsFromName(member.name)}</span>
                        </div>
                      </div>

                      <div className="nurse-about-profile-bottom">
                        <h4>{member.name}</h4>
                        <p className="nurse-about-profile-role nurse-about-profile-role-dev">{member.role}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </article>
          </section>
        </section>
      </div>
    </div>
  );
}
