<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table): void {
            $table->unsignedTinyInteger('age')->nullable()->after('birth_date');
            $table->string('address')->nullable()->after('age');
            $table->string('emergency_contact_relationship', 100)->nullable()->after('emergency_contact_number');

            $table->text('allergies')->nullable()->after('emergency_contact_relationship');
            $table->text('existing_medical_condition')->nullable()->after('allergies');
            $table->boolean('with_maintenance_medicine')->nullable()->after('existing_medical_condition');
            $table->text('notes')->nullable()->after('with_maintenance_medicine');

            $table->string('student_level', 20)->nullable()->after('notes');
            $table->string('student_id_number', 40)->nullable()->after('student_level');
            $table->string('grade_level', 40)->nullable()->after('student_id_number');
            $table->string('section', 80)->nullable()->after('grade_level');
            $table->string('parent_guardian_name', 120)->nullable()->after('section');
            $table->string('parent_contact_number', 30)->nullable()->after('parent_guardian_name');
            $table->string('parent_address')->nullable()->after('parent_contact_number');
            $table->string('immunization_status', 20)->nullable()->after('parent_address');
            $table->boolean('fit_for_school')->nullable()->after('immunization_status');
            $table->text('special_health_concern')->nullable()->after('fit_for_school');

            $table->string('course_program', 120)->nullable()->after('special_health_concern');
            $table->string('year_level', 20)->nullable()->after('course_program');
            $table->boolean('working_student')->nullable()->after('year_level');

            $table->string('employee_id', 40)->nullable()->after('working_student');
            $table->string('employee_type', 30)->nullable()->after('employee_id');
            $table->string('office_unit_department', 120)->nullable()->after('employee_type');
            $table->string('position_job_title', 120)->nullable()->after('office_unit_department');
            $table->string('employment_status', 30)->nullable()->after('position_job_title');
            $table->boolean('fit_to_work')->nullable()->after('employment_status');
            $table->string('blood_type', 5)->nullable()->after('fit_to_work');
            $table->string('philhealth_number', 40)->nullable()->after('blood_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table): void {
            $table->dropColumn([
                'age',
                'address',
                'emergency_contact_relationship',
                'allergies',
                'existing_medical_condition',
                'with_maintenance_medicine',
                'notes',
                'student_level',
                'student_id_number',
                'grade_level',
                'section',
                'parent_guardian_name',
                'parent_contact_number',
                'parent_address',
                'immunization_status',
                'fit_for_school',
                'special_health_concern',
                'course_program',
                'year_level',
                'working_student',
                'employee_id',
                'employee_type',
                'office_unit_department',
                'position_job_title',
                'employment_status',
                'fit_to_work',
                'blood_type',
                'philhealth_number',
            ]);
        });
    }
};
