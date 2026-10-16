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
  Sparkles,
  Stethoscope,
  X,
  type LucideIcon,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { Consultation, PaginatedResponse } from '../types/hsms';

type NurseSection = 'dashboard' | 'search' | 'print' | 'reports' | 'inventory' | 'referrals' | 'about' | 'chat' | 'notifications';
type SearchTarget = 'student' | 'employee';
type PatientGroupKey = 'basic' | 'college' | 'employee';

interface NurseMenuItem {
  key: NurseSection;
  label: string;
  icon: LucideIcon;
}

interface DiagnosisCount {
  diagnosis: string;
  count: number;
  contextLabel?: string;
}

interface PatientCategoryCount {
  key: PatientGroupKey;
  label: string;
  count: number;
}

interface BreakdownCount {
  label: string;
  count: number;
}

interface AiSummaryResponse {
  summary: string;
  source: string;
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

const searchTargetOptions: Array<{ key: SearchTarget; label: string; icon: LucideIcon }> = [
  {
    key: 'student',
    label: 'Student',
    icon: GraduationCap,
  },
  {
    key: 'employee',
    label: 'Employee',
    icon: Briefcase,
  },
];

const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const reportCategoryColors: Record<PatientCategoryCount['key'], string> = {
  basic: '#4a7fe6',
  college: '#a855f7',
  employee: '#f97316',
};

const defaultAiSummaryMessage = 'Click AI Summary to generate insights for this month.';

const diseaseGroupCards: Array<{
  key: PatientGroupKey;
  title: string;
  subtitle: string;
  contextLabel: string;
}> = [
  {
    key: 'basic',
    title: 'Top Diseases - Basic Education',
    subtitle: 'Sorted by grade level',
    contextLabel: 'Grade',
  },
  {
    key: 'college',
    title: 'Top Diseases - College',
    subtitle: 'Sorted by course/program',
    contextLabel: 'Course',
  },
  {
    key: 'employee',
    title: 'Top Diseases - Employees',
    subtitle: 'Sorted by office/unit',
    contextLabel: 'Office',
  },
];

function resolveConsultationDate(consultation: Consultation): Date | null {
  const rawDate =
    consultation.consulted_at ?? consultation.completed_at ?? consultation.started_at ?? consultation.submitted_at;

  if (!rawDate) {
    return null;
  }

  const parsedDate = new Date(rawDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function normalizeDiagnosis(consultation: Consultation): string {
  const diagnosisValue =
    consultation.diagnosis?.trim() ??
    consultation.medical_record?.final_diagnosis?.trim() ??
    consultation.symptoms?.trim() ??
    '';

  if (diagnosisValue === '') {
    return 'Unspecified Diagnosis';
  }

  return diagnosisValue
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolvePatientGroup(consultation: Consultation): PatientGroupKey | null {
  const patient = consultation.patient;

  if (!patient) {
    return null;
  }

  if (patient.patient_type === 'employee') {
    return 'employee';
  }

  if (patient.patient_type === 'student') {
    return patient.student_level === 'college' ? 'college' : 'basic';
  }

  return null;
}

function normalizeSubgroupLabel(value: string | null | undefined, fallbackLabel: string): string {
  const normalized = (value ?? '').trim();

  if (normalized === '') {
    return fallbackLabel;
  }

  return normalized.replace(/\s+/g, ' ');
}

function resolveSubgroupLabel(consultation: Consultation, groupKey: PatientGroupKey): string {
  const patient = consultation.patient;

  if (!patient) {
    return 'Unspecified';
  }

  if (groupKey === 'basic') {
    return normalizeSubgroupLabel(patient.grade_level, 'Unspecified Grade');
  }

  if (groupKey === 'college') {
    return normalizeSubgroupLabel(patient.course_program ?? patient.year_level, 'Unspecified Course');
  }

  return normalizeSubgroupLabel(patient.office_unit_department ?? patient.position_job_title, 'Unspecified Office');
}

function truncateLabel(value: string, maxLength = 18): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function summarizeFindings(
  monthLabel: string,
  year: number,
  consultations: Consultation[],
  topDiseases: DiagnosisCount[],
  patientCategoryCounts: PatientCategoryCount[],
  patientSubgroupBreakdowns: Record<PatientGroupKey, BreakdownCount[]>,
): string {
  if (consultations.length === 0) {
    return `No consultations were recorded for ${monthLabel} ${year}.`;
  }

  const totalConsultations = consultations.length;
  const referredCount = consultations.filter((consultation) => consultation.referred_to_doctor).length;
  const topDisease = topDiseases[0];

  const categoryInsight = patientCategoryCounts
    .map((category) => `${category.label}: ${category.count}`)
    .join(' | ');

  const diseaseInsight = topDisease
    ? `${topDisease.diagnosis} (${topDisease.count} cases)`
    : 'No dominant diagnosis';

  const basicTopLevel = patientSubgroupBreakdowns.basic[0];
  const collegeTopProgram = patientSubgroupBreakdowns.college[0];
  const employeeTopOffice = patientSubgroupBreakdowns.employee[0];

  const levelInsight = [
    basicTopLevel ? `Basic top grade: ${basicTopLevel.label} (${basicTopLevel.count})` : null,
    collegeTopProgram ? `College top course: ${collegeTopProgram.label} (${collegeTopProgram.count})` : null,
    employeeTopOffice ? `Employee top office: ${employeeTopOffice.label} (${employeeTopOffice.count})` : null,
  ]
    .filter((value): value is string => value !== null)
    .join(' | ');

  return `For ${monthLabel} ${year}, there were ${totalConsultations} consultations. Top diagnosis was ${diseaseInsight}. Referrals accounted for ${referredCount} of ${totalConsultations} consultations. Patient volume by category: ${categoryInsight}. ${levelInsight}`.trim();
}

export function NurseReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<NurseSection>('reports');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('student');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [isAiSummaryModalOpen, setIsAiSummaryModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState(defaultAiSummaryMessage);
  const [aiSummarySource, setAiSummarySource] = useState<string | null>(null);

  const summaryRequestIdRef = useRef(0);
  const printTriggerTimerRef = useRef<number | null>(null);

  const now = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(() => now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => now.getFullYear());

  const nurseName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const yearOptions = useMemo(() => {
    const currentYear = now.getFullYear();
    const years: number[] = [];

    for (let year = currentYear; year >= currentYear - 4; year -= 1) {
      years.push(year);
    }

    return years;
  }, [now]);

  const loadAllConsultations = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const loadedConsultations: Consultation[] = [];
      let page = 1;
      let lastPage = 1;

      do {
        const response = await api.get<PaginatedResponse<Consultation>>('/consultations', {
          params: {
            per_page: 100,
            page,
          },
        });

        loadedConsultations.push(...response.data.data);
        lastPage = response.data.last_page;
        page += 1;
      } while (page <= lastPage);

      setConsultations(loadedConsultations);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load reports data.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllConsultations();
  }, [loadAllConsultations]);

  useEffect(() => {
    const onAfterPrint = (): void => {
      setPrinting(false);
    };

    window.addEventListener('afterprint', onAfterPrint);

    return () => {
      window.removeEventListener('afterprint', onAfterPrint);

      if (printTriggerTimerRef.current !== null) {
        window.clearTimeout(printTriggerTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    summaryRequestIdRef.current += 1;
    setGeneratingSummary(false);
    setAiSummary(defaultAiSummaryMessage);
    setAiSummarySource(null);
    setIsAiSummaryModalOpen(false);
  }, [selectedMonth, selectedYear]);

  const closeAiSummaryModal = useCallback((): void => {
    setIsAiSummaryModalOpen(false);
  }, []);

  useEffect(() => {
    if (!isAiSummaryModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeAiSummaryModal();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeAiSummaryModal, isAiSummaryModalOpen]);

  const monthLabel = useMemo(() => {
    const month = monthOptions.find((option) => option.value === selectedMonth);
    return month?.label ?? 'Month';
  }, [selectedMonth]);

  const monthlyConsultations = useMemo(
    () =>
      consultations.filter((consultation) => {
        const consultationDate = resolveConsultationDate(consultation);

        if (!consultationDate) {
          return false;
        }

        return consultationDate.getMonth() + 1 === selectedMonth && consultationDate.getFullYear() === selectedYear;
      }),
    [consultations, selectedMonth, selectedYear],
  );

  const diagnosisCounts = useMemo(() => {
    const diagnosisCountMap = new Map<string, number>();

    monthlyConsultations.forEach((consultation) => {
      const diagnosis = normalizeDiagnosis(consultation);
      diagnosisCountMap.set(diagnosis, (diagnosisCountMap.get(diagnosis) ?? 0) + 1);
    });

    return Array.from(diagnosisCountMap.entries())
      .map(([diagnosis, count]) => ({ diagnosis, count }))
      .sort((left, right) => right.count - left.count || left.diagnosis.localeCompare(right.diagnosis));
  }, [monthlyConsultations]);

  const topDiseases = useMemo(() => diagnosisCounts.slice(0, 5), [diagnosisCounts]);

  const topDiseasesByGroup = useMemo(() => {
    const diagnosisByGroup: Record<
      PatientGroupKey,
      Map<string, { count: number; contextCounts: Map<string, number> }>
    > = {
      basic: new Map(),
      college: new Map(),
      employee: new Map(),
    };

    monthlyConsultations.forEach((consultation) => {
      const groupKey = resolvePatientGroup(consultation);

      if (!groupKey) {
        return;
      }

      const diagnosis = normalizeDiagnosis(consultation);
      const subgroupLabel = resolveSubgroupLabel(consultation, groupKey);
      const diagnosisMap = diagnosisByGroup[groupKey];
      const existingValue = diagnosisMap.get(diagnosis) ?? {
        count: 0,
        contextCounts: new Map<string, number>(),
      };

      existingValue.count += 1;
      existingValue.contextCounts.set(subgroupLabel, (existingValue.contextCounts.get(subgroupLabel) ?? 0) + 1);
      diagnosisMap.set(diagnosis, existingValue);
    });

    const toSortedTopDiseases = (
      diagnosisMap: Map<string, { count: number; contextCounts: Map<string, number> }>,
    ): DiagnosisCount[] =>
      Array.from(diagnosisMap.entries())
        .map(([diagnosis, value]) => {
          const dominantContextLabel = Array.from(value.contextCounts.entries()).sort(
            (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
          )[0]?.[0];

          return {
            diagnosis,
            count: value.count,
            contextLabel: dominantContextLabel ?? 'N/A',
          };
        })
        .sort((left, right) => right.count - left.count || left.diagnosis.localeCompare(right.diagnosis))
        .slice(0, 5);

    return {
      basic: toSortedTopDiseases(diagnosisByGroup.basic),
      college: toSortedTopDiseases(diagnosisByGroup.college),
      employee: toSortedTopDiseases(diagnosisByGroup.employee),
    };
  }, [monthlyConsultations]);

  const maxDiagnosisCountByGroup = useMemo(
    () => ({
      basic: Math.max(...topDiseasesByGroup.basic.map((item) => item.count), 1),
      college: Math.max(...topDiseasesByGroup.college.map((item) => item.count), 1),
      employee: Math.max(...topDiseasesByGroup.employee.map((item) => item.count), 1),
    }),
    [topDiseasesByGroup.basic, topDiseasesByGroup.college, topDiseasesByGroup.employee],
  );

  const patientCategoryCounts = useMemo(() => {
    const basicStudentIds = new Set<number>();
    const collegeStudentIds = new Set<number>();
    const employeeIds = new Set<number>();

    monthlyConsultations.forEach((consultation) => {
      const patient = consultation.patient;

      if (!patient) {
        return;
      }

      if (patient.patient_type === 'employee') {
        employeeIds.add(patient.id);
        return;
      }

      if (patient.patient_type === 'student') {
        if (patient.student_level === 'college') {
          collegeStudentIds.add(patient.id);
          return;
        }

        basicStudentIds.add(patient.id);
      }
    });

    return [
      {
        key: 'basic',
        label: 'Student (Basic Education)',
        count: basicStudentIds.size,
      },
      {
        key: 'college',
        label: 'Student (College)',
        count: collegeStudentIds.size,
      },
      {
        key: 'employee',
        label: 'Employees',
        count: employeeIds.size,
      },
    ] satisfies PatientCategoryCount[];
  }, [monthlyConsultations]);

  const patientSubgroupBreakdowns = useMemo(() => {
    const subgroupMaps: Record<PatientGroupKey, Map<string, Set<number>>> = {
      basic: new Map(),
      college: new Map(),
      employee: new Map(),
    };

    monthlyConsultations.forEach((consultation) => {
      const groupKey = resolvePatientGroup(consultation);
      const patientId = consultation.patient?.id;

      if (!groupKey || !patientId) {
        return;
      }

      const subgroupLabel = resolveSubgroupLabel(consultation, groupKey);
      const existingSet = subgroupMaps[groupKey].get(subgroupLabel) ?? new Set<number>();
      existingSet.add(patientId);
      subgroupMaps[groupKey].set(subgroupLabel, existingSet);
    });

    const toSortedBreakdown = (subgroupMap: Map<string, Set<number>>): BreakdownCount[] =>
      Array.from(subgroupMap.entries())
        .map(([label, patientIds]) => ({
          label,
          count: patientIds.size,
        }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

    return {
      basic: toSortedBreakdown(subgroupMaps.basic),
      college: toSortedBreakdown(subgroupMaps.college),
      employee: toSortedBreakdown(subgroupMaps.employee),
    };
  }, [monthlyConsultations]);

  const maxPatientCategoryCount = useMemo(
    () => Math.max(...patientCategoryCounts.map((item) => item.count), 1),
    [patientCategoryCounts],
  );

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

  const onPrintReport = (): void => {
    if (printing) {
      return;
    }

    setPrinting(true);

    if (isAiSummaryModalOpen) {
      setIsAiSummaryModalOpen(false);
    }

    window.requestAnimationFrame(() => {
      printTriggerTimerRef.current = window.setTimeout(() => {
        printTriggerTimerRef.current = null;
        window.print();

        window.setTimeout(() => {
          setPrinting(false);
        }, 320);
      }, 110);
    });
  };

  const onGenerateSummary = async (): Promise<void> => {
    setIsAiSummaryModalOpen(true);

    if (generatingSummary) {
      return;
    }

    setGeneratingSummary(true);
    summaryRequestIdRef.current += 1;
    const requestId = summaryRequestIdRef.current;

    const referredCount = monthlyConsultations.filter((consultation) => consultation.referred_to_doctor).length;

    try {
      const response = await api.post<AiSummaryResponse>('/reports/ai-summary', {
        month_label: monthLabel,
        year: selectedYear,
        total_consultations: monthlyConsultations.length,
        referred_count: referredCount,
        top_diseases: topDiseases.map((item) => ({
          diagnosis: item.diagnosis,
          count: item.count,
          context_label: null,
        })),
        patient_category_counts: patientCategoryCounts.map((item) => ({
          label: item.label,
          count: item.count,
        })),
        top_diseases_by_group: {
          basic: topDiseasesByGroup.basic.map((item) => ({
            diagnosis: item.diagnosis,
            count: item.count,
            context_label: item.contextLabel ?? null,
          })),
          college: topDiseasesByGroup.college.map((item) => ({
            diagnosis: item.diagnosis,
            count: item.count,
            context_label: item.contextLabel ?? null,
          })),
          employee: topDiseasesByGroup.employee.map((item) => ({
            diagnosis: item.diagnosis,
            count: item.count,
            context_label: item.contextLabel ?? null,
          })),
        },
        subgroup_breakdowns: {
          basic: patientSubgroupBreakdowns.basic,
          college: patientSubgroupBreakdowns.college,
          employee: patientSubgroupBreakdowns.employee,
        },
      });

      if (summaryRequestIdRef.current !== requestId) {
        return;
      }

      const returnedSummary = response.data.summary?.trim();

      if (returnedSummary) {
        setAiSummary(returnedSummary);
      } else {
        setAiSummary(
          summarizeFindings(
            monthLabel,
            selectedYear,
            monthlyConsultations,
            topDiseases,
            patientCategoryCounts,
            patientSubgroupBreakdowns,
          ),
        );
      }

      setAiSummarySource(response.data.source?.trim() || 'fallback');
    } catch (err) {
      if (summaryRequestIdRef.current !== requestId) {
        return;
      }

      setAiSummary(
        summarizeFindings(
          monthLabel,
          selectedYear,
          monthlyConsultations,
          topDiseases,
          patientCategoryCounts,
          patientSubgroupBreakdowns,
        ),
      );
      setAiSummarySource('fallback');
      void notifyError(
        getErrorMessage(err, 'Unable to generate AI summary right now. Showing fallback insights instead.'),
        'AI Summary',
      );
    } finally {
      if (summaryRequestIdRef.current === requestId) {
        setGeneratingSummary(false);
      }
    }
  };

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

      <div className="nurse-dashboard-main nurse-dashboard-main-records nurse-dashboard-main-reports">
        <section className="panel nurse-reports-page">
          <div className="panel-head nurse-reports-head">
            <div>
              <h2>Overview</h2>
              <p className="muted small">
                Monthly consultation insights for {monthLabel} {selectedYear}
              </p>
            </div>

            <div className="nurse-reports-head-actions">
              <button
                className={`button nurse-reports-ai-icon-button${generatingSummary ? ' loading' : ''}`}
                onClick={onGenerateSummary}
                type="button"
                disabled={generatingSummary || loading}
                aria-label="Generate AI Summary"
                title="Generate AI Summary"
              >
                {generatingSummary ? (
                  <RefreshCw className="nurse-reports-spinner" size={18} strokeWidth={2.4} />
                ) : (
                  <Sparkles size={18} strokeWidth={2.2} />
                )}
              </button>

              <button
                className={`button nurse-reports-print-button${printing ? ' loading' : ''}`}
                onClick={onPrintReport}
                type="button"
                disabled={printing || loading}
                aria-busy={printing}
              >
                {printing ? (
                  <RefreshCw className="nurse-reports-spinner" size={16} strokeWidth={2.4} />
                ) : (
                  <Printer size={16} strokeWidth={2.4} />
                )}
                <span>{printing ? 'Opening Print...' : 'Print Report'}</span>
              </button>
            </div>
          </div>

          <div className="nurse-reports-filters">
            <label className="field inline-field" htmlFor="nurse-reports-month">
              <span>Month</span>
              <select
                id="nurse-reports-month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(Number(event.target.value))}
              >
                {monthOptions.map((monthOption) => (
                  <option key={monthOption.value} value={monthOption.value}>
                    {monthOption.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field inline-field" htmlFor="nurse-reports-year">
              <span>Year</span>
              <select
                id="nurse-reports-year"
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
              >
                {yearOptions.map((yearOption) => (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="nurse-reports-print-area" aria-label="Nurse monthly reports overview">
            {loading ? (
              <p className="muted">Loading report data...</p>
            ) : (
              <>
                <div className="nurse-reports-main-grid">
                  {diseaseGroupCards.map((groupCard) => {
                    const groupItems = topDiseasesByGroup[groupCard.key];
                    const groupMax = maxDiagnosisCountByGroup[groupCard.key];

                    return (
                      <article className="nurse-reports-card nurse-reports-card-diagnosis" key={groupCard.key}>
                        <header className="nurse-reports-card-head">
                          <h3>{groupCard.title}</h3>
                          <p className="muted small">{groupCard.subtitle}</p>
                        </header>

                        {groupItems.length === 0 ? (
                          <p className="empty-state">No diagnosis entries yet.</p>
                        ) : (
                          <div className="nurse-reports-diagnosis-chart" role="img" aria-label={groupCard.title}>
                            {groupItems.map((item) => {
                              const heightPercent = (item.count / groupMax) * 100;

                              return (
                                <div className="nurse-reports-diagnosis-bar" key={`${groupCard.key}-${item.diagnosis}`}>
                                  <div className="nurse-reports-diagnosis-track">
                                    <div
                                      className="nurse-reports-diagnosis-fill"
                                      style={{
                                        height: `${Math.max(heightPercent, 8)}%`,
                                        background: `linear-gradient(180deg, ${reportCategoryColors[groupCard.key]} 0%, #cb4473 100%)`,
                                      }}
                                    />
                                  </div>
                                  <strong>{item.count}</strong>
                                  <span title={item.diagnosis}>{truncateLabel(item.diagnosis, 15)}</span>
                                  <small title={`${groupCard.contextLabel}: ${item.contextLabel ?? 'N/A'}`}>
                                    {truncateLabel(item.contextLabel ?? 'N/A', 16)}
                                  </small>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <article className="nurse-reports-card nurse-reports-card-patient-volume">
                  <header className="nurse-reports-card-head">
                    <h3>Patients Consulted This Month</h3>
                  </header>

                  <div className="nurse-reports-patient-bar-chart" role="img" aria-label="Patient category bar graph">
                    {patientCategoryCounts.map((item) => {
                      const heightPercent = (item.count / maxPatientCategoryCount) * 100;

                      return (
                        <div className="nurse-reports-patient-bar-column" key={item.key}>
                          <div className="nurse-reports-patient-bar-track">
                            <div
                              className="nurse-reports-patient-bar-fill"
                              style={{
                                height: `${Math.max(heightPercent, item.count === 0 ? 0 : 7)}%`,
                                backgroundColor: reportCategoryColors[item.key],
                              }}
                            />
                          </div>
                          <strong>{item.count}</strong>
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="nurse-reports-patient-breakdown-grid">
                    <article className="nurse-reports-breakdown-card">
                      <h4>Basic Education - Grade Level</h4>
                      {patientSubgroupBreakdowns.basic.length === 0 ? (
                        <p className="muted small">No grade levels recorded.</p>
                      ) : (
                        <ul className="nurse-reports-breakdown-list">
                          {patientSubgroupBreakdowns.basic.map((item) => (
                            <li key={`basic-${item.label}`}>
                              <span>{item.label}</span>
                              <strong>{item.count}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>

                    <article className="nurse-reports-breakdown-card">
                      <h4>College - Course/Program</h4>
                      {patientSubgroupBreakdowns.college.length === 0 ? (
                        <p className="muted small">No course records.</p>
                      ) : (
                        <ul className="nurse-reports-breakdown-list">
                          {patientSubgroupBreakdowns.college.map((item) => (
                            <li key={`college-${item.label}`}>
                              <span>{item.label}</span>
                              <strong>{item.count}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>

                    <article className="nurse-reports-breakdown-card">
                      <h4>Employees - Office/Unit</h4>
                      {patientSubgroupBreakdowns.employee.length === 0 ? (
                        <p className="muted small">No office/unit records.</p>
                      ) : (
                        <ul className="nurse-reports-breakdown-list">
                          {patientSubgroupBreakdowns.employee.map((item) => (
                            <li key={`employee-${item.label}`}>
                              <span>{item.label}</span>
                              <strong>{item.count}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  </div>
                </article>
              </>
            )}
          </section>
        </section>

        {isAiSummaryModalOpen && (
          <div
            className="nurse-reports-summary-modal-backdrop"
            onClick={closeAiSummaryModal}
            role="presentation"
          >
            <section
              aria-label="AI findings summary"
              aria-modal="true"
              className="nurse-reports-summary-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <header className="nurse-reports-summary-modal-head">
                <div>
                  <h3>AI Findings Summary</h3>
                  <p className="muted small">
                    {monthLabel} {selectedYear}
                  </p>
                </div>
                <button
                  className="nurse-reports-summary-modal-close"
                  onClick={closeAiSummaryModal}
                  type="button"
                  aria-label="Close AI summary"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </header>

              <div className="nurse-reports-summary-modal-body">
                {generatingSummary ? (
                  <div className="nurse-reports-summary-loading" role="status" aria-live="polite">
                    <RefreshCw className="nurse-reports-spinner" size={18} strokeWidth={2.4} />
                    <span>Generating monthly insights...</span>
                  </div>
                ) : (
                  <>
                    <p>{aiSummary}</p>
                    {aiSummarySource && (
                      <p className="muted small">Source: {aiSummarySource === 'openai' ? 'OpenAI' : 'Fallback'}</p>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
