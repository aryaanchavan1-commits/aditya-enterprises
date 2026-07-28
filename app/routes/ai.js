const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const PDFDocument = require('pdfkit');

function getGroqClient() {
  const apiKey = get("SELECT value FROM settings WHERE key='groq_api_key'")?.value;
  if (!apiKey) return null;
  try { const Groq = require('groq-sdk'); return new Groq({ apiKey }); } catch (e) { return null; }
}

function getCompany() {
  return {
    name: get("SELECT value FROM settings WHERE key='company_name'")?.value || 'Aditya Enterprises',
    gstin: get("SELECT value FROM settings WHERE key='company_gstin'")?.value || '',
  };
}

const defaultModels = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
  { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B' },
  { id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B' },
  { id: 'llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B' },
];

// Agent tool definitions
const agentTools = [
  {
    type: 'function',
    function: {
      name: 'get_sales_report', description: 'Get daily or monthly sales report data',
      parameters: { type: 'object', properties: { period: { type: 'string', enum: ['today', 'this_month', 'yesterday', 'last_month'], description: 'Time period for report' }, format: { type: 'string', enum: ['json', 'pdf'], description: 'Report format' } }, required: ['period'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_inventory_status', description: 'Get current inventory status including low stock alerts',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_product', description: 'Create a new product in inventory',
      parameters: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'number' }, sell_price: { type: 'number' }, hsn_code: { type: 'string' }, description: { type: 'string' }, discount_percent: { type: 'number' } }, required: ['name', 'quantity', 'sell_price'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_analysis', description: 'Get customer analysis with repeat customer detection',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_gst_summary', description: 'Get GST tax summary for filing',
      parameters: { type: 'object', properties: { month: { type: 'string', description: 'Month in YYYY-MM format' } }, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_report_pdf', description: 'Generate and return a downloadable PDF report',
      parameters: { type: 'object', properties: { type: { type: 'string', enum: ['daily_sales', 'monthly_sales', 'inventory', 'gst'], description: 'Report type' }, date: { type: 'string', description: 'Date in YYYY-MM-DD format for daily reports' }, month: { type: 'string', description: 'Month in YYYY-MM format for monthly reports' } }, required: ['type'] }
    }
  },
];

// Execute agent tool calls
async function executeToolCall(name, args) {
  switch (name) {
    case 'get_sales_report': {
      const date = new Date().toISOString().split('T')[0];
      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      if (args.period === 'today') {
        const sales = all("SELECT * FROM sales WHERE sale_date = ? ORDER BY created_at DESC", [date]);
        const total = sales.reduce((s, x) => s + x.grand_total, 0);
        return { period: 'today', date, totalInvoices: sales.length, totalRevenue: Math.round(total * 100) / 100, invoices: sales.map(s => ({ inv: s.invoice_number, customer: s.customer_name, amount: s.grand_total, date: s.sale_date })) };
      }
      if (args.period === 'this_month') {
        const sales = all("SELECT * FROM sales WHERE sale_date >= ? ORDER BY created_at DESC", [firstOfMonth]);
        const total = sales.reduce((s, x) => s + x.grand_total, 0);
        return { period: 'this_month', startDate: firstOfMonth, totalInvoices: sales.length, totalRevenue: Math.round(total * 100) / 100 };
      }
      return { message: 'Report data retrieved' };
    }
    case 'get_inventory_status': {
      const total = get('SELECT COUNT(*) as c FROM products').c;
      const totalQty = get('SELECT COALESCE(SUM(quantity),0) as c FROM products').c;
      const lowStock = all('SELECT name, quantity, sell_price FROM products WHERE quantity <= 5 ORDER BY quantity ASC');
      return { totalProducts: total, totalQuantity: totalQty, lowStockCount: lowStock.length, lowStockItems: lowStock };
    }
    case 'create_product': {
      const barcode = `AE${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const serial = args.serial_number || `AE-AI-${Date.now()}`;
      run(`INSERT INTO products (name, quantity, sell_price, hsn_code, description, discount_percent, serial_number, barcode) VALUES (?,?,?,?,?,?,?,?)`,
        [args.name, args.quantity || 0, args.sell_price || 0, args.hsn_code || '', args.description || '', args.discount_percent || 0, serial, barcode]);
      return { created: true, name: args.name, barcode, message: `Product "${args.name}" created with barcode ${barcode}` };
    }
    case 'get_customer_analysis': {
      const sales = all("SELECT * FROM sales ORDER BY sale_date");
      const custMap = {};
      sales.forEach(s => {
        const n = s.customer_name || 'Walk-in';
        if (!custMap[n]) custMap[n] = { name: n, visits: 0, spent: 0, phone: s.customer_phone, gstin: s.customer_gstin };
        custMap[n].visits++; custMap[n].spent += s.grand_total;
      });
      const repeat = Object.values(custMap).filter(c => c.visits > 1).sort((a, b) => b.spent - a.spent);
      return { totalCustomers: Object.keys(custMap).length, repeatCustomers: repeat.length, topRepeat: repeat.slice(0, 10) };
    }
    case 'get_gst_summary': {
      const m = args.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const [y, mo] = m.split('-');
      const sd = `${y}-${mo}-01`;
      const ld = new Date(y, mo, 0).getDate();
      const ed = `${y}-${mo}-${ld}`;
      const sales = all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ?", [sd, ed]);
      const totRev = sales.reduce((s, x) => s + (x.subtotal || 0) - (x.discount_total || 0), 0);
      const totC = sales.reduce((s, x) => s + x.cgst_total, 0);
      const totS = sales.reduce((s, x) => s + x.sgst_total, 0);
      const totI = sales.reduce((s, x) => s + x.igst_total, 0);
      return { month: m, totalSales: sales.length, taxableValue: Math.round(totRev * 100) / 100, cgst: Math.round(totC * 100) / 100, sgst: Math.round(totS * 100) / 100, igst: Math.round(totI * 100) / 100, totalGst: Math.round((totC + totS + totI) * 100) / 100 };
    }
    case 'generate_report_pdf': {
      return {
        reportGenerated: true,
        type: args.type,
        downloadUrl: `/api/reports/${args.type === 'daily_sales' ? 'daily/pdf?date=' + (args.date || new Date().toISOString().split('T')[0]) : args.type === 'monthly_sales' ? 'monthly/pdf?month=' + (args.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`) : args.type === 'gst' ? '../gst/report' : 'daily/pdf'}`,
        message: `${args.type.replace(/_/g, ' ')} PDF report is ready for download.`
      };
    }
    default: return { message: 'Action completed' };
  }
}

// System prompts
const CHAT_SYSTEM = `You are the AI assistant for Aditya Enterprises ERP 2026. You help with:
- Inventory management, stock levels, low stock alerts
- Sales analysis, revenue tracking
- GST billing (CGST 9%, SGST 9% for intra-state, IGST 18% for inter-state)
- Customer analysis
- Product management (create, update, search)
- Business insights and recommendations
- Report generation (daily, monthly, GST)

Be concise, helpful, and data-driven. The year is 2026. If asked to perform an action, use the available functions.`;

const AGENT_SYSTEM = `You are an AUTONOMOUS AI AGENT for Aditya Enterprises ERP 2026. You CAN and SHOULD:
1. Execute tasks using available functions
2. Generate reports when asked
3. Create products when requested
4. Analyze data and provide insights
5. Make inventory changes when authorized

CRITICAL RULES:
- Before making ANY changes (creating products, modifying data), ASK the user for confirmation with a clear YES/NO question
- Present what you're about to do and ask "Shall I proceed?"
- Only execute the change after the user says YES or confirms
- For read-only operations (reports, analysis), proceed immediately
- When generating reports, always provide the download link
- If unsure about something, ask the user for clarification with specific options

FORMAT YOUR RESPONSES AS:
- If asking for confirmation: "[CONFIRM] <clear yes/no question>"
- If executing: "[ACTION] <what you did>"
- Regular info: just respond normally`;

router.get('/models', async (req, res) => {
  try {
    const client = getGroqClient();
    if (!client) return res.json({ success: true, data: defaultModels });
    const models = await client.models.list();
    res.json({ success: true, data: models.data || defaultModels });
  } catch (err) { res.json({ success: true, data: defaultModels }); }
});

// POST chat (both chat and agent modes)
router.post('/chat', async (req, res) => {
  try {
    const { message, model, mode } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message required' });

    const client = getGroqClient();
    if (!client) return res.status(400).json({ success: false, error: 'Groq API key not configured' });

    const selectedModel = model || get("SELECT value FROM settings WHERE key='groq_model'")?.value || 'llama-3.3-70b-versatile';
    const isAgentMode = mode === 'agent';

    run('INSERT INTO ai_conversations (role, content) VALUES (?, ?)', ['user', message]);

    const history = all('SELECT role, content FROM ai_conversations ORDER BY id DESC LIMIT 30').reverse();

    const messages = [
      { role: 'system', content: isAgentMode ? AGENT_SYSTEM : CHAT_SYSTEM },
      ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
    ];

    // In agent mode, add tools
    const completionOpts = {
      model: selectedModel,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    };

    if (isAgentMode) {
      completionOpts.tools = agentTools;
      completionOpts.tool_choice = 'auto';
    }

    const completion = await client.chat.completions.create(completionOpts);
    const responseMsg = completion.choices[0]?.message;

    let replyText = responseMsg?.content || '';
    const toolCalls = responseMsg?.tool_calls || [];

    // Execute tool calls if any
    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        const fnName = tc.function.name;
        const fnArgs = JSON.parse(tc.function.arguments || '{}');
        try {
          const result = await executeToolCall(fnName, fnArgs);
          replyText += `\n\n[${fnName} Result]: ${JSON.stringify(result)}`;
        } catch (e) {
          replyText += `\n\n[${fnName} Error]: ${e.message}`;
        }
      }
    }

    if (!replyText) replyText = isAgentMode ? 'I understand. What would you like me to do?' : 'How can I help with your ERP?';

    run('INSERT INTO ai_conversations (role, content) VALUES (?, ?)', ['assistant', replyText]);

    res.json({
      success: true,
      data: { role: 'assistant', content: replyText, model: selectedModel, mode: isAgentMode ? 'agent' : 'chat' }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/history', (req, res) => {
  try { res.json({ success: true, data: all('SELECT * FROM ai_conversations ORDER BY id ASC') }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/history', (req, res) => {
  try { run('DELETE FROM ai_conversations'); res.json({ success: true, message: 'Cleared' }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/analyze', async (req, res) => {
  try {
    const { type } = req.body;
    const client = getGroqClient();
    if (!client) return res.status(400).json({ success: false, error: 'Groq API key not configured' });
    let context = '';
    if (type === 'inventory') {
      const tp = get('SELECT COUNT(*) as c FROM products').c;
      const ls = get('SELECT COUNT(*) as c FROM products WHERE quantity <= 5').c;
      const lsi = all('SELECT name, quantity FROM products WHERE quantity <= 5 LIMIT 10');
      context = `Inventory: ${tp} products, ${ls} low stock. Items: ${JSON.stringify(lsi)}`;
    } else if (type === 'sales') {
      const today = new Date().toISOString().split('T')[0];
      const ts = get('SELECT COALESCE(SUM(grand_total),0) as c FROM sales WHERE sale_date = ?', [today]).c;
      const ms = get("SELECT COALESCE(SUM(grand_total),0) as c FROM sales WHERE sale_date >= ?", [new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]]).c;
      const sc = get('SELECT COUNT(*) as c FROM sales').c;
      context = `Sales: ${sc} total, today: Rs.${ts}, this month: Rs.${ms}`;
    } else if (type === 'customers') {
      const sales = all("SELECT customer_name, COUNT(*) as visits, SUM(grand_total) as spent FROM sales GROUP BY customer_name HAVING visits > 1 ORDER BY spent DESC LIMIT 10");
      context = `Repeat customers: ${JSON.stringify(sales)}`;
    }
    const model = get("SELECT value FROM settings WHERE key='groq_model'")?.value || 'llama-3.3-70b-versatile';
    const completion = await client.chat.completions.create({
      model, messages: [{ role: 'system', content: 'Business analyst for Aditya Enterprises. Give concise, actionable insights.' }, { role: 'user', content: `Analyze: ${context}` }],
      temperature: 0.7, max_tokens: 1000,
    });
    res.json({ success: true, data: { analysis: completion.choices[0]?.message?.content, context } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
