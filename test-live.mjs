/**
 * Soul LIVE 冒烟测试 — 用真实 LLM 测试真实代理循环
 * 这不是模块导入测试。它发送实际消息并检查工具使用。
 *
 * 运行：node test-live.mjs
 * 需要：配置 LLM（Ollama、Groq 等）
 */

let pass = 0, fail = 0;
function ok(name, condition, detail) {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} — ${detail || "FAILED"}`); }
}

console.log("\n═══ Soul LIVE 冒烟测试 ═══\n");
console.log("用真实 LLM 测试真实代理循环...\n");

const { runAgentLoop, registerAllInternalTools } = await import("./dist/core/agent-loop.js");
registerAllInternalTools();

// 辅助函数：带超时的代理循环
async function ask(message, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await runAgentLoop(message, { maxIterations: 5 });
    clearTimeout(timer);
    return result;
  } catch (e) {
    clearTimeout(timer);
    return { reply: `ERROR: ${e.message}`, toolsUsed: [], model: "error", provider: "error", iterations: 0, totalTokens: 0 };
  }
}

// ─── Test 1: Simple greeting (should NOT call tools) ───
console.log("1. Simple greeting (no tools expected)");
try {
  const r = await ask("สวัสดีครับ");
  console.log(`   Reply: "${r.reply.substring(0, 80)}..."`);
  console.log(`   Model: ${r.provider}/${r.model} | Tools: [${r.toolsUsed.join(",")}] | Tokens: ${r.totalTokens}`);
  ok("Got a reply", r.reply && r.reply.length > 0);
  ok("No crash", !r.reply.startsWith("ERROR"));
} catch (e) { fail++; console.log(`  ✗ Greeting failed: ${e.message}`); }

// ─── Test 2: Remember something (MUST call soul_remember) ───
console.log("\n2. Remember command (tool: soul_remember)");
try {
  const r = await ask("จำไว้ว่าผมชอบกินข้าวผัด");
  console.log(`   Reply: "${r.reply.substring(0, 80)}..."`);
  console.log(`   Tools: [${r.toolsUsed.join(",")}]`);
  ok("Got a reply", r.reply.length > 0);
  ok("Called soul_remember", r.toolsUsed.includes("soul_remember"), `Tools used: [${r.toolsUsed.join(",")}]`);
} catch (e) { fail++; console.log(`  ✗ Remember failed: ${e.message}`); }

// ─── 测试 3：搜索记忆（必须调用 soul_search）───
console.log("\n3. 搜索记忆（工具：soul_search");
try {
  const r = await ask("搜索记忆中的炒饭");
  console.log(`   回复："${r.reply.substring(0, 80)}..."`);
  console.log(`   工具：[${r.toolsUsed.join(",")}]`);
  ok("收到回复", r.reply.length > 0);
  ok("调用了 soul_search 或 soul_recall", r.toolsUsed.some(t => t.includes("search") || t.includes("recall")), `使用的工具：[${r.toolsUsed.join(",")}]`);
} catch (e) { fail++; console.log(`  ✗ 搜索失败：${e.message}`); }

// ─── 测试 4：读取文件（必须调用 soul_read_file 或 soul_list_dir）───
console.log("\n4. 文件操作（工具：soul_read_file 或 soul_list_dir");
try {
  const r = await ask("读取当前文件夹中的 package.json 文件");
  console.log(`   回复："${r.reply.substring(0, 100)}..."`);
  console.log(`   工具：[${r.toolsUsed.join(",")}]`);
  ok("收到回复", r.reply.length > 0);
  ok("调用了文件工具", r.toolsUsed.some(t => t.includes("file") || t.includes("read") || t.includes("dir") || t.includes("list")), `使用的工具：[${r.toolsUsed.join(",")}]`);
} catch (e) { fail++; console.log(`  ✗ 文件读取失败：${e.message}`); }

// ─── 测试 5：错误恢复（错误请求不应崩溃）───
console.log("\n5. 错误恢复");
try {
  const r = await ask("aaaaaaaaaaaaaaaa", 30000);
  ok("未崩溃", r.reply && !r.reply.startsWith("ERROR"));
} catch (e) { fail++; console.log(`  ✗ 错误恢复失败：${e.message}`); }

// ─── 测试 6：泰语输入泰语回复 ───
console.log("\n6. 语言检测");
try {
  const r = await ask("你叫什么名字");
  console.log(`   回复："${r.reply.substring(0, 80)}..."`);
  // 检查回复是否包含泰语字符
  const hasThai = /[\u0E00-\u0E7F]/.test(r.reply);
  ok("用泰语回复", hasThai, `回复似乎是英文`);
} catch (e) { fail++; console.log(`  ✗ 语言测试失败：${e.message}`); }

// ─── 总结 ───
console.log(`\n═══ 结果：${pass} 通过，${fail} 失败（共 ${pass + fail}）═══`);
if (fail > 0) {
  console.log("\n⚠️  一些测试失败。检查：");
  console.log("   - LLM 是否配置并可访问（soul_llm_list）");
  console.log("   - 模型是否支持工具调用（检查自诊断）");
  console.log("   - 云 LLM 提供商的网络是否可用");
}
process.exit(fail > 0 ? 1 : 0);
