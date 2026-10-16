import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Package,
  RefreshCw,
  Search,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventoryBasePath } from '../lib/useInventoryBasePath';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { formatDate, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';

interface InventoryItem {
  id: number;
  medicine_id: number;
  campus_id: number;
  quantity: number;
  available_quantity?: number;
  date_received: string;
  expiration_date: string;
  medicine?: {
    id: number;
    name: string;
    category: string;
  };
}

interface DashboardStats {
  totalMedicines: number;
  totalStockUnits: number;
  lowStockCount: number;
  expiringSoonCount: number;
}

type InventorySection = 'dashboard' | 'stocks' | 'requests' | 'history' | 'reports' | 'about';

interface MenuItem {
  key: InventorySection;
  label: string;
  icon: LucideIcon;
  path: string;
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: TrendingUp, path: '/nurse/inventory' },
  { key: 'stocks', label: 'Stocks', icon: Package, path: '/nurse/inventory/stocks' },
  { key: 'requests', label: 'Branch Requests', icon: Package, path: '/nurse/inventory/requests' },
  { key: 'history', label: 'History', icon: Package, path: '/nurse/inventory/history' },
  { key: 'reports', label: 'Reports', icon: Package, path: '/nurse/inventory/reports' },
  { key: 'about', label: 'About', icon: Package, path: '/nurse/inventory/about' },
];

function truncateText(value: string, maxLength = 60): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

export function NurseInventoryDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { basePath } = useInventoryBasePath();

  const resolvedMenuItems = useMemo(
    () =>
      menuItems.map((item) => ({
        ...item,
        path: item.path.replace('/nurse/inventory', basePath),
      })),
    [basePath],
  );

  const [activeSection, setActiveSection] = useState<InventorySection>('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    totalMedicines: 0,
    totalStockUnits: 0,
    lowStockCount: 0,
    expiringSoonCount: 0,
  });
  const [recentStocks, setRecentStocks] = useState<InventoryItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [, setExpiringItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const campusId = user?.campus_id ?? null;

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    [],
  );

  const loadDashboard = useCallback(async () => {
    if (!campusId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [availableRes, lowStockRes, expiringRes] = await Promise.all([
        api.get<InventoryItem[]>('/inventory/available', { params: { campus_id: campusId } }),
        api.get<InventoryItem[]>('/inventory/low-stock', { params: { campus_id: campusId } }),
        api.get<InventoryItem[]>('/inventory/expiring-soon', { params: { campus_id: campusId } }),
      ]);

      const available = Array.isArray(availableRes.data) ? availableRes.data : [];
      const lowStock = Array.isArray(lowStockRes.data) ? lowStockRes.data : [];
      const expiring = Array.isArray(expiringRes.data) ? expiringRes.data : [];

      const totalUnits = available.reduce(
        (sum, item) => sum + (item.available_quantity ?? item.quantity ?? 0),
        0,
      );

      setStats({
        totalMedicines: available.length,
        totalStockUnits: totalUnits,
        lowStockCount: lowStock.length,
        expiringSoonCount: expiring.length,
      });

      setRecentStocks(available.slice(0, 10));
      setLowStockItems(lowStock.slice(0, 5));
      setExpiringItems(expiring.slice(0, 5));
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load inventory dashboard.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const filteredStocks = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (normalized === '') return recentStocks;

    return recentStocks.filter((item) => {
      const name = item.medicine?.name?.toLowerCase() ?? '';
      const category = item.medicine?.category?.toLowerCase() ?? '';
      return name.includes(normalized) || category.includes(normalized);
    });
  }, [recentStocks, search]);

  const onMenuClick = (item: MenuItem): void => {
    setActiveSection(item.key);
    if (item.path !== '/nurse/inventory') {
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
              <div className="nurse-nav-item">
                <button
                  className="nurse-side-link back-to-dashboard"
                  onClick={() => navigate(basePath === '/doctor/inventory' ? '/doctor' : '/nurse')}
                  type="button"
                >
                  <ArrowLeft className="nurse-side-icon" size={18} strokeWidth={2.2} />
                  <span className="nurse-side-label">Back to Dashboard</span>
                </button>
              </div>

              {resolvedMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <div className="nurse-nav-item" key={item.key}>
                <button
                  className={`nurse-side-link${activeSection === item.key ? ' active' : ''}`}
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
              <h2>Inventory Dashboard</h2>
              <p className="muted small">{todayLabel}</p>
            </div>
            <button
              className="button ghost nurse-refresh-button"
              onClick={() => void loadDashboard()}
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
        </section>

        <section className="nurse-kpi-grid" aria-label="Inventory metrics">
          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <Package className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Total Medicines</p>
            </div>
            <p className="nurse-kpi-value">{stats.totalMedicines}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <CheckCircle2 className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Total Stock Units</p>
            </div>
            <p className="nurse-kpi-value">{stats.totalStockUnits}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <AlertTriangle className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Low Stock</p>
            </div>
            <p className="nurse-kpi-value">{stats.lowStockCount}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <AlertTriangle className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Expiring Soon</p>
            </div>
            <p className="nurse-kpi-value">{stats.expiringSoonCount}</p>
          </article>
        </section>

        <section className="panel">
          <div className="panel-head nurse-dashboard-consultation-head">
            <div className="nurse-dashboard-consultation-title-wrap">
              <h3 className="nurse-dashboard-consultation-title">Available Stock</h3>
            </div>
            <label className="nurse-records-search nurse-dashboard-consultation-search">
              <Search className="nurse-dashboard-consultation-search-icon" size={16} strokeWidth={2.25} />
              <input
                placeholder="Search medicines..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search medicines"
              />
            </label>
          </div>

          {loading ? (
            <p className="muted">Loading inventory data...</p>
          ) : filteredStocks.length === 0 ? (
            <p className="empty-state">No stock available for this campus.</p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Available stock table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Expiration</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map((item) => (
                    <tr key={item.id}>
                      <td>{truncateText(item.medicine?.name ?? 'Unknown')}</td>
                      <td>{item.medicine?.category ?? 'N/A'}</td>
                      <td>{item.available_quantity ?? item.quantity}</td>
                      <td>{formatDate(item.expiration_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {lowStockItems.length > 0 && (
          <section className="panel">
            <div className="panel-head">
              <h3 className="nurse-dashboard-consultation-title">Low Stock Alerts</h3>
            </div>
            <div className="table-wrap">
              <table aria-label="Low stock alerts">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Quantity</th>
                    <th>Expiration</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => (
                    <tr key={item.id}>
                      <td>{truncateText(item.medicine?.name ?? 'Unknown')}</td>
                      <td>{item.available_quantity ?? item.quantity}</td>
                      <td>{formatDate(item.expiration_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}