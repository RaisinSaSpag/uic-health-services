import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  RefreshCw,
  Search,
  Stethoscope,
  type LucideIcon,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about' | 'chat' | 'notifications';
type SearchTarget = 'student' | 'employee';
type PrintTab = 'prescription' | 'inventory';

interface NurseMenuItem {
  key: NurseSection;
  label: string;
  icon: LucideIcon;
}

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

const nurseMenuItems: NurseMenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'search', label: 'Search Records', icon: Search },
  { key: 'print', label: 'Print', icon: Printer },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'referrals', label: 'Referrals', icon: Stethoscope },
  { key: 'about', label: 'About', icon: Info },
  { key: 'chat', label: 'Messages', icon: MessageSquare },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: Bell,
  },
];

const searchTargetOptions: Array<{ key: SearchTarget; label: string; icon: LucideIcon }> = [
  { key: 'student', label: 'Student', icon: GraduationCap },
  { key: 'employee', label: 'Employee', icon: Briefcase },
];

const prescriptionAssetPath = '/prescription.png';

function formatDate(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysUntil(value: string): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function NursePrintPrescriptionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const printDelayTimerRef = useRef<number | null>(null);

  const [activeSection, setActiveSection] = useState<NurseSection>('print');
  const [activeTab, setActiveTab] = useState<PrintTab>('prescription');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('student');
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const campusId = user?.campus_id ?? null;

  // Preload the prescription background image
  useEffect(() => {
    const image = new window.Image();
    image.src = prescriptionAssetPath;
  }, []);

  // Reset isPreparingPrint on print finish
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

  // Load inventory when the tab is opened (once)
  const loadInventory = useCallback(async () => {
    if (!campusId) return;

    setInventoryLoading(true);
    try {
      const res = await api.get<InventoryItem[]>('/inventory/available', {
        params: { campus_id: campusId },
      });
      setInventory(Array.isArray(res.data) ? res.data : []);
      setInventoryLoaded(true);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load inventory.'), 'Load Failed');
    } finally {
      setInventoryLoading(false);
    }
  }, [campusId]);

  useEffect(() => {
    if (activeTab === 'inventory' && !inventoryLoaded && !inventoryLoading) {
      void loadInventory();
    }
  }, [activeTab, inventoryLoaded, inventoryLoading, loadInventory]);

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

  const triggerPrint = (): void => {
    if (isPreparingPrint) return;

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

  const inventorySorted = useMemo(() => {
    return [...inventory].sort((a, b) => {
      const an = (a.medicine?.name ?? '').toLowerCase();
      const bn = (b.medicine?.name ?? '').toLowerCase();
      return an.localeCompare(bn);
    });
  }, [inventory]);

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

          <div className="nurse-print-tabs no-print">
            <button
              type="button"
              className={`nurse-print-tab${activeTab === 'prescription' ? ' active' : ''}`}
              onClick={() => setActiveTab('prescription')}
            >
              Prescription
            </button>
            <button
              type="button"
              className={`nurse-print-tab${activeTab === 'inventory' ? ' active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              Inventory
            </button>
          </div>

          {activeTab === 'prescription' && (
            <article className="nurse-print-document-card">
              <header className="nurse-print-document-head">
                <div>
                  <h3>Prescription</h3>
                  <p className="nurse-print-document-meta">Print prescription form</p>
                </div>

                <button
                  className={`button nurse-print-action-button${isPreparingPrint ? ' is-preparing' : ''}`}
                  onClick={triggerPrint}
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
          )}

          {activeTab === 'inventory' && (
            <article className="nurse-print-document-card">
              <header className="nurse-print-document-head">
                <div>
                  <h3>Inventory Report</h3>
                  <p className="nurse-print-document-meta">
                    {campusName} · {inventorySorted.length} medicine{inventorySorted.length === 1 ? '' : 's'} in stock
                  </p>
                </div>

                <div className="nurse-dashboard-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="button ghost"
                    onClick={() => void loadInventory()}
                    type="button"
                    disabled={inventoryLoading}
                    title="Refresh"
                  >
                    <RefreshCw
                      className={inventoryLoading ? 'spinning' : ''}
                      size={16}
                      strokeWidth={2.2}
                    />
                  </button>
                  <button
                    className={`button nurse-print-action-button${isPreparingPrint ? ' is-preparing' : ''}`}
                    onClick={triggerPrint}
                    type="button"
                    aria-busy={isPreparingPrint}
                    disabled={isPreparingPrint || inventoryLoading}
                  >
                    <Printer
                      className={`nurse-print-action-icon${isPreparingPrint ? ' spinning' : ''}`}
                      size={16}
                      strokeWidth={2.4}
                    />
                    <span>{isPreparingPrint ? 'Opening Print Preview...' : 'Print Inventory'}</span>
                  </button>
                </div>
              </header>

              <div className="nurse-print-preview" aria-hidden="true">
                <Package className="nurse-print-preview-icon" size={44} strokeWidth={1.8} />
                <h4>Inventory Report Ready</h4>
                <p>Click print to continue.</p>
                <span>Current stock, expiration dates, and alerts</span>
              </div>

              {/* Print-only content — visible only when window.print() is invoked */}
              <div className="nurse-print-only-inventory" aria-hidden="true">
                <div className="nurse-print-inventory-sheet">
                  <header className="nurse-print-inventory-header">
                    <h2>UIC Health Services — Inventory Report</h2>
                    <p>
                      <strong>{campusName}</strong> · Generated by {nurseName} ·{' '}
                      {new Date().toLocaleString()}
                    </p>
                  </header>

                  {inventorySorted.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                      No inventory records found for this campus.
                    </p>
                  ) : (
                    <table className="nurse-print-inventory-table">
                      <thead>
                        <tr>
                          <th style={{ width: '8%' }}>#</th>
                          <th>Medicine</th>
                          <th>Category</th>
                          <th style={{ width: '12%' }}>Qty</th>
                          <th style={{ width: '18%' }}>Expiration</th>
                          <th style={{ width: '15%' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventorySorted.map((item, index) => {
                          const qty = item.available_quantity ?? item.quantity ?? 0;
                          const exp = item.expiration_date;
                          const days = daysUntil(exp);
                          let status = 'OK';
                          let statusClass = '';
                          if (qty <= 0) {
                            status = 'Out of Stock';
                            statusClass = 'bad';
                          } else if (qty <= 50) {
                            status = 'Low Stock';
                            statusClass = 'warn';
                          } else if (days !== null && days < 0) {
                            status = 'Expired';
                            statusClass = 'bad';
                          } else if (days !== null && days <= 30) {
                            status = 'Expiring Soon';
                            statusClass = 'warn';
                          }

                          return (
                            <tr key={item.id}>
                              <td>{index + 1}</td>
                              <td>{item.medicine?.name ?? `Medicine #${item.medicine_id}`}</td>
                              <td>{item.medicine?.category ?? '—'}</td>
                              <td>{qty}</td>
                              <td>{formatDate(exp)}</td>
                              <td className={statusClass}>{status}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  <footer className="nurse-print-inventory-footer">
                    <p>UIC Health Services Management System · Inventory Report · {new Date().toLocaleDateString()}</p>
                  </footer>
                </div>
              </div>
            </article>
          )}
        </section>
      </div>
    </div>
  );
}