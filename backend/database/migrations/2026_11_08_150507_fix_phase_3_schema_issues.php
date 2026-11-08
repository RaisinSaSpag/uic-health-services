<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 🚨 P3-10 FIX: Allow nurse_id to be null (for student self-referrals)
        Schema::table('medical_records', function (Blueprint $table) {
            $table->unsignedBigInteger('nurse_id')->nullable()->change();
        });

        // 🚨 P3-5 FIX: Add unique index to users.email
        try {
            Schema::table('users', function (Blueprint $table) {
                $table->unique('email');
            });
        } catch (\Exception $e) {
            // Index might already exist, ignore
        }

        // 🚨 P3-14 FIX: Add missing tracking columns to prescriptions
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->unsignedBigInteger('stock_in_id')->nullable()->after('dispensed_at');
            $table->timestamp('unavailable_at')->nullable()->after('dispensed_at');
            $table->timestamp('cancelled_at')->nullable()->after('dispensed_at');
        });
    }

    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->unsignedBigInteger('nurse_id')->nullable(false)->change();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['email']);
        });

        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropColumn(['stock_in_id', 'unavailable_at', 'cancelled_at']);
        });
    }
};