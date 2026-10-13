<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Consultation extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'nurse_id',
        'consultation_type',
        'status',
        'chief_complaint',
        'symptoms',
        'diagnosis',
        'remarks',
        'triage_notes',
        'blood_pressure',
        'pulse_bpm',
        'temperature_c',
        'weight_kg',
        'last_menstrual_period',
        'referred_to_doctor',
        'submitted_at',
        'consulted_at',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'referred_to_doctor' => 'boolean',
            'pulse_bpm' => 'integer',
            'temperature_c' => 'decimal:1',
            'weight_kg' => 'decimal:2',
            'last_menstrual_period' => 'date',
            'submitted_at' => 'datetime',
            'consulted_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function nurse(): BelongsTo
    {
        return $this->belongsTo(User::class, 'nurse_id');
    }

    public function referral(): HasOne
    {
        return $this->hasOne(Referral::class);
    }

    public function medicalRecord(): HasOne
    {
        return $this->hasOne(MedicalRecord::class);
    }
}
