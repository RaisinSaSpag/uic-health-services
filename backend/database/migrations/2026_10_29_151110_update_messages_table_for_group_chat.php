<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->boolean('is_group_chat')->default(false)->after('recipient_id');
            // Make recipient_id nullable so group messages don't need a recipient
            $table->foreignId('recipient_id')->nullable()->change(); 
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('is_group_chat');
        });
    }
};