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
        Schema::create('medical_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->noActionOnDelete();
            $table->foreignId('nurse_id')->constrained('users')->noActionOnDelete();
            $table->foreignId('doctor_id')->nullable()->constrained('users')->noActionOnDelete();
            $table->text('summary');
            $table->string('final_diagnosis');
            $table->text('treatment_plan');
            $table->text('prescription')->nullable();
            $table->date('follow_up_date')->nullable();
            $table->timestamp('finalized_at');
            $table->timestamps();

            $table->index('final_diagnosis');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('medical_records');
    }
};
