@echo off
rem AI Office launcher: double-click to start. Close this window to stop.
rem Messages are in English because cmd.exe misreads UTF-8 text in .bat files.
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" goto :deps

set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY where python >nul 2>nul && set "PY=python"
if not defined PY (
  echo [!] Python not found. Install Python 3.9+ from python.org
  echo     and tick "Add Python to PATH" during setup.
  goto :fail
)
echo Creating virtual environment...
%PY% -m venv .venv || goto :fail

:deps
rem Reinstall packages only when requirements.txt changed.
fc /b requirements.txt ".venv\installed-requirements.txt" >nul 2>nul
if not errorlevel 1 goto :env
echo Installing packages...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r requirements.txt || goto :fail
copy /y requirements.txt ".venv\installed-requirements.txt" >nul

:env
if exist ".env" goto :run
copy .env.example .env >nul
echo [!] Created .env. Put your OPENAI_API_KEY in it, save, then run start.bat again.
notepad .env
goto :end

:run
set "OPEN_BROWSER=true"
".venv\Scripts\python.exe" app.py
if errorlevel 1 goto :fail
goto :end

:fail
echo.
echo [!] AI Office did not start. Read the message above.
pause
exit /b 1

:end
endlocal
