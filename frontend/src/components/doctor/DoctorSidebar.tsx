import { LayoutDashboard, Stethoscope, Info, MessageSquare } from 'lucide-react';

export type DoctorSection = 'dashboard' | 'referrals' | 'about' | 'chat' | 'notifications';

interface Props {
  doctorName: string;
  activeSection: DoctorSection;
  onMenuClick: (section: DoctorSection) => void;
}

const MENU_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'referrals', label: 'Referrals', icon: Stethoscope },
  { key: 'about', label: 'About', icon: Info },
  { key: 'chat', label: 'Messages', icon: MessageSquare },
] as const;

export function DoctorSidebar({ doctorName, activeSection, onMenuClick }: Props) {
  return (
    <aside className="nurse-sidebar" aria-label="Doctor sidebar" style={{ minHeight: '100vh' }}>
      <div className="nurse-sidebar-brand">
        <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
        <div className="nurse-sidebar-identity">
          <h3>{doctorName}</h3>
          <p>Doctor</p>
        </div>
      </div>
      <nav className="nurse-sidebar-nav">
        {MENU_ITEMS.map(({ key, label, icon: Icon }) => (
          <div className="nurse-nav-item" key={key}>
            <button
              className={`nurse-side-link${activeSection === key ? ' active' : ''}`}
              onClick={() => onMenuClick(key as DoctorSection)}
              type="button"
            >
              <Icon className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">{label}</span>
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
