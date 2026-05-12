@echo off
chcp 65001 >nul
title ArcUI Backend

echo ========================================
echo   ArcUI - 通用 AI 对话前端
echo   Backend Server Startup
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.9+.
    pause
    exit /b 1
)
echo   Python found: 
python --version

echo.
echo [2/3] Installing dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Some dependencies may not have installed correctly.
)

echo.
echo [3/3] Starting ArcUI backend on http://localhost:1011
echo.
echo   The frontend will open automatically in your default browser
echo   once the backend is ready (self-check + auto-open).
echo.
echo   Press Ctrl+C to stop
echo ========================================
echo.

python server.py

pause
