@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (set "PY=py") else (set "PY=python")
if not exist ".venv\Scripts\python.exe" (
  echo Creating a local Python environment...
  %PY% -m venv .venv || goto error
)
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt || goto error
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:5000"
python backend\app.py
goto end
:error
echo Setup failed. Install Python 3.10 or newer and try again.
pause
:end
endlocal
