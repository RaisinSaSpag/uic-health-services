<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicineArchived extends Model
{
    use HasFactory;

    protected $table = 'medicine_archived';

    protected $fillable = [
        'stock_in_id',
        'quantity',
        'reason',
        'archived_by',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
        ];
    }

    public function stockIn(): BelongsTo
    {
        return $this->belongsTo(MedicineStockIn::class, 'stock_in_id');
    }

    public function archivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'archived_by');
    }
}