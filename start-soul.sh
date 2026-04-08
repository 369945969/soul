#!/bin/bash

# Soul AI - 服务器启动脚本
# Soul AI - Server Startup Script

set -e

# 切换到脚本所在目录
cd "$(dirname "$0")"

# 设置 UTF-8 编码
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

echo "========================================"
echo "  Soul AI - Server Mode"
echo "  正在启动服务器模式..."
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js"
    echo "请安装 Node.js: https://nodejs.org/"
    exit 1
fi
echo "[✓] Node.js: $(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "[错误] 未找到 npm"
    exit 1
fi
echo "[✓] npm: $(npm --version)"

# 构建项目
echo ""
echo "[信息] 正在构建最新代码..."
if npm run build > /dev/null 2>&1; then
    echo "[✓] 构建完成"
else
    echo "[警告] 构建失败，尝试使用已有的 dist..."
fi

echo ""
echo "[信息] 启动 Soul server on http://localhost:47779 ..."
echo "[信息] 按 Ctrl+C 停止"
echo "========================================"
echo ""

# 3 秒后自动打开浏览器
sleep 3 && xdg-open "http://localhost:47779" &>/dev/null &

# 启动服务器
exec node "dist/server.js"
