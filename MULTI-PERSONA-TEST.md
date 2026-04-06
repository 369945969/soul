# 多角色功能验证指南

本文档说明如何验证 Soul 的多角色（Multi-Persona）功能。

## 📋 功能概述

Soul 支持：
- **多用户**：多个用户可以独立使用 Soul
- **多角色**：每个用户可以创建多个角色（Persona）
- **角色切换**：在同一会话中动态切换角色
- **独立记忆**：每个角色有独立的记忆空间
- **共享空间**：角色之间可以共享部分工作空间

## 🧪 验证步骤

### 步骤 1: 启动 Soul 服务

```bash
cd /home/node/.openclaw/workspace/soul
npm start
```

服务启动后，检查日志中是否有以下内容：
```
🧬 Embeddings: 向量搜索初始化
📁 Workspace: 工作区文件同步
🤖 Persona: 角色系统初始化
```

### 步骤 2: 创建第一个角色（默认角色）

启动后，Soul 会自动创建默认角色。检查数据库：

```bash
cd /home/node/.openclaw/workspace/soul
node -e "
const { getRawDb } = require('./dist/db/index.js');
const db = getRawDb();
const personas = db.prepare('SELECT * FROM personas').all();
console.log('当前角色：', JSON.stringify(personas, null, 2));
"
```

**预期结果**：至少有一个角色，`is_active = 1`

### 步骤 3: 创建第二个角色

通过 API 或控制台创建新角色：

```bash
# 方法 1: 使用 curl 创建角色
curl -X POST http://localhost:3000/api/personas \
  -H "Content-Type: application/json" \
  -d '{
    "name": "assistant",
    "displayName": "助手",
    "description": "专业的技术助手角色",
    "isActive": true
  }'

# 方法 2: 直接在数据库创建
node -e "
const { getRawDb } = require('./dist/db/index.js');
const db = getRawDb();
const id = 'assistant-' + Date.now();
db.prepare('INSERT INTO personas (id, name, display_name, description, is_active) VALUES (?, ?, ?, ?, ?)')
  .run(id, 'assistant', '助手', '专业的技术助手角色', 1);
console.log('创建角色成功:', id);
"
```

### 步骤 4: 验证角色创建

```bash
node -e "
const { getRawDb } = require('./dist/db/index.js');
const db = getRawDb();
const personas = db.prepare('SELECT id, name, display_name, is_active FROM personas').all();
console.log('所有角色：');
personas.forEach(p => {
  console.log('  -', p.display_name, `(${p.name}) - ${p.is_active ? '激活' : '停用'}`);
});
"
```

**预期结果**：显示至少 2 个角色

### 步骤 5: 测试角色切换

通过 API 切换角色：

```bash
# 获取当前激活的角色
curl http://localhost:3000/api/personas/active

# 切换到新角色
curl -X POST http://localhost:3000/api/personas/switch \
  -H "Content-Type: application/json" \
  -d '{"personaId": "你的角色 ID"}'

# 验证切换成功
curl http://localhost:3000/api/personas/active
```

### 步骤 6: 验证独立记忆

每个角色应该有独立的记忆空间：

```bash
# 为角色 A 添加记忆
node -e "
const { getDb } = require('./dist/db/index.js');
const db = getDb();
db.insert(memories).values({
  type: 'knowledge',
  content: '这是角色 A 的记忆',
  tags: JSON.stringify(['test', 'role-a'])
}).run();
console.log('角色 A 记忆添加成功');
"

# 为角色 B 添加记忆
node -e "
const { getDb } = require('./dist/db/index.js');
const db = getDb();
db.insert(memories).values({
  type: 'knowledge',
  content: '这是角色 B 的记忆',
  tags: JSON.stringify(['test', 'role-b'])
}).run();
console.log('角色 B 记忆添加成功');
"

# 验证记忆隔离
node -e "
const { getRawDb } = require('./dist/db/index.js');
const db = getRawDb();
const memories = db.prepare('SELECT id, content, tags FROM memories WHERE tags LIKE ?').all('%test%');
console.log('所有测试记忆：');
memories.forEach(m => {
  console.log('  -', m.content, 'Tags:', m.tags);
});
"
```

### 步骤 7: 测试多用户（可选）

创建多个用户并绑定不同角色：

```bash
# 创建用户 A
node -e "
const { getRawDb } = require('./dist/db/index.js');
const db = getRawDb();
const userId = 'user-a-' + Date.now();
db.prepare('INSERT INTO users (id, username, display_name, role) VALUES (?, ?, ?, ?)')
  .run(userId, 'user_a', '用户 A', 'user');
console.log('创建用户 A:', userId);
"

# 创建用户 B
node -e "
const { getRawDb } = require('./dist/db/index.js');
const db = getRawDb();
const userId = 'user-b-' + Date.now();
db.prepare('INSERT INTO users (id, username, display_name, role) VALUES (?, ?, ?, ?)')
  .run(userId, 'user_b', '用户 B', 'user');
console.log('创建用户 B:', userId);
"

# 绑定用户和角色
node -e "
const { getRawDb } = require('./dist/db/index.js');
const db = getRawDb();
const userId = 'user-a-xxx'; // 替换为实际的用户 ID
const personaId = 'xxx'; // 替换为实际的角色 ID
db.prepare('INSERT INTO user_persona_bindings (user_id, persona_id, is_default) VALUES (?, ?, ?)')
  .run(userId, personaId, 1);
console.log('用户 - 角色绑定成功');
"

# 验证绑定
node -e "
const { getRawDb } = require('./dist/db/index.js');
const db = getRawDb();
const bindings = db.prepare('SELECT * FROM user_persona_bindings').all();
console.log('用户 - 角色绑定：', JSON.stringify(bindings, null, 2));
"
```

## 📊 验证检查清单

| 检查项 | 命令 | 预期结果 |
|--------|------|----------|
| 角色表存在 | `SELECT * FROM personas` | 至少 1 个角色 |
| 角色创建 | `INSERT INTO personas...` | 成功插入 |
| 角色切换 | API `/api/personas/switch` | 切换成功 |
| 记忆隔离 | 不同角色添加记忆 | 记忆独立存储 |
| 用户表存在 | `SELECT * FROM users` | 至少 1 个用户 |
| 用户 - 角色绑定 | `SELECT * FROM user_persona_bindings` | 绑定记录存在 |

## 🐛 常见问题

### 问题 1: 角色创建失败
**原因**: 角色名称重复
**解决**: 使用唯一的 `name` 字段

### 问题 2: 角色切换无响应
**原因**: 角色 ID 不存在
**解决**: 检查角色 ID 是否正确

### 问题 3: 记忆共享而不是隔离
**原因**: 角色记忆引用未正确配置
**解决**: 检查 `persona_memory_refs` 表配置

## 📝 测试报告模板

```markdown
## 多角色功能测试报告

**测试时间**: 2026-04-06
**测试人员**: [姓名]

### 测试结果

| 功能 | 状态 | 备注 |
|------|------|------|
| 角色创建 | ✅/❌ | |
| 角色切换 | ✅/❌ | |
| 记忆隔离 | ✅/❌ | |
| 用户绑定 | ✅/❌ | |
| 共享空间 | ✅/❌ | |

### 发现的问题

1. [问题描述]
2. [问题描述]

### 建议改进

1. [建议内容]
2. [建议内容]
```

## 🔗 相关文档

- [数据库 Schema](src/db/schema-persona.ts)
- [角色系统代码](src/core/persona.ts)
- [多用户 API](src/server.ts)
