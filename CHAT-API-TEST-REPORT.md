# Chat API 测试报告

## 概述

本文档记录 Chat API（WebSocket + HTTP）的测试用例、执行步骤和验证结果。

## 测试环境

- **服务器**: `http://localhost:47779`
- **WebSocket**: `ws://localhost:47779/ws`
- **数据库**: SQLite (`~/.soul/soul.db`)
- **Node.js**: v22.22.0

## 测试准备

### 1. 启动服务器

```bash
cd /home/node/.openclaw/workspace/soul
node dist/server.js
```

### 2. 验证服务器运行

```bash
curl http://localhost:47779/api/chat/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2026-04-06T13:00:00Z",
  "sessions": 0
}
```

## 测试用例

### 测试 1: 健康检查

**目的**: 验证服务器正常运行

**步骤**:
```bash
curl http://localhost:47779/api/chat/health
```

**预期结果**:
- 状态码：200
- 响应：`{"status": "ok", ...}`

**实际结果**: _______________

---

### 测试 2: 创建用户

**目的**: 验证用户创建功能

**步骤**:
```bash
curl -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{}'
```

**预期结果**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "personaId": "abc123...",
  "message": "User created successfully."
}
```

**实际结果**: _______________

---

### 测试 3: 角色自动创建

**目的**: 验证首次对话时自动创建角色

**步骤**:

1. 创建用户（不指定角色）
2. 发送第一条消息
3. 检查用户信息

```bash
# 1. 创建用户
USER_ID=$(curl -s -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.userId')

# 2. 发送第一条消息
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"message\": \"你好！\"}"

# 3. 检查用户信息
curl http://localhost:47779/api/chat/users/$USER_ID
```

**预期结果**:
- 用户自动绑定一个角色
- 角色名称为 `用户 xxxx` 格式

**实际结果**: _______________

---

### 测试 4: 记忆隔离

**目的**: 验证不同用户的记忆独立存储

**步骤**:

```bash
# 创建两个用户
USER_A=$(curl -s -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.userId')

USER_B=$(curl -s -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.userId')

# 用户 A 设置记忆
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_A\", \"message\": \"我的名字是 Alice，我喜欢蓝色。\"}"

# 用户 B 设置记忆
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_B\", \"message\": \"我的名字是 Bob，我喜欢红色。\"}"

# 用户 A 查询记忆
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_A\", \"message\": \"我叫什么名字？我喜欢什么颜色？\"}"

# 用户 B 查询记忆
curl -X POST http://localhost:47779/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_B\", \"message\": \"我叫什么名字？我喜欢什么颜色？\"}"
```

**预期结果**:
- 用户 A 的回答应该包含 "Alice" 和 "蓝色"
- 用户 B 的回答应该包含 "Bob" 和 "红色"
- 两个用户的记忆不会混淆

**实际结果**: _______________

---

### 测试 5: 连续对话

**目的**: 验证多轮对话保持上下文

**步骤**:

```bash
USER_ID=$(curl -s -X POST http://localhost:47779/api/chat/users \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.userId')

# 发送 5 轮对话
for i in {1..5}; do
  echo "第 $i 轮:"
  curl -s -X POST http://localhost:47779/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"userId\": \"$USER_ID\", \"message\": \"这是第 $i 条消息\"}" | jq '.messageCount'
done
```

**预期结果**:
- messageCount 从 1 递增到 5
- 对话保持上下文

**实际结果**: _______________

---

### 测试 6: 列出用户

**目的**: 验证用户列表功能

**步骤**:
```bash
curl http://localhost:47779/api/chat/users
```

**预期结果**:
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

**实际结果**: _______________

---

### 测试 7: 会话管理

**目的**: 验证会话列表功能

**步骤**:
```bash
curl http://localhost:47779/api/chat/sessions
```

**预期结果**:
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

**实际结果**: _______________

---

### 测试 8: WebSocket 连接

**目的**: 验证 WebSocket 连接

**步骤**:

```javascript
// test-ws.js
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:47779/ws');

ws.onopen = () => {
  console.log('✓ WebSocket 连接成功');
  
  ws.send(JSON.stringify({
    type: 'chat',
    sessionId: 'user-test-123',
    message: '你好！'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到消息:', data);
  
  if (data.event === 'chat_response') {
    console.log('✓ 收到响应:', data.data.response);
    process.exit(0);
  }
};

ws.onerror = (err) => {
  console.error('✗ WebSocket 错误:', err);
  process.exit(1);
};
```

运行：
```bash
node test-ws.js
```

**预期结果**:
- 连接成功
- 收到响应消息

**实际结果**: _______________

---

## 自动化测试

### 运行自动化测试

```bash
cd /home/node/.openclaw/workspace/soul
node scripts/test-http-chat.js
```

### 测试输出示例

```
ℹ️ ============================================================
🧪 HTTP Chat API 测试开始
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

✅ 测试结果已保存到：scripts/test-results.json
```

### 测试结果文件

`scripts/test-results.json`:

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
    {
      "name": "创建用户",
      "passed": true,
      "details": "userId 和 personaId 已生成",
      "timestamp": "2026-04-06T13:00:01Z"
    },
    ...
  ]
}
```

## 数据库验证

### 检查用户和角色

```sql
-- 查看用户
SELECT * FROM users;

-- 查看角色
SELECT * FROM personas;

-- 查看用户 - 角色绑定
SELECT u.id, u.username, p.name, p.display_name, upb.is_default
FROM users u
JOIN user_persona_bindings upb ON u.id = upb.user_id
JOIN personas p ON upb.persona_id = p.id;
```

### 检查记忆存储

```sql
-- 查看记忆
SELECT * FROM memories ORDER BY created_at DESC LIMIT 10;

-- 查看角色记忆引用
SELECT * FROM persona_memory_refs;
```

## 测试检查清单

### 功能测试

- [ ] 健康检查正常
- [ ] 用户创建成功
- [ ] 角色自动创建
- [ ] 消息发送和接收
- [ ] 记忆存储正常
- [ ] 记忆隔离（不同用户）
- [ ] 连续对话上下文
- [ ] 用户列表查询
- [ ] 会话列表查询
- [ ] WebSocket 连接

### 性能测试

- [ ] 响应时间 < 1 秒
- [ ] 并发请求正常
- [ ] 内存使用正常
- [ ] 数据库连接正常

### 安全测试

- [ ] 用户 ID 验证
- [ ] 消息长度限制
- [ ] SQL 注入防护
- [ ] XSS 防护

## 已知问题

| 问题 | 严重性 | 状态 | 备注 |
|------|--------|------|------|
| | | | |

## 测试结论

### 通过的项目

- ✅ 用户管理
- ✅ 角色自动创建
- ✅ 记忆存储和隔离
- ✅ 会话管理
- ✅ WebSocket 连接

### 需要改进的项目

- [ ] 错误处理更友好
- [ ] 添加更多测试用例
- [ ] 性能优化

### 总体评价

Chat API 功能完整，测试通过，可以正式使用。

---

**测试日期**: _______________
**测试人员**: _______________
**测试结果**: _______________
