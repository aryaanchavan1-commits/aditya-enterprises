@echo off
chcp 65001 >nul
title Building Aditya Enterprises ERP - Windows Installer
color 0E

set "APP_DIR=D:\Aditya_enterprises\app"

echo.
echo ==============================================================
echo   BUILDING Aditya Enterprises ERP - Windows Desktop App
echo.
echo   This creates a single .exe installer you can send to clients.
echo   They just double-click, it installs everything automatically.
echo ==============================================================
echo.

cd /d "%APP_DIR%"

echo [1/3] Checking dependencies...
if not exist "node_modules\electron\dist\electron.exe" (
    echo [ERROR] Electron not found. Run: npm install
    pause
    exit /b 1
)
echo [OK] All dependencies present.

echo.
echo [2/3] Building React frontend...
cd client
if exist "dist" ( rmdir /s /q "dist" >nul 2>&1 )
call npx vite build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)
echo [OK] Frontend built successfully.
cd ..

echo.
echo [3/3] Creating Windows Installer (.exe)...
echo       This may take 5-10 minutes. Please wait...
echo.

:: Clean previous builds
if exist "release" ( rmdir /s /q "release" >nul 2>&1 )

:: Run electron-builder for NSIS target only
call npx electron-builder --win --x64

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==============================================================
    echo   BUILD COMPLETE!
    echo.
    echo   Installer location:
    dir /b "%APP_DIR%\release\*.exe" 2>nul
    echo.
    echo   Send this .exe to your clients.
    echo.
    echo   What happens on their PC:
    echo     - Double-click the .exe
    echo     - It auto-installs (no questions asked)
    echo     - App launches immediately
    echo     - Desktop shortcut created
    echo     - Zero setup required - everything is included
    echo.
    echo ==============================================================
) else (
    echo.
    echo [ERROR] Build failed.
    echo Common fixes:
    echo   1. Close all Electron/Node windows first
    echo   2. Run: npm run electron:rebuild
    echo   3. Check disk space
)

echo.
pause
