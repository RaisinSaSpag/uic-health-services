<?php

namespace App\Observers;

use App\Models\PatientEnrollment;

class PatientEnrollmentObserver
{
    private const MIRRORED_FIELDS = [
        'patient_category' => 'category',
        'student_level' => 'student_level',
        'grade_level' => 'grade_level',
        'course_program' => 'course_program',
        'year_level' => 'year_level',
        'section' => 'section',
        'student_id_number' => 'student_id_number',
        'employee_id' => 'employee_id',
        'employee_type' => 'employee_type',
        'office_unit_department' => 'office_unit_department',
        'position_job_title' => 'position_job_title',
        'employment_status' => 'employment_status',
    ];

    public function saved(PatientEnrollment $enrollment): void
    {
        // Only the CURRENT enrollment mirrors to `patients`.
        if (! $enrollment->is_current) {
            return;
        }

        $patient = $enrollment->patient;

        if (! $patient) {
            return;
        }

        $updates = [];
        foreach (self::MIRRORED_FIELDS as $patientField => $enrollmentField) {
            $updates[$patientField] = $enrollment->getAttribute($enrollmentField);
        }

        $patient->forceFill($updates);

        if ($patient->isDirty()) {
            $patient->saveQuietly(); // prevent recursive observer calls
        }
    }
}