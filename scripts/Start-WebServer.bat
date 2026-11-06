@echo off
cd /d C:\Users\USER\Desktop\Student_Notice
netstat -ano | findstr "LISTENING" | findstr ":3001" >nul
if not errorlevel 1 goto open
start "" /min cmd /c "npm.cmd run dev"
set /a tries=0
:wait
timeout /t 2 /nobreak >nul
set /a tries+=1
netstat -ano | findstr "LISTENING" | findstr ":3001" >nul
if not errorlevel 1 goto open
if %tries% lss 30 goto wait
:open
start "" http://localhost:3001/
