@echo off
REM OpenClaw Windows 启动脚本
REM 启动 OpenClaw AI 助手

chcp 65001 >nul
title OpenClaw - AI Assistant

echo ========================================
echo    OpenClaw AI Assistant
echo    正在启动...
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

REM 检查 OpenClaw 是否安装
where openclaw >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 OpenClaw，请先安装
    echo 安装命令：npm install -g openclaw
    pause
    exit /b 1
)

REM 切换到工作目录
cd /d "%~dp0"

echo [信息] 工作目录：%CD%
echo [信息] 正在启动 OpenClaw...
echo.

REM 启动 OpenClaw
openclaw

if %errorlevel% neq 0 (
    echo.
    echo [错误] OpenClaw 启动失败，错误码：%errorlevel%
    pause
)
