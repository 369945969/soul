#!/usr/bin/env node
/**
 * 注释翻译脚本 - 将 JS/TS 文件中的英文注释翻译成中文
 * 使用方法：node scripts/translate-comments.js [目录路径]
 
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 常用术语翻译映射表
const translations = {
  // 标题/描述
  "Soul CLI — Interactive AI Companion Terminal (Claude Code-style UX)": "Soul CLI — 交互式 AI 伴侣终端（Claude Code 风格）",
  "The brain that makes Soul think and act autonomously": "让 Soul 自主思考和行动的大脑",
  
  // 功能描述
  "Features": "功能",
  "Multi-line input": "多行输入",
  "Message queue": "消息队列",
  "Streaming responses": "流式响应",
  "Tool execution": "工具执行",
  "Session persistence": "会话持久化",
  "Tab completion": "Tab 补全",
  "Visual input area": "可视化输入区域",
  
  // 通用术语
  "Terminal Colors & Styles": "终端颜色与样式",
  "Box drawing characters": "边框字符",
  "State": "状态",
  "Command Definitions": "命令定义",
  "Command Handlers": "命令处理器",
  "Internal Tool Registry": "内部工具注册表",
  "Tool Router": "工具路由器",
  
  // 命令描述
  "Start a new conversation": "开始新对话",
  "Switch to talk to a Soul Child": "切换到与 Soul Child 对话",
  "Show all Soul Children": "显示所有 Soul Children",
  "Show conversation history": "显示对话历史",
  "List past sessions": "列出过去的会话",
  "Soul's status": "Soul 状态",
  "Memory statistics": "内存统计",
  "Current LLM info": "当前 LLM 信息",
  "Clear screen": "清屏",
  "Explore Soul's 300+ capabilities": "探索 Soul 的 300+ 项能力",
  
  // 变量/常量描述
  "State —": "状态 —",
};

// 简单翻译函数
function translate(text) {
  // 先查映射表
  if (translations[text]) return translations[text];
  
  let result = text;
  
  // 通用替换
  result = result.replace(/Soul's/g, "Soul 的");
  result = result.replace(/Soul/g, "Soul");
  
  return result;
}

// 翻译单行注释
function translateSingleLineComment(line) {
  const match = line.match(/^(\s*)(\/\/)(\s*)(.*)$/);
  if (!match) return line;
  
  const [, indent, slash, space, commentText] = match;
  const translated = translate(commentText.trim());
  return `${indent}${slash}${space}${translated}`;
}

// 翻译 JSDoc 注释块
function translateJSDocBlock(content) {
  const lines = content.split('\n');
  const translatedLines = lines.map(line => {
    const match = line.match(/^(\s*\*\s?)(.*)$/);
    if (match) {
      const [, prefix, text] = match;
      if (text.trim()) {
        return prefix + translate(text.trim());
      }
    }
    return line;
  });
  return '/**' + translatedLines.join('\n') + '\n 
 */';
}

// 翻译普通多行注释
function translateMultiLineBlock(content) {
  const lines = content.split('\n');
  const translatedLines = lines.map(line => {
    const match = line.match(/^(\s*\*\s?)(.*)$/);
    if (match) {
      const [, prefix, text] = match;
      if (text.trim()) {
        return prefix + translate(text.trim());
      }
    }
    return line;
  });
  return '/*' + translatedLines.join('\n') + '\n 
 */';
}

// 翻译文件
function translateFile(filePath) {
  console.log(`处理文件：${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  
  // 1. 翻译 JSDoc 注释块 /** ...
 */
  content = content.replace(
    /\/\*\*([\s\S]*?)\*\//g,
    (match, content) => translateJSDocBlock(content)
  );
  
  // 2. 翻译普通多行注释 /* ...
 */ (跳过 JSDoc)
  content = content.replace(
    /\/\*([\s\S]*?)\*\//g,
    (match, content) => {
      if (match.startsWith('/**')) return match;
      return translateMultiLineBlock(content);
    }
  );
  
  // 3. 翻译单行注释 //
  const lines = content.split('\n');
  const translatedLines = lines.map(line => {
    // 简单检查：// 前是否有字符串引号
    const beforeComment = line.split('//')[0];
    const hasString = /['"`]/.test(beforeComment);
    if (!hasString && line.includes('//')) {
      return translateSingleLineComment(line);
    }
    return line;
  });
  content = translatedLines.join('\n');
  
  // 写回文件
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✓ 已翻译`);
  } else {
    console.log(`  - 无变化`);
  }
}

// 主函数
function main() {
  const soulDir = process.argv[2] || './soul';
  
  // 查找所有 JS/TS 文件
  const extensions = ['.js', '.mjs', '.cjs', '.ts'];
  const files = [];
  
  function findFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 跳过 node_modules 和 .git
        if (item === 'node_modules' || item === '.git') continue;
        findFiles(fullPath);
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  findFiles(soulDir);
  
  console.log(`找到 ${files.length} 个需要处理的文件\n`);
  
  for (const file of files) {
    try {
      translateFile(file);
    } catch (err) {
      console.error(`  ✗ 错误：${err.message}`);
    }
  }
  
  console.log('\n翻译完成！');
}

main();
