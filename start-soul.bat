@echo off
chcp 65001 >nul
title Soul AI

:: 切换到脚本所在目录
cd /d "%~dp0"

echo ========================================
echo    Soul AI - Server Mode
echo    正在启动服务器模式...
echo ========================================
echo.

:: Kill old Soul processes (suppress errors if none found)
taskkill /F /FI "WINDOWTITLE eq Soul AI" >nul 2>&1

:: Verify node is available
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

:: Verify npm is available
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 npm，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

:: Build latest code
echo [信息] 正在构建最新代码...
call npm.cmd run build >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [警告] 构建失败，尝试使用已有的 dist...
) else (
    echo [信息] 构建完成。
)
echo.

:: Open browser after 3-second delay (runs in background)
start "" cmd /c "timeout /t 3 /nobreak >nul & start "" "http://localhost:47779""

:: Start server (blocks — keeps window open)
echo [信息] 启动 Soul server on http://localhost:47779 ...
echo 按 Ctrl+C 停止。
echo.
node "dist\server.js"

pause
