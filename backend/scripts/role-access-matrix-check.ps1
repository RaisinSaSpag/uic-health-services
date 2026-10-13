param(
  [string]$BaseUrl = 'http://localhost:8000'
)

Set-Location "$PSScriptRoot\.."

$roleTokens = @{
  student = $env:HSMS_TOKEN_STUDENT
  employee = $env:HSMS_TOKEN_EMPLOYEE
  nurse = $env:HSMS_TOKEN_NURSE
  doctor = $env:HSMS_TOKEN_DOCTOR
  admin = $env:HSMS_TOKEN_ADMIN
}

$checks = @(
  @{ Name = 'Admin users list'; Method = 'GET'; Path = '/api/v1/users'; Allowed = @('admin') },
  @{ Name = 'Admin audit logs'; Method = 'GET'; Path = '/api/v1/audit-logs'; Allowed = @('admin') },
  @{ Name = 'Referrals list'; Method = 'GET'; Path = '/api/v1/referrals'; Allowed = @('nurse', 'doctor', 'admin') },
  @{ Name = 'Patients list'; Method = 'GET'; Path = '/api/v1/patients'; Allowed = @('nurse', 'admin') },
  @{ Name = 'Patient self profile'; Method = 'GET'; Path = '/api/v1/patients/me'; Allowed = @('student', 'employee') },
  @{ Name = 'Consultations list'; Method = 'GET'; Path = '/api/v1/consultations'; Allowed = @('student', 'employee', 'nurse', 'doctor', 'admin') },
  @{ Name = 'Doctors list'; Method = 'GET'; Path = '/api/v1/doctors'; Allowed = @('nurse', 'admin') }
)

function Invoke-StatusCode {
  param(
    [string]$Method,
    [string]$Url,
    [string]$Token
  )

  $args = @('-s', '-o', 'NUL', '-w', '%{http_code}', '-X', $Method)
  if ($Token) {
    $args += @('-H', "Authorization: Bearer $Token")
  }
  $args += $Url

  $codeText = (curl.exe @args)
  $code = 0
  [void][int]::TryParse($codeText, [ref]$code)
  return $code
}

function Get-ExpectedResult {
  param(
    [string]$Role,
    [string[]]$AllowedRoles
  )

  if ($AllowedRoles -contains $Role) {
    return 'ALLOW'
  }

  return 'DENY'
}

$results = @()

foreach ($check in $checks) {
  $url = "$BaseUrl$($check.Path)"

  foreach ($role in @('student', 'employee', 'nurse', 'doctor', 'admin')) {
    $token = $roleTokens[$role]
    $expected = Get-ExpectedResult -Role $role -AllowedRoles $check.Allowed

    if (-not $token) {
      $results += [PSCustomObject]@{
        Endpoint = $check.Name
        Role = $role
        Method = $check.Method
        Status = 'n/a'
        Expected = $expected
        Result = 'SKIPPED (missing token)'
      }
      continue
    }

    $statusCode = Invoke-StatusCode -Method $check.Method -Url $url -Token $token

    $isPass = $false
    if ($expected -eq 'ALLOW') {
      # For allowed roles we only require that request is not rejected by auth/role middleware.
      $isPass = ($statusCode -ne 401 -and $statusCode -ne 403)
    }
    else {
      $isPass = ($statusCode -eq 403)
    }

    $results += [PSCustomObject]@{
      Endpoint = $check.Name
      Role = $role
      Method = $check.Method
      Status = $statusCode
      Expected = $expected
      Result = if ($isPass) { 'PASS' } else { 'FAIL' }
    }
  }
}

Write-Output "Running role access matrix checks against $BaseUrl"
Write-Output ''
$results | Format-Table -AutoSize | Out-String | Write-Output

$failed = @($results | Where-Object { $_.Result -eq 'FAIL' })
$skipped = @($results | Where-Object { $_.Result -like 'SKIPPED*' })

Write-Output ''
Write-Output ("Summary: PASS={0} FAIL={1} SKIPPED={2}" -f (@($results | Where-Object { $_.Result -eq 'PASS' }).Count), $failed.Count, $skipped.Count)

if ($failed.Count -gt 0) {
  exit 1
}

exit 0
