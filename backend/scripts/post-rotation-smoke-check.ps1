param(
  [string]$BaseUrl = 'http://localhost:8000',
  [string]$BearerToken = $env:HSMS_BEARER_TOKEN,
  [switch]$VerboseOutput
)

Set-Location "$PSScriptRoot\.."

function Invoke-HeaderCheck {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url,
    [string[]]$RequiredHeaders = @(),
    [int[]]$ExpectedStatus = @(200)
  )

  $raw = curl.exe -s -D - -o NUL $Url
  $lines = $raw -split "`r?`n"

  $statusLine = ($lines | Where-Object { $_ -match '^HTTP/' } | Select-Object -Last 1)
  $code = 0
  if ($statusLine -match '^HTTP/\S+\s+(\d+)') {
    $code = [int]$Matches[1]
  }

  $statusPass = $ExpectedStatus -contains $code

  $missingHeaders = @()
  foreach ($header in $RequiredHeaders) {
    $hasHeader = $lines | Where-Object { $_ -match ('^' + [Regex]::Escape($header) + ':') } | Select-Object -First 1
    if (-not $hasHeader) {
      $missingHeaders += $header
    }
  }

  $headerPass = $missingHeaders.Count -eq 0
  $pass = $statusPass -and $headerPass

  [PSCustomObject]@{
    Test = $Name
    Url = $Url
    Status = if ($statusLine) { $statusLine } else { 'HTTP: n/a' }
    Expected = ($ExpectedStatus -join ',')
    MissingHeaders = if ($missingHeaders.Count -gt 0) { $missingHeaders -join ', ' } else { '-' }
    Result = if ($pass) { 'PASS' } else { 'FAIL' }
  }
}

function Invoke-AuthApiCheck {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int[]]$ExpectedStatus,
    [string]$Token
  )

  $headers = @('-s', '-D', '-', '-o', 'NUL')
  if ($Token) {
    $headers += @('-H', "Authorization: Bearer $Token")
  }

  $raw = curl.exe @headers $Url
  $lines = $raw -split "`r?`n"
  $statusLine = ($lines | Where-Object { $_ -match '^HTTP/' } | Select-Object -Last 1)

  $code = 0
  if ($statusLine -match '^HTTP/\S+\s+(\d+)') {
    $code = [int]$Matches[1]
  }

  $pass = $ExpectedStatus -contains $code

  [PSCustomObject]@{
    Test = $Name
    Url = $Url
    Status = if ($statusLine) { $statusLine } else { 'HTTP: n/a' }
    Expected = ($ExpectedStatus -join ',')
    MissingHeaders = '-'
    Result = if ($pass) { 'PASS' } else { 'FAIL' }
  }
}

Write-Output "Running HSMS post-rotation smoke checks against $BaseUrl"
Write-Output ''

$results = @()

$results += Invoke-HeaderCheck -Name 'Health endpoint + security headers' `
  -Url "$BaseUrl/api/v1/health" `
  -ExpectedStatus @(200) `
  -RequiredHeaders @(
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Cross-Origin-Opener-Policy'
  )

$results += Invoke-HeaderCheck -Name 'OAuth redirect rate-limit headers' `
  -Url "$BaseUrl/api/v1/auth/google/redirect?json=1" `
  -ExpectedStatus @(200,302,429) `
  -RequiredHeaders @(
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining'
  )

if ($BearerToken) {
  $results += Invoke-AuthApiCheck -Name 'Protected profile endpoint with token' `
    -Url "$BaseUrl/api/v1/auth/me" `
    -ExpectedStatus @(200) `
    -Token $BearerToken
}
else {
  $results += Invoke-AuthApiCheck -Name 'Protected profile endpoint without token (expected unauthorized)' `
    -Url "$BaseUrl/api/v1/auth/me" `
    -ExpectedStatus @(401) `
    -Token ''
}

$results | Format-Table -AutoSize | Out-String | Write-Output

$failed = $results | Where-Object { $_.Result -eq 'FAIL' }
if ($failed.Count -gt 0) {
  Write-Output 'Smoke check result: FAIL'
  if ($VerboseOutput) {
    Write-Output ''
    Write-Output 'Failed checks:'
    $failed | Format-Table -AutoSize | Out-String | Write-Output
  }
  exit 1
}

Write-Output 'Smoke check result: PASS'
Write-Output ''
Write-Output 'Manual post-rotation checks still required:'
Write-Output '1. Complete Google OAuth login flow in frontend and verify role-based landing page.'
Write-Output '2. Create and update a patient/consultation/referral to verify DB write paths.'
Write-Output '3. Trigger AI summary endpoint from authenticated UI workflow.'
