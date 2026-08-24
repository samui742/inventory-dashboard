@echo off
setlocal
start "Inventory Dashboard Server" /min powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\serve-dashboard.ps1" -Port 4173
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/"
endlocal
