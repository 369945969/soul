@echo off
chcp 65001 >nul
title Soul AI - Setup

:: 切换到脚本所在目录
cd /d "%~dp0"

echo ========================================
echo    Soul AI - 模型配置向导
echo    Soul AI - Model Setup Wizard
echo ========================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 npm，请先安装 Node.js
    pause
    exit /b 1
)

:: 构建项目
echo [信息] 正在构建项目...
call npm.cmd run build >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [警告] 构建失败，尝试使用已有的 dist...
) else (
    echo [信息] 构建完成。
)
echo.

:: 运行 setup-cli 命令
echo [信息] 启动模型配置向导...
echo ========================================
echo.

node "dist\setup-cli.js"

echo.
echo ========================================
echo [信息] 配置完成！
echo ========================================
pause
