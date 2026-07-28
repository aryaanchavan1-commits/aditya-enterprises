@echo off
chcp 65001 >nul
title Aditya ERP - Dev Mode
cd /d "D:\Aditya_enterprises\app"

echo Starting Aditya Enterprises ERP (Dev Mode)...
echo.

:: Kill existing
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Start backend
start "AdityaERP-Backend" cmd /c "node server.js"

:: Wait
timeout /t 3 /nobreak >nul

:: Start frontend dev server
cd client
start "AdityaERP-Frontend" cmd /c "npx vite --host"

:: Open browser
start http://localhost:5173

echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Close the CMD windows to stop servers.
pause
