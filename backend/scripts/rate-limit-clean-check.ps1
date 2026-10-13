Set-Location "$PSScriptRoot\.."

$targets = @(
  @{ Name = 'Google Callback'; Url = 'http://localhost:8000/api/v1/auth/google/callback' },
  @{ Name = 'Google Redirect'; Url = 'http://localhost:8000/api/v1/auth/google/redirect?json=1' }
)

$waitSeconds = 62 - (Get-Date).Second
if ($waitSeconds -lt 1) {
  $waitSeconds = 1
}

Write-Output "Waiting $waitSeconds second(s) for a clean limiter window..."
Start-Sleep -Seconds $waitSeconds

foreach ($target in $targets) {
  $raw = curl.exe -s -D - -o NUL $target.Url
  $lines = $raw -split "`r?`n"

  $status = ($lines | Where-Object { $_ -match '^HTTP/' } | Select-Object -Last 1)
  $limit = ($lines | Where-Object { $_ -match '^X-RateLimit-Limit:' } | Select-Object -Last 1)
  $remaining = ($lines | Where-Object { $_ -match '^X-RateLimit-Remaining:' } | Select-Object -Last 1)
  $retry = ($lines | Where-Object { $_ -match '^Retry-After:' } | Select-Object -Last 1)

  if (-not $status) { $status = 'HTTP: n/a' }
  if (-not $limit) { $limit = 'X-RateLimit-Limit: n/a' }
  if (-not $remaining) { $remaining = 'X-RateLimit-Remaining: n/a' }
  if (-not $retry) { $retry = 'Retry-After: n/a' }

  Write-Output ''
  Write-Output "[$($target.Name)]"
  Write-Output $status
  Write-Output $limit
  Write-Output $remaining
  Write-Output $retry
}
