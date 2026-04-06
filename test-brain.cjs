const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const dbPath = path.join(os.homedir(), '.soul', 'soul.db');
const db = new Database(dbPath);
const groqRow = db.prepare("SELECT api_key FROM soul_llm_config WHERE provider_id = 'groq'").get();
const openaiRow = db.prepare("SELECT api_key FROM soul_llm_config WHERE provider_id = 'openai'").get();
db.close();

const TOOLS = [
  { type: 'function', function: { name: 'soul_remember', description: '将内容存储到记忆中', parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } } },
  { type: 'function', function: { name: 'soul_mt5_analyze', description: '用技术指标分析交易标的', parameters: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } } },
  { type: 'function', function: { name: 'soul_web_search', description: '搜索网络获取信息', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'soul_note', description: '快速记录捕捉', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } },
];

const TESTS = [
  '分析金价',
  '记住今天下午 2 点开会',
  '搜索 AI 趋势 2026 信息',
  '金价',
];

async function testModel(provider, baseUrl, apiKey, model) {
  console.log(`\n=== ${provider}/${model} ===`);
  for (const msg of TESTS) {
    const start = Date.now();
    try {
      const res = await globalThis.fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are Soul, an AI companion. ALWAYS use tools to execute actions. Reply in Thai.' },
            { role: 'user', content: msg }
          ],
          tools: TOOLS,
          temperature: 0.3,
          max_tokens: 300
        })
      });
      const data = await res.json();
      const ms = Date.now() - start;
      if (data.error) {
        console.log(`  "${msg}" → ERROR: ${data.error.message}`);
        continue;
      }
      const m = data.choices[0].message;
      const calledTool = m.tool_calls && m.tool_calls.length > 0;
      if (calledTool) {
        const tc = m.tool_calls[0];
        console.log(`  "${msg}" → ${ms}ms OK ${tc.function.name}(${tc.function.arguments})`);
      } else {
        const text = (m.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        console.log(`  "${msg}" → ${ms}ms FAIL text: "${text.substring(0, 60)}"`);
      }
    } catch(e) {
      console.log(`  "${msg}" → ERROR: ${e.message}`);
    }
  }
}

(async () => {
  // Groq models (all free)
  const groqModels = [
    'qwen/qwen3-32b',
    'llama-3.3-70b-versatile',
    'moonshotai/kimi-k2-instruct',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.1-8b-instant',
  ];

  for (const model of groqModels) {
    await testModel('groq', 'https://api.groq.com/openai/v1', groqRow.api_key, model);
  }

  // OpenAI
  await testModel('openai', 'https://api.openai.com/v1', openaiRow.api_key, 'gpt-4o-mini');

  console.log('\n=== DONE ===');
})();
