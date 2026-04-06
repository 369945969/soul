#!/usr/bin/env node

/**
 * OpenAI 兼容提供商 CLI 测试工具（非交互式）
 */

import { addCustomProvider, listConfiguredProviders, getDefaultConfig, setDefaultProvider } from '../dist/core/llm-connector.js';

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║    OpenAI 兼容提供商 CLI 测试工具                    ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// 1. 显示当前配置
console.log('📋 步骤 1: 查看当前配置');
console.log('─'.repeat(60));
const providers = listConfiguredProviders();
if (providers.length === 0) {
  console.log('   暂无已配置的提供商');
} else {
  providers.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.providerName} (${p.providerId})`);
    console.log(`      模型：${p.modelName}`);
    console.log(`      URL: ${p.baseUrl}`);
    console.log(`      状态：${p.isDefault ? '⭐ 默认' : '可用'}`);
  });
}

const defaultConfig = getDefaultConfig();
if (defaultConfig) {
  console.log('\n   ⭐ 当前默认配置:');
  console.log(`      Provider: ${defaultConfig.providerId}`);
  console.log(`      Model: ${defaultConfig.modelId}`);
}

// 2. 添加 Qwen3.5 配置（使用环境变量或默认值）
console.log('\n📋 步骤 2: 添加 Qwen3.5 配置');
console.log('─'.repeat(60));

const apiKey = process.env.QWEN35_API_KEY || process.argv[2] || 'test-key';
const baseUrl = process.env.QWEN35_BASE_URL || 'https://api.openclawd.example.com/v1';
const isDefault = process.argv[3] === '--default';

console.log(`   提供商：Qwen3.5 (OpenClawd)`);
console.log(`   模型：qwen3.5-122b`);
console.log(`   URL: ${baseUrl}`);
console.log(`   API Key: ${apiKey.substring(0, 4)}...${apiKey.length > 8 ? apiKey.substring(apiKey.length - 4) : ''}`);
console.log(`   默认：${isDefault ? '是' : '否'}`);

console.log('\n   ⏳ 正在添加配置...');
const result = addCustomProvider({
  id: 'qwen35-openclawd',
  name: 'Qwen3.5 (OpenClawd)',
  type: 'openai-compatible',
  baseUrl: baseUrl,
  apiKey: apiKey,
  modelId: 'qwen3.5-122b',
  modelName: 'Qwen3.5 122B',
  contextWindow: 131072,
  isDefault: isDefault
});

console.log(`   ✅ ${result.message}`);

// 3. 显示更新后的配置
console.log('\n📋 步骤 3: 更新后的配置');
console.log('─'.repeat(60));
const updatedProviders = listConfiguredProviders();
updatedProviders.forEach((p, i) => {
  const maskKey = p.apiKey ? p.apiKey.substring(0, 4) + '...' + p.apiKey.substring(p.apiKey.length - 4) : 'N/A';
  console.log(`   ${i + 1}. ${p.providerName} (${p.providerId})`);
  console.log(`      模型：${p.modelName}`);
  console.log(`      URL: ${p.baseUrl}`);
  console.log(`      API Key: ${maskKey}`);
  console.log(`      状态：${p.isDefault ? '⭐ 默认' : '可用'}`);
});

// 4. 测试设置默认
if (isDefault) {
  console.log('\n📋 步骤 4: 验证默认配置');
  console.log('─'.repeat(60));
  const newDefault = getDefaultConfig();
  if (newDefault && newDefault.providerId === 'qwen35-openclawd') {
    console.log('   ✅ 默认配置设置成功');
    console.log(`      Provider: ${newDefault.providerId}`);
    console.log(`      Model: ${newDefault.modelId}`);
  } else {
    console.log('   ⚠️  默认配置可能未正确设置');
  }
}

// 5. 总结
console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║                    测试完成                            ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

console.log('📊 统计信息:');
console.log(`   - 已配置提供商：${listConfiguredProviders().length}`);
console.log(`   - 默认提供商：${getDefaultConfig() ? getDefaultConfig().providerId : '无'}`);

console.log('\n📚 下一步:');
console.log('   1. 查看完整文档：OPENAI_COMPATIBLE_PROVIDERS.md');
console.log('   2. 使用聊天 API: curl -X POST http://localhost:47779/api/chat ...');
console.log('   3. 在 Soul 聊天中使用：soul_llm_add({...})\n');
