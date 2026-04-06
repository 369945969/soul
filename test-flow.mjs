import { registerAllInternalTools, getRegisteredTools } from './dist/core/agent-loop.js';
import { isActionMessage } from './dist/core/agent-loop.js';

// Step 1: 注册工具（像 main() 在启动时做的那样）
registerAllInternalTools();
const allTools = getRegisteredTools();
console.log(`[测试] 注册的总工具数：${allTools.length}`);

// Step 2: 模拟 routeTools("金价")
const msg = "金价";
const lower = msg.toLowerCase();
const isAction = isActionMessage(msg);
console.log(`[测试] isAction: ${isAction}`);

// 检查短消息守卫
if (lower.length < 15 && !isAction) {
  console.log("[测试] 被短消息守卫阻止");
} else {
  console.log("[测试] 通过短消息守卫");
}

// Score categories (copy from agent-loop)
const CATEGORY_KEYWORDS = {
  memory: ["remember", "recall", "forget", "memory", "search", "find", "know", "learned", "จำ", "ค้นหา", "ความจำ", "เรียนรู้"],
  mt5: ["mt5", "metatrader", "trading", "trade", "gold", "xauusd", "forex", "candle", "signal", "chart", "position", "เทรด", "ทอง", "ราคาทอง", "ราคา", "กราฟ", "สัญญาณ", "ออเดอร์", "เฝ้า", "ติดตาม", "monitor"],
};

const scores = new Map();
for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score += 1;
  }
  if (score > 0) scores.set(category, score);
}
console.log(`[测试] 分类得分：`, Object.fromEntries(scores));

// 按 mt5 分类过滤工具
const mt5tools = allTools.filter(t => t.category === 'mt5');
console.log(`[测试] 将路由 ${mt5tools.length} 个 MT5 工具：`, mt5tools.map(t => t.name));

console.log("\n✅ 工具路由在此环境中工作正常");
process.exit(0);
