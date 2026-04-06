#!/usr/bin/env node
/**
 * Soul Setup 测试脚本
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:47779/ws';

console.log('🔌 连接到 WebSocket...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ 连接成功');
  
  // 发送 soul_setup 命令
  console.log('📝 发送 soul_setup 命令...');
  ws.send(JSON.stringify({
    type: 'chat',
    sessionId: 'setup-session',
    message: 'soul_setup 主人 1234'
  }));
  
  // 等待响应
  setTimeout(() => {
    console.log('❌ 超时');
    ws.close();
    process.exit(1);
  }, 10000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('收到消息:', JSON.stringify(msg, null, 2));
  
  if (msg.event === 'chat_response') {
    console.log('✅ 收到响应');
    ws.close();
    process.exit(0);
  } else if (msg.event === 'chat_error') {
    console.error('❌ 错误:', msg.data.error);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket 错误:', err);
  process.exit(1);
});
