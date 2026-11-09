<?php

namespace Database\Seeders;

use App\Models\Campus;
use App\Models\Medicine;
use App\Models\MedicineStockIn;
use App\Models\User;
use Illuminate\Database\Seeder;

class DummyMedicineSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Get the first campus and a nurse to attribute the stock to
        $campus = Campus::first();
        $nurse = User::whereHas('role', fn($q) => $q->where('name', 'nurse'))->first();

        if (!$campus || !$nurse) {
            $this->command->error("Please ensure you have at least one campus and one nurse in the database.");
            return;
        }

        // 2. Define our test medicines
        $medicines = [
            ['name' => 'Paracetamol 500mg', 'category' => 'Pain Relief', 'qty' => 500],
            ['name' => 'Amoxicillin 500mg', 'category' => 'Antibiotic', 'qty' => 200],
            ['name' => 'Biogesic 500mg', 'category' => 'Fever', 'qty' => 300],
            ['name' => 'Cetirizine 10mg', 'category' => 'Antihistamine', 'qty' => 150],
            ['name' => 'Losartan 50mg', 'category' => 'Hypertension', 'qty' => 100],
            ['name' => 'Salbutamol Inhaler', 'category' => 'Asthma', 'qty' => 50],
            ['name' => 'Omeprazole 20mg', 'category' => 'Gastrointestinal', 'qty' => 80],
            ['name' => 'Vitamin C 500mg', 'category' => 'Supplement', 'qty' => 400],
            ['name' => 'Ibuprofen 400mg', 'category' => 'Pain Relief', 'qty' => 250],
            ['name' => 'Mefenamic Acid 500mg', 'category' => 'Pain Relief', 'qty' => 120],
        ];

        foreach ($medicines as $index => $med) {
            // Create the medicine in the catalog
            $medicine = Medicine::firstOrCreate(
                ['name' => $med['name']],
                ['category' => $med['category']]
            );

            // Create a Stock-In batch for this medicine
            // We stagger the expiration dates so you can test FIFO and Expiring Soon
            $expirationMonths = ($index % 3) + 1; // Will be 1, 2, or 3 months from now

            MedicineStockIn::create([
                'medicine_id' => $medicine->id,
                'campus_id' => $campus->id,
                'quantity' => $med['qty'],
                'date_received' => now()->toDateString(),
                'expiration_date' => now()->addMonths($expirationMonths)->toDateString(),
                'received_by' => $nurse->id,
            ]);
        }

        $this->command->info('✅ 10 Test Medicines and Stock-Ins created successfully!');
    }
}