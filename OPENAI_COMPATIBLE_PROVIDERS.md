# OpenAI 兼容提供商配置指南

## 概述

Soul 支持任何 OpenAI 兼容的 API 提供商，包括：
- Qwen3.5（OpenClawd）
- 自定义 OpenAI 兼容端点
- 第三方模型提供商

## 支持的模型

### Qwen3.5 系列
- `qwen3.5-122b` - Qwen3.5 122B（推荐）
- `qwen3.5-72b` - Qwen3.5 72B

### 其他 OpenAI 兼容模型
- `gpt-4o` - GPT-4o
- 任何自定义模型

## 配置方法

### 方法 1：使用环境变量（推荐）

```bash
# 设置 API 密钥
export QWEN35_API_KEY="your_api_key_here"

# 运行验证脚本
cd /home/node/.openclaw/workspace/soul
node scripts/verify-qwen35.js
```

### 方法 2：使用 soul_llm_add 命令

```javascript
// 在 Soul 聊天中使用
soul_llm_add({
  providerId: "openai-compatible",
  modelId: "qwen3.5-122b",
  isDefault: true,
  customBaseUrl: "https://api.openclawd.example.com/v1",
  apiKey: "your_api_key_here"
})
```

### 方法 3：使用 addCustomProvider API

```javascript
import { addCustomProvider } from './dist/core/llm-connector.js';

const result = addCustomProvider({
  id: "qwen35-openclawd",
  name: "Qwen3.5 (OpenClawd)",
  type: "openai-compatible",
  baseUrl: "https://api.openclawd.example.com/v1",
  apiKey: "your_api_key_here",
  modelId: "qwen3.5-122b",
  modelName: "Qwen3.5 122B",
  contextWindow: 131072,
  isDefault: true
});

console.log(result.message);
```

## 验证配置

### 1. 检查配置状态

```bash
cd /home/node/.openclaw/workspace/soul
node -e "
import('./dist/core/llm-connector.js').then(({ listConfiguredProviders, getDefaultConfig }) => {
  console.log('已配置的提供商:');
  listConfiguredProviders().forEach(p => {
    console.log(' -', p.providerName, '(', p.providerId, ')');
    console.log('   Model:', p.modelName);
  });
  
  const config = getDefaultConfig();
  if (config) {
    console.log('\n默认配置:');
    console.log(' - Provider:', config.providerId);
    console.log(' - Model:', config.modelId);
  }
});
"
```

### 2. 测试对话

```bash
QWEN35_API_KEY=your_key node scripts/verify-qwen35.js
```

### 3. 使用聊天 API

```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "你好",
    "providerId": "qwen35-openclawd",
    "modelId": "qwen3.5-122b"
  }' \
  http://localhost:47779/api/chat
```

## 自定义提供商配置

### 添加新的 OpenAI 兼容提供商

```javascript
import { addCustomProvider } from './dist/core/llm-connector.js';

const result = addCustomProvider({
  id: "my-custom-provider",
  name: "My Custom Provider",
  type: "openai-compatible",
  baseUrl: "https://api.myprovider.com/v1",
  apiKey: "your_api_key",
  modelId: "my-model",
  modelName: "My Model",
  contextWindow: 128000,
  isDefault: false
});
```

### 支持的参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 提供商唯一标识 |
| `name` | string | 是 | 提供商显示名称 |
| `type` | string | 是 | 固定为 `"openai-compatible"` |
| `baseUrl` | string | 是 | API 基础 URL（包含 `/v1`） |
| `apiKey` | string | 是 | API 密钥 |
| `modelId` | string | 是 | 模型标识符 |
| `modelName` | string | 是 | 模型显示名称 |
| `contextWindow` | number | 否 | 上下文窗口大小（默认 128000） |
| `isDefault` | boolean | 否 | 是否设为默认（默认 false） |

## 故障排除

### 问题 1：API 密钥错误

```
Error: qwen35-openclawd error (401): Unauthorized
```

**解决方案**：
- 检查 API 密钥是否正确
- 确保环境变量 `QWEN35_API_KEY` 已设置

### 问题 2：连接超时

```
Error: qwen35-openclawd error: Timeout
```

**解决方案**：
- 检查网络连接
- 确认 API 端点 URL 正确
- 增加超时时间（修改 `llm-connector.ts` 中的 `AbortSignal.timeout(120000)`）

### 问题 3：模型不支持

```
Error: Model not found
```

**解决方案**：
- 确认 `modelId` 正确
- 检查提供商是否支持该模型
- 联系提供商获取支持的模型列表

## 最佳实践

### 1. 使用环境变量存储密钥

```bash
# .env 文件
QWEN35_API_KEY=your_api_key_here
```

```javascript
// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();
```

### 2. 设置默认提供商

```javascript
import { setDefaultProvider } from './dist/core/llm-connector.js';

setDefaultProvider('qwen35-openclawd', 'qwen3.5-122b');
```

### 3. 多提供商配置

```javascript
// 配置多个提供商，根据需要切换
addCustomProvider({ id: 'qwen35-small', ..., modelId: 'qwen3.5-72b', isDefault: false });
addCustomProvider({ id: 'qwen35-large', ..., modelId: 'qwen3.5-122b', isDefault: true });
```

## API 参考

### addCustomProvider

添加新的 OpenAI 兼容提供商。

```typescript
function addCustomProvider(input: {
  id: string;
  name: string;
  type: "openai-compatible";
  baseUrl: string;
  apiKey: string;
  modelId: string;
  modelName: string;
  contextWindow?: number;
  isDefault?: boolean;
}): { success: boolean; message: string };
```

### listConfiguredProviders

列出所有已配置的提供商。

```typescript
function listConfiguredProviders(): Array<{
  providerId: string;
  providerName: string;
  providerType: string;
  baseUrl: string;
  modelId: string;
  modelName: string;
  isActive: boolean;
  isDefault: boolean;
}>;
```

### getDefaultConfig

获取当前默认提供商配置。

```typescript
function getDefaultConfig(): {
  providerId: string;
  providerType: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  modelName: string;
} | null;
```

### setDefaultProvider

设置默认提供商。

```typescript
function setDefaultProvider(providerId: string, modelId: string): boolean;
```

## 示例配置

### Qwen3.5 完整配置

```javascript
{
  id: "qwen35-openclawd",
  name: "Qwen3.5 (OpenClawd)",
  type: "openai-compatible",
  baseUrl: "https://api.openclawd.example.com/v1",
  apiKey: "sk-xxxxxxxxxxxxxxxx",
  modelId: "qwen3.5-122b",
  modelName: "Qwen3.5 122B",
  contextWindow: 131072,
  isDefault: true
}
```

### 自定义提供商配置

```javascript
{
  id: "my-provider",
  name: "My Custom Provider",
  type: "openai-compatible",
  baseUrl: "https://api.myprovider.com/v1",
  apiKey: "your_api_key",
  modelId: "custom-model",
  modelName: "Custom Model",
  contextWindow: 128000,
  isDefault: false
}
```

## 更新日志

- **2026-04-06** - 添加 OpenAI 兼容提供商支持
- **2026-04-06** - 添加 Qwen3.5 模型配置
- **2026-04-06** - 创建验证脚本
