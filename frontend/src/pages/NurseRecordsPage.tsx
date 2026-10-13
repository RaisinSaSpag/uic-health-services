import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  Eye,
  GraduationCap,
  Info,
  LayoutDashboard,
  Package,
  Printer,
  Search,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userDisplayName } from '../lib/format';
import { api } from '../lib/api';
import { notifyError, notifyInfo } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import type { PaginatedResponse, Patient } from '../types/hsms';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about';
type NurseRecordsPatientType = 'student' | 'employee';
type SortBy = 'last_name' | 'first_name' | 'age' | 'student_level' | 'employment_status';

interface SortOption {
  value: SortBy;
  label: string;
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
];

const studentSortOptions: SortOption[] = [
  { value: 'last_name', label: 'Last Name' },
  { value: 'first_name', label: 'First Name' },
  { value: 'age', label: 'Age' },
  { value: 'student_level', label: 'Student Level' },
];

const employeeSortOptions: SortOption[] = [
  { value: 'last_name', label: 'Last Name' },
  { value: 'first_name', label: 'First Name' },
  { value: 'age', label: 'Age' },
  { value: 'employment_status', label: 'Employment Status' },
];

function normalizePatientType(rawPatientType: string | undefined): NurseRecordsPatientType | null {
  if (rawPatientType === 'student' || rawPatientType === 'employee') {
    return rawPatientType;
  }

  return null;
}

function toDisplayText(value: string | null | undefined): string {
  if (!value || value.trim() === '') {
    return 'N/A';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getPatientAge(patient: Patient): number {
  if (typeof patient.age === 'number' && patient.age > 0) {
    return patient.age;
  }

  const birthDate = patient.birth_date ? new Date(patient.birth_date) : null;

  if (!birthDate || Number.isNaN(birthDate.getTime())) {
    return 0;
  }

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function studentLevelLabel(patient: Patient): string {
  if (patient.student_level === 'basic') {
    return 'Basic Education';
  }

  if (patient.student_level === 'college') {
    return 'College';
  }

  return 'N/A';
}

function studentProgramOrGrade(patient: Patient): string {
  if (patient.student_level === 'college') {
    return patient.course_program?.trim() || 'N/A';
  }

  const gradeLevel = patient.grade_level?.trim() || '';
  const section = patient.section?.trim() || '';

  if (gradeLevel !== '' && section !== '') {
    return `${gradeLevel} - ${section}`;
  }

  if (gradeLevel !== '') {
    return gradeLevel;
  }

  if (section !== '') {
    return section;
  }

  return 'N/A';
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

export function NurseRecordsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { patientType: rawPatientType } = useParams<{ patientType: string }>();
  const patientType = useMemo(() => normalizePatientType(rawPatientType), [rawPatientType]);

  const [records, setRecords] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('last_name');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<NurseSection>('search');
  const [isSearchOpen, setIsSearchOpen] = useState(true);

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  useEffect(() => {
    setSortBy('last_name');
    setSearchTerm('');
    setActiveSection('search');
    setIsSearchOpen(true);
  }, [patientType]);

  const loadRecords = useCallback(async () => {
    if (!patientType) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.get<PaginatedResponse<Patient>>('/patients', {
        params: {
          patient_type: patientType,
          per_page: 100,
        },
      });

      setRecords(response.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load patient records.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, [patientType]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const onMenuClick = (section: NurseSection): void => {
    if (section === 'inventory') {
      void notifyInfo('Inventory is coming soon.', 'Coming Soon');
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

  const openPatientDetail = (patientId: number): void => {
    navigate(`/nurse/patients/${patientId}`);
  };

  const sortOptions = patientType === 'employee' ? employeeSortOptions : studentSortOptions;

  const filteredRecords = useMemo(() => {
    if (!patientType) {
      return [];
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = records.filter((patient) => {
      if (normalizedSearch === '') {
        return true;
      }

      const baseFields = [
        userDisplayName(patient.user).toLowerCase(),
        toDisplayText(patient.sex).toLowerCase(),
        String(getPatientAge(patient)),
      ];

      const patientTypeSpecificFields =
        patientType === 'student'
          ? [
              (patient.student_id_number ?? '').toLowerCase(),
              studentLevelLabel(patient).toLowerCase(),
              studentProgramOrGrade(patient).toLowerCase(),
            ]
          : [
              (patient.employee_id ?? '').toLowerCase(),
              (patient.office_unit_department ?? '').toLowerCase(),
              (patient.position_job_title ?? '').toLowerCase(),
              toDisplayText(patient.employment_status).toLowerCase(),
            ];

      return [...baseFields, ...patientTypeSpecificFields].some((value) => value.includes(normalizedSearch));
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === 'age') {
        return getPatientAge(left) - getPatientAge(right);
      }

      if (sortBy === 'first_name') {
        return compareStrings(left.user?.first_name ?? '', right.user?.first_name ?? '');
      }

      if (sortBy === 'student_level') {
        return compareStrings(studentLevelLabel(left), studentLevelLabel(right));
      }

      if (sortBy === 'employment_status') {
        return compareStrings(toDisplayText(left.employment_status), toDisplayText(right.employment_status));
      }

      return compareStrings(left.user?.last_name ?? '', right.user?.last_name ?? '');
    });
  }, [patientType, records, searchTerm, sortBy]);

  if (!patientType) {
    return <Navigate to="/nurse" replace />;
  }

  const pageTitle = patientType === 'student' ? 'Student Patients' : 'Employee Patients';
  const searchPlaceholder = patientType === 'student' ? 'Search students...' : 'Search employees...';

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

      <div className="nurse-dashboard-main nurse-dashboard-main-records">
        <section className="panel nurse-records-panel">
          <div className="panel-head nurse-records-head">
            <h2>{pageTitle}</h2>
          </div>

          <div className="nurse-records-toolbar">
            <label className="nurse-records-search" htmlFor="nurse-record-search">
              <input
                id="nurse-record-search"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>

            <label className="field inline-field nurse-records-sort" htmlFor="nurse-record-sort">
              <span>Sort by</span>
              <select
                id="nurse-record-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <p className="muted">Loading patient records...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="empty-state">No patient records found for this view.</p>
          ) : (
            <div className="nurse-records-table-shell">
              <div className="table-wrap">
                <table className="nurse-records-table" aria-label={`${pageTitle} table`}>
                  <thead>
                    {patientType === 'student' ? (
                      <tr>
                        <th>School ID</th>
                        <th>Name</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>Student Level</th>
                        <th>Program / Grade</th>
                        <th>View</th>
                      </tr>
                    ) : (
                      <tr>
                        <th>Name</th>
                        <th>Age</th>
                        <th>Gender</th>
                        <th>Employee ID</th>
                        <th>Office / Unit</th>
                        <th>Position</th>
                        <th>Status</th>
                        <th>View</th>
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {filteredRecords.map((patient) => (
                      <tr key={patient.id}>
                        {patientType === 'student' ? (
                          <>
                            <td>{patient.student_id_number || 'N/A'}</td>
                            <td>{userDisplayName(patient.user)}</td>
                            <td>{getPatientAge(patient)}</td>
                            <td>{toDisplayText(patient.sex)}</td>
                            <td>{studentLevelLabel(patient)}</td>
                            <td>{studentProgramOrGrade(patient)}</td>
                            <td className="nurse-records-view-cell">
                              <button
                                className="button ghost nurse-records-view-button"
                                onClick={() => openPatientDetail(patient.id)}
                                type="button"
                              >
                                <Eye size={15} strokeWidth={2.2} />
                                <span>View</span>
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{userDisplayName(patient.user)}</td>
                            <td>{getPatientAge(patient)}</td>
                            <td>{toDisplayText(patient.sex)}</td>
                            <td>{patient.employee_id || 'N/A'}</td>
                            <td>{patient.office_unit_department || 'N/A'}</td>
                            <td>{patient.position_job_title || 'N/A'}</td>
                            <td>{toDisplayText(patient.employment_status)}</td>
                            <td className="nurse-records-view-cell">
                              <button
                                className="button ghost nurse-records-view-button"
                                onClick={() => openPatientDetail(patient.id)}
                                type="button"
                              >
                                <Eye size={15} strokeWidth={2.2} />
                                <span>View</span>
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
