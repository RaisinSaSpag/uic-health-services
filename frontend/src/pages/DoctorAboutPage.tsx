import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Info,
  LayoutDashboard,
  Package,
  Stethoscope,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userDisplayName } from '../lib/format';

type DoctorSection = 'dashboard' | 'inventory' | 'referrals' | 'about' | 'chat' | 'notifications';

interface DoctorMenuItem {
  key: DoctorSection;
  label: string;
  icon: LucideIcon;
}

interface AboutPerson {
  name: string;
  role: string;
  campus?: string;
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

export function DoctorAboutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<DoctorSection>('about');
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  const doctorName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const onMenuClick = (section: DoctorSection): void => {
    setActiveSection(section);

    if (section === 'dashboard') {
      navigate('/doctor');
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

    if (section === 'inventory') {
      setIsInventoryOpen((current) => !current);
      return;
    }

    if (section === 'referrals') {
      navigate('/doctor/referrals');
      return;
    }

    navigate('/doctor/about');
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
                  <li>
                    Conducts annual physical examination and random check-up especially to student and employees who need
                    close observation to determine health concern.
                  </li>
                  <li>
                    Provides referrals to private/public hospitals and specialist clinics for cases that need advanced
                    medical management.
                  </li>
                  <li>
                    Maintains complete and updated health records of all clinic patients to support continuity of care.
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
