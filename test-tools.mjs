import { registerAllInternalTools, getRegisteredTools } from './dist/core/agent-loop.js';
registerAllInternalTools();
const tools = getRegisteredTools();
console.log('总工具数:', tools.length);
const mt5tools = tools.filter(t => t.category === 'mt5');
console.log('MT5 工具:', mt5tools.map(t => t.name));
const allCats = [...new Set(tools.map(t => t.category))];
console.log('所有分类:', allCats.sort());
process.exit(0);
