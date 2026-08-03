@echo off
title Aditya ERP - USB Print Bridge
cd /d "%~dp0"
echo Starting Aditya ERP USB Print Bridge...
echo Close this window to stop the bridge. It restarts automatically if it crashes.
echo.
:loop
if exist "%~dp0bridge.exe" (
  "%~dp0bridge.exe"
) else (
  node bridge.js
)
echo.
echo Bridge stopped unexpectedly - restarting in 5 seconds...
echo (Press Ctrl+C twice quickly to stop it for good.)
timeout /t 5 /nobreak >nul
goto loop
