@echo off
rem Floating Office for Windows. Double-click to start.
rem First run downloads Electron (about 100 MB) and adds a desktop shortcut.
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing Electron, please wait...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo npm install failed. Install Node.js 18+ from https://nodejs.org and try again.
    pause
    exit /b 1
  )
  powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Floating Office.lnk'); $s.TargetPath='%~dp0node_modules\electron\dist\electron.exe'; $s.Arguments='\"%~dp0.\"'; $s.WorkingDirectory='%~dp0'; $s.Save()"
)
start "" "node_modules\electron\dist\electron.exe" "%~dp0."
