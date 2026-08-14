# ============================================================
# GO-LIVE: bring the REAL app back online after payment.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\go-live.ps1
# Requirements: Vercel CLI (npm i -g vercel), VERCEL_TOKEN in .env
# ============================================================
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)   # repo root

# 0. Read the Vercel token from .env
$env:VERCEL_TOKEN = (Select-String -Path '.env' -Pattern '^VERCEL_TOKEN=(.+)$').Matches[0].Groups[1].Value.Trim()
if (-not $env:VERCEL_TOKEN) { throw 'VERCEL_TOKEN not found in .env' }

# 1. Unpause the project FIRST (deploys are blocked while paused)
Write-Host '[1/5] Unpausing the Vercel project...' -ForegroundColor Cyan
Invoke-RestMethod -Method Delete -Uri 'https://api.vercel.com/v9/projects/prj_L5I2lAwuOoSesoTm7JM1EUpztcCi/pause' -Headers @{ Authorization = "Bearer $env:VERCEL_TOKEN" } -ErrorAction SilentlyContinue | Out-Null

# 2. Restore the real app entry page (undo the fake database-error page if present)
git checkout -- client/index.html 2>$null
Write-Host '[2/5] Real index.html confirmed.' -ForegroundColor Green

# 3. Optional: bump the service-worker cache so installed PWAs refresh cleanly
$sw = 'client/public/sw.js'
if (Test-Path $sw) {
  (Get-Content $sw -Raw) -replace "aditya-erp-v\d+", ('aditya-erp-v' + (Get-Date).ToString('yyyyMMdd')) | Set-Content $sw -NoNewline
  Write-Host '[3/5] Service worker cache bumped.' -ForegroundColor Green
}

# 4. Build + deploy the real app to production
Write-Host '[4/5] Building client...' -ForegroundColor Cyan
Push-Location client
  npm run build
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Build failed' }
Pop-Location
vercel --prod --yes
if ($LASTEXITCODE -ne 0) { throw 'Deploy failed' }

# 5. Reconnect git so future pushes auto-deploy again
vercel git connect https://github.com/aryaanchavan1-commits/aditya-enterprises.git 2>$null
Write-Host '[5/5] Git reconnected - future pushes auto-deploy.' -ForegroundColor Green

Write-Host ''
Write-Host 'DONE. The real app is live again at:' -ForegroundColor Green
Write-Host '  https://aditya-enterprises-erp.vercel.app' -ForegroundColor White
Write-Host 'Give it 1-2 minutes for the deploy to finish, then hard-refresh.' -ForegroundColor DarkGray
