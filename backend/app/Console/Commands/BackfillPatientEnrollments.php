<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillPatientEnrollments extends Command
{
    protected $signature = 'patients:backfill-enrollments';
    protected $description = 'Creates an initial enrollment for existing patients who do not have one';

    public function handle()
    {
        $patients = DB::table('patients')->get();
        $created = 0;

        $this->info("Found {$patients->count()} patients. Checking for missing enrollments...");

        foreach ($patients as $p) {
            // Check if they already have an enrollment
            $exists = DB::table('patient_enrollments')
                ->where('patient_id', $p->id)
                ->exists();

            if (! $exists) {
                $category = $p->patient_category ?? 'college';
                
                DB::table('patient_enrollments')->insert([
                    'patient_id' => $p->id,
                    'campus_id' => $p->campus_id,
                    'category' => $category,
                    'student_level' => $p->student_level ?? 'college',
                    'grade_level' => $p->grade_level,
                    'course_program' => $p->course_program,
                    'year_level' => $p->year_level,
                    'section' => $p->section,
                    'valid_from' => $p->created_at ?? now(),
                    'valid_to' => null,
                    'is_current' => true,
                    'change_reason' => 'backfill_initial',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $created++;
            }
        }

        $this->info("Successfully created {$created} new enrollment records.");
    }
}