<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF');
            
            Schema::create('patients_temp', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('campus_id')->constrained('campuses');
                $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
                $table->string('patient_number')->unique();
                $table->string('patient_type');
                $table->string('patient_category')->nullable();
                $table->string('sex')->nullable();
                $table->date('birth_date')->nullable();
                $table->string('address')->nullable();
                $table->string('contact_number')->nullable();
                $table->string('emergency_contact_name')->nullable();
                $table->string('emergency_contact_number')->nullable();
                $table->string('emergency_contact_relationship')->nullable();
                $table->text('allergies')->nullable();
                $table->text('existing_medical_condition')->nullable();
                $table->boolean('with_maintenance_medicine')->nullable();
                $table->text('notes')->nullable();
                $table->string('student_level')->nullable();
                $table->string('student_id_number')->nullable();
                $table->string('grade_level')->nullable();
                $table->string('section')->nullable();
                $table->string('parent_guardian_name')->nullable();
                $table->string('parent_contact_number')->nullable();
                $table->string('parent_address')->nullable();
                $table->string('immunization_status')->nullable();
                $table->boolean('fit_for_school')->nullable();
                $table->text('special_health_concern')->nullable();
                $table->string('course_program')->nullable();
                $table->string('year_level')->nullable();
                $table->boolean('working_student')->nullable();
                $table->string('employee_id')->nullable();
                $table->string('employee_type')->nullable();
                $table->string('office_unit_department')->nullable();
                $table->string('position_job_title')->nullable();
                $table->string('employment_status')->nullable();
                $table->boolean('fit_to_work')->nullable();
                $table->string('blood_type')->nullable();
                $table->string('philhealth_number')->nullable();
                $table->timestamps();
            });

            // Copy data explicitly (avoids SELECT * column mismatch)
            DB::statement('
                INSERT INTO patients_temp (
                    id, user_id, campus_id, department_id, patient_number, patient_type, 
                    patient_category, sex, birth_date, address, contact_number, 
                    emergency_contact_name, emergency_contact_number, emergency_contact_relationship, 
                    allergies, existing_medical_condition, with_maintenance_medicine, notes, 
                    student_level, student_id_number, grade_level, section, 
                    parent_guardian_name, parent_contact_number, parent_address, 
                    immunization_status, fit_for_school, special_health_concern, 
                    course_program, year_level, working_student, employee_id, 
                    employee_type, office_unit_department, position_job_title, 
                    employment_status, fit_to_work, blood_type, philhealth_number, 
                    created_at, updated_at
                ) 
                SELECT 
                    id, user_id, campus_id, department_id, patient_number, patient_type, 
                    patient_category, sex, birth_date, address, contact_number, 
                    emergency_contact_name, emergency_contact_number, emergency_contact_relationship, 
                    allergies, existing_medical_condition, with_maintenance_medicine, notes, 
                    student_level, student_id_number, grade_level, section, 
                    parent_guardian_name, parent_contact_number, parent_address, 
                    immunization_status, fit_for_school, special_health_concern, 
                    course_program, year_level, working_student, employee_id, 
                    employee_type, office_unit_department, position_job_title, 
                    employment_status, fit_to_work, blood_type, philhealth_number, 
                    created_at, updated_at
                FROM patients
            ');
            
            Schema::drop('patients');
            Schema::rename('patients_temp', 'patients');
            
            DB::statement('PRAGMA foreign_keys = ON');
            return;
        }

        Schema::table('patients', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        //
    }
};