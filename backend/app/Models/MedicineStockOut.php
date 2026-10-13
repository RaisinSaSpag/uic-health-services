<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicineStockOut extends Model
{
    use HasFactory;

    protected $table = 'medicine_stock_out';

    protected $fillable = [
        'stock_in_id',
        'quantity_dispensed',
        'dispensed_by',
        'dispensed_at',
    ];

    protected function casts(): array
    {
        return [
            'dispensed_at' => 'datetime',
        ];
    }

    public function stockIn(): BelongsTo
    {
        return $this->belongsTo(MedicineStockIn::class, 'stock_in_id');
    }

    public function dispensedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispensed_by');
    }
}