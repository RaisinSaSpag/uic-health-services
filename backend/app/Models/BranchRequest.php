<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BranchRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'from_campus_id',
        'to_campus_id',
        'medicine_id',
        'quantity_requested',
        'status',
        'requested_by',
        'approved_by',
    ];

    public function fromCampus(): BelongsTo
    {
        return $this->belongsTo(Campus::class, 'from_campus_id');
    }

    public function toCampus(): BelongsTo
    {
        return $this->belongsTo(Campus::class, 'to_campus_id');
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}