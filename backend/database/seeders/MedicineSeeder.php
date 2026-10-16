<?php

namespace Database\Seeders;

use App\Models\Campus;
use App\Models\Medicine;
use App\Models\MedicineStockIn;
use App\Models\MedicineStockOut;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class MedicineSeeder extends Seeder
{
    public function run(): void
    {
        // -------- 1. Medicines --------
        $medicines = [
            ['name' => 'Paracetamol 500mg',       'category' => 'Analgesic'],
            ['name' => 'Ibuprofen 200mg',         'category' => 'Analgesic'],
            ['name' => 'Aspirin 100mg',           'category' => 'Analgesic'],
            ['name' => 'Amoxicillin 500mg',       'category' => 'Antibiotic'],
            ['name' => 'Azithromycin 500mg',      'category' => 'Antibiotic'],
            ['name' => 'Ciprofloxacin 500mg',     'category' => 'Antibiotic'],
            ['name' => 'Cetirizine 10mg',         'category' => 'Antihistamine'],
            ['name' => 'Loratadine 10mg',         'category' => 'Antihistamine'],
            ['name' => 'Diphenhydramine 25mg',    'category' => 'Antihistamine'],
            ['name' => 'Omeprazole 20mg',         'category' => 'Antacid'],
            ['name' => 'Aluminum Hydroxide',      'category' => 'Antacid'],
            ['name' => 'Metformin 500mg',         'category' => 'Antidiabetic'],
            ['name' => 'Amlodipine 5mg',          'category' => 'Antihypertensive'],
            ['name' => 'Losartan 50mg',           'category' => 'Antihypertensive'],
            ['name' => 'Salbutamol Inhaler',      'category' => 'Bronchodilator'],
            ['name' => 'Prednisone 5mg',          'category' => 'Corticosteroid'],
            ['name' => 'Vitamin C 500mg',         'category' => 'Vitamin'],
            ['name' => 'Ferrous Sulfate 325mg',   'category' => 'Supplement'],
        ];

        foreach ($medicines as $m) {
            Medicine::updateOrCreate(
                ['name' => $m['name']],
                ['category' => $m['category']]
            );
        }

        // -------- 2. Stock-ins across campuses --------
        $campuses = Campus::all();
        if ($campuses->isEmpty()) {
            $this->command->warn('No campuses found — skipping stock-ins.');
            return;
        }

        $nurseIds = User::whereHas('role', fn ($q) => $q->whereIn('name', ['nurse', 'admin']))
            ->pluck('id')
            ->toArray();

        if (empty($nurseIds)) {
            $this->command->warn('No nurse/admin users found — stock-ins will have null received_by.');
        }

        $allMedicines = Medicine::all();

        foreach ($campuses as $campus) {
            // Idempotency guard: skip campuses that already have 5+ stock-ins
            $existingCount = MedicineStockIn::where('campus_id', $campus->id)->count();
            if ($existingCount >= 5) {
                $this->command->line("Skipping campus {$campus->name} — already has {$existingCount} stock-ins.");
                continue;
            }

            // Give each campus 4–6 random medicines with stock
            $subset = $allMedicines->random(min(6, $allMedicines->count()));

            foreach ($subset as $medicine) {
                // Skip if this campus already has stock for this medicine
                $exists = MedicineStockIn::where('medicine_id', $medicine->id)
                    ->where('campus_id', $campus->id)
                    ->exists();

                if ($exists) {
                    continue;
                }

                MedicineStockIn::create([
                    'medicine_id' => $medicine->id,
                    'campus_id' => $campus->id,
                    'quantity' => random_int(30, 200),
                    'date_received' => Carbon::now()->subDays(random_int(1, 60)),
                    'expiration_date' => Carbon::now()->addMonths(random_int(6, 24)),
                    'received_by' => ! empty($nurseIds) ? $nurseIds[array_rand($nurseIds)] : null,
                ]);
            }
        }

        // -------- 3. Sample stock-outs (dispenses) --------
        // Idempotency guard: skip if we already have enough stock-outs
        if (MedicineStockOut::count() >= 12) {
            $this->command->line('Skipping stock-outs — 12 or more already exist.');
        } else {
            $stockIns = MedicineStockIn::where('quantity', '>', 10)->get();

            foreach ($stockIns->take(12) as $stockIn) {
                $dispenseQty = random_int(1, min(10, (int) $stockIn->quantity));

                $exists = MedicineStockOut::where('stock_in_id', $stockIn->id)->exists();
                if ($exists) {
                    continue;
                }

                MedicineStockOut::create([
                    'stock_in_id' => $stockIn->id,
                    'quantity_dispensed' => $dispenseQty,
                    'dispensed_by' => ! empty($nurseIds) ? $nurseIds[array_rand($nurseIds)] : null,
                    'dispensed_at' => Carbon::now()->subDays(random_int(1, 30)),
                ]);
            }
        }

        $this->command->info(sprintf(
            'Medicines: %d | Stock-ins: %d | Stock-outs: %d',
            Medicine::count(),
            MedicineStockIn::count(),
            MedicineStockOut::count()
        ));
    }
}