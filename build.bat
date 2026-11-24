@echo off
rem Copyright LanDen Labs - Dennis Lang 2026 ^| https://github.com/landenlabs/chrome-status-bar
rem
rem Build the Chrome Web Store upload zip: dist\page-status-bar-<version>.zip
rem Only the files the extension needs at run time are included (an allow list),
rem so docs\, screens\, README, store listing, git files, etc. are left out.
rem Uses tar.exe, which ships with Windows 10 (1803) and later.

setlocal EnableDelayedExpansion
cd /d "%~dp0"

rem Files packaged into the zip. Add new run-time files here (forward slashes).
set FILES=manifest.json background.js content.js frame.js media.js options.html options.js list.html list.js icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png LICENSE NOTICE

set VERSION=
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Get-Content -Raw manifest.json | ConvertFrom-Json).version"`) do set VERSION=%%v
if "%VERSION%"=="" (
  echo ERROR: could not read version from manifest.json
  exit /b 1
)

for %%f in (%FILES%) do (
  if not exist "%%~f" (
    echo ERROR: missing file: %%f
    exit /b 1
  )
)

if not exist dist mkdir dist
set ZIP=dist\page-status-bar-%VERSION%.zip
if exist "%ZIP%" del "%ZIP%"

rem -a picks the archive format from the .zip extension
tar -a -c -f "%ZIP%" %FILES%
if errorlevel 1 (
  echo ERROR: tar failed
  exit /b 1
)

echo Built %ZIP%
tar -t -f "%ZIP%"
endlocal
