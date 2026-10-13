<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Referral extends Model
{
    use HasFactory;

    protected $fillable = [
        'consultation_id',
        'doctor_id',
        'status',
        'referral_reason',
        'doctor_remarks',
        'prescription',
        'referred_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'referred_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }
}
