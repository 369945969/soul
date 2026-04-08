#!/bin/bash

# Soul AI - Setup 验证脚本
# 用于测试 setup 命令是否正常工作

set -e

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo "========================================"
echo "  Soul AI - Setup 验证脚本"
echo "  Soul AI - Setup Verification Script"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js"
    echo "请安装 Node.js: https://nodejs.org/"
    exit 1
fi
echo "[✓] Node.js 已安装：$(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "[错误] 未找到 npm"
    exit 1
fi
echo "[✓] npm 已安装：$(npm --version)"

# 检查是否需要构建
if [ ! -d "dist" ] || [ ! -f "dist/setup-cli.js" ]; then
    echo ""
    echo "[信息] 正在构建项目..."
    npm run build
    echo "[✓] 构建完成"
fi

echo ""
echo "========================================"
echo "  测试 setup 命令..."
echo "========================================"
echo ""

# 测试 setup 命令
echo "setup 命令输出预览（前 50 行）："
echo "----------------------------------------"
timeout 3 node dist/setup-cli.js 2>&1 | head -50 || true

echo ""
echo "----------------------------------------"
echo ""

# 检查配置文件
echo "检查配置文件..."
if [ -d "$HOME/.soul" ]; then
    echo "[✓] Soul 配置目录存在：$HOME/.soul"
    
    if [ -f "$HOME/.soul/soul.db" ]; then
        echo "[✓] Soul 数据库存在"
    else
        echo "[!] Soul 数据库不存在，需要运行 setup"
    fi
    
    if [ -f "$HOME/.soul/config.json" ]; then
        echo "[✓] 配置文件存在"
        echo ""
        echo "配置文件内容:"
        cat "$HOME/.soul/config.json" | head -20
    else
        echo "[!] 配置文件不存在，需要运行 setup"
    fi
else
    echo "[!] Soul 配置目录不存在，需要运行 setup"
fi

echo ""
echo "========================================"
echo "  验证完成！"
echo "========================================"
echo ""
echo "提示：运行以下命令进行完整配置："
echo "  npm run setup"
echo "  或"
echo "  node dist/setup-cli.js"
echo ""
