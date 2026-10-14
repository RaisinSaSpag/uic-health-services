import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Info,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userDisplayName } from '../lib/format';

type InventorySection = 'dashboard' | 'stocks' | 'requests' | 'history' | 'reports' | 'about';

interface MenuItem {
  key: InventorySection;
  label: string;
  icon: LucideIcon;
  path: string;
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Package, path: '/nurse/inventory' },
  { key: 'stocks', label: 'Stocks', icon: Package, path: '/nurse/inventory/stocks' },
  { key: 'requests', label: 'Branch Requests', icon: Package, path: '/nurse/inventory/requests' },
  { key: 'history', label: 'History', icon: Package, path: '/nurse/inventory/history' },
  { key: 'reports', label: 'Reports', icon: Package, path: '/nurse/inventory/reports' },
  { key: 'about', label: 'About', icon: Info, path: '/nurse/inventory/about' },
];

export function NurseInventoryAboutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const onMenuClick = (item: MenuItem): void => {
    if (item.path !== '/nurse/inventory/about') {
      navigate(item.path);
    }
  };

  return (
    <div className="nurse-dashboard-page">
      <aside className="nurse-sidebar" aria-label="Inventory sidebar">
        <div className="nurse-sidebar-brand">
          <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
          <div className="nurse-sidebar-identity">
            <h3>{userName}</h3>
            <p>{campusName}</p>
          </div>
        </div>

        <nav className="nurse-sidebar-nav" aria-label="Inventory navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === 'about';
            return (
              <div className="nurse-nav-item" key={item.key}>
                <button
                  className={`nurse-side-link${isActive ? ' active' : ''}`}
                  onClick={() => onMenuClick(item)}
                  type="button"
                >
                  <Icon className="nurse-side-icon" size={18} strokeWidth={2.2} />
                  <span className="nurse-side-label">{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="nurse-dashboard-main">
        <section className="panel">
          <div className="panel-head nurse-dashboard-head">
            <div>
              <h2>About the Inventory Module</h2>
              <p className="muted small">Learn about the UIC HIMS inventory system.</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ marginBottom: '0.5rem', color: '#b83355' }}>Overview</h3>
              <p style={{ lineHeight: 1.6, color: '#333' }}>
                The UIC Health Inventory Management System (HIMS) is the inventory module of the
                UIC Health Services Management System (HSMS). It provides clinic nurses and
                coordinators with a centralized platform to track medicine stock across all five
                university clinic branches.
              </p>
            </div>

            <div>
              <h3 style={{ marginBottom: '0.5rem', color: '#b83355' }}>Key Features</h3>
              <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem', color: '#333' }}>
                <li>Real-time stock monitoring across all campus branches</li>
                <li>Automated low-stock alerts and expiry notifications</li>
                <li>Inter-branch medicine transfer requests</li>
                <li>Full activity history and audit trail</li>
                <li>Monthly usage reports and analytics</li>
                <li>Medicine catalog with full CRUD operations</li>
              </ul>
            </div>

            <div>
              <h3 style={{ marginBottom: '0.5rem', color: '#b83355' }}>University Vision</h3>
              <p style={{ lineHeight: 1.6, color: '#333' }}>
                A globally recognized Catholic university that nurtures faith, builds passion for
                excellence, and develops lifelong learners with compassion for service that impacts
                transformation in a fast-changing society.
              </p>
            </div>

            <div>
              <h3 style={{ marginBottom: '0.5rem', color: '#b83355' }}>University Mission</h3>
              <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem', color: '#333' }}>
                <li>Provide an excellent educational experience to students</li>
                <li>Inculcate values of service, justice, and integrity</li>
                <li>Engage in collaborative research activities</li>
                <li>Uphold the dignity of persons, especially the poor</li>
                <li>Promote and strengthen Filipino culture and values</li>
              </ul>
            </div>

            <div style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem', color: '#666', fontSize: '0.9rem' }}>
              <p><strong>Version:</strong> 1.0</p>
              <p><strong>Developed by:</strong> UIC Capstone Team (Group 3A / Group 4 merged)</p>
              <p><strong>Deployment:</strong> On-premise, University of the Immaculate Conception</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}