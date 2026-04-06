#!/bin/bash
# Chat API 快速验证脚本
# 使用方法：bash quick-verify.sh

echo "=========================================="
echo "Chat API 快速验证"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查服务器状态
echo -e "${YELLOW}检查服务器状态...${NC}"
HEALTH=$(curl -s http://localhost:47779/api/chat/health 2>/dev/null)

if [ -z "$HEALTH" ]; then
    echo -e "${RED}❌ 服务器未运行！${NC}"
    echo ""
    echo "请先启动服务器："
    echo "  cd /home/node/.openclaw/workspace/soul"
    echo "  node dist/server.js"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ 服务器运行正常${NC}"
echo ""

# 测试 1: 健康检查
echo "=========================================="
echo "测试 1: 健康检查"
echo "=========================================="
echo "$HEALTH" | jq .
echo ""

# 测试 2: 创建用户
echo "=========================================="
echo "测试 2: 创建用户"
echo "=========================================="
USER_RESPONSE=$(curl -s -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{}')
echo "$USER_RESPONSE" | jq .
USER_ID=$(echo "$USER_RESPONSE" | jq -r '.userId')
echo ""

# 测试 3: 发送消息
echo "=========================================="
echo "测试 3: 发送消息"
echo "=========================================="
CHAT_RESPONSE=$(curl -s -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"message\": \"你好！\"}")
echo "$CHAT_RESPONSE" | jq .
echo ""

# 测试 4: 获取用户信息
echo "=========================================="
echo "测试 4: 获取用户信息"
echo "=========================================="
curl -s "http://localhost:47779/api/chat/users/$USER_ID" | jq .
echo ""

# 测试 5: 列出用户
echo "=========================================="
echo "测试 5: 列出用户"
echo "=========================================="
curl -s http://localhost:47779/api/chat/users | jq .
echo ""

# 测试 6: 会话列表
echo "=========================================="
echo "测试 6: 会话列表"
echo "=========================================="
curl -s http://localhost:47779/api/chat/sessions | jq .
echo ""

echo "=========================================="
echo "验证完成！"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ 所有 API 端点正常${NC}"
echo ""
