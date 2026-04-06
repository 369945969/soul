#!/usr/bin/env node
/**
 * HTTP Chat API 测试脚本（简化版）
 * 
 * 测试内容：
 * 1. 用户创建
 * 2. 角色自动创建
 * 3. 消息发送
 * 4. 记忆隔离
 * 5. 会话管理
 */

import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置
const HTTP_URL = process.env.HTTP_URL || 'http://localhost:47779';

// 测试状态
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// 工具函数
function log(message, type = 'info') {
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    test: '🧪'
  }[type] || 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function recordTest(name, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    log(`${name} - 通过`, 'success');
  } else {
    testResults.failed++;
    log(`${name} - 失败：${details}`, 'error');
  }
  testResults.tests.push({ name, passed, details, timestamp: new Date().toISOString() });
}

// ─── 测试用例 ───

/**
 * 测试 1: 健康检查
 */
async function testHealthCheck() {
  log('测试 1: 健康检查', 'test');
  
  try {
    const response = await fetch(`${HTTP_URL}/api/chat/health`);
    const data = await response.json();
    
    log(`状态：${data.status}`, 'info');
    log(`时间戳：${data.timestamp}`, 'info');
    log(`会话数：${data.sessions}`, 'info');
    
    recordTest('健康检查', data.status === 'ok');
    return data;
  } catch (err) {
    recordTest('健康检查', false, err.message);
    return null;
  }
}

/**
 * 测试 2: 创建用户
 */
async function testCreateUser() {
  log('测试 2: 创建用户', 'test');
  
  try {
    const userId = randomUUID();
    
    const response = await fetch(`${HTTP_URL}/api/chat/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    const data = await response.json();
    
    log(`用户 ID: ${data.userId}`, 'info');
    log(`角色 ID: ${data.personaId}`, 'info');
    log(`消息：${data.message}`, 'info');
    
    recordTest('创建用户', !!data.userId && !!data.personaId);
    return data;
  } catch (err) {
    recordTest('创建用户', false, err.message);
    return null;
  }
}

/**
 * 测试 3: 角色自动创建
 */
async function testPersonaAutoCreation() {
  log('测试 3: 角色自动创建', 'test');
  
  try {
    const userId = randomUUID();
    
    // 创建用户（不指定角色）
    const createUserResponse = await fetch(`${HTTP_URL}/api/chat/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const createUserData = await createUserResponse.json();
    
    // 发送第一条消息（应该触发角色自动创建）
    const chatResponse = await fetch(`${HTTP_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        message: '你好，这是我的第一次对话！'
      })
    });
    const chatData = await chatResponse.json();
    
    // 获取用户信息
    const userInfoResponse = await fetch(`${HTTP_URL}/api/chat/users/${userId}`);
    const userInfo = await userInfoResponse.json();
    
    const personas = userInfo.user?.personas || [];
    
    log(`用户 ID: ${userId}`, 'info');
    log(`角色名称：${chatData.personaName}`, 'info');
    log(`角色数量：${personas.length}`, 'info');
    
    for (const p of personas) {
      log(`  - ${p.display_name} (${p.name}) ${p.is_default ? '[默认]' : ''}`, 'info');
    }
    
    recordTest('角色自动创建', personas.length > 0 && chatData.personaName);
    return { userId, personas, chatData };
  } catch (err) {
    recordTest('角色自动创建', false, err.message);
    return null;
  }
}

/**
 * 测试 4: 记忆隔离
 */
async function testMemoryIsolation() {
  log('测试 4: 记忆隔离', 'test');
  
  try {
    const userId1 = randomUUID();
    const userId2 = randomUUID();
    
    // 用户 1 发送消息
    const response1 = await fetch(`${HTTP_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId1,
        message: '我的名字是 Alice，我喜欢蓝色。'
      })
    });
    const data1 = await response1.json();
    log(`用户 1 (Alice): ${data1.response.substring(0, 50)}...`, 'info');
    
    // 用户 2 发送消息
    const response2 = await fetch(`${HTTP_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId2,
        message: '我的名字是 Bob，我喜欢红色。'
      })
    });
    const data2 = await response2.json();
    log(`用户 2 (Bob): ${data2.response.substring(0, 50)}...`, 'info');
    
    // 验证用户 1 的记忆
    const response3 = await fetch(`${HTTP_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId1,
        message: '我叫什么名字？我喜欢什么颜色？'
      })
    });
    const data3 = await response3.json();
    log(`用户 1 查询：${data3.response}`, 'info');
    
    // 验证用户 2 的记忆
    const response4 = await fetch(`${HTTP_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId2,
        message: '我叫什么名字？我喜欢什么颜色？'
      })
    });
    const data4 = await response4.json();
    log(`用户 2 查询：${data4.response}`, 'info');
    
    // 检查记忆是否隔离
    const user1HasCorrectName = data3.response.includes('Alice') || data3.response.includes('名字');
    const user2HasCorrectName = data4.response.includes('Bob') || data4.response.includes('名字');
    
    if (user1HasCorrectName && user2HasCorrectName) {
      recordTest('记忆隔离', true, '两个用户的记忆独立存储');
    } else {
      recordTest('记忆隔离', false, '记忆可能未正确隔离');
    }
    
    return { userId1, userId2, data1, data2, data3, data4 };
  } catch (err) {
    recordTest('记忆隔离', false, err.message);
    return null;
  }
}

/**
 * 测试 5: 会话管理
 */
async function testSessionManagement() {
  log('测试 5: 会话管理', 'test');
  
  try {
    const response = await fetch(`${HTTP_URL}/api/chat/sessions`);
    const data = await response.json();
    
    log(`当前会话数量：${data.count}`, 'info');
    for (const session of data.sessions) {
      log(`  - ${session.sessionId}: ${session.userId} (${session.messageCount} 条消息)`, 'info');
    }
    
    recordTest('会话管理', true, `当前有 ${data.count} 个会话`);
    return data.sessions;
  } catch (err) {
    recordTest('会话管理', false, err.message);
    return [];
  }
}

/**
 * 测试 6: 连续对话
 */
async function testContinuousConversation() {
  log('测试 6: 连续对话', 'test');
  
  try {
    const userId = randomUUID();
    const messages = [
      '你好，我是新用户',
      '我今年 25 岁',
      '我住在上海',
      '我是一名程序员',
      '很高兴认识你'
    ];
    
    let sessionId = null;
    
    for (const msg of messages) {
      const response = await fetch(`${HTTP_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          message: msg,
          sessionId: sessionId || undefined
        })
      });
      const data = await response.json();
      
      if (!sessionId) {
        sessionId = data.sessionId;
        log(`会话 ID: ${sessionId}`, 'info');
      }
      
      log(`Q: ${msg}`, 'info');
      log(`A: ${data.response.substring(0, 50)}...`, 'info');
      log(`消息数：${data.messageCount}`, 'info');
    }
    
    recordTest('连续对话', true, `完成了 ${messages.length} 轮对话`);
    return sessionId;
  } catch (err) {
    recordTest('连续对话', false, err.message);
    return null;
  }
}

/**
 * 测试 7: 列出用户
 */
async function testListUsers() {
  log('测试 7: 列出用户', 'test');
  
  try {
    const response = await fetch(`${HTTP_URL}/api/chat/users`);
    const data = await response.json();
    
    log(`用户总数：${data.count}`, 'info');
    for (const user of data.users.slice(0, 5)) {
      log(`  - ${user.display_name} (${user.username})`, 'info');
    }
    
    recordTest('列出用户', true, `共有 ${data.count} 个用户`);
    return data.users;
  } catch (err) {
    recordTest('列出用户', false, err.message);
    return [];
  }
}

// ─── 主测试流程 ───

async function runAllTests() {
  log('='.repeat(60), 'info');
  log('HTTP Chat API 测试开始', 'info');
  log('='.repeat(60), 'info');
  
  // 检查服务器状态
  log('\n检查服务器状态...', 'test');
  const health = await testHealthCheck();
  
  if (!health) {
    log('\n❌ 服务器未运行！', 'error');
    log('请启动服务器：node dist/server.js', 'info');
    process.exit(1);
  }
  
  log('\n服务器运行正常！', 'success');
  
  // 运行测试
  await testCreateUser();
  await testPersonaAutoCreation();
  await testMemoryIsolation();
  await testSessionManagement();
  await testContinuousConversation();
  await testListUsers();
  
  // 测试总结
  log('\n' + '='.repeat(60), 'info');
  log('测试总结', 'info');
  log('='.repeat(60), 'info');
  log(`总测试数：${testResults.total}`, 'info');
  log(`通过：${testResults.passed}`, 'success');
  log(`失败：${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`通过率：${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 'info');
  
  // 保存测试结果
  const resultFile = join(__dirname, 'test-results.json');
  writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
  log(`\n测试结果已保存到：${resultFile}`, 'success');
  
  // 退出
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 运行测试
runAllTests().catch(err => {
  log(`测试失败：${err.message}`, 'error');
  process.exit(1);
});
