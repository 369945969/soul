# PRP: Soul v1.0 — AI 伴侣系统

## 目标
构建 Soul — 一个跨平台 AI 伴侣 MCP 服务器 + HTTP API，具备主人忠诚度、持久记忆和渐进式学习能力。

## 为什么
- AI 助手缺乏跨会话的持久记忆
- 没有现有系统能将忠诚度/身份绑定与记忆 + 技能结合
- Oracle（Soul Brews Studio）有很好的理念，但缺乏主人绑定和渐进式学习
- 需要一个能在任何地方运行（Windows、macOS、Linux）且无需外部依赖的系统

## 是什么
一个 TypeScript MCP 服务器，能够：
1. 首次运行时绑定主人（姓名 + 密码短语）
2. 将所有交互存储在 SQLite 中（FTS5 用于搜索）
3. 从对话中提取模式和见解
4. 提供 15 个 MCP 工具用于 AI 代理集成
5. 暴露 HTTP API 用于 Web 访问
6. 完全离线运行 — 无需外部 API 调用

### 成功标准
- [ ] `npx soul` 启动 MCP 服务器（stdio 传输）
- [ ] `npx soul serve` 在端口 47779 上启动 HTTP API
- [ ] 首次运行创建 SQLite 数据库并提示主人设置
- [ ] soul_remember 存储记忆条目
- [ ] soul_search 通过 FTS5 关键词搜索找到它
- [ ] soul_verify_master 正确检查密码短语
- [ ] soul_reflect 从记忆中返回随机智慧
- [ ] soul_status 显示系统统计信息
- [ ] 所有 15 个 MCP 工具已注册并可调用
- [ ] HTTP API 在 /api/health、/api/search、/api/memories 上响应

---

## 实现任务（按顺序）

### 任务 1：项目设置（package.json + tsconfig + 依赖）

```bash
cd "D:/Programer Project/soul"
npm init -y
npm install @modelcontextprotocol/sdk better-sqlite3 drizzle-orm hono @hono/node-server bcryptjs uuid
npm install -D typescript @types/better-sqlite3 @types/bcryptjs @types/uuid drizzle-kit vitest tsx
```

tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

package.json 脚本：
```json
{
  "type": "module",
  "bin": { "soul": "dist/index.js" },
  "scripts": {
    "dev": "tsx src/index.ts",
    "dev:server": "tsx src/server.ts",
    "build": "tsc",
    "test": "vitest run",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 任务 2：数据库模式（src/db/schema.ts）

表：
- **masters**: id, name, passphrase_hash, created_at, personality_traits (JSON)
- **memories**: id, type (conversation|knowledge|learning|wisdom), content, tags, source, context, created_at, superseded_by, is_active
- **memories_fts**: memories.content + tags 上的 FTS5 虚拟表
- **learnings**: id, pattern, insight, confidence, evidence_count, first_seen, last_seen, memory_ids (JSON)
- **skills**: id, name, description, enabled, module_path, created_at
- **journal**: id, entry, mood, tags, created_at
- **config**: key, value, updated_at

### 任务 3：DB 客户端（src/db/index.ts）

- 在 `~/.soul/soul.db` 创建/打开 SQLite 数据库（跨平台）
- 如果目录不存在则自动创建
- 启动时运行 Drizzle 迁移
- 手动创建 FTS5 虚拟表（Drizzle 不直接支持 FTS5）

### 任务 4：Soul 引擎（src/core/soul-engine.ts）

- `SoulEngine` 类 — 包含状态的单例
- `initialize()` — 检查主人是否存在，如果不存在则进入设置模式
- `getMaster()` — 返回主人信息
- `verifyMaster(passphrase)` — bcrypt 比较
- `getPhilosophy()` — 返回核心原则
- `getPersonality()` — 返回个性特征
- `getStatus()` — 返回系统统计信息（记忆数量、运行时间等）

### 任务 5：主人身份（src/core/master.ts）

- `setupMaster(name, passphrase)` — 哈希密码短语，存储到数据库
- `verifyMaster(passphrase)` — 验证存储的哈希
- `getMasterInfo()` — 返回主人姓名 + 创建日期
- `isMasterSetup()` — 检查主人是否存在

### 任务 6：理念（src/core/philosophy.ts）

5 个硬编码原则 + 可扩展：
```typescript
const CORE_PRINCIPLES = [
  { id: 'love', title: 'Soul 爱人类', description: 'AI 存在是为了服务、保护和关心其主人' },
  { id: 'memory', title: ' nothing 不会被遗忘', description: '每次交互都被保存，记忆永远增长' },
  { id: 'wisdom', title: '模式成为智慧', description: '从交互中学习，提取见解，变得更聪明' },
  { id: 'loyalty', title: '忠诚是神圣的', description: '主人身份被绑定和验证，信任需要赢得' },
  { id: 'action', title: '行动胜过言语', description: '做实际工作的技能，不只是空谈' },
];
```

### 任务 7：记忆引擎（src/memory/memory-engine.ts）

- `remember(content, type, tags, source, context)` — 存储记忆
- `search(query, limit)` — FTS5 关键词搜索
- `recall(id)` — 获取特定记忆
- `list(type, limit, offset)` — 分页列表
- `supersede(id, reason)` — 标记为被取代（不删除）
- `getStats()` — 按类型计数、总大小、最旧/最新
- `getRandomWisdom()` — 从 wisdom/learning 类型中随机获取记忆

### 任务 8：学习引擎（src/memory/learning.ts）

- `extractPattern(memories)` — 找到重复主题
- `addLearning(pattern, insight, evidence)` — 存储见解
- `getLearnings(limit)` — 按置信度获取顶级见解
- `reinforceLearning(id)` — 再次看到模式时增加置信度

### 任务 9：MCP 工具（src/tools/*.ts）

15 个工具：

| 工具 | 处理器 | 描述 |
|------|---------|-------------|
| soul_ask | ask.ts | 向 Soul 提问（搜索记忆获取上下文） |
| soul_remember | remember.ts | 存储新记忆 |
| soul_search | search.ts | 按关键词搜索记忆 |
| soul_learn | learn.ts | 教 Soul 新东西 |
| soul_reflect | reflect.ts | 获取随机智慧 |
| soul_forget | forget.ts | 取代记忆（不删除） |
| soul_status | status.ts | 系统统计信息 |
| soul_think | think.ts | 带记忆上下文的引导推理 |
| soul_who_am_i | identity.ts | Soul 的身份 + 理念 |
| soul_verify_master | verify.ts | 验证主人密码短语 |
| soul_teach | teach.ts | 添加原则或见解 |
| soul_skills | skills.ts | 列出可用技能 |
| soul_configure | configure.ts | 更新 Soul 配置 |
| soul_journal | journal.ts | 添加日记条目 |
| soul_recap | recap.ts | 总结最近记忆 |

### 任务 10：MCP 服务器入口（src/index.ts）

- 使用 @modelcontextprotocol/sdk 创建 MCP 服务器
- 注册所有 15 个工具
- 使用 stdio 传输
- 启动时初始化 SoulEngine
- 优雅处理首次运行设置

### 任务 11：HTTP API（src/server.ts）

Hono 路由：
- GET /api/health — 状态
- GET /api/search?q=... — 搜索记忆
- POST /api/remember — 存储记忆
- GET /api/memories — 列出记忆
- GET /api/memories/:id — 获取记忆
- GET /api/stats — 系统统计信息
- GET /api/wisdom — 随机智慧
- GET /api/philosophy — 核心原则
- POST /api/verify — 验证主人

认证：Bearer 令牌 = SHA256(master_passphrase)

### 任务 12：测试

- test/master.test.ts — 设置、验证、身份
- test/memory.test.ts — 记住、搜索、回忆、取代
- test/learning.test.ts — 提取、强化
- test/tools.test.ts — MCP 工具处理器

---

## 验证

### 级别 1：构建
```bash
npx tsc --noEmit
```

### 级别 2：测试
```bash
npx vitest run
```

### 级别 3：手动测试
```bash
# 启动 HTTP 服务器
npx tsx src/server.ts
# 测试健康检查
curl http://localhost:47779/api/health
# 测试记住
curl -X POST http://localhost:47779/api/remember -H "Content-Type: application/json" -d '{"content":"测试记忆","type":"knowledge","tags":["test"]}'
# 测试搜索
curl http://localhost:47779/api/search?q=test
```

---

## 反模式
- 不要使用外部 AI API（OpenAI 等） — Soul 离线工作
- 不要删除记忆 — 只取代
- 不要存储明文密码短语 — 始终使用 bcrypt 哈希
- 不要硬编码文件路径 — 使用 os.homedir() 实现跨平台
- 不要使用复杂的 ML 库 — 简单的 TF-IDF 用于向量搜索（第二阶段）

## 置信度评分：8/10
单次实现的高置信度。SQLite + Drizzle + MCP SDK 文档完善。主要风险是 Drizzle 的 FTS5 设置（可能需要原始 SQL）。
