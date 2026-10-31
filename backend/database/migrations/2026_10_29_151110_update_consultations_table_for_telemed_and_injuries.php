<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            // consultation_type already exists in your model, so we just add the telemed/referral fields
            $table->boolean('is_telemed')->default(false)->after('status');
            $table->string('telemed_link')->nullable()->after('is_telemed');
            $table->string('referral_status')->default('none')->after('telemed_link');
            $table->text('referral_notes')->nullable()->after('referral_status');
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn(['is_telemed', 'telemed_link', 'referral_status', 'referral_notes']);
        });
    }
};