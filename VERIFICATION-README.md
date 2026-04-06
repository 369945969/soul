# Chat API 功能验证说明

## 当前状态

由于系统限制，我无法直接启动服务器。请按以下步骤手动验证功能。

## 验证步骤

### 1. 启动服务器

打开终端，运行：

```bash
cd /home/node/.openclaw/workspace/soul
node dist/server.js
```

服务器启动后会显示：
```
Soul Server running on http://localhost:47779
WebSocket server running on ws://localhost:47779/ws
```

**保持这个终端运行**，不要关闭。

### 2. 打开新终端运行验证

打开另一个终端，运行以下命令：

#### 方法 A: 快速验证脚本

```bash
cd /home/node/.openclaw/workspace/soul
bash scripts/quick-verify.sh
```

#### 方法 B: 自动化测试

```bash
cd /home/node/.openclaw/workspace/soul
node scripts/test-http-chat.js
```

#### 方法 C: 手动验证

```bash
# 1. 健康检查
curl http://localhost:47779/api/chat/health

# 2. 创建用户
curl -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{}'

# 3. 发送消息
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "你的用户 ID",
    "message": "你好！"
  }'

# 4. 列出用户
curl http://localhost:47779/api/chat/users

# 5. 会话列表
curl http://localhost:47779/api/chat/sessions
```

## 验证内容

| 功能 | 说明 | 预期结果 |
|------|------|----------|
| 健康检查 | 检查服务器状态 | status: ok |
| 用户创建 | 创建新用户 | 返回 userId 和 personaId |
| 角色自动创建 | 首次对话自动创建 | 自动创建默认角色 |
| 消息发送 | 发送聊天消息 | 收到响应 |
| 记忆隔离 | 不同用户记忆独立 | Alice 和 Bob 记忆独立 |
| 会话管理 | 查看会话列表 | 显示所有会话 |

## 测试脚本

### quick-verify.sh

快速验证脚本，自动执行所有基本测试。

**运行方式**:
```bash
bash scripts/quick-verify.sh
```

### test-http-chat.js

完整的 HTTP API 测试，包含 7 个测试项。

**运行方式**:
```bash
node scripts/test-http-chat.js
```

**测试结果**: 保存到 `scripts/test-results.json`

### test-websocket-chat.js

WebSocket 测试脚本。

**运行方式**:
```bash
node scripts/test-websocket-chat.js
```

## 验证报告

运行测试后，请记录以下信息：

### 测试结果

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 健康检查 | | |
| 用户创建 | | |
| 角色自动创建 | | |
| 消息发送 | | |
| 记忆隔离 | | |
| 会话管理 | | |
| 列出用户 | | |

### 服务器日志

服务器启动时的输出：
```
[粘贴服务器日志]
```

### 测试输出

自动化测试的输出：
```
[粘贴测试输出]
```

## 常见问题

### Q: 服务器启动失败？

A: 检查端口 47779 是否被占用：
```bash
netstat -tlnp | grep 47779
```

### Q: 连接被拒绝？

A: 确保服务器已经启动并正在运行。

### Q: 测试脚本报错？

A: 确保已安装依赖：
```bash
npm install
```

## 文档参考

- `CHAT-API.md` - API 使用文档
- `VERIFICATION-GUIDE.md` - 详细验证指南
- `CHAT-API-TEST-REPORT.md` - 测试用例说明

## 下一步

验证完成后，请告诉我：

1. 服务器是否成功启动
2. 哪些测试通过了
3. 哪些测试失败了（如果有）
4. 任何错误信息

我会根据结果帮你解决问题。
