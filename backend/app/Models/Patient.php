<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Patient extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'campus_id',
        'department_id',
        'patient_number',
        'patient_type',
        'sex',
        'birth_date',
        'age',
        'address',
        'contact_number',
        'emergency_contact_name',
        'emergency_contact_number',
        'emergency_contact_relationship',
        'allergies',
        'existing_medical_condition',
        'with_maintenance_medicine',
        'notes',
        'student_level',
        'student_id_number',
        'grade_level',
        'section',
        'parent_guardian_name',
        'parent_contact_number',
        'parent_address',
        'immunization_status',
        'fit_for_school',
        'special_health_concern',
        'course_program',
        'year_level',
        'working_student',
        'employee_id',
        'employee_type',
        'office_unit_department',
        'position_job_title',
        'employment_status',
        'fit_to_work',
        'blood_type',
        'philhealth_number',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'age' => 'integer',
            'with_maintenance_medicine' => 'boolean',
            'fit_for_school' => 'boolean',
            'working_student' => 'boolean',
            'fit_to_work' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function consultations(): HasMany
    {
        return $this->hasMany(Consultation::class);
    }

    public function medicalRecords(): HasMany
    {
        return $this->hasMany(MedicalRecord::class);
    }
}
