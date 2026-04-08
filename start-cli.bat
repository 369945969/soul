@echo off
title Soul AI - CLI
cd /d "D:\Programer Project\soul"

echo ========================================
echo    Soul AI - CLI Mode
echo    正在启动命令行模式...
echo ========================================
echo.

:: Kill old Soul CLI processes (suppress errors if none found)
taskkill /F /FI "WINDOWTITLE eq Soul AI - CLI" >nul 2>&1

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

:: Start CLI mode
echo [信息] 启动 CLI 模式...
echo 输入命令与 Soul AI 交互，输入 exit 退出
echo ========================================
echo.

node "D:\Programer Project\soul\dist\cli.js"

pause
