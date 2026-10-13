<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Medicine extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'category',
    ];

    public function stockIns(): HasMany
    {
        return $this->hasMany(MedicineStockIn::class);
    }

    public function branchRequests(): HasMany
    {
        return $this->hasMany(BranchRequest::class);
    }

    public function prescriptions(): HasMany
    {
        return $this->hasMany(Prescription::class);
    }
}

