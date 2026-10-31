import type { Patient } from '../types/hsms';
import { formatDate } from '../lib/format';

interface Props {
  patient: Patient;
}

function normalizeText(value: string | null | undefined): string {
  if (!value || value.trim() === '') return 'N/A';
  return value.replace(/_/g, ' ');
}

function normalizeYesNo(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'N/A';
}

function getPatientAge(patient: Patient): string {
  if (typeof patient.age === 'number' && patient.age > 0) return String(patient.age);
  if (!patient.birth_date) return 'N/A';
  const birthDate = new Date(patient.birth_date);
  if (Number.isNaN(birthDate.getTime())) return 'N/A';
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDifference = now.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return String(Math.max(age, 0));
}

export function PatientProfileTab({ patient }: Props) {
  const patientType = patient.patient_type === 'employee' ? 'employee' : 'student';

  const profileRows = [
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
    { label: 'With Maintenance Medicine', value: normalizeYesNo(patient.with_maintenance_medicine) },
    { label: 'Existing Medical Condition', value: patient.existing_medical_condition || 'N/A' },
    { label: 'Allergies', value: patient.allergies || 'N/A' },
  ];

  return (
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
  );
}