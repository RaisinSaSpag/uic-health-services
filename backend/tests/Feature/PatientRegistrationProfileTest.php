<?php

namespace Tests\Feature;

use App\Models\Campus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PatientRegistrationProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_basic_education_student_can_register_extended_profile(): void
    {
        $student = $this->createUserWithRole('student');
        $student->update(['email' => 'jdoe_1234567890@uic.edu.ph']);

        $response = $this->asUser($student)->postJson('/api/v1/patients', [
            'patient_type' => 'student',
            'student_level' => 'basic',
            'sex' => 'female',
            'birth_date' => '2012-01-01',
            'age' => 14,
            'address' => 'Davao City',
            'contact_number' => '09171234567',
            'emergency_contact_name' => 'Jane Doe',
            'emergency_contact_number' => '09181234567',
            'emergency_contact_relationship' => 'Mother',
            'allergies' => 'Seafood',
            'existing_medical_condition' => null,
            'with_maintenance_medicine' => false,
            'notes' => 'No additional notes',
            'student_id_number' => '1234567890',
            'grade_level' => 'Grade 8',
            'section' => 'Section A',
            'parent_guardian_name' => 'Jane Doe',
            'parent_contact_number' => '09181234567',
            'parent_address' => 'Davao City',
            'immunization_status' => 'complete',
            'fit_for_school' => true,
            'special_health_concern' => null,
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('patient_type', 'student')
            ->assertJsonPath('student_level', 'basic')
            ->assertJsonPath('grade_level', 'Grade 8')
            ->assertJsonPath('campus.code', 'BAJADA')
            ->assertJsonPath('department.code', 'BASIC_ED');

        $this->assertDatabaseHas('patients', [
            'user_id' => $student->id,
            'student_level' => 'basic',
            'grade_level' => 'Grade 8',
            'campus_id' => $this->campusId('BAJADA'),
        ]);
    }

    public function test_senior_high_basic_student_is_assigned_to_bonifacio_campus(): void
    {
        $student = $this->createUserWithRole('student');
        $student->update(['email' => 'jdoe_1234567890@uic.edu.ph']);

        $response = $this->asUser($student)->postJson('/api/v1/patients', [
            'patient_type' => 'student',
            'student_level' => 'basic',
            'sex' => 'female',
            'birth_date' => '2008-01-01',
            'age' => 18,
            'address' => 'Davao City',
            'contact_number' => '09171234567',
            'emergency_contact_name' => 'Jane Doe',
            'emergency_contact_number' => '09181234567',
            'emergency_contact_relationship' => 'Mother',
            'allergies' => null,
            'existing_medical_condition' => null,
            'with_maintenance_medicine' => false,
            'notes' => null,
            'student_id_number' => '1234567890',
            'grade_level' => 'Grade 11',
            'section' => 'STEM - A',
            'parent_guardian_name' => 'Jane Doe',
            'parent_contact_number' => '09181234567',
            'parent_address' => 'Davao City',
            'immunization_status' => 'complete',
            'fit_for_school' => true,
            'special_health_concern' => null,
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('student_level', 'basic')
            ->assertJsonPath('grade_level', 'Grade 11')
            ->assertJsonPath('campus.code', 'BONIFACIO');

        $this->assertDatabaseHas('patients', [
            'user_id' => $student->id,
            'student_level' => 'basic',
            'grade_level' => 'Grade 11',
            'campus_id' => $this->campusId('BONIFACIO'),
        ]);
    }

    public function test_college_student_can_register_extended_profile(): void
    {
        $student = $this->createUserWithRole('student');
        $student->update(['email' => 'jdoe_123456789012@uic.edu.ph']);

        $response = $this->asUser($student)->postJson('/api/v1/patients', [
            'patient_type' => 'student',
            'student_level' => 'college',
            'sex' => 'male',
            'birth_date' => '2005-01-01',
            'age' => 21,
            'address' => 'Davao City',
            'contact_number' => '09171234567',
            'emergency_contact_name' => 'John Doe Sr.',
            'emergency_contact_number' => '09181234567',
            'emergency_contact_relationship' => 'Father',
            'allergies' => null,
            'existing_medical_condition' => null,
            'with_maintenance_medicine' => false,
            'notes' => null,
            'student_id_number' => '123456789012',
            'campus_code' => 'BONIFACIO',
            'course_program' => 'BSIT',
            'year_level' => '3',
            'working_student' => true,
            'special_health_concern' => 'Sleep deprivation',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('patient_type', 'student')
            ->assertJsonPath('student_level', 'college')
            ->assertJsonPath('course_program', 'BSIT')
            ->assertJsonPath('campus.code', 'BONIFACIO')
            ->assertJsonPath('department.code', 'COLLEGE');

        $this->assertDatabaseHas('patients', [
            'user_id' => $student->id,
            'student_level' => 'college',
            'course_program' => 'BSIT',
            'working_student' => 1,
            'campus_id' => $this->campusId('BONIFACIO'),
        ]);
    }

    public function test_college_student_defaults_to_father_selga_when_campus_not_provided(): void
    {
        $student = $this->createUserWithRole('student');
        $student->update(['email' => 'jdoe_123456789012@uic.edu.ph']);

        $response = $this->asUser($student)->postJson('/api/v1/patients', [
            'patient_type' => 'student',
            'student_level' => 'college',
            'sex' => 'male',
            'birth_date' => '2005-01-01',
            'age' => 21,
            'address' => 'Davao City',
            'contact_number' => '09171234567',
            'emergency_contact_name' => 'John Doe Sr.',
            'emergency_contact_number' => '09181234567',
            'emergency_contact_relationship' => 'Father',
            'allergies' => null,
            'existing_medical_condition' => null,
            'with_maintenance_medicine' => false,
            'notes' => null,
            'student_id_number' => '123456789012',
            'course_program' => 'BSIT',
            'year_level' => '3',
            'working_student' => false,
            'special_health_concern' => null,
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('student_level', 'college')
            ->assertJsonPath('campus.code', 'FATHER_SELGA');

        $this->assertDatabaseHas('patients', [
            'user_id' => $student->id,
            'student_level' => 'college',
            'campus_id' => $this->campusId('FATHER_SELGA'),
        ]);
    }

    public function test_employee_can_register_extended_profile(): void
    {
        $employee = $this->createUserWithRole('employee');
        $employee->update(['email' => 'jdoe@uic.edu.ph']);

        $response = $this->asUser($employee)->postJson('/api/v1/patients', [
            'patient_type' => 'employee',
            'sex' => 'male',
            'birth_date' => '1990-01-01',
            'age' => 36,
            'address' => 'Davao City',
            'contact_number' => '09171234567',
            'emergency_contact_name' => 'Jane Doe',
            'emergency_contact_number' => '09181234567',
            'emergency_contact_relationship' => 'Spouse',
            'allergies' => 'Dust',
            'existing_medical_condition' => 'Hypertension',
            'with_maintenance_medicine' => true,
            'notes' => 'Monitor blood pressure.',
            'employee_id' => 'EMP-10001',
            'employee_type' => 'non_teaching',
            'office_unit_department' => 'Registrar',
            'position_job_title' => 'Clerk',
            'employment_status' => 'regular',
            'fit_to_work' => true,
            'blood_type' => 'o+',
            'philhealth_number' => '12-345678901-2',
            'special_health_concern' => null,
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('patient_type', 'employee')
            ->assertJsonPath('employee_id', 'EMP-10001')
            ->assertJsonPath('employee_type', 'non_teaching')
            ->assertJsonPath('employment_status', 'regular');

        $this->assertDatabaseHas('patients', [
            'user_id' => $employee->id,
            'employee_id' => 'EMP-10001',
            'employee_type' => 'non_teaching',
            'employment_status' => 'regular',
        ]);
    }

    public function test_student_level_mismatch_with_email_format_is_rejected(): void
    {
        $student = $this->createUserWithRole('student');
        $student->update(['email' => 'jdoe_1234567890@uic.edu.ph']);

        $response = $this->asUser($student)->postJson('/api/v1/patients', [
            'patient_type' => 'student',
            'student_level' => 'college',
            'sex' => 'female',
            'birth_date' => '2012-01-01',
            'age' => 14,
            'address' => 'Davao City',
            'contact_number' => '09171234567',
            'emergency_contact_name' => 'Jane Doe',
            'emergency_contact_number' => '09181234567',
            'emergency_contact_relationship' => 'Mother',
            'allergies' => null,
            'existing_medical_condition' => null,
            'with_maintenance_medicine' => false,
            'notes' => null,
            'student_id_number' => '1234567890',
            'course_program' => 'BSIT',
            'year_level' => '1',
            'working_student' => false,
            'special_health_concern' => null,
        ]);

        $response
            ->assertStatus(409)
            ->assertJsonPath('message', 'Student level does not match the authenticated account format.');

        $this->assertDatabaseCount('patients', 0);
    }

    private function campusId(string $campusCode): int
    {
        return (int) Campus::where('code', $campusCode)->value('id');
    }
}
