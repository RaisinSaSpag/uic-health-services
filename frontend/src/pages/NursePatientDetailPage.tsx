import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  ArrowLeftCircle,
  BarChart3,
  Briefcase,
  ChevronDown,
  CircleUserRound,
  Eye,
  GraduationCap,
  Info,
  LayoutDashboard,
  Package,
  Plus,
  Printer,
  Search,
  Stethoscope,
  type LucideIcon,
  MessageSquare,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { formatDate, formatDateTime, humanizeStatus, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { Consultation, PaginatedResponse, Patient } from '../types/hsms';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about' | 'chat' | 'notifications';
type NurseRecordsPatientType = 'student' | 'employee';
type DetailTab = 'patient_profile' | 'medical_history' | 'past_consultations' | 'remark_records';

interface NurseMenuItem {
  key: NurseSection;
  label: string;
  icon: LucideIcon;
}

interface DetailTabItem {
  key: DetailTab;
  label: string;
}

interface NursePatientDetailLocationState {
  initialTab?: DetailTab;
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

const detailTabs: DetailTabItem[] = [
  { key: 'patient_profile', label: 'Patient Profile' },
  { key: 'medical_history', label: 'Medical History' },
  { key: 'past_consultations', label: 'Past Consultations' },
  { key: 'remark_records', label: 'Remark Records' },
];

function normalizePatientType(value: string | null | undefined): NurseRecordsPatientType {
  return value === 'employee' ? 'employee' : 'student';
}

function normalizeText(value: string | null | undefined): string {
  if (!value || value.trim() === '') {
    return 'N/A';
  }

  return value.replace(/_/g, ' ');
}

function normalizeYesNo(value: boolean | null | undefined): string {
  if (value === true) {
    return 'Yes';
  }

  if (value === false) {
    return 'No';
  }

  return 'N/A';
}

function normalizeNumericText(value: number | string | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  const normalized = typeof value === 'number' ? String(value) : value;

  return suffix ? `${normalized} ${suffix}` : normalized;
}

function resolveDetailTab(value: unknown): DetailTab | null {
  if (value === 'patient_profile' || value === 'medical_history' || value === 'past_consultations' || value === 'remark_records') {
    return value;
  }

  return null;
}

function getPatientAge(patient: Patient | null): string {
  if (!patient) {
    return 'N/A';
  }

  if (typeof patient.age === 'number' && patient.age > 0) {
    return String(patient.age);
  }

  if (!patient.birth_date) {
    return 'N/A';
  }

  const birthDate = new Date(patient.birth_date);

  if (Number.isNaN(birthDate.getTime())) {
    return 'N/A';
  }

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDifference = now.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return String(Math.max(age, 0));
}

function consultationTypeLabel(consultation: Consultation): string {
  const baseType = humanizeStatus(consultation.consultation_type)
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  if (consultation.referred_to_doctor) {
    return `${baseType} + Referral`;
  }

  return baseType;
}

function consultationDateLabel(consultation: Consultation): string {
  return formatDateTime(
    consultation.consulted_at ?? consultation.completed_at ?? consultation.started_at ?? consultation.submitted_at,
  );
}

function latestConsultationTimestamp(consultation: Consultation): number {
  const value = consultation.consulted_at ?? consultation.completed_at ?? consultation.started_at ?? consultation.submitted_at;

  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function NursePatientDetailPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { patientId: rawPatientId } = useParams<{ patientId: string }>();

  const patientId = useMemo(() => {
    const parsedId = Number(rawPatientId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return null;
    }

    return parsedId;
  }, [rawPatientId]);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>(() => {
    const initialTab = resolveDetailTab((location.state as NursePatientDetailLocationState | null)?.initialTab);

    return initialTab ?? 'patient_profile';
  });
  const [activeSection, setActiveSection] = useState<NurseSection>('search');
  const [isSearchOpen, setIsSearchOpen] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [loadingConsultation, setLoadingConsultation] = useState(false);
  const [showConsultationMoreDetails, setShowConsultationMoreDetails] = useState(false);
  const consultationRequestTokenRef = useRef(0);

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const patientType = useMemo(() => normalizePatientType(patient?.patient_type), [patient?.patient_type]);

  const sortedConsultations = useMemo(
    () => [...consultations].sort((left, right) => latestConsultationTimestamp(right) - latestConsultationTimestamp(left)),
    [consultations],
  );

  const consultationSequenceById = useMemo(() => {
    const oldestFirst = [...consultations].sort((left, right) => {
      const timestampDifference = latestConsultationTimestamp(left) - latestConsultationTimestamp(right);

      if (timestampDifference !== 0) {
        return timestampDifference;
      }

      return left.id - right.id;
    });

    return oldestFirst.reduce<Record<number, number>>((sequenceMap, consultation, index) => {
      sequenceMap[consultation.id] = index + 1;
      return sequenceMap;
    }, {});
  }, [consultations]);

  const selectedConsultationSequence = useMemo(() => {
    if (!selectedConsultation) {
      return null;
    }

    return consultationSequenceById[selectedConsultation.id] ?? null;
  }, [consultationSequenceById, selectedConsultation]);

  const medicalHistoryRows = useMemo(() => sortedConsultations, [sortedConsultations]);

  const pastConsultationRows = useMemo(() => sortedConsultations, [sortedConsultations]);

  const remarkRows = useMemo(
    () => sortedConsultations.filter((consultation) => consultation.referred_to_doctor),
    [sortedConsultations],
  );

  const loadPatientContext = useCallback(async (): Promise<void> => {
    if (!patientId) {
      return;
    }

    setLoading(true);

    try {
      const [patientResponse, consultationsResponse] = await Promise.all([
        api.get<Patient>(`/patients/${patientId}`),
        api.get<PaginatedResponse<Consultation>>('/consultations', {
          params: {
            patient_id: patientId,
            per_page: 100,
          },
        }),
      ]);

      setPatient(patientResponse.data);
      setConsultations(consultationsResponse.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load the selected patient details.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadPatientContext();
  }, [loadPatientContext]);

  useEffect(() => {
    const locationState = location.state as NursePatientDetailLocationState | null;
    const nextTab = resolveDetailTab(locationState?.initialTab);

    if (nextTab) {
      setActiveTab(nextTab);
    }
  }, [location.state]);

  const closeConsultationModal = useCallback((): void => {
    consultationRequestTokenRef.current += 1;
    setSelectedConsultation(null);
    setLoadingConsultation(false);
    setShowConsultationMoreDetails(false);
  }, []);

  useEffect(() => {
    setShowConsultationMoreDetails(false);
  }, [selectedConsultation?.id]);

  useEffect(() => {
    if (!selectedConsultation) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeConsultationModal();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeConsultationModal, selectedConsultation]);

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

    if (section === 'referrals') {
      navigate('/nurse/referrals');
      return;
    }

    if (section === 'about') {
      navigate('/nurse/about');
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

  const viewConsultation = async (consultation: Consultation): Promise<void> => {
    const requestToken = consultationRequestTokenRef.current + 1;
    consultationRequestTokenRef.current = requestToken;

    setSelectedConsultation(consultation);
    setLoadingConsultation(true);

    try {
      const response = await api.get<Consultation>(`/consultations/${consultation.id}`);

      if (consultationRequestTokenRef.current !== requestToken) {
        return;
      }

      setSelectedConsultation(response.data);
    } catch (err) {
      if (consultationRequestTokenRef.current !== requestToken) {
        return;
      }

      void notifyError(
        getErrorMessage(err, 'Unable to fetch the full consultation detail. Showing available data.'),
        'View Failed',
      );
    } finally {
      if (consultationRequestTokenRef.current === requestToken) {
        setLoadingConsultation(false);
      }
    }
  };

  const profileRows = useMemo(() => {
    if (!patient) {
      return [];
    }

    return [
      { label: 'Patient Number', value: patient.patient_number || 'N/A' },
      { label: 'Last Name', value: patient.user?.last_name || 'N/A' },
      { label: 'First Name', value: patient.user?.first_name || 'N/A' },
      { label: 'Middle Initial', value: 'N/A' },
      { label: 'Gender', value: normalizeText(patient.sex) },
      { label: 'Date of Birth', value: formatDate(patient.birth_date) },
      { label: 'Age', value: getPatientAge(patient) },
      { label: 'Address', value: patient.address || 'N/A' },
      { label: 'Contact Number', value: patient.contact_number || 'N/A' },
      {
        label: 'Course / Program',
        value:
          patientType === 'student'
            ? patient.course_program || patient.grade_level || 'N/A'
            : patient.position_job_title || 'N/A',
      },
      {
        label: 'Student / Employee ID',
        value: patientType === 'student' ? patient.student_id_number || 'N/A' : patient.employee_id || 'N/A',
      },
      {
        label: 'Guardian Name',
        value: patient.parent_guardian_name || patient.emergency_contact_name || 'N/A',
      },
      {
        label: "Guardian's Contact Number",
        value: patient.parent_contact_number || patient.emergency_contact_number || 'N/A',
      },
      {
        label: 'With Maintenance Medicine',
        value: normalizeYesNo(patient.with_maintenance_medicine),
      },
      {
        label: 'Existing Medical Condition',
        value: patient.existing_medical_condition || 'N/A',
      },
      {
        label: 'Allergies',
        value: patient.allergies || 'N/A',
      },
    ];
  }, [patient, patientType]);

  const consultationSpotlightPrimaryItems = useMemo(() => {
    if (!selectedConsultation) {
      return [];
    }

    return [
      {
        label: 'Chief Complaint',
        value: selectedConsultation.chief_complaint || 'N/A',
      },
      {
        label: 'Diagnosis',
        value:
          selectedConsultation.diagnosis ||
          selectedConsultation.symptoms ||
          selectedConsultation.medical_record?.final_diagnosis ||
          'N/A',
      },
      {
        label: 'Blood Pressure',
        value: selectedConsultation.blood_pressure || 'N/A',
      },
      {
        label: 'Pulse (BPM)',
        value: normalizeNumericText(selectedConsultation.pulse_bpm),
      },
      {
        label: 'Temperature (C)',
        value: normalizeNumericText(selectedConsultation.temperature_c, 'C'),
      },
      {
        label: 'Weight (kg)',
        value: normalizeNumericText(selectedConsultation.weight_kg, 'kg'),
      },
    ];
  }, [selectedConsultation]);

  const consultationSpotlightSecondaryItems = useMemo(() => {
    if (!selectedConsultation) {
      return [];
    }

    return [
      {
        label: 'Last Menstrual Period',
        value: formatDate(selectedConsultation.last_menstrual_period),
      },
      {
        label: 'Remarks',
        value: selectedConsultation.remarks || selectedConsultation.triage_notes || 'N/A',
      },
      {
        label: 'Triage Notes',
        value: selectedConsultation.triage_notes || 'N/A',
      },
      {
        label: 'Referral Reason',
        value: selectedConsultation.referral?.referral_reason || 'N/A',
      },
      {
        label: 'Doctor Remarks',
        value: selectedConsultation.referral?.doctor_remarks || 'N/A',
      },
      {
        label: 'Final Diagnosis',
        value: selectedConsultation.medical_record?.final_diagnosis || 'N/A',
      },
      {
        label: 'Treatment Plan',
        value: selectedConsultation.medical_record?.treatment_plan || 'N/A',
      },
      {
        label: 'Prescription',
        value:
          selectedConsultation.medical_record?.prescription ||
          selectedConsultation.referral?.prescription ||
          'N/A',
      },
    ];
  }, [selectedConsultation]);

  const hasSecondaryConsultationDetails = useMemo(
    () => consultationSpotlightSecondaryItems.some((item) => item.value !== 'N/A'),
    [consultationSpotlightSecondaryItems],
  );

  if (!patientId) {
    return <Navigate to="/nurse" replace />;
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
        <section className="panel nurse-patient-detail-page">
          <div className="nurse-patient-detail-head">
            <div>
              <h2>
                Search {patientType === 'student' ? 'Student' : 'Employee'}:{' '}
                {patient ? userDisplayName(patient.user) : 'Patient'}
              </h2>
            </div>

            <div className="action-row">
              <button
                aria-label="Back to records"
                className="button ghost nurse-patient-back-icon-button"
                onClick={() => navigate(`/nurse/records/${patientType}`)}
                title="Back to records"
                type="button"
              >
                <ArrowLeftCircle size={21} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {loading ? (
            <p className="muted">Loading patient record...</p>
          ) : !patient ? (
            <p className="empty-state">Patient record not found.</p>
          ) : (
            <>
              <article className="nurse-patient-summary">
                <div className="nurse-avatar-card" aria-hidden="true">
                  <CircleUserRound className="nurse-avatar-icon" size={84} strokeWidth={1.4} />
                </div>

                <div className="nurse-patient-summary-main">
                  <h3>{userDisplayName(patient.user)}</h3>
                  <p>
                    {patientType === 'student' ? 'Student' : 'Employee'} · {normalizeText(patient.department?.name)}
                  </p>
                  <p>
                    Campus: {patient.campus?.name ?? 'N/A'} · Profile Type:{' '}
                    {patient.student_level ? normalizeText(patient.student_level) : normalizeText(patient.patient_type)}
                  </p>
                </div>

                <div className="nurse-patient-summary-actions">
                  <button
                    className="button nurse-patient-new-button"
                    onClick={() => navigate(`/nurse/patients/${patient.id}/new-consultation`)}
                    type="button"
                  >
                    <Plus className="nurse-patient-new-icon" size={19} strokeWidth={2.6} />
                    <span className="nurse-patient-new-label">New</span>
                  </button>
                </div>
              </article>

              <div className="nurse-patient-tabs" role="tablist" aria-label="Patient record tabs">
                {detailTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`nurse-patient-tab${activeTab === tab.key ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                    role="tab"
                    type="button"
                    aria-selected={activeTab === tab.key}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'patient_profile' && (
                <section className="nurse-patient-tab-content">
                  <div className="nurse-records-table-shell">
                    <div className="table-wrap">
                      <table className="nurse-records-table" aria-label="Patient profile details">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileRows.map((profileRow) => (
                            <tr key={profileRow.label}>
                              <td>{profileRow.label}</td>
                              <td>{profileRow.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'medical_history' && (
                <section className="nurse-patient-tab-content">
                  {medicalHistoryRows.length === 0 ? (
                    <p className="empty-state">No medical history records are available yet.</p>
                  ) : (
                    <div className="nurse-records-table-shell">
                      <div className="table-wrap">
                        <table className="nurse-records-table" aria-label="Medical history table">
                          <thead>
                            <tr>
                              <th>Complaints</th>
                              <th>Diagnosis</th>
                              <th>Date Consulted</th>
                              <th>View</th>
                            </tr>
                          </thead>
                          <tbody>
                            {medicalHistoryRows.map((consultation) => (
                              <tr key={consultation.id}>
                                <td>{consultation.chief_complaint}</td>
                                <td>{consultation.diagnosis ?? consultation.symptoms ?? 'N/A'}</td>
                                <td>{consultationDateLabel(consultation)}</td>
                                <td className="nurse-records-view-cell">
                                  <button
                                    className="button ghost nurse-records-view-button"
                                    onClick={() => void viewConsultation(consultation)}
                                    type="button"
                                  >
                                    <Eye size={15} strokeWidth={2.2} />
                                    <span>View</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'past_consultations' && (
                <section className="nurse-patient-tab-content">
                  {pastConsultationRows.length === 0 ? (
                    <p className="empty-state">No past consultations are available yet.</p>
                  ) : (
                    <div className="nurse-records-table-shell">
                      <div className="table-wrap">
                        <table className="nurse-records-table" aria-label="Past consultations table">
                          <thead>
                            <tr>
                              <th>Consultation Type</th>
                              <th>Date Consulted</th>
                              <th>View</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pastConsultationRows.map((consultation) => (
                              <tr key={consultation.id}>
                                <td>{consultationTypeLabel(consultation)}</td>
                                <td>{consultationDateLabel(consultation)}</td>
                                <td className="nurse-records-view-cell">
                                  <button
                                    className="button ghost nurse-records-view-button"
                                    onClick={() => void viewConsultation(consultation)}
                                    type="button"
                                  >
                                    <Eye size={15} strokeWidth={2.2} />
                                    <span>View</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'remark_records' && (
                <section className="nurse-patient-tab-content">
                  {remarkRows.length === 0 ? (
                    <p className="empty-state">No doctor referral remark records are available yet.</p>
                  ) : (
                    <div className="nurse-records-table-shell">
                      <div className="table-wrap">
                        <table className="nurse-records-table" aria-label="Remark records table">
                          <thead>
                            <tr>
                              <th>Date Referred</th>
                              <th>Referral Reason</th>
                              <th>Referral Status</th>
                              <th>View</th>
                            </tr>
                          </thead>
                          <tbody>
                            {remarkRows.map((consultation) => (
                              <tr key={consultation.id}>
                                <td>{consultationDateLabel(consultation)}</td>
                                <td>{consultation.referral?.referral_reason ?? consultation.triage_notes ?? 'N/A'}</td>
                                <td>{normalizeText(consultation.referral?.status ?? consultation.status)}</td>
                                <td className="nurse-records-view-cell">
                                  <button
                                    className="button ghost nurse-records-view-button"
                                    onClick={() => void viewConsultation(consultation)}
                                    type="button"
                                  >
                                    <Eye size={15} strokeWidth={2.2} />
                                    <span>View</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {selectedConsultation && (
                <div
                  className="nurse-consultation-modal-backdrop"
                  onClick={closeConsultationModal}
                  role="presentation"
                >
                  <section
                    aria-label={
                      selectedConsultationSequence
                        ? `Patient Consultation ${selectedConsultationSequence} detail`
                        : 'Patient consultation detail'
                    }
                    aria-modal="true"
                    className="nurse-consultation-modal"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                  >
                    <article className="nurse-consultation-spotlight">
                      <header className="nurse-consultation-spotlight-banner">
                        <div className="nurse-consultation-spotlight-heading">
                          <p className="nurse-consultation-spotlight-kicker">Consultation Spotlight</p>
                          <h4>
                            {selectedConsultationSequence
                              ? `Patient Consultation ${selectedConsultationSequence}`
                              : 'Patient Consultation'}
                          </h4>
                          <p className="nurse-consultation-spotlight-subtitle">
                            {(patient && userDisplayName(patient.user)) || 'Selected patient'} ·{' '}
                            {consultationDateLabel(selectedConsultation)}
                          </p>
                        </div>

                        <button
                          className="button ghost nurse-consultation-spotlight-close"
                          onClick={closeConsultationModal}
                          type="button"
                        >
                          Close
                        </button>
                      </header>

                      {loadingConsultation && (
                        <p className="nurse-consultation-spotlight-fetching" role="status" aria-live="polite">
                          Updating consultation details...
                        </p>
                      )}

                      <div className="nurse-consultation-spotlight-stats">
                        <article className="stat-card">
                          <span className="stat-label">Status</span>
                          <StatusBadge status={selectedConsultation.status} />
                        </article>
                        <article className="stat-card">
                          <span className="stat-label">Consultation Type</span>
                          <strong>{consultationTypeLabel(selectedConsultation)}</strong>
                        </article>
                        <article className="stat-card">
                          <span className="stat-label">Date Consulted</span>
                          <strong>{consultationDateLabel(selectedConsultation)}</strong>
                        </article>
                        <article className="stat-card">
                          <span className="stat-label">Referred to Doctor</span>
                          <strong>{normalizeYesNo(selectedConsultation.referred_to_doctor)}</strong>
                        </article>
                      </div>

                      <div className="nurse-consultation-spotlight-grid primary">
                        {consultationSpotlightPrimaryItems.map((item) => (
                          <article className="nurse-consultation-spotlight-item" key={item.label}>
                            <span>{item.label}</span>
                            <p>{item.value}</p>
                          </article>
                        ))}
                      </div>

                      {hasSecondaryConsultationDetails && (
                        <div className="nurse-consultation-spotlight-more-row">
                          <button
                            className="button ghost nurse-consultation-spotlight-more-button"
                            onClick={() => setShowConsultationMoreDetails((current) => !current)}
                            type="button"
                          >
                            {showConsultationMoreDetails ? 'Hide Details' : 'More Details'}
                          </button>
                        </div>
                      )}

                      {hasSecondaryConsultationDetails && showConsultationMoreDetails && (
                        <div className="nurse-consultation-spotlight-grid secondary">
                          {consultationSpotlightSecondaryItems.map((item) => (
                            <article className="nurse-consultation-spotlight-item" key={item.label}>
                              <span>{item.label}</span>
                              <p>{item.value}</p>
                            </article>
                          ))}
                        </div>
                      )}
                    </article>
                  </section>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
