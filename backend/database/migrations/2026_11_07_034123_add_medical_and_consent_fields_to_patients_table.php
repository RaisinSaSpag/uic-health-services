<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            // General Medical & Contacts
            $table->string('parent_secondary_contact_number', 30)->nullable()->after('parent_contact_number');
            $table->text('current_medications')->nullable()->after('with_maintenance_medicine');
            $table->text('medication_instructions')->nullable()->after('current_medications');
            $table->string('preferred_hospital', 120)->nullable()->after('emergency_contact_relationship');

            // Junior High School (JHS) Specific
            $table->text('growth_pubertal_disclosure')->nullable();
            $table->boolean('self_carry_permit')->nullable();
            $table->boolean('extracurricular_clearance')->nullable();
            $table->boolean('counseling_authorization')->nullable();

            // Senior High School (SHS) Specific
            $table->boolean('otc_consent_given')->nullable();
            $table->boolean('sports_clearance')->nullable();
            $table->text('hazard_disclosure')->nullable();
            $table->boolean('work_immersion_clearance')->nullable();
            $table->boolean('self_consent_18plus')->nullable();

            // College Specific
            $table->boolean('immunization_titer_proof')->nullable();
            $table->boolean('ferpa_hipaa_waiver')->nullable();
            $table->text('dorm_housing_profile')->nullable();
            $table->text('substance_abuse_history')->nullable();
            $table->string('insurance_provider', 120)->nullable();
            $table->string('insurance_policy_number', 80)->nullable();

            // E-Signature & Audit Trail (For Minors)
            $table->text('guardian_signature_base64')->nullable();
            $table->string('guardian_printed_name', 120)->nullable();
            $table->string('guardian_relationship', 50)->nullable();
            $table->string('signature_ip_address', 45)->nullable();
            $table->timestamp('signature_timestamp')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn([
                'parent_secondary_contact_number',
                'current_medications',
                'medication_instructions',
                'preferred_hospital',
                'growth_pubertal_disclosure',
                'self_carry_permit',
                'extracurricular_clearance',
                'counseling_authorization',
                'otc_consent_given',
                'sports_clearance',
                'hazard_disclosure',
                'work_immersion_clearance',
                'self_consent_18plus',
                'immunization_titer_proof',
                'ferpa_hipaa_waiver',
                'dorm_housing_profile',
                'substance_abuse_history',
                'insurance_provider',
                'insurance_policy_number',
                'guardian_signature_base64',
                'guardian_printed_name',
                'guardian_relationship',
                'signature_ip_address',
                'signature_timestamp',
            ]);
        });
    }
};