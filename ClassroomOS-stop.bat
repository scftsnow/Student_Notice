@echo off
echo Stopping ClassroomOS server...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>&1
)
echo Stopped.
timeout /t 2 /nobreak >nul
exit /b 0
