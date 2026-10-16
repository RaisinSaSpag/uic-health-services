<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fix dangerous FK cascade rules discovered in the merged schema.
     *
     * 1. prescriptions.prescribed_by: cascade → noAction
     *    Deleting a doctor should NOT delete their medical prescriptions (legal/medical retention).
     *
     * 2. medicine_stock_in.campus_id: cascade → noAction
     *    Deleting a campus should NOT wipe its stock history (audit retention).
     *
     * 3. branch_requests.from_campus_id / to_campus_id: cascade → noAction
     *    Deleting a campus should NOT erase its request history.
     *
     * 4. medical_records.finalized_at: NOT NULL → nullable
     *    Allows medical records to be created without a finalized timestamp until approval.
     */
    public function up(): void
    {
        // 1. prescriptions.prescribed_by
        Schema::table('prescriptions', function (Blueprint $table): void {
            $table->dropForeign(['prescribed_by']);
            $table->foreign('prescribed_by')
                ->references('id')
                ->on('users')
                ->noActionOnDelete();
        });

        // 2. medicine_stock_in.campus_id
        Schema::table('medicine_stock_in', function (Blueprint $table): void {
            $table->dropForeign(['campus_id']);
            $table->foreign('campus_id')
                ->references('id')
                ->on('campuses')
                ->noActionOnDelete();
        });

        // 3. branch_requests.from_campus_id + to_campus_id
        Schema::table('branch_requests', function (Blueprint $table): void {
            $table->dropForeign(['from_campus_id']);
            $table->foreign('from_campus_id')
                ->references('id')
                ->on('campuses')
                ->noActionOnDelete();

            $table->dropForeign(['to_campus_id']);
            $table->foreign('to_campus_id')
                ->references('id')
                ->on('campuses')
                ->noActionOnDelete();
        });

        // 4. medical_records.finalized_at → nullable
        Schema::table('medical_records', function (Blueprint $table): void {
            $table->timestamp('finalized_at')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Revert finalized_at to NOT NULL
        Schema::table('medical_records', function (Blueprint $table): void {
            $table->timestamp('finalized_at')->nullable(false)->change();
        });

        // Revert branch_requests FK rules
        Schema::table('branch_requests', function (Blueprint $table): void {
            $table->dropForeign(['from_campus_id']);
            $table->foreign('from_campus_id')
                ->references('id')
                ->on('campuses')
                ->cascadeOnDelete();

            $table->dropForeign(['to_campus_id']);
            $table->foreign('to_campus_id')
                ->references('id')
                ->on('campuses')
                ->cascadeOnDelete();
        });

        // Revert medicine_stock_in FK
        Schema::table('medicine_stock_in', function (Blueprint $table): void {
            $table->dropForeign(['campus_id']);
            $table->foreign('campus_id')
                ->references('id')
                ->on('campuses')
                ->cascadeOnDelete();
        });

        // Revert prescriptions FK
        Schema::table('prescriptions', function (Blueprint $table): void {
            $table->dropForeign(['prescribed_by']);
            $table->foreign('prescribed_by')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });
    }
};