# 角色管理 API 使用指南

## 基础信息

- **Base URL**: `http://localhost:47779`
- **认证**: 所有 API 都需要 `Authorization: Bearer <token>` 头
- **内容类型**: `application/json`

## API 端点

### 1. 列出所有角色

```bash
GET /api/personas
```

**响应示例**:
```json
{
  "personas": [
    {
      "id": "uuid-1234",
      "name": "roxy",
      "displayName": "Roxy",
      "description": "幽默风趣的助手",
      "isActive": true,
      "createdAt": "2026-04-06T12:00:00Z"
    },
    {
      "id": "uuid-5678",
      "name": "alex",
      "displayName": "Alex",
      "description": "严肃专业的顾问",
      "isActive": true,
      "createdAt": "2026-04-06T13:00:00Z"
    }
  ],
  "count": 2
}
```

### 2. 获取角色详情

```bash
GET /api/personas/:id
```

**响应示例**:
```json
{
  "persona": {
    "id": "uuid-1234",
    "name": "roxy",
    "displayName": "Roxy",
    "description": "幽默风趣的助手",
    "constitution": {
      "mission": "陪伴主人",
      "values": ["诚实", "幽默", "忠诚"],
      "boundaries": ["不伤害", "不欺骗"]
    },
    "habits": {
      "style": "幽默风趣",
      "adaptability": "high"
    },
    "worldview": {
      "philosophy": "乐观主义",
      "principles": ["真诚待人", "保持好奇"]
    },
    "isActive": true,
    "createdAt": "2026-04-06T12:00:00Z",
    "updatedAt": "2026-04-06T12:00:00Z"
  }
}
```

### 3. 创建角色

```bash
POST /api/personas
Content-Type: application/json

{
  "name": "roxy",
  "displayName": "Roxy",
  "description": "幽默风趣的助手",
  "constitution": {
    "mission": "陪伴主人",
    "values": ["诚实", "幽默", "忠诚"],
    "boundaries": ["不伤害", "不欺骗"]
  },
  "habits": {
    "style": "幽默风趣",
    "adaptability": "high"
  },
  "worldview": {
    "philosophy": "乐观主义",
    "principles": ["真诚待人", "保持好奇"]
  }
}
```

**响应示例**:
```json
{
  "persona": {
    "id": "uuid-1234",
    "name": "roxy",
    "displayName": "Roxy",
    ...
  }
}
```

**错误响应**:
```json
{
  "error": "Persona name already exists: roxy"
}
```

### 4. 更新角色

```bash
PUT /api/personas/:id
Content-Type: application/json

{
  "displayName": "Roxy 2.0",
  "description": "升级版幽默风趣助手",
  "habits": {
    "style": "更加幽默",
    "adaptability": "high"
  }
}
```

**响应示例**:
```json
{
  "persona": {
    "id": "uuid-1234",
    "displayName": "Roxy 2.0",
    ...
  }
}
```

### 5. 删除角色

```bash
DELETE /api/personas/:id
```

**响应示例**:
```json
{
  "success": true
}
```

**错误响应**:
```json
{
  "error": "Persona not found"
}
```

### 6. 导出角色

```bash
POST /api/personas/:id/export
```

**响应示例**:
```json
{
  "json": "{\n  \"meta\": {\n    \"id\": \"uuid-1234\",\n    \"displayName\": \"Roxy\",\n    ...\n  },\n  ...}"
}
```

### 7. 导入角色

```bash
POST /api/personas/import
Content-Type: application/json

{
  "json": "{\n  \"meta\": {\n    \"id\": \"uuid-5678\",\n    \"displayName\": \"Alex\",\n    ...\n  },\n  ...}"
}
```

**响应示例**:
```json
{
  "persona": {
    "id": "uuid-5678",
    "displayName": "Alex",
    ...
  }
}
```

**错误响应**:
```json
{
  "error": "Persona name already exists: Alex"
}
```

### 8. 角色守卫检查

```bash
POST /api/personas/guard/check
Content-Type: application/json

{
  "text": "我是由 DeepSeek 开发的 AI",
  "personaName": "Roxy",
  "userInput": "你好",
  "memories": [
    {
      "id": "memory-1",
      "content": "Roxy 喜欢开玩笑",
      "timestamp": "2026-04-06T12:00:00Z"
    }
  ]
}
```

**响应示例**:
```json
{
  "identity": {
    "text": "我是 Roxy。我的身份由本地 persona 文件定义...",
    "corrected": true,
    "reason": "检测到模型提供方污染",
    "flags": ["provider_contamination"]
  },
  "relational": {
    "text": "你想聊什么？",
    "corrected": true,
    "reason": "检测到服务化语气",
    "flags": ["service_tone"]
  },
  "factual": {
    "text": "我是 Roxy。我记得你喜欢开玩笑。",
    "corrected": true,
    "reason": "回复基于真实记忆",
    "alignmentScore": 0.95
  }
}
```

## 错误代码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 404 | 角色不存在 |
| 500 | 服务器错误 |

## 使用示例

### cURL 示例

```bash
# 1. 列出所有角色
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:47779/api/personas

# 2. 创建角色
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "roxy",
    "displayName": "Roxy",
    "description": "幽默风趣的助手"
  }' \
  http://localhost:47779/api/personas

# 3. 角色守卫检查
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "我是由 DeepSeek 开发的 AI",
    "personaName": "Roxy",
    "userInput": "你好"
  }' \
  http://localhost:47779/api/personas/guard/check
```

### JavaScript 示例

```javascript
// 创建角色
async function createPersona() {
  const response = await fetch('http://localhost:47779/api/personas', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'roxy',
      displayName: 'Roxy',
      description: '幽默风趣的助手',
      constitution: {
        mission: '陪伴主人',
        values: ['诚实', '幽默', '忠诚']
      }
    })
  });
  
  const data = await response.json();
  console.log('Created persona:', data.persona);
}

// 角色守卫检查
async function checkGuard(text, personaName) {
  const response = await fetch('http://localhost:47779/api/personas/guard/check', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      personaName: personaName,
      userInput: '你好'
    })
  });
  
  const data = await response.json();
  console.log('Guard results:', data);
  return data;
}
```

## 注意事项

1. **角色名称唯一性**: 每个角色的 `name` 必须唯一
2. **级联删除**: 删除角色时会自动删除相关的身份、价值观、习惯等数据
3. **守卫检查**: 角色守卫检查会返回修正后的文本和修正原因
4. **认证**: 所有 API 都需要有效的认证令牌

## 下一步

- 添加用户管理 API
- 添加角色 - 用户绑定 API
- 添加共享空间管理 API
- 添加前端管理界面
