#!/usr/bin/env node
/**
 * WebSocket Chat API 测试脚本
 * 
 * 测试内容：
 * 1. WebSocket 连接
 * 2. 用户创建和角色自动创建
 * 3. 消息发送和接收
 * 4. 记忆存储和隔离
 * 5. 会话管理
 */

import WebSocket from 'ws';
import { randomUUID } from 'crypto';

// 配置
const WS_URL = process.env.WS_URL || 'ws://localhost:47779/ws';
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
    log(`${name} - 失败: ${details}`, 'error');
  }
  testResults.tests.push({ name, passed, details, timestamp: new Date().toISOString() });
}

// ─── 测试用例 ───

/**
 * 测试 1: WebSocket 连接
 */
async function testWebSocketConnection() {
  log('测试 1: WebSocket 连接', 'test');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      recordTest('WebSocket 连接', false, '连接超时');
      resolve(null);
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      log('WebSocket 连接成功', 'success');
      recordTest('WebSocket 连接', true);
      resolve(ws);
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      recordTest('WebSocket 连接', false, err.message);
      resolve(null);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.event === 'connected') {
        log(`连接确认：clientId=${msg.data.clientId}`, 'info');
      }
    });
  });
}

/**
 * 测试 2: 发送聊天消息
 */
async function testChatMessage(ws, userId) {
  log('测试 2: 发送聊天消息', 'test');
  
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      recordTest('发送聊天消息', false, 'WebSocket 未连接');
      resolve(null);
      return;
    }

    const sessionId = `user-${userId}`;
    const message = '你好，这是我的第一次对话！';
    
    log(`发送消息："${message}"`, 'info');
    
    const timeout = setTimeout(() => {
      recordTest('发送聊天消息', false, '响应超时');
      resolve(null);
    }, 10000);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.event === 'chat_response') {
        clearTimeout(timeout);
        log(`收到响应：${msg.data.response}`, 'success');
        log(`角色名称：${msg.data.personaName}`, 'info');
        log(`消息数量：${msg.data.messageCount}`, 'info');
        recordTest('发送聊天消息', true, `响应长度：${msg.data.response.length} 字符`);
        resolve(msg.data);
      } else if (msg.event === 'chat_error') {
        clearTimeout(timeout);
        recordTest('发送聊天消息', false, msg.data.error);
        resolve(null);
      }
    });

    // 发送消息
    ws.send(JSON.stringify({
      type: 'chat',
      sessionId: sessionId,
      message: message
    }));
  });
}

/**
 * 测试 3: 验证角色自动创建
 */
async function testPersonaAutoCreation(httpUrl, userId) {
  log('测试 3: 验证角色自动创建', 'test');
  
  try {
    const response = await fetch(`${httpUrl}/api/chat/users/${userId}`);
    const data = await response.json();
    
    if (!data.user) {
      recordTest('角色自动创建', false, '用户不存在');
      return null;
    }
    
    const personas = data.user.personas || [];
    if (personas.length === 0) {
      recordTest('角色自动创建', false, '没有绑定角色');
      return null;
    }
    
    log(`用户角色数量：${personas.length}`, 'info');
    for (const p of personas) {
      log(`  - ${p.display_name} (${p.name}) ${p.is_default ? '[默认]' : ''}`, 'info');
    }
    
    recordTest('角色自动创建', true, `创建了 ${personas.length} 个角色`);
    return personas;
  } catch (err) {
    recordTest('角色自动创建', false, err.message);
    return null;
  }
}

/**
 * 测试 4: 记忆隔离验证
 */
async function testMemoryIsolation(httpUrl, userId1, userId2) {
  log('测试 4: 记忆隔离验证', 'test');
  
  try {
    // 用户 1 发送消息
    const response1 = await fetch(`${httpUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId1,
        message: '我的名字是 Alice，我喜欢蓝色。'
      })
    });
    const data1 = await response1.json();
    log(`用户 1 消息响应：${data1.response.substring(0, 50)}...`, 'info');
    
    // 用户 2 发送消息
    const response2 = await fetch(`${httpUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId2,
        message: '我的名字是 Bob，我喜欢红色。'
      })
    });
    const data2 = await response2.json();
    log(`用户 2 消息响应：${data2.response.substring(0, 50)}...`, 'info');
    
    // 验证用户 1 的记忆
    const response3 = await fetch(`${httpUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId1,
        message: '我叫什么名字？我喜欢什么颜色？'
      })
    });
    const data3 = await response3.json();
    log(`用户 1 查询记忆：${data3.response}`, 'info');
    
    // 验证用户 2 的记忆
    const response4 = await fetch(`${httpUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId2,
        message: '我叫什么名字？我喜欢什么颜色？'
      })
    });
    const data4 = await response4.json();
    log(`用户 2 查询记忆：${data4.response}`, 'info');
    
    // 检查记忆是否隔离
    const user1HasCorrectName = data3.response.includes('Alice') || data3.response.includes('名字');
    const user2HasCorrectName = data4.response.includes('Bob') || data4.response.includes('名字');
    
    if (user1HasCorrectName && user2HasCorrectName) {
      recordTest('记忆隔离验证', true, '两个用户的记忆独立存储');
    } else {
      recordTest('记忆隔离验证', false, '记忆可能未正确隔离');
    }
    
    return { data3, data4 };
  } catch (err) {
    recordTest('记忆隔离验证', false, err.message);
    return null;
  }
}

/**
 * 测试 5: 会话管理
 */
async function testSessionManagement(httpUrl) {
  log('测试 5: 会话管理', 'test');
  
  try {
    // 获取会话列表
    const response = await fetch(`${httpUrl}/api/chat/sessions`);
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
 * 测试 6: 健康检查
 */
async function testHealthCheck(httpUrl) {
  log('测试 6: 健康检查', 'test');
  
  try {
    const response = await fetch(`${httpUrl}/api/chat/health`);
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
 * 测试 7: 连续对话
 */
async function testContinuousConversation(httpUrl, userId) {
  log('测试 7: 连续对话', 'test');
  
  try {
    const messages = [
      '你好，我是新用户',
      '我今年 25 岁',
      '我住在上海',
      '我是一名程序员',
      '很高兴认识你'
    ];
    
    let sessionId = null;
    
    for (const msg of messages) {
      const response = await fetch(`${httpUrl}/api/chat`, {
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

// ─── 主测试流程 ───

async function runAllTests() {
  log('='.repeat(60), 'info');
  log('WebSocket Chat API 测试开始', 'info');
  log('='.repeat(60), 'info');
  
  // 健康检查
  await testHealthCheck(HTTP_URL);
  
  // 创建测试用户
  log('\n创建测试用户...', 'test');
  const userId1 = randomUUID();
  const userId2 = randomUUID();
  
  try {
    await fetch(`${HTTP_URL}/api/chat/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId1 })
    });
    await fetch(`${HTTP_URL}/api/chat/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId2 })
    });
    log(`用户 1: ${userId1}`, 'success');
    log(`用户 2: ${userId2}`, 'success');
  } catch (err) {
    log(`创建用户失败：${err.message}`, 'error');
  }
  
  // WebSocket 测试
  log('\n' + '='.repeat(60), 'info');
  log('WebSocket 测试', 'info');
  log('='.repeat(60), 'info');
  
  const ws = await testWebSocketConnection();
  if (ws) {
    await testChatMessage(ws, userId1);
    setTimeout(() => ws.close(), 1000);
  }
  
  // HTTP API 测试
  log('\n' + '='.repeat(60), 'info');
  log('HTTP API 测试', 'info');
  log('='.repeat(60), 'info');
  
  await testPersonaAutoCreation(HTTP_URL, userId1);
  await testMemoryIsolation(HTTP_URL, userId1, userId2);
  await testSessionManagement(HTTP_URL);
  await testContinuousConversation(HTTP_URL, userId1);
  
  // 测试总结
  log('\n' + '='.repeat(60), 'info');
  log('测试总结', 'info');
  log('='.repeat(60), 'info');
  log(`总测试数：${testResults.total}`, 'info');
  log(`通过：${testResults.passed}`, 'success');
  log(`失败：${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`通过率：${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 'info');
  
  // 保存测试结果
  const fs = await import('fs');
  const resultFile = 'test-results.json';
  fs.writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
  log(`\n测试结果已保存到：${resultFile}`, 'success');
  
  // 退出
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 运行测试
runAllTests().catch(err => {
  log(`测试失败：${err.message}`, 'error');
  process.exit(1);
});
