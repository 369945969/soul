#!/usr/bin/env node

/**
 * 验证 Qwen3.5 模型配置
 */

import { addCustomProvider, chat, getDefaultConfig, listConfiguredProviders } from './src/core/llm-connector.js';

console.log("=== Qwen3.5 模型配置验证 ===\n");

// 1. 添加 qwen3.5 模型配置
console.log("1. 添加 Qwen3.5 提供商配置...");
const result = addCustomProvider({
  id: "qwen35-openclawd",
  name: "Qwen3.5 (OpenClawd)",
  type: "openai-compatible",
  baseUrl: "https://api.openclawd.example.com/v1",
  apiKey: process.env.QWEN35_API_KEY || "test-key-for-validation",
  modelId: "qwen3.5-122b",
  modelName: "Qwen3.5 122B",
  contextWindow: 131072,
  isDefault: false
});

console.log("✅", result.message);

// 2. 列出所有配置的提供商
console.log("\n2. 已配置的提供商:");
const providers = listConfiguredProviders();
providers.forEach(p => {
  console.log(`   - ${p.providerName} (${p.providerId})`);
  console.log(`     Model: ${p.modelName}`);
  console.log(`     URL: ${p.baseUrl}`);
});

// 3. 检查当前配置
console.log("\n3. 当前默认配置:");
const config = getDefaultConfig();
if (config) {
  console.log(`   Provider: ${config.providerId}`);
  console.log(`   Model: ${config.modelId}`);
  console.log(`   URL: ${config.baseUrl}`);
} else {
  console.log("   未配置默认提供商");
}

console.log("\n✅ 配置验证完成！");
console.log("\n提示：");
console.log("  - 需要设置 QWEN35_API_KEY 环境变量");
console.log("  - 需要更新 baseUrl 为实际的 OpenClawd API 地址");
console.log("  - 使用 soul_llm_add 命令可以交互式添加配置");
