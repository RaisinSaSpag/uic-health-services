import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Info,
  Package,
  RefreshCw,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventoryBasePath } from '../lib/useInventoryBasePath';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';

interface Medicine {
  id: number;
  name: string;
  category: string;
}

interface InventoryItem {
  id: number;
  medicine_id: number;
  campus_id: number;
  quantity: number;
  available_quantity?: number;
  expiration_date: string;
  medicine?: Medicine;
}

interface DispensedMedicine {
  name: string;
  category: string | null;
  medicine_stock_out: number;
}

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
  { key: 'reports', label: 'Reports', icon: TrendingUp, path: '/nurse/inventory/reports' },
  { key: 'about', label: 'About', icon: Info, path: '/nurse/inventory/about' },
];

const CATEGORY_COLORS = [
  '#d94e70',
  '#b83355',
  '#e6708f',
  '#8b1e3f',
  '#f2a0b5',
  '#c44a6a',
];

export function NurseInventoryReportsPage() {
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

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispensed, setDispensed] = useState<DispensedMedicine[]>([]);
  const [dispensedLoading, setDispensedLoading] = useState(true);
  const [dispenseMonth, setDispenseMonth] = useState<number | 'all'>(new Date().getMonth() + 1);
  const [dispenseYear, setDispenseYear] = useState<number>(new Date().getFullYear());
  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const campusId = user?.campus_id ?? null;

  const loadReports = useCallback(async () => {
    if (!campusId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get<InventoryItem[]>('/inventory/available', {
        params: { campus_id: campusId },
      });
      setInventory(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load reports.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

    const loadDispensedReport = useCallback(async () => {
    if (!campusId) {
      setDispensedLoading(false);
      return;
    }

    setDispensedLoading(true);
    try {
      const params: Record<string, number> = { campus_id: campusId };
      if (dispenseMonth !== 'all') {
        params.month = dispenseMonth;
      }
      if (dispenseYear) {
        params.year = dispenseYear;
      }

      const response = await api.get<DispensedMedicine[]>('/medicines/stock-out', { params });
      setDispensed(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load dispensing report.'), 'Load Failed');
      setDispensed([]);
    } finally {
      setDispensedLoading(false);
    }
  }, [campusId, dispenseMonth, dispenseYear]);

  useEffect(() => {
    void loadDispensedReport();
  }, [loadDispensedReport]);

  // Aggregate by medicine name
  const medicineTotals = useMemo(() => {
    const map = new Map<string, number>();

    inventory.forEach((item) => {
      const name = item.medicine?.name ?? `Medicine ${item.medicine_id}`;
      const qty = item.available_quantity ?? item.quantity ?? 0;
      map.set(name, (map.get(name) ?? 0) + qty);
    });

    return Array.from(map.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [inventory]);

  // Aggregate by category
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();

    inventory.forEach((item) => {
      const category = item.medicine?.category ?? 'Uncategorized';
      map.set(category, (map.get(category) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [inventory]);

  const totalMedicines = medicineTotals.length;
  const totalStockUnits = medicineTotals.reduce((sum, m) => sum + m.quantity, 0);
  const totalCategories = categoryTotals.length;

  // Top 10 by stock
  const topMedicines = medicineTotals.slice(0, 10);
  const maxMedicineQty = topMedicines.length > 0 ? Math.max(...topMedicines.map((m) => m.quantity)) : 1;

  const maxCategoryCount = categoryTotals.length > 0 ? Math.max(...categoryTotals.map((c) => c.count)) : 1;

  const onMenuClick = (item: MenuItem): void => {
    if (item.path !== '/nurse/inventory/reports') {
      navigate(item.path);
    }
  };

  const handlePrint = (): void => {
    window.print();
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
            const isActive = item.key === 'reports';
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
              <h2>Inventory Reports</h2>
              <p className="muted small">{campusName}</p>
            </div>
            <div className="nurse-dashboard-actions">
              <button
                className="button ghost nurse-refresh-button"
                onClick={() => void loadReports()}
                type="button"
                disabled={loading}
              >
                <RefreshCw className={`nurse-refresh-icon${loading ? ' spinning' : ''}`} size={16} strokeWidth={2.2} />
              </button>
              <button className="button" onClick={handlePrint} type="button">
                Print Report
              </button>
            </div>
          </div>
        </section>

        <section className="nurse-kpi-grid" aria-label="Report summary">
          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <Package className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Total Medicines</p>
            </div>
            <p className="nurse-kpi-value">{totalMedicines}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <CheckCircle2 className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Total Stock Units</p>
            </div>
            <p className="nurse-kpi-value">{totalStockUnits}</p>
          </article>

          <article className="panel nurse-kpi-card">
            <div className="nurse-kpi-head">
              <span className="nurse-kpi-icon-wrap">
                <AlertTriangle className="nurse-kpi-icon" size={16} strokeWidth={2.2} />
              </span>
              <p className="nurse-kpi-label">Categories</p>
            </div>
            <p className="nurse-kpi-value">{totalCategories}</p>
          </article>
        </section>

        {/* Top Medicines Bar Chart */}
        <section className="panel">
          <div className="panel-head">
            <h3 className="nurse-dashboard-consultation-title">Top 10 Medicines by Stock</h3>
          </div>

          {loading ? (
            <p className="muted">Loading report data...</p>
          ) : topMedicines.length === 0 ? (
            <p className="empty-state">No inventory data available for this campus.</p>
          ) : (
            <div style={{ padding: '1rem 1.5rem 1.5rem' }}>
              {topMedicines.map((medicine) => {
                const percent = maxMedicineQty > 0 ? (medicine.quantity / maxMedicineQty) * 100 : 0;
                return (
                  <div key={medicine.name} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 500, color: '#333' }}>{medicine.name}</span>
                      <span style={{ color: '#666' }}>{medicine.quantity} units</span>
                    </div>
                    <div style={{ height: '12px', background: '#f5f5f5', borderRadius: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${percent}%`,
                          background: `linear-gradient(90deg, #d94e70, #b83355)`,
                          borderRadius: '6px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Category Breakdown */}
        <section className="panel">
          <div className="panel-head">
            <h3 className="nurse-dashboard-consultation-title">Medicines by Category</h3>
          </div>

          {loading ? (
            <p className="muted">Loading category data...</p>
          ) : categoryTotals.length === 0 ? (
            <p className="empty-state">No categories to display.</p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Category breakdown table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Number of Medicines</th>
                    <th style={{ width: '50%' }}>Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTotals.map((cat, index) => {
                    const percent = maxCategoryCount > 0 ? (cat.count / maxCategoryCount) * 100 : 0;
                    const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                    return (
                      <tr key={cat.category}>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: color,
                              marginRight: '0.5rem',
                              verticalAlign: 'middle',
                            }}
                          />
                          {cat.category}
                        </td>
                        <td>{cat.count}</td>
                        <td>
                          <div style={{ height: '10px', background: '#f5f5f5', borderRadius: '5px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${percent}%`,
                                background: color,
                                borderRadius: '5px',
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

                {/* Dispensed Medicines Report */}
        <section className="panel">
          <div className="panel-head">
            <h3 className="nurse-dashboard-consultation-title">Dispensed Medicines Report</h3>
            <div className="nurse-dashboard-actions" style={{ gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                <span className="muted">Month</span>
                <select
                  value={dispenseMonth}
                  onChange={(event) =>
                    setDispenseMonth(event.target.value === 'all' ? 'all' : Number(event.target.value))
                  }
                  disabled={dispensedLoading}
                  style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="all">All</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                <span className="muted">Year</span>
                <select
                  value={dispenseYear}
                  onChange={(event) => setDispenseYear(Number(event.target.value))}
                  disabled={dispensedLoading}
                  style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  {Array.from({ length: 5 }, (_, idx) => new Date().getFullYear() - idx).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {dispensedLoading ? (
            <p className="muted">Loading dispensing data...</p>
          ) : dispensed.length === 0 ? (
            <p className="empty-state">No dispensed medicines for the selected period.</p>
          ) : (
            <div style={{ padding: '1rem 1.5rem 1.5rem' }}>
              <p className="muted small" style={{ marginBottom: '1rem' }}>
                Total dispensed in period:{' '}
                <strong>
                  {dispensed.reduce((sum, d) => sum + d.medicine_stock_out, 0)} units
                </strong>{' '}
                across {dispensed.length} medicine{dispensed.length === 1 ? '' : 's'}
              </p>

              {dispensed.map((med) => {
                const maxQty = Math.max(...dispensed.map((d) => d.medicine_stock_out), 1);
                const percent = maxQty > 0 ? (med.medicine_stock_out / maxQty) * 100 : 0;
                return (
                  <div key={med.name} style={{ marginBottom: '0.75rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '0.25rem',
                        fontSize: '0.9rem',
                      }}
                    >
                      <span style={{ fontWeight: 500, color: '#333' }}>
                        {med.name}
                        {med.category ? (
                          <span className="muted small" style={{ marginLeft: '0.5rem' }}>
                            ({med.category})
                          </span>
                        ) : null}
                      </span>
                      <span style={{ color: '#666' }}>{med.medicine_stock_out} dispensed</span>
                    </div>
                    <div
                      style={{
                        height: '12px',
                        background: '#f5f5f5',
                        borderRadius: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${percent}%`,
                          background: 'linear-gradient(90deg, #d94e70, #b83355)',
                          borderRadius: '6px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}