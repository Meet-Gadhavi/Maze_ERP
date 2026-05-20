@echo off
echo ============================================
echo   Quantro (Maze ERP) — Windows Build
echo ============================================
echo.
echo [1/2] Building renderer...
call npm run build:renderer
if errorlevel 1 (
    echo.
    echo ERROR: Renderer build failed!
    pause
    exit /b 1
)
echo.
echo [2/2] Packaging EXE installer...
call npx electron-builder --win
if errorlevel 1 (
    echo.
    echo ERROR: Electron Builder failed!
    pause
    exit /b 1
)
echo.
echo ============================================
echo   Build complete!
echo   Installer: Deployment\v1.0.3\
echo ============================================
pause
