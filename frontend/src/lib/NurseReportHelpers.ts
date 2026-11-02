import type { Consultation } from '../types/hsms';

export type PatientGroupKey = 'basic' | 'college' | 'employee';

export interface DiagnosisCount {
  diagnosis: string;
  count: number;
  contextLabel?: string;
}

export interface PatientCategoryCount {
  key: PatientGroupKey;
  label: string;
  count: number;
}

export interface BreakdownCount {
  label: string;
  count: number;
}

export function resolveConsultationDate(consultation: Consultation): Date | null {
  const rawDate =
    consultation.consulted_at ?? consultation.completed_at ?? consultation.started_at ?? consultation.submitted_at;

  if (!rawDate) return null;
  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return parsedDate;
}

export function normalizeDiagnosis(consultation: Consultation): string {
  const diagnosisValue =
    consultation.diagnosis?.trim() ??
    consultation.medicalRecord?.final_diagnosis?.trim() ??
    consultation.symptoms?.trim() ??
    '';

  if (diagnosisValue === '') return 'Unspecified Diagnosis';

  return diagnosisValue.replace(/\s+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolvePatientGroup(consultation: Consultation): PatientGroupKey | null {
  const patient = consultation.patient;
  if (!patient) return null;

  if (patient.patient_type === 'employee') return 'employee';
  if (patient.patient_type === 'student') return patient.student_level === 'college' ? 'college' : 'basic';

  return null;
}

export function normalizeSubgroupLabel(value: string | null | undefined, fallbackLabel: string): string {
  const normalized = (value ?? '').trim();
  if (normalized === '') return fallbackLabel;
  return normalized.replace(/\s+/g, ' ');
}

export function resolveSubgroupLabel(consultation: Consultation, groupKey: PatientGroupKey): string {
  const patient = consultation.patient;
  if (!patient) return 'Unspecified';

  if (groupKey === 'basic') return normalizeSubgroupLabel(patient.grade_level, 'Unspecified Grade');
  if (groupKey === 'college') return normalizeSubgroupLabel(patient.course_program ?? patient.year_level, 'Unspecified Course');

  return normalizeSubgroupLabel(patient.office_unit_department ?? patient.position_job_title, 'Unspecified Office');
}

export function summarizeFindings(
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
  const referredCount = consultations.filter((c) => c.referred_to_doctor).length;
  const topDisease = topDiseases[0];

  const categoryInsight = patientCategoryCounts.map((c) => `${c.label}: ${c.count}`).join(' | ');
  const diseaseInsight = topDisease ? `${topDisease.diagnosis} (${topDisease.count} cases)` : 'No dominant diagnosis';

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