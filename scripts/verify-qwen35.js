#!/usr/bin/env node

/**
 * Qwen3.5 模型验证脚本
 * 
 * 用法：
 *   QWEN35_API_KEY=your_api_key node scripts/verify-qwen35.js
 */

import { chat, getDefaultConfig, setDefaultProvider, addCustomProvider } from '../dist/core/llm-connector.js';

async function verifyQwen35() {
  console.log('=== Qwen3.5 模型验证 ===\n');
  
  const apiKey = process.env.QWEN35_API_KEY;
  if (!apiKey) {
    console.log('❌ 错误：需要设置 QWEN35_API_KEY 环境变量');
    console.log('\n用法：QWEN35_API_KEY=your_api_key node scripts/verify-qwen35.js');
    return;
  }
  
  // 1. 添加配置
  console.log('1. 配置 Qwen3.5 提供商...');
  const result = addCustomProvider({
    id: 'qwen35-openclawd',
    name: 'Qwen3.5 (OpenClawd)',
    type: 'openai-compatible',
    baseUrl: 'https://api.openclawd.example.com/v1',
    apiKey: apiKey,
    modelId: 'qwen3.5-122b',
    modelName: 'Qwen3.5 122B',
    contextWindow: 131072,
    isDefault: true
  });
  console.log('✅', result.message);
  
  // 2. 测试简单对话
  console.log('\n2. 测试简单对话...');
  try {
    const response = await chat([
      { role: 'user', content: '你好！请用一句话介绍你自己。' }
    ], {
      providerId: 'qwen35-openclawd',
      modelId: 'qwen3.5-122b',
      temperature: 0.7,
      maxTokens: 100
    });
    
    console.log('✅ 响应成功！');
    console.log('   模型:', response.model);
    console.log('   提供商:', response.provider);
    console.log('   令牌:', response.usage.totalTokens);
    console.log('\n   回复:', response.content?.substring(0, 100) + '...');
  } catch (err) {
    console.log('❌ 测试失败:', err.message);
  }
  
  console.log('\n✅ 验证完成！');
}

verifyQwen35().catch(console.error);
