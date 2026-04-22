$ErrorActionPreference = 'Continue'
$root = 'C:\Users\Dimax\Documents\claude-workspace\tiktok-clone\ultronos-desktop'
Set-Location $root

$logDir = Join-Path $root '.overnight-plan'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'ultronos.log'
$nextLog = Join-Path $logDir 'next.log'

function Test-Next {
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3100' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return $r.StatusCode -eq 200
    } catch { return $false }
}

Add-Content $log "[$(Get-Date)] launcher started"

if (-not (Test-Next)) {
    Add-Content $log "[$(Get-Date)] starting Next dev server"
    $next = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', "cd /d `"$root\renderer`" && npx next dev -p 3100 >> `"$nextLog`" 2>&1" `
        -WindowStyle Hidden -PassThru
    Add-Content $log "[$(Get-Date)] Next PID=$($next.Id)"

    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Next) { break }
    }
    if (-not (Test-Next)) {
        Add-Content $log "[$(Get-Date)] ERROR: Next failed to start within 60s"
        [System.Windows.Forms.MessageBox]::Show('Next.js dev server failed to start. Check .overnight-plan\next.log', 'ULTRONOS Error')
        exit 1
    }
    Add-Content $log "[$(Get-Date)] Next ready"
} else {
    Add-Content $log "[$(Get-Date)] Next already running"
}

Add-Content $log "[$(Get-Date)] launching Electron"
$env:ULTRONOS_DEV_URL = 'http://127.0.0.1:3100'
Start-Process -FilePath "$root\node_modules\.bin\electron.cmd" -ArgumentList '.' -WorkingDirectory $root
Add-Content $log "[$(Get-Date)] Electron spawned"
