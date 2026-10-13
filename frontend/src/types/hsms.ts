export type RoleName = 'student' | 'employee' | 'nurse' | 'doctor' | 'admin' | string;

export interface RoleRecord {
  id: number;
  name: string;
}

export interface UserRecord {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role?: RoleName | RoleRecord | null;
  role_id?: number | null;
  campus_id?: number | null;
  department_id?: number | null;
}

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleName | null;
  campus?: string | null;
  department?: string | null;
}

export interface AuthCallbackResponse {
  token_type: string;
  access_token: string;
  expires_in: number;
  user: AuthUser;
}

export interface LookupRecord {
  id: number;
  name: string;
  code?: string;
}

export interface Patient {
  id: number;
  user_id: number;
  campus_id?: number | null;
  department_id?: number | null;
  patient_number: string;
  patient_type: string;
  sex: string;
  birth_date: string;
  age?: number | null;
  address?: string | null;
  contact_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  emergency_contact_relationship?: string | null;
  allergies?: string | null;
  existing_medical_condition?: string | null;
  with_maintenance_medicine?: boolean | null;
  notes?: string | null;
  student_level?: string | null;
  student_id_number?: string | null;
  grade_level?: string | null;
  section?: string | null;
  parent_guardian_name?: string | null;
  parent_contact_number?: string | null;
  parent_address?: string | null;
  immunization_status?: string | null;
  fit_for_school?: boolean | null;
  special_health_concern?: string | null;
  course_program?: string | null;
  year_level?: string | null;
  working_student?: boolean | null;
  employee_id?: string | null;
  employee_type?: string | null;
  office_unit_department?: string | null;
  position_job_title?: string | null;
  employment_status?: string | null;
  fit_to_work?: boolean | null;
  blood_type?: string | null;
  philhealth_number?: string | null;
  user?: UserRecord;
  campus?: LookupRecord | null;
  department?: LookupRecord | null;
}

export interface MedicalRecord {
  id: number;
  consultation_id: number;
  patient_id: number;
  nurse_id?: number | null;
  doctor_id?: number | null;
  summary: string;
  final_diagnosis: string;
  treatment_plan: string;
  prescription?: string | null;
  follow_up_date?: string | null;
  finalized_at?: string | null;
}

export interface Referral {
  id: number;
  consultation_id: number;
  doctor_id: number;
  status: string;
  referral_reason: string;
  doctor_remarks?: string | null;
  prescription?: string | null;
  referred_at: string;
  completed_at?: string | null;
  doctor?: UserRecord;
  consultation?: Consultation | null;
}

export interface Consultation {
  id: number;
  patient_id: number;
  nurse_id?: number | null;
  consultation_type: string;
  status: string;
  chief_complaint: string;
  symptoms?: string | null;
  diagnosis?: string | null;
  remarks?: string | null;
  triage_notes?: string | null;
  blood_pressure?: string | null;
  pulse_bpm?: number | null;
  temperature_c?: number | string | null;
  weight_kg?: number | string | null;
  last_menstrual_period?: string | null;
  referred_to_doctor: boolean;
  submitted_at?: string | null;
  consulted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  patient?: Patient;
  nurse?: UserRecord | null;
  referral?: Referral | null;
  medical_record?: MedicalRecord | null;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  created_at: string;
  user?: UserRecord | null;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  from?: number | null;
  last_page: number;
  per_page: number;
  to?: number | null;
  total: number;
}
