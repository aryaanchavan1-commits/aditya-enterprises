@echo off
chcp 65001 >nul
title Aditya Enterprises ERP - Launcher
color 0A

set "APP_DIR=D:\Aditya_enterprises\app"
set "LOGO_PATH=%APP_DIR%\client\public\logo.jpg"
set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUT_NAME=Aditya Enterprises ERP.lnk"

:MENU
cls
echo.
echo ==============================================================
echo        ADITYA ENTERPRISES ERP SUITE 2026
echo ==============================================================
echo.
echo   [1] Launch as Web App (in browser)
echo   [2] Launch as Desktop App (native window - recommended)
echo   [3] Create Desktop Shortcut
echo   [4] Build Windows Installer (.exe)
echo   [5] Exit
echo.
set /p choice="   Enter your choice (1-5): "

if "%choice%"=="1" goto WEB_MODE
if "%choice%"=="2" goto ELECTRON_MODE
if "%choice%"=="3" goto CREATE_SHORTCUT
if "%choice%"=="4" goto BUILD_INSTALLER
if "%choice%"=="5" exit /b 0
echo Invalid choice. Try again.
pause
cls
goto MENU

:WEB_MODE
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed.
    pause
    exit /b 1
)

cd /d "%APP_DIR%"

echo.
echo [*] Installing dependencies (if needed)...
if not exist "node_modules" ( call npm install --legacy-peer-deps )
if not exist "client\node_modules" ( cd client && call npm install && cd .. )
if not exist "client\dist" ( cd client && call npx vite build && cd .. )

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

start "AdityaERP" /MIN cmd /c "cd /d "%APP_DIR%" && node server.js"

:WAIT_WEB
timeout /t 2 /nobreak >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% == 0 (
    start http://localhost:3000
    echo [OK] Launched in your browser: http://localhost:3000
    echo Press any key in this window to stop the server.
    pause >nul
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do ( taskkill /F /PID %%a >nul 2>&1 )
    exit /b 0
)
goto WAIT_WEB

:ELECTRON_MODE
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed.
    pause
    exit /b 1
)

cd /d "%APP_DIR%"

if not exist "node_modules\electron\dist\electron.exe" (
    echo [ERROR] Electron not installed. Run: npm install
    pause
    exit /b 1
)

echo.
echo [*] Checking frontend build...
if not exist "client\dist" (
    echo Building frontend...
    cd client && call npx vite build && cd ..
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Launching Aditya Enterprises ERP...
echo [OK] The app window will open. No console windows will show.

start "" "node_modules\electron\dist\electron.exe" "." >nul 2>&1

echo.
echo You can close this window now. The ERP app will stay running.
echo Close the ERP window to exit the app.
timeout /t 3 >nul
exit /b 0

:CREATE_SHORTCUT
echo.
echo [*] Creating desktop shortcut...

set "VBS_FILE=%TEMP%\create_shortcut.vbs"
(
echo Set WshShell = WScript.CreateObject("WScript.Shell")
echo Set oShellLink = WshShell.CreateShortcut("%DESKTOP%\%SHORTCUT_NAME%")
echo oShellLink.TargetPath = "%comspec%"
echo oShellLink.Arguments = "/c ""D:\Aditya_enterprises\per.bat"""
echo oShellLink.WorkingDirectory = "%APP_DIR%"
echo oShellLink.Description = "Aditya Enterprises ERP Suite 2026"
if exist "%LOGO_PATH%" (
    echo oShellLink.IconLocation = "%LOGO_PATH%"
)
echo oShellLink.WindowStyle = 1
echo oShellLink.Save
) > "%VBS_FILE%"

cscript //nologo "%VBS_FILE%" >nul 2>&1
del "%VBS_FILE%" >nul 2>&1

if exist "%DESKTOP%\%SHORTCUT_NAME%" (
    echo [OK] Shortcut created: %DESKTOP%\%SHORTCUT_NAME%
) else (
    echo [ERROR] Could not create shortcut.
)
pause
goto MENU

:BUILD_INSTALLER
echo.
echo [*] Building Windows Installer...
echo This will take 5-10 minutes on first build.
echo.
call "D:\Aditya_enterprises\build.bat"
pause
goto MENU
