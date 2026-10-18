<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BranchRequestController;
use App\Http\Controllers\Api\V1\CampusController;
use App\Http\Controllers\Api\V1\ConsultationController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\MedicineController;
use App\Http\Controllers\Api\V1\MessageController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PatientController;
use App\Http\Controllers\Api\V1\PrescriptionController;
use App\Http\Controllers\Api\V1\ReferralController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', [HealthController::class, 'index']);

    Route::prefix('auth')->group(function (): void {
        Route::get('/google/redirect', [AuthController::class, 'googleRedirect'])->middleware('throttle:30,1');
        Route::get('/google/callback', [AuthController::class, 'googleCallback'])->middleware('throttle:20,1');
        Route::post('/staff/login', [AuthController::class, 'staffLogin'])->middleware('throttle:20,1');

        Route::middleware(['jwt', 'throttle:60,1'])->group(function (): void {
            Route::get('/me', [AuthController::class, 'me']);
            Route::post('/logout', [AuthController::class, 'logout']);
        });
    });

    Route::middleware(['jwt', 'throttle:200,1'])->group(function (): void {
        // ============================================================
        // System A - Existing Routes
        // ============================================================

        Route::middleware('role:nurse,coordinator,admin')->group(function (): void {
            Route::get('/patients', [PatientController::class, 'index']);
            Route::get('/patients/{patient}', [PatientController::class, 'show'])->whereNumber('patient');
            Route::get('/doctors', [UserController::class, 'doctors']);
            Route::patch('/consultations/{consultation}', [ConsultationController::class, 'update']);
            Route::post('/referrals', [ReferralController::class, 'store']);
            Route::post('/reports/ai-summary', [ReportController::class, 'aiSummary'])->middleware('throttle:10,1');
        });

        Route::middleware('role:doctor,nurse,coordinator,admin')->group(function (): void {
            Route::get('/history-log', [AuditLogController::class, 'historyForCampus']);
            Route::get('/campuses', [CampusController::class, 'index']);
        });

        Route::middleware('role:student,employee')->group(function (): void {
            Route::post('/patients', [PatientController::class, 'store']);
            Route::get('/patients/me', [PatientController::class, 'me']);
            Route::patch('/patients/me', [PatientController::class, 'updateMe']);
        });

        // Consultations - create: all roles can submit
        Route::middleware('role:student,employee,nurse,admin')->group(function (): void {
            Route::post('/consultations', [ConsultationController::class, 'store']);
        });

        Route::middleware('role:student,employee,nurse,doctor,admin')->group(function (): void {
            Route::get('/consultations', [ConsultationController::class, 'index']);
            Route::get('/consultations/{consultation}', [ConsultationController::class, 'show']);
        });

        Route::middleware('role:nurse,coordinator,doctor,admin')->group(function (): void {
            Route::get('/referrals', [ReferralController::class, 'index']);
            Route::patch('/referrals/{referral}', [ReferralController::class, 'update']);
            Route::get('/referrals/{referral}', [ReferralController::class, 'show']);
        });

        // ============================================================
        // Notifications — accessible to nurse, doctor, admin
        // ============================================================
        Route::middleware('role:nurse,coordinator,doctor,admin')->group(function (): void {
            Route::get('/notifications', [NotificationController::class, 'index']);
            Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
            Route::post('/notifications/mark-read', [NotificationController::class, 'markRead']);
            Route::post('/notifications/{auditLog}/read', [NotificationController::class, 'markOneRead'])->whereNumber('auditLog');
        });

        Route::middleware('role:admin')->group(function (): void {
            Route::get('/audit-logs', [AuditLogController::class, 'index']);
            Route::get('/users', [UserController::class, 'index'])->middleware('throttle:30,1');
            Route::patch('/users/{user}/role', [UserController::class, 'updateRole'])
                ->whereNumber('user')
                ->middleware('throttle:10,1');
            Route::post('/users', [UserController::class, 'store'])
                ->middleware('throttle:10,1');
            Route::patch('/users/{user}', [UserController::class, 'update'])
                ->whereNumber('user')
                ->middleware('throttle:10,1');
            Route::patch('/users/{user}/password', [UserController::class, 'resetPassword'])
                ->whereNumber('user')
                ->middleware('throttle:10,1');
            Route::delete('/users/{user}', [UserController::class, 'destroy'])
                ->whereNumber('user')
                ->middleware('throttle:10,1');
        });

        // ============================================================
        // System B - New Inventory Routes (merged into System A)
        // ============================================================

        // Medicines — read access for clinical staff
        Route::middleware('role:nurse,coordinator,admin,doctor')->group(function (): void {
            Route::get('/medicines', [MedicineController::class, 'index']);
            Route::get('/medicines/stock-out', [MedicineController::class, 'stockOut']);
            Route::get('/medicines/{medicine}', [MedicineController::class, 'show']);
        });

        // Chat / Messages — accessible to nurse, doctor, admin
        Route::middleware('role:nurse,coordinator,doctor,admin')->group(function (): void {
            Route::get('/messages/contacts', [MessageController::class, 'contacts']);
            Route::get('/messages/thread/{user}', [MessageController::class, 'thread'])->whereNumber('user');
            Route::post('/messages', [MessageController::class, 'store']);
            Route::post('/messages/read/{user}', [MessageController::class, 'markRead'])->whereNumber('user');
            Route::get('/messages/unread-count', [MessageController::class, 'unreadCount']);
        });

        // Medicines — write access for nurse + admin only
        Route::middleware('role:nurse,coordinator,admin')->group(function (): void {
            Route::post('/medicines', [MedicineController::class, 'store']);
            Route::patch('/medicines/{medicine}', [MedicineController::class, 'update']);
            Route::delete('/medicines/{medicine}', [MedicineController::class, 'destroy']);
        });

        // Inventory operations — READ access for doctor, nurse, admin
        Route::middleware('role:doctor,nurse,coordinator,admin')->group(function (): void {
            Route::get('/inventory/available', [InventoryController::class, 'available']);
            Route::get('/inventory/low-stock', [InventoryController::class, 'lowStock']);
            Route::get('/inventory/expiring-soon', [InventoryController::class, 'expiringSoon']);
        });

        // Inventory operations — WRITE access for nurse + admin only
        Route::middleware('role:nurse,coordinator,admin')->group(function (): void {
            Route::post('/inventory/stock-in', [InventoryController::class, 'stockIn']);
            Route::post('/inventory/dispense', [InventoryController::class, 'dispense']);
            Route::post('/inventory/archive', [InventoryController::class, 'archive']);

            // Archived medicines management
            Route::get('/inventory/archived', [InventoryController::class, 'archived']);
            Route::post('/inventory/archived/{id}/restore', [InventoryController::class, 'restoreArchived'])->whereNumber('id');
            Route::delete('/inventory/archived/{id}', [InventoryController::class, 'deleteArchived'])->whereNumber('id');
        });

        // Branch requests — READ access for doctor, nurse, admin
        Route::middleware('role:doctor,nurse,coordinator,admin')->group(function (): void {
            Route::get('/branch-requests', [BranchRequestController::class, 'index']);
            Route::get('/branch-requests/{branchRequest}', [BranchRequestController::class, 'show']);
        });

        // Branch requests — WRITE access for nurse + admin only
        Route::middleware('role:nurse,coordinator,admin')->group(function (): void {
            Route::post('/branch-requests', [BranchRequestController::class, 'store']);
            Route::patch('/branch-requests/{branchRequest}/approve', [BranchRequestController::class, 'approve']);
            Route::patch('/branch-requests/{branchRequest}/reject', [BranchRequestController::class, 'reject']);
            Route::patch('/branch-requests/{branchRequest}/complete', [BranchRequestController::class, 'complete']);
        });

        // Prescriptions — doctor creates & cancels
        Route::middleware('role:doctor,admin')->group(function (): void {
            Route::post('/prescriptions', [PrescriptionController::class, 'store']);
            Route::patch('/prescriptions/{prescription}/cancel', [PrescriptionController::class, 'cancel']);
        });

        // Prescriptions — nurse dispenses
        Route::middleware('role:nurse,coordinator,admin')->group(function (): void {
            Route::patch('/prescriptions/{prescription}/dispense', [PrescriptionController::class, 'dispense']);
        });

        // Prescriptions — read access for clinical staff
        Route::middleware('role:nurse,coordinator,doctor,admin')->group(function (): void {
            Route::get('/prescriptions', [PrescriptionController::class, 'index']);
            Route::get('/prescriptions/{prescription}', [PrescriptionController::class, 'show']);
        });
    });
});