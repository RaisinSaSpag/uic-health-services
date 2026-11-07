<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

class PatientEnrollment extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id', 'campus_id', 'category', 'student_level', 'grade_level',
        'course_program', 'year_level', 'section', 'student_id_number',
        'employee_id', 'employee_type', 'office_unit_department',
        'position_job_title', 'employment_status', 'valid_from', 'valid_to',
        'is_current', 'created_by_user_id', 'change_reason',
    ];

    protected function casts(): array
    {
        return [
            'valid_from' => 'date',
            'valid_to' => 'date',
            'is_current' => 'boolean',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function consultations(): HasMany
    {
        return $this->hasMany(Consultation::class);
    }

    public function scopeCurrent(Builder $query): Builder
    {
        return $query->where('is_current', true);
    }

    public function scopeForPatient(Builder $query, int $patientId): Builder
    {
        return $query->where('patient_id', $patientId);
    }

    public function scopeEffectiveOn(Builder $query, string $date): Builder
    {
        return $query
            ->whereDate('valid_from', '<=', $date)
            ->where(function (Builder $q) use ($date) {
                $q->whereNull('valid_to')
                  ->orWhereDate('valid_to', '>=', $date);
            });
    }
}