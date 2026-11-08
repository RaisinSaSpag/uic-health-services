<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Patient extends Model
{
    use HasFactory;

    // 🚨 P3-12 FIX: Hide sensitive PHI from API serialization
    protected $hidden = [
        'guardian_signature_base64',
        'signature_ip_address',
        'substance_abuse_history',
        'philhealth_number',
        'insurance_policy_number',
    ];

    protected $fillable = [
        'user_id',
        'campus_id',
        'department_id',
        'patient_number',
        'patient_type',
        'sex',
        'birth_date',
        'patient_category',
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
        
        // Phase 1 New Fields (Medical, Guardian, Signature)
        'parent_secondary_contact_number',
        'current_medications',
        'medication_instructions',
        'preferred_hospital',
        'growth_pubertal_disclosure',
        'self_carry_permit',
        'extracurricular_clearance',
        'counseling_authorization',
        'otc_consent_given',
        'sports_clearance',
        'hazard_disclosure',
        'work_immersion_clearance',
        'self_consent_18plus',
        'immunization_titer_proof',
        'ferpa_hipaa_waiver',
        'dorm_housing_profile',
        'substance_abuse_history',
        'insurance_provider',
        'insurance_policy_number',
        'guardian_signature_base64',
        'guardian_printed_name',
        'guardian_relationship',
        'signature_ip_address',
        'signature_timestamp',

        // Phase 3 Consent Fields
        'consent_method',
        'consent_notes',
        'consent_contact_name',
        'consent_contact_phone',
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
            'self_carry_permit' => 'boolean',
            'extracurricular_clearance' => 'boolean',
            'counseling_authorization' => 'boolean',
            'otc_consent_given' => 'boolean',
            'sports_clearance' => 'boolean',
            'work_immersion_clearance' => 'boolean',
            'self_consent_18plus' => 'boolean',
            'immunization_titer_proof' => 'boolean',
            'ferpa_hipaa_waiver' => 'boolean',
            'signature_timestamp' => 'datetime',
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

    public function enrollments(): HasMany
    {
        return $this->hasMany(PatientEnrollment::class);
    }

    public function currentEnrollment(): HasOne
    {
        return $this->hasOne(PatientEnrollment::class)->where('is_current', true);
    }
}