@echo off
setlocal
title Aditya ERP - Print Bridge Installer (run once)
cd /d "%~dp0"

echo ============================================
echo   Aditya ERP - USB Print Bridge Installer
echo   Run this ONCE on the Windows PC where the
echo   printer is plugged in. It installs the
echo   bridge AND the printer driver automatically.
echo ============================================
echo.

REM ---- 1. Make sure Node.js is installed ----
set NODE_CMD=node
where node >nul 2>nul
if %errorlevel%==0 (
  echo [1/5] Node.js found - good.
) else (
  echo [1/5] Node.js not found - installing it silently (takes about a minute)...
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements >nul 2>nul
  if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    echo       Installed.
  ) else (
    echo       Could not install Node.js automatically.
    echo       Please install it from https://nodejs.org then run this file again.
    pause
    exit /b 1
  )
)

REM ---- 2. Copy the bridge files into the app folder ----
set DEST=%LOCALAPPDATA%\AdityaPrintBridge
echo [2/5] Installing bridge to %DEST%
if not exist "%DEST%" mkdir "%DEST%"
copy /y "%~dp0bridge.js" "%DEST%" >nul
copy /y "%~dp0start-bridge.bat" "%DEST%" >nul
if exist "%~dp0config.json" copy /y "%~dp0config.json" "%DEST%" >nul

REM ---- 3. Auto-start with Windows ----
echo [3/5] Setting up auto-start with Windows...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AdityaPrintBridge.lnk'); $s.TargetPath='%DEST%\start-bridge.bat'; $s.WorkingDirectory='%DEST%'; $s.WindowStyle=7; $s.Save()" >nul 2>nul
echo       Done - the bridge will start automatically every time Windows starts.

REM ---- 4. Start the bridge now ----
echo [4/5] Starting the bridge now...
echo       If the printer's driver is missing, the bridge
echo       installs it automatically. If Windows asks
echo       for permission, click Yes.
start "" /min "%DEST%\start-bridge.bat"

REM ---- 5. Install the printer driver now (first time only) ----
echo [5/5] Making sure the printer driver is installed...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $dest='%DEST%'; $m='%DEST%\driver-installed.txt'; if (Test-Path $m) { echo '       Already done - good.' } else { $devs = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match 'CH340|CH341|CH342|CH343|CH344|USB-SERIAL' -or $_.HardwareID -match 'VID_1A86' }; if ($devs -and ($devs | Where-Object { $_.ConfigManagerErrorCode -eq 0 })) { echo '       Driver already working - good.'; New-Item -ItemType File -Path $m -Force >nul } else { echo '       Driver not found yet - installing it now...'; echo '       (If Windows asks for permission, click Yes.)'; $zip = Join-Path $env:TEMP 'ch341ser.zip'; $ex = Join-Path $env:TEMP 'ch341ser_ex'; try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/WCH-IC/download/releases/latest/download/CH341SER.ZIP' -OutFile $zip -UseBasicParsing; Expand-Archive -Force -LiteralPath $zip -DestinationPath $ex; $inf = (Get-ChildItem -Path $ex -Recurse -Filter *.inf | Select-Object -First 1).FullName; if (-not $inf) { throw 'no inf' }; $script = \"pnputil.exe /add-driver '$inf' /install; pnputil.exe /scan-devices; exit 0\"; Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-Command',$script; if ($LASTEXITCODE -eq 0) { New-Item -ItemType File -Path $m -Force >nul; echo '       Driver installed.' } else { echo '       Permission was not given - the bridge will install it later.' } } catch { echo '       Could not download the driver now - the bridge will install it later.' } } } }"
echo.
echo ============================================
echo   INSTALLATION COMPLETE.
echo   The bridge is running in a minimized window.
echo   You can close this installer now.
echo.
echo   In the app: Settings -^> Printers should
echo   show "Bridge Online" within 10 seconds.
echo ============================================
timeout /t 8 /nobreak >nul
