# Soul 多用户/多角色功能实现计划

基于 Soul-seed 的核心功能分析，在现有 soul 代码上实现以下功能：

## 核心功能清单

### 1. 多角色 (Persona) 系统

#### 1.1 数据结构设计
```typescript
// 新增数据库表
- personas: 角色元数据表
- persona_identity: 角色身份锚点
- persona_constitution: 角色价值观/原则
- persona_worldview: 角色世界观
- persona_habits: 角色行为特点
- persona_user_profiles: 每个角色对应的用户档案
- persona_memory_db: 每个角色的独立记忆数据库引用
```

#### 1.2 核心功能
- 创建新角色 (`createPersona`)
- 列出所有角色 (`listPersonas`)
- 切换角色 (`connectToPersona`)
- 角色导入/导出 (`importPersona`, `exportPersona`)
- 角色编译/验证 (`compilePersona`, `lintPersona`)

### 2. 角色守卫系统 (Guards)

#### 2.1 Identity Guard (身份守卫)
- 防止角色身份污染（如暴露底层模型）
- 检测语义身份漂移
- 自动纠正角色身份表述

#### 2.2 Relational Guard (关系守卫)
- 防止服务化语气（如"你的个人助手"）
- 防止虚构记忆引用
- 防止失忆声明

#### 2.3 Factual Grounding Guard (事实守卫)
- 确保回复基于真实记忆
- 防止虚构回忆

### 3. 多用户独立聊天

#### 3.1 用户隔离
- 每个用户独立的记忆数据库
- 每个用户独立的会话历史
- 用户认证和授权

#### 3.2 共享空间 (Shared Space)
- 用户与角色之间的文件共享
- 独立的读写权限控制

### 4. 会话调度器 (Turn Scheduler)

#### 4.1 多角色对话调度
- 反垄断机制（防止单一角色垄断发言）
- 三种调度模式：严格轮询、优先级轮询、自由发言
- 角色发言欲望计算

## 实现步骤

### 步骤 1: 数据库模式扩展
- 新增 persona 相关表
- 新增用户相关表
- 修改现有表添加 user_id 字段

### 步骤 2: 核心引擎实现
- Persona 管理器
- 角色守卫系统
- 用户认证系统
- 会话调度器

### 步骤 3: API 路由
- `/api/personas/*` - 角色管理
- `/api/users/*` - 用户管理
- `/api/shared-space/*` - 共享空间

### 步骤 4: 单元测试
- 为每个新功能编写测试
- 确保测试通过

## 文件结构

```
src/
├── core/
│   ├── persona/
│   │   ├── persona-manager.ts       # 角色管理器
│   │   ├── persona-types.ts         # 角色类型定义
│   │   ├── identity-guard.ts        # 身份守卫
│   │   ├── relational-guard.ts      # 关系守卫
│   │   ├── factual-guard.ts         # 事实守卫
│   │   └── turn-scheduler.ts        # 会话调度器
│   ├── user/
│   │   ├── user-manager.ts          # 用户管理器
│   │   └── auth.ts                  # 用户认证
│   └── shared-space/
│       └── shared-space.ts          # 共享空间管理
├── db/
│   └── schema-persona.ts            # 角色相关数据库模式
├── api/
│   └── routes/
│       ├── personas.ts              # 角色 API
│       ├── users.ts                 # 用户 API
│       └── shared-space.ts          # 共享空间 API
└── tests/
    ├── persona-manager.test.ts
    ├── identity-guard.test.ts
    ├── relational-guard.test.ts
    ├── user-manager.test.ts
    └── turn-scheduler.test.ts
```
