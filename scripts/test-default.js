#!/usr/bin/env node

/**
 * 测试默认提供商设置
 */

import { addCustomProvider, listConfiguredProviders, getDefaultConfig, setDefaultProvider } from '../dist/core/llm-connector.js';

console.log('\n=== 测试默认提供商设置 ===\n');

// 1. 添加配置并设为默认
console.log('1. 添加 Qwen3.5 配置并设为默认...');
const result = addCustomProvider({
  id: 'qwen35-test',
  name: 'Qwen3.5 Test',
  type: 'openai-compatible',
  baseUrl: 'https://api.test.com/v1',
  apiKey: 'test-key-12345',
  modelId: 'qwen3.5-122b',
  modelName: 'Qwen3.5 122B',
  contextWindow: 131072,
  isDefault: true
});
console.log('   ✅', result.message);

// 2. 验证默认配置
console.log('\n2. 验证默认配置...');
const defaultConfig = getDefaultConfig();
if (defaultConfig) {
  console.log('   ✅ 默认配置设置成功');
  console.log('      Provider:', defaultConfig.providerId);
  console.log('      Model:', defaultConfig.modelId);
  console.log('      URL:', defaultConfig.baseUrl);
} else {
  console.log('   ❌ 默认配置未设置');
}

// 3. 列出所有提供商
console.log('\n3. 所有已配置提供商:');
const providers = listConfiguredProviders();
providers.forEach((p, i) => {
  console.log(`   ${i + 1}. ${p.providerName} (${p.providerId})`);
  console.log(`      Model: ${p.modelName}`);
  console.log(`      默认：${p.isDefault ? '⭐' : '✗'}`);
});

// 4. 测试 setDefaultProvider
console.log('\n4. 测试 setDefaultProvider API...');
const success = setDefaultProvider('qwen35-openclawd', 'qwen3.5-122b');
console.log('   ', success ? '✅' : '❌', 'setDefaultProvider 执行结果:', success ? '成功' : '失败');

// 5. 再次验证
console.log('\n5. 验证最终配置...');
const finalConfig = getDefaultConfig();
if (finalConfig) {
  console.log('   ✅ 当前默认配置:');
  console.log('      Provider:', finalConfig.providerId);
  console.log('      Model:', finalConfig.modelId);
}

console.log('\n=== 测试完成 ===\n');
