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
use App\Http\Controllers\Api\V1\PatientEnrollmentController;
use App\Http\Controllers\Api\V1\PrescriptionController;
use App\Http\Controllers\Api\V1\ReferralController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\AcademicTermController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', [HealthController::class, 'index']);

    Route::prefix('auth')->group(function (): void {
        // Staff login (Nurse, Doctor, Coordinator)
        Route::post('/staff/login', [AuthController::class, 'staffLogin'])->middleware('throttle:100,1');

        // Student/Employee login
        Route::post('/student/login', [AuthController::class, 'studentLogin'])->middleware('throttle:100,1');

        Route::middleware(['jwt', 'throttle:60,1'])->group(function (): void {
            Route::get('/me', [AuthController::class, 'me']);
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::post('/change-password', [AuthController::class, 'changePassword']);
        });
    });

    Route::middleware(['jwt', 'throttle:200,1', 'enforce.password'])->group(function (): void {

        // ============================================================
        // Patient Profile (Self-Service for Students/Employees)
        // ============================================================
        Route::middleware('role:student,employee')->group(function (): void {
            Route::get('/patients/me', [PatientController::class, 'me']);
            Route::patch('/patients/me', [PatientController::class, 'updateMe']);
        });

        // ============================================================
        // Patient & Consultation Routes (Walk-ins allowed for Nurses)
        // ============================================================
        Route::middleware('role:nurse,coordinator')->group(function (): void {
            Route::get('/patients', [PatientController::class, 'index']);
            Route::get('/patients/identify', [PatientController::class, 'identify']);
            Route::get('/patients/search', [PatientController::class, 'search']);
            
            // Enrollment Management
            Route::get('/patients/{patient}/enrollments', [PatientEnrollmentController::class, 'index']);
            Route::post('/patients/{patient}/enrollments/roll-up', [PatientEnrollmentController::class, 'rollUp']);
            Route::patch('/patients/{patient}/enrollments/{enrollment}', [PatientEnrollmentController::class, 'correct'])->whereNumber('enrollment');

            Route::get('/patients/{patient}', [PatientController::class, 'show'])->whereNumber('patient');
            Route::post('/patients', [PatientController::class, 'walkIn']);
            Route::post('/patients/quick-injury', [PatientController::class, 'quickInjuryLog']);
            Route::get('/doctors', [UserController::class, 'doctors']);
            Route::patch('/consultations/{consultation}', [ConsultationController::class, 'update']);
            Route::post('/referrals', [ReferralController::class, 'store']);
            Route::post('/reports/ai-summary', [ReportController::class, 'aiSummary'])->middleware('throttle:10,1');
        });

        // ============================================================
        // Consultations (Allowed for everyone including Students)
        // ============================================================
        Route::middleware('role:doctor,nurse,coordinator,student,employee')->group(function (): void {
            Route::get('/campuses', [CampusController::class, 'index']);
            Route::post('/consultations', [ConsultationController::class, 'store']);
            Route::get('/consultations', [ConsultationController::class, 'index']);
            Route::get('/consultations/{consultation}', [ConsultationController::class, 'show']);
        });

        // ============================================================
        // 🚨 AUDIT LOGS & ACADEMIC TERMS (Staff only)
        // ============================================================
        Route::middleware('role:nurse,coordinator,doctor')->group(function (): void {
            Route::get('/history-log', [AuditLogController::class, 'historyForCampus']);
            Route::get('/referrals', [ReferralController::class, 'index']);
            Route::patch('/referrals/{referral}', [ReferralController::class, 'update']);
            Route::get('/referrals/{referral}', [ReferralController::class, 'show']);
            
            // Allow staff to read academic terms (e.g., for the Nurse dashboard)
            Route::get('/academic-terms', [AcademicTermController::class, 'index']);
        });

        // ============================================================
        // Notifications
        // ============================================================
        Route::middleware('role:nurse,coordinator,doctor')->group(function (): void {
            Route::get('/notifications', [NotificationController::class, 'index']);
            Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
            Route::post('/notifications/mark-read', [NotificationController::class, 'markRead']);
            Route::post('/notifications/{auditLog}/read', [NotificationController::class, 'markOneRead'])->whereNumber('auditLog');
        });

        // ============================================================
        // Coordinator - Command Center & Management
        // ============================================================
        Route::middleware('role:coordinator')->group(function (): void {
            Route::get('/audit-logs', [AuditLogController::class, 'index']);
            Route::get('/reports/command-center', [ReportController::class, 'clinicCommandCenter']);
            Route::get('/reports/campus-detail/{campusCode}', [ReportController::class, 'campusDetail']);
            
            // Academic Terms Management
            Route::post('/academic-terms', [AcademicTermController::class, 'store']);
            Route::patch('/academic-terms/{term}/activate', [AcademicTermController::class, 'activate']);
            
            // User Management
            Route::get('/users', [UserController::class, 'index'])->middleware('throttle:30,1');
            Route::patch('/users/{user}/role', [UserController::class, 'updateRole'])->whereNumber('user')->middleware('throttle:10,1');
            Route::post('/users', [UserController::class, 'store'])->middleware('throttle:10,1');
            Route::patch('/users/{user}', [UserController::class, 'update'])->whereNumber('user')->middleware('throttle:10,1');
            Route::patch('/users/{user}/password', [UserController::class, 'resetPassword'])->whereNumber('user')->middleware('throttle:10,1');
            Route::delete('/users/{user}', [UserController::class, 'destroy'])->whereNumber('user')->middleware('throttle:10,1');
        });

        // ============================================================
        // Medicines Catalog — READ (Nurses + Coordinators + Doctors)
        // ============================================================
        Route::middleware('role:nurse,coordinator,doctor')->group(function (): void {
            Route::get('/medicines', [MedicineController::class, 'index']);
            Route::get('/medicines/stock-out', [MedicineController::class, 'stockOut']);
            Route::get('/medicines/{medicine}', [MedicineController::class, 'show']);
        });

        // ============================================================
        // Medicines Catalog — WRITE (Nurses + Coordinators)
        // ============================================================
        Route::middleware('role:nurse,coordinator')->group(function (): void {
            Route::post('/medicines', [MedicineController::class, 'store']);
            Route::patch('/medicines/{medicine}', [MedicineController::class, 'update']);
            Route::delete('/medicines/{medicine}', [MedicineController::class, 'destroy']);
        });

        // ============================================================
        // Inventory Management
        // ============================================================
        Route::middleware('role:nurse,coordinator')->group(function (): void {
            Route::get('/inventory/available', [InventoryController::class, 'available']);
            Route::get('/inventory/low-stock', [InventoryController::class, 'lowStock']);
            Route::get('/inventory/expiring-soon', [InventoryController::class, 'expiringSoon']);

            Route::post('/inventory/stock-in', [InventoryController::class, 'stockIn']);
            Route::post('/inventory/dispense', [InventoryController::class, 'dispense']);
            Route::post('/inventory/archive', [InventoryController::class, 'archive']);

            Route::get('/inventory/archived', [InventoryController::class, 'archived']);
            Route::post('/inventory/archived/{id}/restore', [InventoryController::class, 'restoreArchived'])->whereNumber('id');
            Route::delete('/inventory/archived/{id}', [InventoryController::class, 'deleteArchived'])->whereNumber('id');
        });

        // ============================================================
        // Branch Requests
        // ============================================================
        Route::middleware('role:nurse,coordinator')->group(function (): void {
            Route::get('/branch-requests', [BranchRequestController::class, 'index']);
            Route::get('/branch-requests/{branchRequest}', [BranchRequestController::class, 'show']);
            Route::post('/branch-requests', [BranchRequestController::class, 'store']);
            Route::patch('/branch-requests/{branchRequest}/approve', [BranchRequestController::class, 'approve']);
            Route::patch('/branch-requests/{branchRequest}/reject', [BranchRequestController::class, 'reject']);
            Route::patch('/branch-requests/{branchRequest}/complete', [BranchRequestController::class, 'complete']);
        });

        // ============================================================
        // Prescriptions
        // ============================================================
        Route::middleware('role:doctor')->group(function (): void {
            Route::post('/prescriptions', [PrescriptionController::class, 'store']);
            Route::patch('/prescriptions/{prescription}/cancel', [PrescriptionController::class, 'cancel']);
        });

        Route::middleware('role:nurse,coordinator')->group(function (): void {
            Route::patch('/prescriptions/{prescription}/dispense', [PrescriptionController::class, 'dispense']);
            Route::post('/prescriptions/{prescription}/dispense-fifo', [PrescriptionController::class, 'dispenseFifo']); // <-- NEW
            Route::post('/prescriptions/{prescription}/mark-unavailable', [PrescriptionController::class, 'markUnavailable']); // <-- NEW
        });

        Route::middleware('role:nurse,coordinator,doctor')->group(function (): void {
            Route::get('/prescriptions', [PrescriptionController::class, 'index']);
            Route::get('/prescriptions/{prescription}', [PrescriptionController::class, 'show']);
        });

        // ============================================================
        // Chat / Messages (Global Group Chat for All Staff)
        // ============================================================
        Route::middleware('role:nurse,coordinator,doctor')->group(function (): void {
            Route::get('/messages/group', [MessageController::class, 'groupThread']);
            Route::post('/messages/group', [MessageController::class, 'sendGroupMessage']);
        });

    });
});