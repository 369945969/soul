# Chat API 功能验证指南

## 快速开始

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

### 2. 打开另一个终端运行测试

在服务器运行的同时，打开另一个终端：

```bash
cd /home/node/.openclaw/workspace/soul
node scripts/test-http-chat.js
```

## 手动测试步骤

### 测试 1: 健康检查

```bash
curl http://localhost:47779/api/chat/health
```

**预期输出**:
```json
{
  "status": "ok",
  "timestamp": "2026-04-06T13:00:00Z",
  "sessions": 0
}
```

### 测试 2: 创建用户

```bash
curl -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{}'
```

**预期输出**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "personaId": "abc123...",
  "message": "User created successfully. First message will auto-create persona."
}
```

### 测试 3: 发送消息（触发角色自动创建）

```bash
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "你好！这是我的第一次对话。"
  }'
```

**预期输出**:
```json
{
  "sessionId": "ws_1234567890",
  "response": "你好！有什么我可以帮你的吗？",
  "messageCount": 1,
  "personaId": "abc123...",
  "personaName": "用户 550e"
}
```

### 测试 4: 验证记忆隔离

#### 用户 A 设置记忆

```bash
USER_A="user-a-$(date +%s)"

curl -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_A\"}"

curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_A\", \"message\": \"我的名字是 Alice，我喜欢蓝色。\"}"
```

#### 用户 B 设置记忆

```bash
USER_B="user-b-$(date +%s)"

curl -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_B\"}"

curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_B\", \"message\": \"我的名字是 Bob，我喜欢红色。\"}"
```

#### 验证用户 A 的记忆

```bash
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_A\", \"message\": \"我叫什么名字？我喜欢什么颜色？\"}"
```

**预期**: 回答应该包含 "Alice" 和 "蓝色"

#### 验证用户 B 的记忆

```bash
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_B\", \"message\": \"我叫什么名字？我喜欢什么颜色？\"}"
```

**预期**: 回答应该包含 "Bob" 和 "红色"

### 测试 5: 连续对话

```bash
USER_ID="user-$(date +%s)"

# 创建用户
curl -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}"

# 发送 5 轮对话
for i in 1 2 3 4 5; do
  echo "=== 第 $i 轮 ==="
  curl -s -X POST http://localhost:47779/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"userId\": \"$USER_ID\", \"message\": \"这是第 $i 条消息\"}" | jq '.messageCount'
done
```

**预期**: messageCount 从 1 递增到 5

### 测试 6: 列出用户

```bash
curl http://localhost:47779/api/chat/users
```

**预期输出**:
```json
{
  "users": [
    {
      "id": "user-a-1712345678",
      "username": "user_user-a",
      "display_name": "用户 user-a",
      "role": "user",
      "created_at": "2026-04-06T13:00:00Z"
    }
  ],
  "count": 3
}
```

### 测试 7: 查看用户详情

```bash
USER_ID="user-a-$(date +%s)"

curl http://localhost:47779/api/chat/users/$USER_ID
```

**预期输出**:
```json
{
  "user": {
    "id": "user-a-1712345678",
    "username": "user_user-a",
    "display_name": "用户 user-a",
    "role": "user",
    "created_at": "2026-04-06T13:00:00Z",
    "personas": [
      {
        "id": "abc123...",
        "name": "user-user-a",
        "display_name": "用户 user-a",
        "is_default": true
      }
    ]
  }
}
```

### 测试 8: 查看会话列表

```bash
curl http://localhost:47779/api/chat/sessions
```

**预期输出**:
```json
{
  "sessions": [
    {
      "sessionId": "ws_1234567890",
      "userId": "user-a-1712345678",
      "personaId": "abc123...",
      "createdAt": "2026-04-06T13:00:00Z",
      "lastActivity": "2026-04-06T13:05:00Z",
      "messageCount": 5
    }
  ],
  "count": 1
}
```

## WebSocket 测试

### 使用 WebSocket 客户端

创建一个测试文件 `test-ws.js`:

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:47779/ws');

ws.on('open', () => {
  console.log('✅ WebSocket 连接成功');
  
  ws.send(JSON.stringify({
    type: 'chat',
    sessionId: 'user-test-123',
    message: '你好！这是 WebSocket 测试'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('收到消息:', JSON.stringify(msg, null, 2));
  
  if (msg.event === 'chat_response') {
    console.log('✅ 收到响应:', msg.data.response);
    ws.close();
    process.exit(0);
  } else if (msg.event === 'chat_error') {
    console.error('❌ 错误:', msg.data.error);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket 错误:', err);
  process.exit(1);
});

// 超时处理
setTimeout(() => {
  console.error('❌ 超时');
  ws.close();
  process.exit(1);
}, 10000);
```

运行测试：

```bash
node test-ws.js
```

## 数据库验证

### 检查用户和角色

```bash
cd /home/node/.openclaw/workspace/soul
node -e "
import { getRawDb } from './dist/db/index.js';
const db = getRawDb();

console.log('=== 用户列表 ===');
const users = db.prepare('SELECT * FROM users').all();
users.forEach(u => console.log(u));

console.log('\n=== 角色列表 ===');
const personas = db.prepare('SELECT * FROM personas').all();
personas.forEach(p => console.log(p));

console.log('\n=== 用户 - 角色绑定 ===');
const bindings = db.prepare('SELECT * FROM user_persona_bindings').all();
bindings.forEach(b => console.log(b));
"
```

### 检查记忆

```bash
node -e "
import { getRawDb } from './dist/db/index.js';
const db = getRawDb();

console.log('=== 记忆列表 ===');
const memories = db.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT 10').all();
memories.forEach(m => console.log(m));
"
```

## 测试检查清单

在测试过程中，请勾选以下项目：

### 功能测试

- [ ] 服务器启动成功
- [ ] 健康检查返回 ok
- [ ] 用户创建成功
- [ ] 角色自动创建
- [ ] 消息发送和接收正常
- [ ] 记忆存储正常
- [ ] 记忆隔离（不同用户记忆独立）
- [ ] 连续对话上下文保持
- [ ] 用户列表查询正常
- [ ] 会话列表查询正常
- [ ] WebSocket 连接成功

### 性能测试

- [ ] 响应时间 < 1 秒
- [ ] 并发请求正常
- [ ] 内存使用正常

### 安全测试

- [ ] 用户 ID 验证正常
- [ ] 消息长度限制正常

## 常见问题

### Q: 服务器启动失败？

A: 检查端口 47779 是否被占用：
```bash
netstat -tlnp | grep 47779
```

### Q: 连接被拒绝？

A: 确保服务器已经启动并正在运行。

### Q: 记忆没有正确隔离？

A: 检查数据库中的记忆表，确认不同用户的记忆独立存储。

### Q: WebSocket 连接失败？

A: 确保服务器已启动，并且防火墙允许 WebSocket 连接。

## 测试结果记录

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 健康检查 | | |
| 用户创建 | | |
| 角色自动创建 | | |
| 消息发送 | | |
| 记忆隔离 | | |
| 连续对话 | | |
| 用户列表 | | |
| 会话列表 | | |
| WebSocket | | |

**测试日期**: _______________
**测试人员**: _______________
**总体评价**: _______________

---

## 自动化测试

如果服务器已运行，可以直接运行自动化测试：

```bash
node scripts/test-http-chat.js
```

测试结果会保存到 `scripts/test-results.json`。
