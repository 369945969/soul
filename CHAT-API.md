# Chat API 文档

WebSocket 和 HTTP 接口，支持 UUID 对话和自动创建角色。

## 快速开始

### 1. 创建用户（获取 UUID）

```bash
curl -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{}'
```

响应：
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "personaId": "abc123...",
  "message": "User created successfully. First message will auto-create persona."
}
```

### 2. 发送消息（HTTP）

```bash
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "你好！"
  }'
```

响应：
```json
{
  "sessionId": "ws_1234567890",
  "response": "你好！有什么我可以帮你的吗？",
  "messageCount": 1,
  "personaId": "abc123...",
  "personaName": "用户 550e"
}
```

### 3. 发送消息（WebSocket）

```javascript
const ws = new WebSocket('ws://localhost:47779/ws');

ws.onopen = () => {
  console.log('Connected');
  
  // 发送消息
  ws.send(JSON.stringify({
    type: 'chat',
    sessionId: 'user-550e8400-e29b-41d4-a716-446655440000',
    message: '你好！'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.event === 'chat_response') {
    console.log('Response:', data.data.response);
    console.log('Persona:', data.data.personaName);
  }
};
```

## API 端点

### HTTP 接口

#### 创建用户
```
POST /api/chat/users
```

请求体：
```json
{
  "userId": "可选，如果不提供则自动生成 UUID"
}
```

响应：
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "personaId": "abc123...",
  "message": "User created successfully."
}
```

#### 列出所有用户
```
GET /api/chat/users
```

响应：
```json
{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "user_550e",
      "display_name": "用户 550e",
      "role": "user",
      "created_at": "2026-04-06T12:00:00Z"
    }
  ],
  "count": 1
}
```

#### 获取用户信息
```
GET /api/chat/users/:userId
```

响应：
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "user_550e",
    "display_name": "用户 550e",
    "role": "user",
    "created_at": "2026-04-06T12:00:00Z",
    "personas": [
      {
        "id": "abc123...",
        "name": "user-550e",
        "display_name": "用户 550e",
        "is_default": true
      }
    ]
  }
}
```

#### 发送聊天消息
```
POST /api/chat
```

请求体：
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "你好！",
  "sessionId": "可选，会话 ID"
}
```

响应：
```json
{
  "sessionId": "ws_1234567890",
  "response": "你好！有什么我可以帮你的吗？",
  "messageCount": 1,
  "personaId": "abc123...",
  "personaName": "用户 550e"
}
```

#### 获取会话列表
```
GET /api/chat/sessions
```

响应：
```json
{
  "sessions": [
    {
      "sessionId": "ws_1234567890",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "personaId": "abc123...",
      "createdAt": "2026-04-06T12:00:00Z",
      "lastActivity": "2026-04-06T12:05:00Z",
      "messageCount": 5
    }
  ],
  "count": 1
}
```

#### 健康检查
```
GET /api/chat/health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2026-04-06T12:00:00Z",
  "sessions": 1
}
```

### WebSocket 接口

#### 连接
```
ws://localhost:47779/ws
```

#### 消息格式

发送消息：
```json
{
  "type": "chat",
  "sessionId": "user-550e8400-e29b-41d4-a716-446655440000",
  "message": "你好！"
}
```

接收响应：
```json
{
  "event": "chat_response",
  "data": {
    "sessionId": "ws_1234567890",
    "response": "你好！有什么我可以帮你的吗？",
    "personaName": "用户 550e",
    "messageCount": 1,
    "timestamp": "2026-04-06T12:00:00Z"
  }
}
```

接收连接确认：
```json
{
  "event": "connected",
  "data": {
    "clientId": "abc123",
    "message": "Soul WebSocket connected"
  }
}
```

接收错误：
```json
{
  "event": "chat_error",
  "data": {
    "error": "错误信息",
    "sessionId": "user-550e..."
  }
}
```

## 自动创建角色

**第一次对话时自动创建角色**：

1. 用户发送第一条消息
2. 系统检查用户是否已有角色
3. 如果没有，自动创建一个默认角色
4. 绑定用户和角色
5. 使用新角色进行对话

**角色配置**：
```typescript
{
  name: `user-${userId.slice(0, 8)}`,
  displayName: `用户 ${userId.slice(0, 4)}`,
  description: "自动创建的用户角色",
  constitution: {
    mission: "与用户进行自然对话",
    values: ["友好", "helpful", "诚实"],
    boundaries: ["不伤害", "不欺骗"],
  },
  habits: {
    style: "友好、自然",
    adaptability: "high",
  }
}
```

## 会话管理

- **会话 ID 格式**: `user-{uuid}` 或 `{uuid}`
- **会话持久化**: 会话在内存中保存，24 小时无活动自动清理
- **多会话支持**: 一个用户可以有多个会话

## 示例代码

### Python 示例

```python
import requests
import uuid

# 创建用户
response = requests.post('http://localhost:47779/api/chat/users', json={})
user_id = response.json()['userId']
print(f"User ID: {user_id}")

# 发送消息
response = requests.post('http://localhost:47779/api/chat', json={
    'userId': user_id,
    'message': '你好！'
})
print(response.json()['response'])
```

### JavaScript 示例

```javascript
// HTTP 请求
async function chat(userId, message) {
  const response = await fetch('http://localhost:47779/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, message })
  });
  return response.json();
}

// 使用
const userId = '550e8400-e29b-41d4-a716-446655440000';
const result = await chat(userId, '你好！');
console.log(result.response);
```

## 注意事项

1. **首次对话**: 第一次对话会自动创建角色
2. **UUID 格式**: 使用标准 UUID 格式（可选）
3. **会话保持**: 使用相同的 userId 可以保持对话历史
4. **WebSocket**: WebSocket 支持实时双向通信

## 测试用例

### 运行测试

```bash
cd /home/node/.openclaw/workspace/soul

# 启动服务器
node dist/server.js

# 在另一个终端运行测试
node scripts/test-http-chat.js
```

### 测试内容

测试脚本会自动执行以下测试：

| 测试项 | 说明 | 预期结果 |
|--------|------|----------|
| 健康检查 | 检查服务器状态 | status: ok |
| 创建用户 | 创建新用户并获取 UUID | 返回 userId 和 personaId |
| 角色自动创建 | 首次对话自动创建角色 | 自动创建默认角色 |
| 记忆隔离 | 不同用户的记忆独立 | Alice 和 Bob 记忆独立 |
| 会话管理 | 查看和管理会话 | 显示所有会话列表 |
| 连续对话 | 多轮对话保持上下文 | 消息数递增 |
| 列出用户 | 查看所有用户 | 显示所有用户列表 |

### 测试输出示例

```
ℹ️ ============================================================
🧪 测试 1: 健康检查
ℹ️ 状态：ok
ℹ️ 时间戳：2026-04-06T13:00:00Z
ℹ️ 会话数：0
✅ 健康检查 - 通过

🧪 测试 2: 创建用户
ℹ️ 用户 ID: 550e8400-e29b-41d4-a716-446655440000
ℹ️ 角色 ID: abc123...
✅ 创建用户 - 通过

...

ℹ️ ============================================================
ℹ️ 测试总结
ℹ️ ============================================================
ℹ️ 总测试数：7
✅ 通过：7
ℹ️ 通过率：100.0%
```

### WebSocket 测试（需要服务器运行）

```javascript
// WebSocket 测试示例
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:47779/ws');

ws.onopen = () => {
  console.log('Connected');
  
  // 发送消息
  ws.send(JSON.stringify({
    type: 'chat',
    sessionId: 'user-550e8400-e29b-41d4-a716-446655440000',
    message: '你好！'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.event === 'chat_response') {
    console.log('Response:', data.data.response);
    console.log('Persona:', data.data.personaName);
  }
};
```

### 测试结果

测试结果保存在 `scripts/test-results.json`：

```json
{
  "total": 7,
  "passed": 7,
  "failed": 0,
  "tests": [
    {
      "name": "健康检查",
      "passed": true,
      "details": "",
      "timestamp": "2026-04-06T13:00:00Z"
    },
    ...
  ]
}
```

## 常见问题

### Q: 如何自定义用户 ID？

A: 在创建用户时指定 `userId` 字段：

```bash
curl -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{"userId": "my-custom-uuid"}'
```

### Q: 如何查看角色的详细信息？

A: 使用角色管理 API：

```bash
curl http://localhost:47779/api/personas
```

### Q: 记忆如何存储和隔离？

A: 每个用户的记忆独立存储，通过 `user_persona_bindings` 表关联。不同用户的记忆不会混淆。

### Q: 会话会过期吗？

A: 会话在内存中保存，24 小时无活动会自动清理。

### Q: WebSocket 和 HTTP 有什么区别？

A: 
- **HTTP**: 适合简单的请求 - 响应场景
- **WebSocket**: 适合实时双向通信，支持流式响应

### Q: 如何删除用户？

A: 目前不支持删除用户，但可以通过数据库直接操作：

```sql
DELETE FROM user_persona_bindings WHERE user_id = 'xxx';
DELETE FROM users WHERE id = 'xxx';
```
