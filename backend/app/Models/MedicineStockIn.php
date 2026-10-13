<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicineStockIn extends Model
{
    use HasFactory;

    protected $table = 'medicine_stock_in';

    protected $fillable = [
        'medicine_id',
        'campus_id',
        'quantity',
        'date_received',
        'expiration_date',
        'received_by',
    ];

    protected function casts(): array
    {
        return [
            'date_received' => 'date',
            'expiration_date' => 'date',
        ];
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class);
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function stockOuts(): HasMany
    {
        return $this->hasMany(MedicineStockOut::class, 'stock_in_id');
    }

    public function archived(): HasMany
    {
        return $this->hasMany(MedicineArchived::class, 'stock_in_id');
    }
}