<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campus_id')->constrained()->noActionOnDelete();

            // Academic / employment status for this validity window
            $table->string('category', 30);                      // grade_school | high_school | senior_high_school | college | employee
            $table->string('student_level', 20)->nullable();     // basic | college
            $table->string('grade_level', 40)->nullable();       // e.g. "Grade 7", "Grade 11"
            $table->string('course_program', 120)->nullable();
            $table->string('year_level', 20)->nullable();
            $table->string('section', 80)->nullable();
            $table->string('student_id_number', 40)->nullable();
            $table->string('employee_id', 40)->nullable();
            $table->string('employee_type', 30)->nullable();
            $table->string('office_unit_department', 120)->nullable();
            $table->string('position_job_title', 120)->nullable();
            $table->string('employment_status', 30)->nullable();

            // Validity window — SCD Type 2
            $table->date('valid_from');
            $table->date('valid_to')->nullable();                // NULL = still active
            $table->boolean('is_current')->default(true);

            // Provenance
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('change_reason', 100)->nullable();

            $table->timestamps();

            $table->index(['patient_id', 'is_current']);
            $table->index(['valid_from', 'valid_to']);
            $table->index(['category', 'campus_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_enrollments');
    }
};