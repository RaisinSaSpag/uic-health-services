import axios from 'axios';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { confirmAction, notifyError, notifySuccess } from '../lib/alerts';
import { formatDate, formatDateTime, normalizeRoleName, userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import { StatusBadge } from '../components/StatusBadge';
import type { Consultation, PaginatedResponse, Patient } from '../types/hsms';

type PatientType = 'student' | 'employee';
type StudentLevel = 'basic' | 'college' | '';
type CollegeCampusCode = 'BONIFACIO' | 'FATHER_SELGA' | '';
type YesNo = 'yes' | 'no';

interface PatientRegistrationForm {
  sex: 'male' | 'female' | 'other' | '';
  birth_date: string;
  age: string;
  address: string;
  contact_number: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  emergency_contact_relationship: string;
  allergies: string;
  existing_medical_condition: string;
  with_maintenance_medicine: YesNo;
  notes: string;

  student_id_number: string;
  grade_level: string;
  section: string;
  parent_guardian_name: string;
  parent_contact_number: string;
  parent_address: string;
  immunization_status: 'complete' | 'incomplete' | 'unknown' | '';
  fit_for_school: YesNo;
  special_health_concern: string;
  course_program: string;
  year_level: string;
  working_student: YesNo;
  campus_code: CollegeCampusCode;

  employee_id: string;
  employee_type:
    | 'teaching'
    | 'non_teaching'
    | 'utility'
    | 'security'
    | 'maintenance'
    | 'admin'
    | 'contractual'
    | '';
  office_unit_department: string;
  position_job_title: string;
  employment_status: 'regular' | 'contractual' | 'part_time' | 'probationary' | '';
  fit_to_work: YesNo;
  blood_type: 'a+' | 'a-' | 'b+' | 'b-' | 'ab+' | 'ab-' | 'o+' | 'o-' | 'unknown' | '';
  philhealth_number: string;
}

function inferStudentLevelFromEmail(email: string | null | undefined): StudentLevel {
  if (!email) {
    return '';
  }

  const localPart = email.trim().toLowerCase().split('@')[0] ?? '';

  if (/^[a-z][a-z]+_\d{10}$/.test(localPart)) {
    return 'basic';
  }

  if (/^[a-z][a-z]+_\d{12}$/.test(localPart)) {
    return 'college';
  }

  return '';
}

function inferStudentIdFromEmail(email: string | null | undefined): string {
  if (!email) {
    return '';
  }

  const localPart = email.trim().toLowerCase().split('@')[0] ?? '';
  const match = localPart.match(/_(\d{10}|\d{12})$/);

  return match?.[1] ?? '';
}

function isSeniorHighGradeLevel(gradeLevel: string): boolean {
  const normalizedGradeLevel = gradeLevel.trim().toLowerCase();

  if (normalizedGradeLevel === '') {
    return false;
  }

  if (normalizedGradeLevel.includes('senior high')) {
    return true;
  }

  return /\b(11|12)\b/.test(normalizedGradeLevel);
}

function yesNoToBoolean(value: YesNo): boolean {
  return value === 'yes';
}

function booleanToYesNo(value: boolean | null | undefined, fallback: YesNo): YesNo {
  if (value === true) {
    return 'yes';
  }

  if (value === false) {
    return 'no';
  }

  return fallback;
}

export function PatientPortalPage() {
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loadingConsultations, setLoadingConsultations] = useState(true);
  const [submittingRegistration, setSubmittingRegistration] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [submittingProfileUpdate, setSubmittingProfileUpdate] = useState(false);

  const patientType = useMemo<PatientType>(() => {
    const role = normalizeRoleName(user?.role);
    return role === 'employee' ? 'employee' : 'student';
  }, [user]);

  const studentLevel = useMemo<StudentLevel>(() => {
    if (patientType !== 'student') {
      return '';
    }

    return inferStudentLevelFromEmail(user?.email);
  }, [patientType, user?.email]);

  const editableStudentLevel = useMemo<StudentLevel>(() => {
    const profileStudentLevel = (patient?.student_level ?? '').toLowerCase();

    if (profileStudentLevel === 'basic' || profileStudentLevel === 'college') {
      return profileStudentLevel as StudentLevel;
    }

    return studentLevel;
  }, [patient?.student_level, studentLevel]);

  const studentDepartmentLabel = useMemo(() => {
    if (studentLevel === 'basic') {
      return 'Basic Education';
    }

    if (studentLevel === 'college') {
      return 'College';
    }

    return 'Unrecognized student account format';
  }, [studentLevel]);

  const [registrationForm, setRegistrationForm] = useState<PatientRegistrationForm>({
    sex: '',
    birth_date: '',
    age: '',
    address: '',
    contact_number: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    emergency_contact_relationship: '',
    allergies: '',
    existing_medical_condition: '',
    with_maintenance_medicine: 'no',
    notes: '',

    student_id_number: '',
    grade_level: '',
    section: '',
    parent_guardian_name: '',
    parent_contact_number: '',
    parent_address: '',
    immunization_status: '',
    fit_for_school: 'yes',
    special_health_concern: '',
    course_program: '',
    year_level: '',
    working_student: 'no',
    campus_code: 'FATHER_SELGA',

    employee_id: '',
    employee_type: '',
    office_unit_department: '',
    position_job_title: '',
    employment_status: '',
    fit_to_work: 'yes',
    blood_type: '',
    philhealth_number: '',
  });

  const basicStudentCampusLabel = useMemo(() => {
    if (studentLevel !== 'basic') {
      return '';
    }

    return isSeniorHighGradeLevel(registrationForm.grade_level)
      ? 'Bonifacio, Davao City'
      : 'Bajada, Davao City';
  }, [registrationForm.grade_level, studentLevel]);

  const loadPortalData = useCallback(async () => {
    setLoading(true);

    try {
      const patientData = await api
        .get<Patient>('/patients/me')
        .then((response) => response.data)
        .catch((err) => {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            return null;
          }

          throw err;
        });

      setPatient(patientData);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to load your clinic portal data.'), 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortalData();
  }, [loadPortalData]);

  const loadConsultationHistory = useCallback(async () => {
    setLoadingConsultations(true);

    try {
      const response = await api.get<PaginatedResponse<Consultation>>('/consultations', {
        params: { per_page: 100 },
      });

      setConsultations(response.data.data);
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Failed to load your consultation history.'), 'History Load Failed');
    } finally {
      setLoadingConsultations(false);
    }
  }, []);

  useEffect(() => {
    void loadConsultationHistory();
  }, [loadConsultationHistory]);

  useEffect(() => {
    if (patientType !== 'student' || registrationForm.student_id_number !== '') {
      return;
    }

    const inferredStudentId = inferStudentIdFromEmail(user?.email);

    if (!inferredStudentId) {
      return;
    }

    setRegistrationForm((current) => ({
      ...current,
      student_id_number: inferredStudentId,
    }));
  }, [patientType, registrationForm.student_id_number, user?.email]);

  useEffect(() => {
    if (!patient) {
      return;
    }

    const normalizedCampusCode = (patient.campus?.code ?? '').toUpperCase();
    const mappedCampusCode: CollegeCampusCode =
      normalizedCampusCode === 'BONIFACIO' || normalizedCampusCode === 'FATHER_SELGA'
        ? (normalizedCampusCode as CollegeCampusCode)
        : 'FATHER_SELGA';

    setRegistrationForm((current) => ({
      ...current,
      address: patient.address ?? '',
      contact_number: patient.contact_number ?? '',
      emergency_contact_name: patient.emergency_contact_name ?? '',
      emergency_contact_number: patient.emergency_contact_number ?? '',
      emergency_contact_relationship: patient.emergency_contact_relationship ?? '',
      allergies: patient.allergies ?? '',
      existing_medical_condition: patient.existing_medical_condition ?? '',
      with_maintenance_medicine: booleanToYesNo(patient.with_maintenance_medicine, 'no'),
      notes: patient.notes ?? '',
      grade_level: patient.grade_level ?? '',
      section: patient.section ?? '',
      parent_guardian_name: patient.parent_guardian_name ?? '',
      parent_contact_number: patient.parent_contact_number ?? '',
      parent_address: patient.parent_address ?? '',
      immunization_status:
        (patient.immunization_status as PatientRegistrationForm['immunization_status']) ?? '',
      fit_for_school: booleanToYesNo(patient.fit_for_school, 'yes'),
      special_health_concern: patient.special_health_concern ?? '',
      course_program: patient.course_program ?? '',
      year_level: patient.year_level ?? '',
      working_student: booleanToYesNo(patient.working_student, 'no'),
      campus_code: mappedCampusCode,
      office_unit_department: patient.office_unit_department ?? '',
      position_job_title: patient.position_job_title ?? '',
      employment_status:
        (patient.employment_status as PatientRegistrationForm['employment_status']) ?? '',
      fit_to_work: booleanToYesNo(patient.fit_to_work, 'yes'),
      blood_type: (patient.blood_type as PatientRegistrationForm['blood_type']) ?? '',
      philhealth_number: patient.philhealth_number ?? '',
    }));
  }, [patient]);

  const submitRegistration = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmittingRegistration(true);

    try {
      if (patientType === 'student' && studentLevel === '') {
        throw new Error('Unable to detect student level from your account email format.');
      }

      const parsedAge = Number(registrationForm.age);

      if (!Number.isInteger(parsedAge) || parsedAge <= 0) {
        throw new Error('Age must be a valid positive number.');
      }

      const payload: Record<string, unknown> = {
        patient_type: patientType,
        sex: registrationForm.sex,
        birth_date: registrationForm.birth_date,
        age: parsedAge,
        address: registrationForm.address,
        contact_number: registrationForm.contact_number,
        emergency_contact_name: registrationForm.emergency_contact_name,
        emergency_contact_number: registrationForm.emergency_contact_number,
        emergency_contact_relationship: registrationForm.emergency_contact_relationship,
        allergies: registrationForm.allergies.trim() || null,
        existing_medical_condition: registrationForm.existing_medical_condition.trim() || null,
        with_maintenance_medicine: yesNoToBoolean(registrationForm.with_maintenance_medicine),
        notes: registrationForm.notes.trim() || null,
      };

      if (patientType === 'student') {
        payload.student_level = studentLevel;
        payload.student_id_number = registrationForm.student_id_number.trim();
        payload.special_health_concern = registrationForm.special_health_concern.trim() || null;

        if (studentLevel === 'basic') {
          payload.campus_code = isSeniorHighGradeLevel(registrationForm.grade_level)
            ? 'BONIFACIO'
            : 'BAJADA';
          payload.grade_level = registrationForm.grade_level.trim();
          payload.section = registrationForm.section.trim();
          payload.parent_guardian_name = registrationForm.parent_guardian_name.trim();
          payload.parent_contact_number = registrationForm.parent_contact_number.trim();
          payload.parent_address = registrationForm.parent_address.trim();
          payload.immunization_status = registrationForm.immunization_status;
          payload.fit_for_school = yesNoToBoolean(registrationForm.fit_for_school);
        }

        if (studentLevel === 'college') {
          payload.campus_code = registrationForm.campus_code || 'FATHER_SELGA';
          payload.course_program = registrationForm.course_program.trim();
          payload.year_level = registrationForm.year_level.trim();
          payload.working_student = yesNoToBoolean(registrationForm.working_student);
        }
      }

      if (patientType === 'employee') {
        payload.employee_id = registrationForm.employee_id.trim();
        payload.employee_type = registrationForm.employee_type;
        payload.office_unit_department = registrationForm.office_unit_department.trim();
        payload.position_job_title = registrationForm.position_job_title.trim();
        payload.employment_status = registrationForm.employment_status;
        payload.fit_to_work = yesNoToBoolean(registrationForm.fit_to_work);
        payload.blood_type = registrationForm.blood_type || null;
        payload.philhealth_number = registrationForm.philhealth_number.trim() || null;
      }

      const response = await api.post<Patient>('/patients', payload);

      setPatient(response.data);
      void notifySuccess('Patient profile registered successfully.', 'Profile Saved');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to register patient profile.'), 'Registration Failed');
    } finally {
      setSubmittingRegistration(false);
    }
  };

  const submitProfileUpdate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const confirmed = await confirmAction({
      title: 'Save profile changes?',
      text: 'Your profile details will be updated immediately.',
      confirmButtonText: 'Yes, save changes',
    });

    if (!confirmed) {
      return;
    }

    setSubmittingProfileUpdate(true);

    try {
      const payload: Record<string, unknown> = {
        address: registrationForm.address.trim(),
        contact_number: registrationForm.contact_number.trim(),
        emergency_contact_name: registrationForm.emergency_contact_name.trim(),
        emergency_contact_number: registrationForm.emergency_contact_number.trim(),
        emergency_contact_relationship: registrationForm.emergency_contact_relationship.trim(),
        with_maintenance_medicine: yesNoToBoolean(registrationForm.with_maintenance_medicine),
        allergies: registrationForm.allergies.trim() || null,
        existing_medical_condition: registrationForm.existing_medical_condition.trim() || null,
        notes: registrationForm.notes.trim() || null,
      };

      if (patientType === 'student') {
        payload.special_health_concern = registrationForm.special_health_concern.trim() || null;

        if (editableStudentLevel === 'basic') {
          payload.grade_level = registrationForm.grade_level.trim();
          payload.section = registrationForm.section.trim();
          payload.parent_guardian_name = registrationForm.parent_guardian_name.trim();
          payload.parent_contact_number = registrationForm.parent_contact_number.trim();
          payload.parent_address = registrationForm.parent_address.trim();
          payload.immunization_status = registrationForm.immunization_status;
          payload.fit_for_school = yesNoToBoolean(registrationForm.fit_for_school);
        }

        if (editableStudentLevel === 'college') {
          payload.campus_code = registrationForm.campus_code || 'FATHER_SELGA';
          payload.course_program = registrationForm.course_program.trim();
          payload.year_level = registrationForm.year_level.trim();
          payload.working_student = yesNoToBoolean(registrationForm.working_student);
        }
      }

      if (patientType === 'employee') {
        payload.office_unit_department = registrationForm.office_unit_department.trim();
        payload.position_job_title = registrationForm.position_job_title.trim();
        payload.employment_status = registrationForm.employment_status;
        payload.fit_to_work = yesNoToBoolean(registrationForm.fit_to_work);
        payload.blood_type = registrationForm.blood_type || null;
        payload.philhealth_number = registrationForm.philhealth_number.trim() || null;
      }

      const response = await api.patch<Patient>('/patients/me', payload);

      setPatient(response.data);
      setEditingProfile(false);
      void notifySuccess('Profile updated successfully.', 'Profile Updated');
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to update patient profile.'), 'Update Failed');
    } finally {
      setSubmittingProfileUpdate(false);
    }
  };

  if (loading) {
    return (
      <section className="panel centered">
        <h2>Loading patient portal</h2>
        <p className="muted">Fetching your registration profile...</p>
      </section>
    );
  }

  if (patient && patient.patient_type !== patientType) {
    return (
      <div className="page patient-portal-page">
        <section className="panel">
          <h2>Patient Access</h2>
          <p className="muted">
            Signed in as <strong>{userDisplayName(user)}</strong>
          </p>
        </section>

        <section className="panel">
          <h3>Profile needs attention</h3>
          <p className="muted">
            Your account role does not match its saved clinic profile. Profile details and consultation
            history are hidden until the clinic administrator corrects the account and profile
            assignment.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page patient-portal-page">
      <section className="panel">
        <h2>Patient Access</h2>
        <p className="muted">
          Signed in as <strong>{userDisplayName(user)}</strong>
        </p>
      </section>

      {!patient && (
        <section className="panel">
          <h3>Register Patient Profile</h3>
          <p className="muted">Complete this once so your profile appears in the nurse dashboard records.</p>

          <form className="form-grid" onSubmit={submitRegistration}>
            <div className="field full-width">
              <h4>System Information</h4>
            </div>

            <label className="field">
              <span>Patient Type</span>
              <input readOnly value={patientType === 'student' ? 'Student' : 'Employee'} />
            </label>

            {patientType !== 'student' && (
              <label className="field">
                <span>Campus</span>
                <input readOnly value={user?.campus ?? 'N/A'} />
              </label>
            )}

            {patientType === 'student' && studentLevel === 'basic' && (
              <label className="field">
                <span>Campus</span>
                <input readOnly value={basicStudentCampusLabel} />
              </label>
            )}

            {patientType === 'student' && studentLevel === 'college' && (
              <label className="field">
                <span>Campus</span>
                <select
                  onChange={(event) =>
                    setRegistrationForm((current) => ({
                      ...current,
                      campus_code: event.target.value as CollegeCampusCode,
                    }))
                  }
                  value={registrationForm.campus_code}
                >
                  <option value="FATHER_SELGA">Father Selga, Davao City</option>
                  <option value="BONIFACIO">Bonifacio, Davao City</option>
                </select>
              </label>
            )}

            {patientType === 'student' && (
              <label className="field full-width">
                <span>Department</span>
                <input readOnly value={studentDepartmentLabel} />
              </label>
            )}

            <div className="field full-width">
              <h4>Common Information</h4>
            </div>

            <label className="field">
              <span>Sex</span>
              <select
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    sex: event.target.value as PatientRegistrationForm['sex'],
                  }))
                }
                required
                value={registrationForm.sex}
              >
                <option value="">Select sex</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="field">
              <span>Birth Date</span>
              <input
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    birth_date: event.target.value,
                  }))
                }
                required
                type="date"
                value={registrationForm.birth_date}
              />
            </label>

            <label className="field">
              <span>Age</span>
              <input
                min={1}
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    age: event.target.value,
                  }))
                }
                required
                type="number"
                value={registrationForm.age}
              />
            </label>

            <label className="field">
              <span>Contact Number</span>
              <input
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    contact_number: event.target.value,
                  }))
                }
                placeholder="09xx..."
                required
                value={registrationForm.contact_number}
              />
            </label>

            <label className="field full-width">
              <span>Address</span>
              <input
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                required
                value={registrationForm.address}
              />
            </label>

            <label className="field">
              <span>Emergency Contact Name</span>
              <input
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    emergency_contact_name: event.target.value,
                  }))
                }
                required
                value={registrationForm.emergency_contact_name}
              />
            </label>

            <label className="field">
              <span>Emergency Contact Number</span>
              <input
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    emergency_contact_number: event.target.value,
                  }))
                }
                required
                value={registrationForm.emergency_contact_number}
              />
            </label>

            <label className="field">
              <span>Emergency Contact Relationship</span>
              <input
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    emergency_contact_relationship: event.target.value,
                  }))
                }
                required
                value={registrationForm.emergency_contact_relationship}
              />
            </label>

            <label className="field">
              <span>With Maintenance Medicine</span>
              <select
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    with_maintenance_medicine: event.target.value as YesNo,
                  }))
                }
                value={registrationForm.with_maintenance_medicine}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="field full-width">
              <span>Allergies (Optional)</span>
              <textarea
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    allergies: event.target.value,
                  }))
                }
                rows={2}
                value={registrationForm.allergies}
              />
            </label>

            <label className="field full-width">
              <span>Existing Medical Condition (Optional)</span>
              <textarea
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    existing_medical_condition: event.target.value,
                  }))
                }
                rows={2}
                value={registrationForm.existing_medical_condition}
              />
            </label>

            <label className="field full-width">
              <span>Notes (Optional)</span>
              <textarea
                onChange={(event) =>
                  setRegistrationForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={2}
                value={registrationForm.notes}
              />
            </label>

            {patientType === 'student' && studentLevel === '' && (
              <p className="muted small full-width">
                Student account format is not recognized. Please contact the clinic/admin.
              </p>
            )}

            {patientType === 'student' && studentLevel !== '' && (
              <>
                <div className="field full-width">
                  <h4>
                    Student Information ({studentLevel === 'basic' ? 'Basic Education' : 'College'})
                  </h4>
                </div>

                <label className="field">
                  <span>Student ID Number</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        student_id_number: event.target.value,
                      }))
                    }
                    required
                    value={registrationForm.student_id_number}
                  />
                </label>

                <label className="field full-width">
                  <span>Special Health Concern (Optional)</span>
                  <textarea
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        special_health_concern: event.target.value,
                      }))
                    }
                    rows={2}
                    value={registrationForm.special_health_concern}
                  />
                </label>

                {studentLevel === 'basic' && (
                  <>
                    <label className="field">
                      <span>Grade Level</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            grade_level: event.target.value,
                          }))
                        }
                        required
                        value={registrationForm.grade_level}
                      />
                    </label>

                    <p className="muted small full-width">
                      Campus mapping: Grades 11-12 are assigned to Bonifacio. Other basic levels stay in Bajada.
                    </p>

                    <label className="field">
                      <span>Section</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            section: event.target.value,
                          }))
                        }
                        required
                        value={registrationForm.section}
                      />
                    </label>

                    <label className="field">
                      <span>Parent / Guardian Name</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            parent_guardian_name: event.target.value,
                          }))
                        }
                        required
                        value={registrationForm.parent_guardian_name}
                      />
                    </label>

                    <label className="field">
                      <span>Parent Contact Number</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            parent_contact_number: event.target.value,
                          }))
                        }
                        required
                        value={registrationForm.parent_contact_number}
                      />
                    </label>

                    <label className="field full-width">
                      <span>Parent Address</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            parent_address: event.target.value,
                          }))
                        }
                        required
                        value={registrationForm.parent_address}
                      />
                    </label>

                    <label className="field">
                      <span>Immunization Status</span>
                      <select
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            immunization_status:
                              event.target.value as PatientRegistrationForm['immunization_status'],
                          }))
                        }
                        required
                        value={registrationForm.immunization_status}
                      >
                        <option value="">Select status</option>
                        <option value="complete">Complete</option>
                        <option value="incomplete">Incomplete</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Fit for School</span>
                      <select
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            fit_for_school: event.target.value as YesNo,
                          }))
                        }
                        value={registrationForm.fit_for_school}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  </>
                )}

                {studentLevel === 'college' && (
                  <>
                    <label className="field">
                      <span>Course / Program</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            course_program: event.target.value,
                          }))
                        }
                        required
                        value={registrationForm.course_program}
                      />
                    </label>

                    <label className="field">
                      <span>Year Level</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            year_level: event.target.value,
                          }))
                        }
                        required
                        value={registrationForm.year_level}
                      />
                    </label>

                    <label className="field">
                      <span>Working Student</span>
                      <select
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            working_student: event.target.value as YesNo,
                          }))
                        }
                        value={registrationForm.working_student}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  </>
                )}
              </>
            )}

            {patientType === 'employee' && (
              <>
                <div className="field full-width">
                  <h4>Employee Information</h4>
                </div>

                <label className="field">
                  <span>Employee ID</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        employee_id: event.target.value,
                      }))
                    }
                    required
                    value={registrationForm.employee_id}
                  />
                </label>

                <label className="field">
                  <span>Employee Type</span>
                  <select
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        employee_type:
                          event.target.value as PatientRegistrationForm['employee_type'],
                      }))
                    }
                    required
                    value={registrationForm.employee_type}
                  >
                    <option value="">Select type</option>
                    <option value="teaching">Teaching</option>
                    <option value="non_teaching">Non-Teaching</option>
                    <option value="utility">Utility</option>
                    <option value="security">Security</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="admin">Admin</option>
                    <option value="contractual">Contractual</option>
                  </select>
                </label>

                <label className="field">
                  <span>Office / Unit / Department</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        office_unit_department: event.target.value,
                      }))
                    }
                    required
                    value={registrationForm.office_unit_department}
                  />
                </label>

                <label className="field">
                  <span>Position / Job Title</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        position_job_title: event.target.value,
                      }))
                    }
                    required
                    value={registrationForm.position_job_title}
                  />
                </label>

                <label className="field">
                  <span>Employment Status</span>
                  <select
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        employment_status:
                          event.target.value as PatientRegistrationForm['employment_status'],
                      }))
                    }
                    required
                    value={registrationForm.employment_status}
                  >
                    <option value="">Select status</option>
                    <option value="regular">Regular</option>
                    <option value="contractual">Contractual</option>
                    <option value="part_time">Part-time</option>
                    <option value="probationary">Probationary</option>
                  </select>
                </label>

                <label className="field">
                  <span>Fit to Work</span>
                  <select
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        fit_to_work: event.target.value as YesNo,
                      }))
                    }
                    value={registrationForm.fit_to_work}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>

                <label className="field">
                  <span>Blood Type (Optional)</span>
                  <select
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        blood_type: event.target.value as PatientRegistrationForm['blood_type'],
                      }))
                    }
                    value={registrationForm.blood_type}
                  >
                    <option value="">Select blood type</option>
                    <option value="a+">A+</option>
                    <option value="a-">A-</option>
                    <option value="b+">B+</option>
                    <option value="b-">B-</option>
                    <option value="ab+">AB+</option>
                    <option value="ab-">AB-</option>
                    <option value="o+">O+</option>
                    <option value="o-">O-</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>

                <label className="field full-width">
                  <span>PhilHealth Number (Optional)</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        philhealth_number: event.target.value,
                      }))
                    }
                    value={registrationForm.philhealth_number}
                  />
                </label>
              </>
            )}

            <div className="field full-width">
              <button className="button" disabled={submittingRegistration} type="submit">
                {submittingRegistration ? 'Saving profile...' : 'Register Patient Profile'}
              </button>
            </div>
          </form>
        </section>
      )}

      {patient && (
        <>
          <section className="panel">
            <h3>Profile Summary</h3>
            <div className="stats-grid">
              <article className="stat-card">
                <span className="stat-label">Patient Number</span>
                <strong>{patient.patient_number}</strong>
              </article>
              <article className="stat-card">
                <span className="stat-label">Birth Date</span>
                <strong>{formatDate(patient.birth_date)}</strong>
              </article>
              <article className="stat-card">
                <span className="stat-label">Campus</span>
                <strong>{patient.campus?.name ?? 'N/A'}</strong>
              </article>
              <article className="stat-card">
                <span className="stat-label">Department</span>
                <strong>{patient.department?.name ?? 'N/A'}</strong>
              </article>
              <article className="stat-card">
                <span className="stat-label">Profile Type</span>
                <strong>
                  {patient.patient_type}
                  {patient.student_level ? ` (${patient.student_level})` : ''}
                </strong>
              </article>
            </div>
            <div className="action-row" style={{ marginTop: '0.85rem' }}>
              <button
                className="button secondary"
                onClick={() => {
                  setEditingProfile((current) => !current);
                }}
                type="button"
              >
                {editingProfile ? 'Close Edit Profile' : 'Edit Profile'}
              </button>
            </div>
            <p className="muted small" style={{ marginTop: '0.45rem' }}>
              Patient type, student level, and system-assigned IDs are locked. Contact clinic staff for
              those corrections.
            </p>
          </section>

          {editingProfile && (
            <section className="panel">
              <h3>Edit Profile</h3>
              <p className="muted">Update incorrect details and save your profile.</p>

              <form className="form-grid" onSubmit={submitProfileUpdate}>
                <div className="field full-width">
                  <h4>Common Information</h4>
                </div>

                <label className="field full-width">
                  <span>Address</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    required
                    value={registrationForm.address}
                  />
                </label>

                <label className="field">
                  <span>Contact Number</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        contact_number: event.target.value,
                      }))
                    }
                    required
                    value={registrationForm.contact_number}
                  />
                </label>

                <label className="field">
                  <span>Emergency Contact Name</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        emergency_contact_name: event.target.value,
                      }))
                    }
                    required
                    value={registrationForm.emergency_contact_name}
                  />
                </label>

                <label className="field">
                  <span>Emergency Contact Number</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        emergency_contact_number: event.target.value,
                      }))
                    }
                    required
                    value={registrationForm.emergency_contact_number}
                  />
                </label>

                <label className="field">
                  <span>Emergency Contact Relationship</span>
                  <input
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        emergency_contact_relationship: event.target.value,
                      }))
                    }
                    required
                    value={registrationForm.emergency_contact_relationship}
                  />
                </label>

                <label className="field">
                  <span>With Maintenance Medicine</span>
                  <select
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        with_maintenance_medicine: event.target.value as YesNo,
                      }))
                    }
                    value={registrationForm.with_maintenance_medicine}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>

                <label className="field full-width">
                  <span>Allergies (Optional)</span>
                  <textarea
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        allergies: event.target.value,
                      }))
                    }
                    rows={2}
                    value={registrationForm.allergies}
                  />
                </label>

                <label className="field full-width">
                  <span>Existing Medical Condition (Optional)</span>
                  <textarea
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        existing_medical_condition: event.target.value,
                      }))
                    }
                    rows={2}
                    value={registrationForm.existing_medical_condition}
                  />
                </label>

                <label className="field full-width">
                  <span>Notes (Optional)</span>
                  <textarea
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    rows={2}
                    value={registrationForm.notes}
                  />
                </label>

                {patientType === 'student' && (
                  <>
                    <div className="field full-width">
                      <h4>
                        Student Information ({editableStudentLevel === 'basic' ? 'Basic Education' : 'College'})
                      </h4>
                    </div>

                    <label className="field full-width">
                      <span>Special Health Concern (Optional)</span>
                      <textarea
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            special_health_concern: event.target.value,
                          }))
                        }
                        rows={2}
                        value={registrationForm.special_health_concern}
                      />
                    </label>

                    {editableStudentLevel === 'basic' && (
                      <>
                        <label className="field">
                          <span>Grade Level</span>
                          <input
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                grade_level: event.target.value,
                              }))
                            }
                            required
                            value={registrationForm.grade_level}
                          />
                        </label>

                        <label className="field">
                          <span>Section</span>
                          <input
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                section: event.target.value,
                              }))
                            }
                            required
                            value={registrationForm.section}
                          />
                        </label>

                        <label className="field">
                          <span>Parent / Guardian Name</span>
                          <input
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                parent_guardian_name: event.target.value,
                              }))
                            }
                            required
                            value={registrationForm.parent_guardian_name}
                          />
                        </label>

                        <label className="field">
                          <span>Parent Contact Number</span>
                          <input
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                parent_contact_number: event.target.value,
                              }))
                            }
                            required
                            value={registrationForm.parent_contact_number}
                          />
                        </label>

                        <label className="field full-width">
                          <span>Parent Address</span>
                          <input
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                parent_address: event.target.value,
                              }))
                            }
                            required
                            value={registrationForm.parent_address}
                          />
                        </label>

                        <label className="field">
                          <span>Immunization Status</span>
                          <select
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                immunization_status:
                                  event.target.value as PatientRegistrationForm['immunization_status'],
                              }))
                            }
                            required
                            value={registrationForm.immunization_status}
                          >
                            <option value="">Select status</option>
                            <option value="complete">Complete</option>
                            <option value="incomplete">Incomplete</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Fit for School</span>
                          <select
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                fit_for_school: event.target.value as YesNo,
                              }))
                            }
                            value={registrationForm.fit_for_school}
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </>
                    )}

                    {editableStudentLevel === 'college' && (
                      <>
                        <label className="field">
                          <span>Campus</span>
                          <select
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                campus_code: event.target.value as CollegeCampusCode,
                              }))
                            }
                            value={registrationForm.campus_code}
                          >
                            <option value="FATHER_SELGA">Father Selga, Davao City</option>
                            <option value="BONIFACIO">Bonifacio, Davao City</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Course / Program</span>
                          <input
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                course_program: event.target.value,
                              }))
                            }
                            required
                            value={registrationForm.course_program}
                          />
                        </label>

                        <label className="field">
                          <span>Year Level</span>
                          <input
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                year_level: event.target.value,
                              }))
                            }
                            required
                            value={registrationForm.year_level}
                          />
                        </label>

                        <label className="field">
                          <span>Working Student</span>
                          <select
                            onChange={(event) =>
                              setRegistrationForm((current) => ({
                                ...current,
                                working_student: event.target.value as YesNo,
                              }))
                            }
                            value={registrationForm.working_student}
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </>
                    )}
                  </>
                )}

                {patientType === 'employee' && (
                  <>
                    <div className="field full-width">
                      <h4>Employee Information</h4>
                    </div>

                    <label className="field">
                      <span>Office / Unit / Department</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            office_unit_department: event.target.value,
                          }))
                        }
                        required
                        value={registrationForm.office_unit_department}
                      />
                    </label>

                    <label className="field">
                      <span>Position / Job Title</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            position_job_title: event.target.value,
                          }))
                        }
                        required
                        value={registrationForm.position_job_title}
                      />
                    </label>

                    <label className="field">
                      <span>Employment Status</span>
                      <select
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            employment_status:
                              event.target.value as PatientRegistrationForm['employment_status'],
                          }))
                        }
                        required
                        value={registrationForm.employment_status}
                      >
                        <option value="">Select status</option>
                        <option value="regular">Regular</option>
                        <option value="contractual">Contractual</option>
                        <option value="part_time">Part-time</option>
                        <option value="probationary">Probationary</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Fit to Work</span>
                      <select
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            fit_to_work: event.target.value as YesNo,
                          }))
                        }
                        value={registrationForm.fit_to_work}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Blood Type (Optional)</span>
                      <select
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            blood_type: event.target.value as PatientRegistrationForm['blood_type'],
                          }))
                        }
                        value={registrationForm.blood_type}
                      >
                        <option value="">Select blood type</option>
                        <option value="a+">A+</option>
                        <option value="a-">A-</option>
                        <option value="b+">B+</option>
                        <option value="b-">B-</option>
                        <option value="ab+">AB+</option>
                        <option value="ab-">AB-</option>
                        <option value="o+">O+</option>
                        <option value="o-">O-</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </label>

                    <label className="field full-width">
                      <span>PhilHealth Number (Optional)</span>
                      <input
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            philhealth_number: event.target.value,
                          }))
                        }
                        value={registrationForm.philhealth_number}
                      />
                    </label>
                  </>
                )}

                <div className="field full-width action-row">
                  <button className="button success" disabled={submittingProfileUpdate} type="submit">
                    {submittingProfileUpdate ? 'Saving changes...' : 'Save Profile Changes'}
                  </button>
                  <button
                    className="button ghost"
                    disabled={submittingProfileUpdate}
                    onClick={() => {
                      setEditingProfile(false);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="panel">
            <h3>Consultation History</h3>
            <p className="muted">Review your submitted consultations and their current status.</p>

            {loadingConsultations ? (
              <p className="muted" style={{ marginTop: '0.7rem' }}>Loading consultation history...</p>
            ) : consultations.length === 0 ? (
              <p className="muted" style={{ marginTop: '0.7rem' }}>You have no consultations yet.</p>
            ) : (
              <div className="table-wrap" style={{ marginTop: '0.7rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Chief Complaint</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultations.map((consultation) => (
                      <tr key={consultation.id}>
                        <td>{formatDateTime(consultation.submitted_at ?? consultation.consulted_at)}</td>
                        <td>{consultation.consultation_type.replace(/_/g, ' ')}</td>
                        <td>{consultation.chief_complaint}</td>
                        <td><StatusBadge status={consultation.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <h3>Clinic Consultation Process</h3>
            <p className="muted">
              Consultations are handled in person at the clinic. Your registration is already saved and
              visible to the nurse dashboard for clinic-side processing.
            </p>
            <p className="muted small" style={{ marginTop: '0.4rem' }}>
              Use Edit Profile above whenever you need to correct your saved details.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
