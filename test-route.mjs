import { registerAllInternalTools, getRegisteredTools } from './dist/core/agent-loop.js';
import { isActionMessage } from './dist/core/agent-loop.js';
registerAllInternalTools();

const msg = "金价";
const lower = msg.toLowerCase();
console.log("消息:", msg, "长度:", lower.length);
console.log("isActionMessage:", isActionMessage(msg));

// 模拟 routeTools
const CATEGORY_KEYWORDS = {
  mt5: ["mt5", "metatrader", "trading", "trade", "gold", "xauusd", "forex", "candle", "signal", "chart", "position", "เทรด", "ทอง", "ราคาทอง", "ราคา", "กราฟ", "สัญญาณ", "ออเดอร์", "เฝ้า", "ติดตาม", "monitor"],
};

const scores = new Map();
for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      score += 1;
      console.log(`  匹配："${kw}" 在分类 "${category}" 中`);
    }
  }
  if (score > 0) scores.set(category, score);
}
console.log("得分:", Object.fromEntries(scores));

const allTools = getRegisteredTools();
const mt5tools = allTools.filter(t => t.category === 'mt5');
console.log("可用的 MT5 工具:", mt5tools.length);

process.exit(0);
