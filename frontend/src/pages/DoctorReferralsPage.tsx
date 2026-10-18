import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  ArrowLeftCircle,
  Info,
  LayoutDashboard,
  Package,
  Stethoscope,
  MessageSquare,
  type LucideIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { confirmAction, notifyError, notifySuccess } from '../lib/alerts';
import { formatDateTime, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { PaginatedResponse, Referral, Medicine } from '../types/hsms';

type DoctorSection = 'dashboard' | 'inventory' | 'referrals' | 'about' | 'chat' | 'notifications';

interface DoctorMenuItem {
  key: DoctorSection;
  label: string;
  icon: LucideIcon;
}

interface PrescriptionRow {
  id: string;
  medicine_id: number | '';
  quantity: number | '';
  dosage_instructions: string;
}

const doctorMenuItems: DoctorMenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'referrals', label: 'Referrals', icon: Stethoscope },
  { key: 'about', label: 'About', icon: Info },
  { key: 'chat', label: 'Messages', icon: MessageSquare },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];

const doctorInventorySubItems: Array<{ key: string; label: string; path: string }> = [
  { key: 'inventory_dashboard', label: 'Dashboard', path: '/doctor/inventory' },
  { key: 'inventory_stocks', label: 'Stocks', path: '/doctor/inventory/stocks' },
  { key: 'inventory_requests', label: 'Branch Requests', path: '/doctor/inventory/requests' },
  { key: 'inventory_history', label: 'History', path: '/doctor/inventory/history' },
  { key: 'inventory_reports', label: 'Reports', path: '/doctor/inventory/reports' },
  { key: 'inventory_about', label: 'About', path: '/doctor/inventory/about' },
];

const referralStatusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending_doctor', label: 'pending_doctor' },
  { value: 'in_progress', label: 'in_progress' },
  { value: 'completed', label: 'completed' },
];

function normalizeText(value: string | null | undefined): string {
  if (!value || value.trim() === '') {
    return 'N/A';
  }
  return value.replace(/_/g, ' ');
}

function normalizeVital(value: string | number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  return suffix ? `${value} ${suffix}` : String(value);
}

function parseReferralId(value: string | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function DoctorReferralsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { referralId: rawReferralId } = useParams<{ referralId: string }>();

  const [activeSection, setActiveSection] = useState<DoctorSection>('referrals');
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [detailReferral, setDetailReferral] = useState<Referral | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [doctorRemarks, setDoctorRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // RISK-06: Structured Prescription State
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);

  const routeReferralId = useMemo(() => parseReferralId(rawReferralId), [rawReferralId]);
  const isDetailMode = routeReferralId !== null;

  const doctorName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const loadReferrals = useCallback(async () => {
    if (isDetailMode) return;
    setLoading(true);
    try {
      const response = await api.get<PaginatedResponse<Referral>>('/referrals', {
        params: { per_page: 100, ...(statusFilter ? { status: statusFilter } : {}) },
      });
      setReferrals(response.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load doctor referrals.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [isDetailMode, statusFilter]);

  const loadMedicines = useCallback(async () => {
    try {
      const response = await api.get<PaginatedResponse<Medicine> | Medicine[]>('/medicines', { params: { per_page: 100 }});
      // Handle both paginated and raw array responses just in case
      const data = Array.isArray(response.data) ? response.data : response.data.data;
      setMedicines(data);
    } catch {
      // non-fatal; doctor can still complete referral without structured medicine
    }
  }, []);

  const loadReferralDetail = useCallback(async () => {
    if (!routeReferralId) {
      setDetailReferral(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const response = await api.get<Referral>(`/referrals/${routeReferralId}`);
      setDetailReferral(response.data);
      setDoctorRemarks(response.data.doctor_remarks ?? '');
      // Load medicines for the dropdown
      if (medicines.length === 0) {
        void loadMedicines();
      }
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load selected referral.'), 'Load Failed');
      navigate('/doctor/referrals');
    } finally {
      setLoadingDetail(false);
    }
  }, [navigate, routeReferralId, medicines.length, loadMedicines]);

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

  const onFilterChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setStatusFilter(event.target.value);
  };

  const onMenuClick = (section: DoctorSection): void => {
    setActiveSection(section);
    if (section === 'dashboard') { navigate('/doctor'); return; }
    if (section === 'chat') { navigate('/doctor/chat'); return; }
    if (section === 'notifications') { navigate('/doctor/notifications'); return; }
    if (section === 'inventory') { setIsInventoryOpen((current) => !current); return; }
    if (section === 'referrals') { navigate('/doctor/referrals'); return; }
    if (section === 'about') { navigate('/doctor/about'); }
  };

  const onInventorySubItemClick = (path: string): void => {
    navigate(path);
  };

  // --- Prescription Row Handlers ---
  const addPrescriptionRow = () => {
    setPrescriptions((current) => [
      ...current,
      { id: Date.now().toString(), medicine_id: '', quantity: 1, dosage_instructions: '' },
    ]);
  };

  const updatePrescriptionRow = (id: string, field: keyof PrescriptionRow, value: string | number) => {
    setPrescriptions((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const removePrescriptionRow = (id: string) => {
    setPrescriptions((current) => current.filter((row) => row.id !== id));
  };

  const updateReferral = async (action: 'in_progress' | 'complete'): Promise<void> => {
    if (!detailReferral) return;

    if (action === 'complete') {
      if (doctorRemarks.trim() === '') {
        void notifyError('Doctor remarks are required to complete this referral.', 'Missing Details');
        return;
      }
      
      // Validate prescriptions if any are added
      const validPrescriptions = prescriptions.filter(p => p.medicine_id !== '' && p.quantity !== '');
      if (prescriptions.length > 0 && validPrescriptions.length !== prescriptions.length) {
        void notifyError('Please fill in all medicine and quantity fields for prescriptions.', 'Incomplete Prescriptions');
        return;
      }

      const confirmed = await confirmAction({
        title: 'Complete this referral?',
        text: `Referral #${detailReferral.id} will be marked as complete and prescriptions will be saved.`,
        confirmButtonText: 'Complete Referral',
        cancelButtonText: 'Cancel',
      });

      if (!confirmed) return;

      setSaving(true);

      try {
        // 1. Create prescriptions (if any)
        for (const p of validPrescriptions) {
          await api.post('/prescriptions', {
            consultation_id: detailReferral.consultation_id,
            medicine_id: p.medicine_id,
            quantity: p.quantity,
            dosage_instructions: p.dosage_instructions,
          });
        }

        // 2. Complete the referral
        await api.patch(`/referrals/${detailReferral.id}`, {
          action: 'complete',
          doctor_remarks: doctorRemarks.trim(),
          prescription: 'See structured prescriptions', // Legacy fallback
        });

        await notifySuccess(`Referral #${detailReferral.id} updated and prescriptions saved.`, 'Referral Completed');
        await loadReferralDetail();
      } catch (err) {
        void notifyError(getErrorMessage(err, `Failed to complete referral #${detailReferral.id}.`), 'Update Failed');
      } finally {
        setSaving(false);
      }
    } else {
      const confirmed = await confirmAction({
        title: 'Mark referral in progress?',
        text: `Referral #${detailReferral.id} will be updated to in_progress.`,
        confirmButtonText: 'Mark In Progress',
        cancelButtonText: 'Cancel',
      });

      if (!confirmed) return;

      setSaving(true);
      try {
        await api.patch(`/referrals/${detailReferral.id}`, { action: 'in_progress' });
        await notifySuccess(`Referral #${detailReferral.id} updated.`, 'Referral Updated');
        await loadReferralDetail();
      } catch (err) {
        void notifyError(getErrorMessage(err, `Failed to update referral #${detailReferral.id}.`), 'Update Failed');
      } finally {
        setSaving(false);
      }
    }
  };

  const canSetInProgress = detailReferral?.status === 'pending_doctor';
  const canComplete = detailReferral ? ['pending_doctor', 'in_progress'].includes(detailReferral.status) : false;

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

      <div className={`nurse-dashboard-main nurse-dashboard-main-detail${isDetailMode ? ' referral-detail-main' : ''}`}>
        {!isDetailMode ? (
          <section className="panel nurse-records-panel">
            <div className="panel-head nurse-records-head">
              <div>
                <h2>Referral Consultations</h2>
                <p className="muted small">View and manage nurse referral consultations.</p>
              </div>
            </div>

            <div className="nurse-records-toolbar referral-list-toolbar">
              <label className="field nurse-records-search" htmlFor="doctor-referrals-search">
                <span>Search Referrals</span>
                <input
                  id="doctor-referrals-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by patient, referral reason, or status"
                />
              </label>

              <label className="field inline-field referral-status-field">
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

            {loading ? (
              <p className="muted">Loading referrals...</p>
            ) : filteredReferrals.length === 0 ? (
              <p className="empty-state">No referrals found for this filter.</p>
            ) : (
              <div className="table-wrap">
                <table aria-label="Doctor referrals table" className="referral-list-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Status</th>
                      <th>Referred</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReferrals.map((referral) => (
                      <tr key={referral.id}>
                        <td>{userDisplayName(referral.consultation?.patient?.user)}</td>
                        <td>
                          <StatusBadge status={referral.status} />
                        </td>
                        <td>{formatDateTime(referral.referred_at)}</td>
                        <td className="referral-list-action-cell">
                          <button
                            className="button ghost referral-view-button"
                            onClick={() => navigate(`/doctor/referrals/${referral.id}`)}
                            type="button"
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
          </section>
        ) : (
          <>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Referral Consultation Detail</h2>
                </div>
                <button
                  aria-label="Back to referrals"
                  className="button ghost referral-back-icon-button"
                  onClick={() => navigate('/doctor/referrals')}
                  title="Back to referrals"
                  type="button"
                >
                  <ArrowLeftCircle size={18} strokeWidth={2.2} />
                </button>
              </div>
            </section>

            <section className="panel referral-workbench referral-workbench-detail">
              {loadingDetail || !detailReferral ? (
                <p className="muted">Loading referral details...</p>
              ) : (
                <div className="referral-compare-grid">
                  <article className="nurse-consultation-detail-panel">
                    <h3>Nurse Consultation Details</h3>
                    <table>
                      <tbody>
                        <tr><td>Patient</td><td>{userDisplayName(detailReferral.consultation?.patient?.user)}</td></tr>
                        <tr><td>Consultation Type</td><td>{normalizeText(detailReferral.consultation?.consultation_type)}</td></tr>
                        <tr><td>Chief Complaint</td><td>{detailReferral.consultation?.chief_complaint ?? 'N/A'}</td></tr>
                        <tr><td>Diagnosis</td><td>{detailReferral.consultation?.diagnosis ?? 'N/A'}</td></tr>
                        <tr><td>Remarks</td><td>{detailReferral.consultation?.remarks ?? 'N/A'}</td></tr>
                        <tr><td>Blood Pressure</td><td>{normalizeVital(detailReferral.consultation?.blood_pressure)}</td></tr>
                        <tr><td>Pulse</td><td>{normalizeVital(detailReferral.consultation?.pulse_bpm, 'bpm')}</td></tr>
                        <tr><td>Temperature</td><td>{normalizeVital(detailReferral.consultation?.temperature_c, 'C')}</td></tr>
                        <tr><td>Weight</td><td>{normalizeVital(detailReferral.consultation?.weight_kg, 'kg')}</td></tr>
                        <tr><td>Referral Reason</td><td>{detailReferral.referral_reason}</td></tr>
                      </tbody>
                    </table>
                  </article>

                  <article className="nurse-consultation-detail-panel">
                    <h3>Doctor Notes</h3>

                    <label className="field full-width">
                      <span>Doctor Remarks (Required)</span>
                      <textarea
                        rows={4}
                        value={doctorRemarks}
                        onChange={(event) => setDoctorRemarks(event.target.value)}
                        placeholder="Enter your clinical remarks"
                        disabled={detailReferral.status === 'completed' || saving}
                      />
                    </label>

                    <div style={{ marginTop: '1rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0 }}>Prescriptions</h4>
                      {canComplete && (
                        <button className="button ghost" type="button" onClick={addPrescriptionRow} disabled={saving}>
                          <Plus size={16} /> Add Medicine
                        </button>
                      )}
                    </div>

                    {prescriptions.map((row) => (
                      <div key={row.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                        <select
                          className="input"
                          style={{ flex: 2 }}
                          value={row.medicine_id}
                          onChange={(e) => updatePrescriptionRow(row.id, 'medicine_id', Number(e.target.value))}
                          disabled={detailReferral.status === 'completed' || saving}
                          required
                        >
                          <option value="">Select Medicine</option>
                          {medicines.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        <input
                          className="input"
                          style={{ flex: 1 }}
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => updatePrescriptionRow(row.id, 'quantity', Number(e.target.value))}
                          disabled={detailReferral.status === 'completed' || saving}
                          required
                        />
                        <input
                          className="input"
                          style={{ flex: 2 }}
                          type="text"
                          placeholder="Instructions (e.g. 1 tab 3x a day)"
                          value={row.dosage_instructions}
                          onChange={(e) => updatePrescriptionRow(row.id, 'dosage_instructions', e.target.value)}
                          disabled={detailReferral.status === 'completed' || saving}
                        />
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => removePrescriptionRow(row.id)}
                          disabled={detailReferral.status === 'completed' || saving}
                          title="Remove"
                        >
                          <Trash2 size={16} color="#d44974" />
                        </button>
                      </div>
                    ))}

                    <div className="action-row" style={{ marginTop: '1.5rem' }}>
                      {canSetInProgress && (
                        <button
                          className="button secondary"
                          onClick={() => void updateReferral('in_progress')}
                          disabled={saving}
                          type="button"
                        >
                          Mark In Progress
                        </button>
                      )}

                      {canComplete && (
                        <button
                          className="button success"
                          onClick={() => void updateReferral('complete')}
                          disabled={saving}
                          type="button"
                        >
                          {saving ? 'Saving...' : 'Complete Referral'}
                        </button>
                      )}
                    </div>
                  </article>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

