$Root = 'D:\Projects\UIC_Merged'
$Be = "$Root\backend"
$Fe = "$Root\frontend"

function Check-Risk($id, $desc, $testBlock) {
    Write-Host "`nRISK-$id : $desc" -ForegroundColor Cyan
    $results = & $testBlock
    if ($results -contains $false) {
        Write-Host "  [FAIL] Fix not detected or incomplete." -ForegroundColor Red
    } else {
        Write-Host "  [PASS] Fix is present in the code." -ForegroundColor Green
    }
}

function Has-Text($path, $pattern) {
    if (-not (Test-Path $path)) { return $false }
    return (Select-String -Path $path -Pattern $pattern -SimpleMatch -Quiet)
}

Check-Risk "01" "Duplicate consultation route (Nurse 403)" {
    $count = (Select-String -Path "$Be\routes\api.php" -Pattern "Route::post\('/consultations'" -SimpleMatch).Count
    Write-Host "  -> Routes found: $count (Expected: 1)" -ForegroundColor DarkGray
    return $count -eq 1
}

Check-Risk "02" "Coordinator permissions" {
    $hasCoordinator = (Select-String -Path "$Be\routes\api.php" -Pattern "role:nurse,coordinator,admin" -SimpleMatch).Count -gt 0
    $hasFeCoordinator = (Select-String -Path "$Fe\src\App.tsx" -Pattern "roles={['nurse', 'coordinator', 'admin']}" -SimpleMatch).Count -gt 0
    Write-Host "  -> Backend role: $hasCoordinator | Frontend role: $hasFeCoordinator" -ForegroundColor DarkGray
    return ($hasCoordinator -and $hasFeCoordinator)
}

Check-Risk "03" "Notification whitelist mismatch" {
    $hasCorrectLog = (Select-String -Path "$Be\app\Http\Controllers\Api\V1\NotificationController.php" -Pattern "'inventory.stocked_in'" -SimpleMatch).Count -gt 0
    Write-Host "  -> Whitelist has 'inventory.stocked_in': $hasCorrectLog" -ForegroundColor DarkGray
    return $hasCorrectLog
}

Check-Risk "04" "Notification unread count campus scoping" {
    $hasScoping = (Select-String -Path "$Be\app\Http\Controllers\Api\V1\NotificationController.php" -Pattern "whereIn('log_id', `$logIds)" -SimpleMatch).Count -gt 0
    Write-Host "  -> Scoped query found: $hasScoping" -ForegroundColor DarkGray
    return $hasScoping
}

Check-Risk "05" "Cross-campus inventory authorization" {
    $hasAuth = (Select-String -Path "$Be\app\Http\Controllers\Api\V1\InventoryController.php" -Pattern "authorizeCampus" -SimpleMatch).Count -gt 0
    Write-Host "  -> authorizeCampus method used: $hasAuth" -ForegroundColor DarkGray
    return $hasAuth
}

Check-Risk "06" "Doctor UI for prescriptions" {
    $hasPrescriptionUi = (Select-String -Path "$Fe\src\pages\DoctorReferralsPage.tsx" -Pattern "Add Medicine" -SimpleMatch).Count -gt 0
    Write-Host "  -> Prescription UI found: $hasPrescriptionUi" -ForegroundColor DarkGray
    return $hasPrescriptionUi
}

Check-Risk "07" "Prescription invalid ID/batch constraints" {
    $hasConsultCheck = Has-Text "$Be\app\Services\Clinic\PrescriptionService.php" "Consultation not found."
    $hasMedicineCheck = Has-Text "$Be\app\Services\Clinic\PrescriptionService.php" "The selected stock batch does not match"
    Write-Host "  -> ID checks: $hasConsultCheck | Batch checks: $hasMedicineCheck" -ForegroundColor DarkGray
    return ($hasConsultCheck -and $hasMedicineCheck)
}

Check-Risk "08" "User delete 500 error handling" {
    $hasTryCatch = Has-Text "$Be\app\Http\Controllers\Api\V1\UserController.php" "FOREIGN KEY constraint failed"
    Write-Host "  -> Try/catch for FK constraint found: $hasTryCatch" -ForegroundColor DarkGray
    return $hasTryCatch
}

Check-Risk "09" "Branch request stock movement" {
    $hasMovement = Has-Text "$Be\app\Services\Clinic\BranchRequestService.php" '$this->inventoryService->dispense'
    Write-Host "  -> Inventory movement logic found: $hasMovement" -ForegroundColor DarkGray
    return $hasMovement
}

Check-Risk "11" "Case-insensitive email duplicate" {
    $hasCaseCheck = Has-Text "$Be\app\Http\Controllers\Api\V1\UserController.php" 'User::where(''email'', $normalizedEmail)->exists()'
    Write-Host "  -> Case-insensitive check found: $hasCaseCheck" -ForegroundColor DarkGray
    return $hasCaseCheck
}

Check-Risk "13" "Logout endpoint & URL token leak" {
    $hasEndpoint = Has-Text "$Be\routes\api.php" "auth/logout"
    $hasUrlClear = Has-Text "$Fe\src\pages\AuthCallbackPage.tsx" "window.history.replaceState"
    Write-Host "  -> Logout route: $hasEndpoint | URL clear: $hasUrlClear" -ForegroundColor DarkGray
    return ($hasEndpoint -and $hasUrlClear)
}

Check-Risk "18" "Archived stock resurrection" {
    $hasMathFix = Has-Text "$Be\app\Services\Clinic\InventoryService.php" '$newQuantity = max(0, (int) $stockIn->quantity - $quantity);'
    Write-Host "  -> Math fix (subtracting deleted quantity) found: $hasMathFix" -ForegroundColor DarkGray
    return $hasMathFix
}