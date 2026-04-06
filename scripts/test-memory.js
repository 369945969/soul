#!/usr/bin/env node

/**
 * 多用户聊天、记忆和拟人化测试
 */

import { chat, chatStream } from '../dist/core/llm-connector.js';
import { remember, getRecentMemories, search } from '../dist/memory/memory-engine.js';

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║    多用户聊天、记忆和拟人化测试工具                  ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function runTests() {
  // 1. 测试多用户聊天
  console.log('📋 测试 1: 多用户聊天');
  console.log('─'.repeat(60));
  
  try {
    // 用户 A 的对话
    console.log('\n   👤 用户 A: 你好，我叫小明。');
    const responseA1 = await chat([
      { role: 'user', content: '你好，我叫小明。' }
    ]);
    console.log('   🤖 Soul:', responseA1.content.substring(0, 100) + '...');
    
    console.log('\n   👤 用户 A: 我今天很开心。');
    const responseA2 = await chat([
      { role: 'user', content: '你好，我叫小明。' },
      { role: 'assistant', content: responseA1.content },
      { role: 'user', content: '我今天很开心。' }
    ]);
    console.log('   🤖 Soul:', responseA2.content.substring(0, 100) + '...');
    
    // 用户 B 的对话
    console.log('\n   👤 用户 B: 你好，我叫小红。');
    const responseB1 = await chat([
      { role: 'user', content: '你好，我叫小红。' }
    ]);
    console.log('   🤖 Soul:', responseB1.content.substring(0, 100) + '...');
    
    console.log('\n   👤 用户 B: 我今天很累。');
    const responseB2 = await chat([
      { role: 'user', content: '你好，我叫小红。' },
      { role: 'assistant', content: responseB1.content },
      { role: 'user', content: '我今天很累。' }
    ]);
    console.log('   🤖 Soul:', responseB2.content.substring(0, 100) + '...');
    
    console.log('\n   ✅ 多用户聊天测试完成');
    console.log('      - 用户 A 和小明可以正常对话');
    console.log('      - 用户 B 和小红可以正常对话');
    
  } catch (err) {
    console.log('   ❌ 多用户聊天测试失败:', err.message);
  }

  // 2. 测试聊天记忆
  console.log('\n📋 测试 2: 聊天记忆');
  console.log('─'.repeat(60));
  
  try {
    // 存储记忆
    console.log('\n   ⏳ 存储记忆...');
    await remember({
      content: '用户小明告诉我他今天很开心，因为完成了一个项目。',
      type: 'conversation',
      tags: ['user', 'mood', 'happy']
    });
    
    await remember({
      content: '用户小红告诉我她很累，需要休息。',
      type: 'conversation',
      tags: ['user', 'mood', 'tired']
    });
    
    console.log('   ✅ 记忆存储成功');
    
    // 查询记忆
    console.log('\n   ⏳ 查询最近记忆...');
    const recent = await getRecentMemories(5);
    console.log('   ✅ 找到', recent.length, '条记忆');
    recent.forEach((m, i) => {
      console.log(`      ${i + 1}. [${m.type}] ${m.content.substring(0, 50)}...`);
    });
    
    // 语义搜索
    console.log('\n   ⏳ 语义搜索"用户心情"...');
    const searchResults = await search('用户心情', 3);
    console.log('   ✅ 找到', searchResults.length, '条相关记忆');
    searchResults.forEach((m, i) => {
      console.log(`      ${i + 1}. [${m.type}] ${m.content.substring(0, 50)}...`);
    });
    
    console.log('\n   ✅ 聊天记忆测试完成');
    
  } catch (err) {
    console.log('   ❌ 聊天记忆测试失败:', err.message);
  }

  // 3. 测试拟人化
  console.log('\n📋 测试 3: 拟人化');
  console.log('─'.repeat(60));
  
  try {
    const tests = [
      {
        name: '情感回应',
        input: '我今天心情不好，有点难过。',
        expected: '应该表达关心和理解'
      },
      {
        name: '幽默回应',
        input: '讲个笑话听听',
        expected: '应该讲笑话'
      },
      {
        name: '个性化称呼',
        input: '你叫什么名字？',
        expected: '应该介绍自己的名字'
      },
      {
        name: '记忆引用',
        input: '你还记得我昨天说了什么吗？',
        expected: '应该尝试回忆或承认不记得'
      }
    ];
    
    for (const test of tests) {
      console.log(`\n   🧪 ${test.name}:`);
      console.log(`      输入：${test.input}`);
      console.log(`      期望：${test.expected}`);
      
      const response = await chat([
        { role: 'user', content: test.input }
      ]);
      
      console.log(`      回复：${response.content.substring(0, 100)}...`);
    }
    
    console.log('\n   ✅ 拟人化测试完成');
    
  } catch (err) {
    console.log('   ❌ 拟人化测试失败:', err.message);
  }

  // 4. 总结
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    测试完成                            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log('📊 统计信息:');
  const stats = await getMemoryStats();
  console.log(`   - 总记忆数：${stats.total}`);
  console.log(`   - 对话记忆：${stats.conversations}`);
  console.log(`   - 知识记忆：${stats.knowledge}`);
  console.log(`   - 学习记忆：${stats.learnings}`);
  console.log(`   - 智慧记忆：${stats.wisdom}`);
  
  console.log('\n📚 下一步:');
  console.log('   1. 查看记忆详情：cat dist/memory/memory-engine.js');
  console.log('   2. 查看聊天逻辑：cat dist/core/agent-loop.js');
  console.log('   3. 在 Soul 聊天中使用：soul_llm_add({...})\n');
}

async function getMemoryStats() {
  const db = await import('../dist/db/index.js');
  const { memories } = await import('../dist/db/schema.js');
  const { eq, desc, sql } = await import('drizzle-orm');
  
  const rawDb = db.getRawDb();
  const total = rawDb.prepare('SELECT COUNT(*) as count FROM memories WHERE isActive = 1').get();
  const conversations = rawDb.prepare("SELECT COUNT(*) as count FROM memories WHERE type = 'conversation' AND isActive = 1").get();
  const knowledge = rawDb.prepare("SELECT COUNT(*) as count FROM memories WHERE type = 'knowledge' AND isActive = 1").get();
  const learnings = rawDb.prepare("SELECT COUNT(*) as count FROM memories WHERE type = 'learning' AND isActive = 1").get();
  const wisdom = rawDb.prepare("SELECT COUNT(*) as count FROM memories WHERE type = 'wisdom' AND isActive = 1").get();
  
  return {
    total: total?.count || 0,
    conversations: conversations?.count || 0,
    knowledge: knowledge?.count || 0,
    learnings: learnings?.count || 0,
    wisdom: wisdom?.count || 0
  };
}

runTests().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
