@echo off
setlocal

echo ================================================
echo   Dementia Assist -- AI Memory Companion
echo ================================================
echo.

:: ── Preflight checks ──────────────────────────────────────────────────────

if not exist "face_db.pkl" (
    echo WARNING: face_db.pkl not found.
    echo   The system will start with an empty face database.
    echo   Place your trained face_db.pkl in the project root, or
    echo   use the "Add Person" feature in the UI to enrol people live.
) else (
    echo [OK] Face database found ^(face_db.pkl^)
)

if not exist ".env" (
    echo.
    echo WARNING: .env not found -- copying from .env.example
    copy /Y .env.example .env >nul
    echo   Edit .env and add your Hindsight API key to enable cloud memory.
    echo   Without it, memories are stored locally in memory_store.json.
) else (
    echo [OK] Environment file found ^(.env^)
)

echo.

:: ── Dependencies ──────────────────────────────────────────────────────────

echo Installing backend dependencies...
py -3.12 -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo ERROR: pip install failed. Make sure Python and pip are on your PATH.
    pause
    exit /b 1
)

echo Installing frontend dependencies...
cd frontend
call npm install --silent
if errorlevel 1 (
    echo ERROR: npm install failed. Make sure Node.js is on your PATH.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo Dependencies ready.
echo.

:: ── Start services ────────────────────────────────────────────────────────

echo Starting Flask backend in a new window ^(port 5000^)...
start "Dementia Assist - Backend" cmd /k "py -3.12 app.py"

:: Give Flask a couple of seconds before Next.js starts sending /api/* requests
timeout /t 3 /nobreak >nul

echo Starting Next.js frontend in a new window ^(port 3000^)...
start "Dementia Assist - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ================================================
echo   System is starting!
echo.
echo   Open:  http://localhost:3000
echo.
echo   Backend API: http://localhost:5000/api/health
echo.
echo   Both services run in separate windows.
echo   Close those windows to stop the services.
echo ================================================
echo.

pause
endlocal
