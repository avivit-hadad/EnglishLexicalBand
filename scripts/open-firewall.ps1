# Run as Administrator: right-click -> Run with PowerShell (as admin)
$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
  Write-Host ''
  Write-Host 'Need Administrator rights to open Windows Firewall.' -ForegroundColor Yellow
  Write-Host 'Right-click this file -> Run as administrator' -ForegroundColor Yellow
  Write-Host ''
  Read-Host 'Press Enter to close'
  exit 1
}

$rules = @(
  @{ Name = 'Lexical Band Dev 5173'; Port = 5173 },
  @{ Name = 'Lexical Band Preview 4173'; Port = 4173 }
)

foreach ($r in $rules) {
  $existing = netsh advfirewall firewall show rule name="$($r.Name)" 2>$null
  if ($LASTEXITCODE -eq 0 -and $existing -match 'Rule Name') {
    Write-Host "Rule already exists: $($r.Name)" -ForegroundColor Green
  } else {
    netsh advfirewall firewall add rule name="$($r.Name)" dir=in action=allow protocol=TCP localport=$($r.Port) | Out-Null
    Write-Host "Added rule: $($r.Name) (port $($r.Port))" -ForegroundColor Green
  }
}

Write-Host ''
Write-Host 'Done. On your phone open the http://192.168.x.x:5173 URL from npm run dev' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Press Enter to close'
