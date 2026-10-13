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
        Schema::create('consultations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('nurse_id')->nullable()->constrained('users')->noActionOnDelete();
            $table->string('consultation_type', 20);
            $table->string('status', 40)->default('pending_consultation');
            $table->text('chief_complaint');
            $table->text('symptoms')->nullable();
            $table->text('triage_notes')->nullable();
            $table->boolean('referred_to_doctor')->default(false);
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'submitted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('consultations');
    }
};
