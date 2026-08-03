@echo off
setlocal
title Aditya ERP - Print Bridge Installer (run once)
cd /d "%~dp0"

echo ============================================
echo   Aditya ERP - USB Print Bridge Installer
echo   Run this ONCE on the Windows PC where the
echo   Posiflow printer is plugged in.
echo ============================================
echo.

REM ---- 1. Make sure Node.js is installed ----
set NODE_CMD=node
where node >nul 2>nul
if %errorlevel%==0 (
  echo [1/4] Node.js found - good.
) else (
  echo [1/4] Node.js not found - installing it silently (takes about a minute)...
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
echo [2/4] Installing bridge to %DEST%
if not exist "%DEST%" mkdir "%DEST%"
copy /y "%~dp0bridge.js" "%DEST%" >nul
copy /y "%~dp0start-bridge.bat" "%DEST%" >nul
if exist "%~dp0config.json" copy /y "%~dp0config.json" "%DEST%" >nul

REM ---- 3. Auto-start with Windows ----
echo [3/4] Setting up auto-start with Windows...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AdityaPrintBridge.lnk'); $s.TargetPath='%DEST%\start-bridge.bat'; $s.WorkingDirectory='%DEST%'; $s.WindowStyle=7; $s.Save()" >nul 2>nul
echo       Done - the bridge will start automatically every time Windows starts.

REM ---- 4. Start the bridge now ----
echo [4/4] Starting the bridge now...
start "" /min "%DEST%\start-bridge.bat"
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
