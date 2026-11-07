<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->string('consent_method', 30)->nullable()->after('guardian_relationship');
            $table->text('consent_notes')->nullable()->after('consent_method');
            $table->string('consent_contact_name', 120)->nullable()->after('consent_notes');
            $table->string('consent_contact_phone', 30)->nullable()->after('consent_contact_name');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn([
                'consent_method',
                'consent_notes',
                'consent_contact_name',
                'consent_contact_phone',
            ]);
        });
    }
};