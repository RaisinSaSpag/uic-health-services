import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
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
import { confirmAction, notifyError, notifySuccess } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import { userDisplayName } from '../lib/format';
import type { Consultation, PaginatedResponse, Patient, UserRecord } from '../types/hsms';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about' | 'chat' | 'notifications';
type NurseRecordsPatientType = 'student' | 'employee';
type ConsultationType = 'walk_in' | 'scheduled';
type ConsultationTypeParam = 'walk-in' | 'scheduled';

interface ConsultationFormState {
  consultationDate: string;
  consultationTime: string;
  referredToDoctor: boolean;
  referralDoctorId: string;
  referralReason: string;
  bloodPressure: string;
  pulseBpm: string;
  temperatureC: string;
  weightKg: string;
  lastMenstrualPeriod: string;
  complaints: string;
  diagnosis: string;
  remarks: string;
}

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

function toDateInputValue(value: Date): string {
  const year = String(value.getFullYear());
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function toTimeInputValue(value: Date): string {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function toNullableText(value: string): string | null {
  const normalized = value.trim();

  return normalized === '' ? null : normalized;
}

function toNullableInteger(value: string): number | null {
  const normalized = value.trim();

  if (normalized === '') {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);

  return Number.isNaN(parsed) ? null : parsed;
}

function toNullableDecimal(value: string): number | null {
  const normalized = value.trim();

  if (normalized === '') {
    return null;
  }

  const parsed = Number.parseFloat(normalized);

  return Number.isNaN(parsed) ? null : parsed;
}

function resolveConsultationType(value: string | undefined): ConsultationType | null {
  if (value === 'walk-in') {
    return 'walk_in';
  }

  if (value === 'scheduled') {
    return 'scheduled';
  }

  return null;
}

function consultationTypeLabel(value: ConsultationType): string {
  return value === 'walk_in' ? 'Walk-in' : 'Scheduled';
}

export function NurseConsultationFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { patientId: rawPatientId, consultationType: rawConsultationType } =
    useParams<{ patientId: string; consultationType: ConsultationTypeParam }>();

  const patientId = useMemo(() => {
    const parsedId = Number(rawPatientId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return null;
    }

    return parsedId;
  }, [rawPatientId]);

  const consultationType = useMemo(
    () => resolveConsultationType(rawConsultationType),
    [rawConsultationType],
  );

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState<NurseSection>('search');
  const [isSearchOpen, setIsSearchOpen] = useState(true);
  const [doctors, setDoctors] = useState<UserRecord[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [formState, setFormState] = useState<ConsultationFormState>(() => {
    const now = new Date();

    return {
      consultationDate: toDateInputValue(now),
      consultationTime: toTimeInputValue(now),
      referredToDoctor: false,
      referralDoctorId: '',
      referralReason: '',
      bloodPressure: '',
      pulseBpm: '',
      temperatureC: '',
      weightKg: '',
      lastMenstrualPeriod: '',
      complaints: '',
      diagnosis: '',
      remarks: '',
    };
  });

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);
  const patientType = useMemo(() => normalizePatientType(patient?.patient_type), [patient?.patient_type]);
  const isWalkIn = consultationType === 'walk_in';
  const isFormDisabled = submitting || loading || !patient;

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

  const loadDoctors = useCallback(async (): Promise<void> => {
    if (loadingDoctors || doctors.length > 0) {
      return;
    }

    setLoadingDoctors(true);

    try {
      const response = await api.get<PaginatedResponse<UserRecord>>('/doctors', {
        params: { per_page: 100 },
      });

      setDoctors(response.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load doctor list.'), 'Load Failed');
    } finally {
      setLoadingDoctors(false);
    }
  }, [doctors.length, loadingDoctors]);

  useEffect(() => {
    if (formState.referredToDoctor) {
      void loadDoctors();
    }
  }, [formState.referredToDoctor, loadDoctors]);

  useEffect(() => {
    if (!isWalkIn) {
      return;
    }

    const syncCurrentDateTime = (): void => {
      const now = new Date();
      const nextDate = toDateInputValue(now);
      const nextTime = toTimeInputValue(now);

      setFormState((current) => {
        if (current.consultationDate === nextDate && current.consultationTime === nextTime) {
          return current;
        }

        return {
          ...current,
          consultationDate: nextDate,
          consultationTime: nextTime,
        };
      });
    };

    syncCurrentDateTime();
    const timer = window.setInterval(syncCurrentDateTime, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isWalkIn]);

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

    if (section === 'about') {
      navigate('/nurse/about');
      return;
    }

    if (section === 'referrals') {
      navigate('/nurse/referrals');
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

  const setField = <K extends keyof ConsultationFormState>(
    field: K,
    value: ConsultationFormState[K],
  ): void => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submitConsultation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!patientId || !patient || !consultationType) {
      return;
    }

    const complaints = formState.complaints.trim();
    const diagnosis = formState.diagnosis.trim();

    if (complaints === '') {
      void notifyError('Please provide the patient complaints before submitting.', 'Missing Complaints');
      return;
    }

    if (diagnosis === '') {
      void notifyError('Please provide the diagnosis before submitting.', 'Missing Diagnosis');
      return;
    }

    if (formState.referredToDoctor && formState.referralReason.trim() === '') {
      void notifyError('Please provide referral reason before referring this consultation to a doctor.', 'Missing Reason');
      return;
    }

    if (formState.referredToDoctor && formState.referralDoctorId.trim() === '') {
      void notifyError('Please select a doctor for this referral.', 'Missing Doctor');
      return;
    }

    if (!formState.consultationDate || !formState.consultationTime) {
      void notifyError('Consultation date and time are required.', 'Missing Date/Time');
      return;
    }

    const typeLabel = consultationTypeLabel(consultationType).toLowerCase();

    const confirmed = await confirmAction({
      title: `Submit ${typeLabel} consultation?`,
      text: `${userDisplayName(patient.user)} will be recorded with this ${typeLabel} consultation details.`,
      confirmButtonText: 'Yes, submit',
      cancelButtonText: 'Review Again',
    });

    if (!confirmed) {
      return;
    }

    setSubmitting(true);

    try {
      const consultationResponse = await api.post<Consultation>('/consultations', {
        patient_id: patientId,
        consultation_type: consultationType,
        consultation_date: formState.consultationDate,
        consultation_time: formState.consultationTime,
        blood_pressure: toNullableText(formState.bloodPressure),
        pulse_bpm: toNullableInteger(formState.pulseBpm),
        temperature_c: toNullableDecimal(formState.temperatureC),
        weight_kg: toNullableDecimal(formState.weightKg),
        last_menstrual_period: formState.lastMenstrualPeriod || null,
        chief_complaint: complaints,
        diagnosis,
        remarks: toNullableText(formState.remarks),
        referred_to_doctor: formState.referredToDoctor,
      });

      if (formState.referredToDoctor) {
        await api.post('/referrals', {
          consultation_id: consultationResponse.data.id,
          doctor_id: Number(formState.referralDoctorId),
          referral_reason: formState.referralReason.trim(),
        });
      }

      await notifySuccess('Consultation submitted successfully.', 'Consultation Saved');

      navigate(`/nurse/patients/${patientId}`, {
        state: {
          initialTab: formState.referredToDoctor ? 'remark_records' : 'medical_history',
        },
      });
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to submit consultation.'), 'Submit Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!patientId) {
    return <Navigate to="/nurse" replace />;
  }

  if (!consultationType) {
    return <Navigate to={`/nurse/patients/${patientId}/new-consultation`} replace />;
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
        <section className="panel nurse-consultation-type-page nurse-consultation-entry-page">
          <div className="nurse-patient-detail-head">
            <div>
              <h2>{consultationTypeLabel(consultationType)} Consultation</h2>
              <p className="muted small">
                {loading
                  ? 'Loading patient context...'
                  : `${consultationTypeLabel(consultationType)} consultation form for ${
                      patient ? userDisplayName(patient.user) : 'the selected patient'
                    }.`}
              </p>
            </div>

            <div className="action-row">
              <button
                aria-label="Back to consultation options"
                className="button ghost nurse-patient-back-icon-button"
                onClick={() => navigate(`/nurse/patients/${patientId}/new-consultation`)}
                title="Back to consultation options"
                type="button"
              >
                <ArrowLeftCircle size={21} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <article className="nurse-patient-summary">
            <div className="nurse-avatar-card" aria-hidden="true">
              <CircleUserRound className="nurse-avatar-icon" size={64} strokeWidth={1.5} />
            </div>

            <div className="nurse-patient-summary-main">
              <h3>{patient ? userDisplayName(patient.user) : 'Patient'}</h3>
              <p>{patientType === 'student' ? 'Student' : 'Employee'}</p>
            </div>
          </article>

          <div className="nurse-consultation-type-grid">
            <button className="button ghost nurse-consultation-type-button active" type="button" disabled>
              {consultationType === 'walk_in' ? (
                <Activity size={24} strokeWidth={2.2} />
              ) : (
                <CalendarDays size={24} strokeWidth={2.2} />
              )}
              <span>{consultationTypeLabel(consultationType)}</span>
            </button>
          </div>

          <form className="nurse-consultation-form" onSubmit={(event) => void submitConsultation(event)}>
            <div className="nurse-consultation-form-grid">
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={formState.consultationDate}
                  onChange={(event) => setField('consultationDate', event.target.value)}
                  disabled={isFormDisabled || isWalkIn}
                  required
                />
              </label>

              <label className="field">
                <span>Time</span>
                <input
                  type="time"
                  value={formState.consultationTime}
                  onChange={(event) => setField('consultationTime', event.target.value)}
                  disabled={isFormDisabled || isWalkIn}
                  required
                />
              </label>

              <div className="field full-width nurse-consultation-referral">
                <span>Referral</span>
                <label className="nurse-consultation-referral-toggle">
                  <input
                    type="checkbox"
                    checked={formState.referredToDoctor}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setField('referredToDoctor', checked);

                      if (!checked) {
                        setField('referralDoctorId', '');
                        setField('referralReason', '');
                      }
                    }}
                    disabled={isFormDisabled}
                  />
                  <span>Refer to Doctor?</span>
                </label>
              </div>

              {formState.referredToDoctor && (
                <>
                  <label className="field full-width">
                    <span>Assign Doctor</span>
                    <select
                      value={formState.referralDoctorId}
                      onChange={(event) => setField('referralDoctorId', event.target.value)}
                      disabled={isFormDisabled || loadingDoctors}
                      required={formState.referredToDoctor}
                    >
                      <option value="">Select doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {userDisplayName(doctor)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field full-width">
                    <span>Referral Reason</span>
                    <textarea
                      rows={3}
                      value={formState.referralReason}
                      onChange={(event) => setField('referralReason', event.target.value)}
                      placeholder="Summarize why this patient is being referred to doctor"
                      disabled={isFormDisabled}
                      required={formState.referredToDoctor}
                    />
                  </label>
                </>
              )}

              <label className="field">
                <span>Blood Pressure</span>
                <input
                  type="text"
                  value={formState.bloodPressure}
                  onChange={(event) => setField('bloodPressure', event.target.value)}
                  placeholder="e.g., 120/80"
                  disabled={isFormDisabled}
                />
              </label>

              <label className="field">
                <span>Pulse (BPM)</span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={formState.pulseBpm}
                  onChange={(event) => setField('pulseBpm', event.target.value)}
                  placeholder="e.g., 72"
                  disabled={isFormDisabled}
                />
              </label>

              <label className="field">
                <span>Temperature (C)</span>
                <input
                  type="number"
                  min={25}
                  max={45}
                  step="0.1"
                  value={formState.temperatureC}
                  onChange={(event) => setField('temperatureC', event.target.value)}
                  placeholder="e.g., 36.5"
                  disabled={isFormDisabled}
                />
              </label>

              <label className="field">
                <span>Weight (kg)</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  step="0.1"
                  value={formState.weightKg}
                  onChange={(event) => setField('weightKg', event.target.value)}
                  placeholder="e.g., 65.5"
                  disabled={isFormDisabled}
                />
              </label>

              <label className="field full-width">
                <span>Last Menstrual Period (Optional)</span>
                <input
                  type="date"
                  value={formState.lastMenstrualPeriod}
                  onChange={(event) => setField('lastMenstrualPeriod', event.target.value)}
                  disabled={isFormDisabled}
                />
              </label>

              <label className="field full-width">
                <span>Complaints</span>
                <textarea
                  rows={3}
                  value={formState.complaints}
                  onChange={(event) => setField('complaints', event.target.value)}
                  placeholder="Enter patient complaints"
                  disabled={isFormDisabled}
                  required
                />
              </label>

              <label className="field full-width">
                <span>Diagnosis</span>
                <input
                  type="text"
                  value={formState.diagnosis}
                  onChange={(event) => setField('diagnosis', event.target.value)}
                  placeholder="Enter diagnosis for reporting"
                  disabled={isFormDisabled}
                  required
                />
              </label>

              <label className="field full-width">
                <span>Remarks</span>
                <textarea
                  rows={3}
                  value={formState.remarks}
                  onChange={(event) => setField('remarks', event.target.value)}
                  placeholder="Additional remarks"
                  disabled={isFormDisabled}
                />
              </label>
            </div>

            <div className="action-row nurse-consultation-form-actions">
              <button className="button" type="submit" disabled={isFormDisabled}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
