@echo off
title Aditya ERP - USB Print Bridge
cd /d "%~dp0"
echo Starting Aditya ERP USB Print Bridge...
echo Close this window to stop the bridge.
echo.
node bridge.js
pause
