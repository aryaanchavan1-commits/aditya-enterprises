import React, { useState, useEffect, useRef } from 'react';

const API = '/api';

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState('chat'); // 'chat' or 'agent'
  const chatRef = useRef(null);
  const fileRef = useRef(null);
  const [apiKey, setApiKey] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    fetch(`${API}/settings`).then(r => r.json()).then(d => {
      if (d.success) {
        setSettings(d.data);
        setApiKey(d.data.groq_api_key || '');
        setSelectedModel(d.data.groq_model || 'llama-3.3-70b-versatile');
      }
    });
    loadModels();
    loadHistory();
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const loadModels = () => {
    fetch(`${API}/ai/models`).then(r => r.json()).then(d => {
      if (d.success && d.data.length > 0) setModels(d.data);
    });
  };

  const loadHistory = () => {
    fetch(`${API}/ai/history`).then(r => r.json()).then(d => {
      if (d.success) setMessages(d.data.map(m => ({ role: m.role, content: m.content })));
    });
  };

  const clearHistory = () => {
    fetch(`${API}/ai/history`, { method: 'DELETE' }).then(() => {
      setMessages([]);
    });
  };

  const saveApiKey = async () => {
    await fetch(`${API}/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groq_api_key: apiKey, groq_model: selectedModel })
    });
    setShowSettings(false);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const r = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, model: selectedModel, mode })
      });
      const d = await r.json();
      if (d.success) {
        const reply = d.data.content;
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        // Check if agent is asking for confirmation
        if (mode === 'agent' && reply.includes('[CONFIRM]')) {
          setPendingAction(reply);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (d.error || 'API key not configured. Set your Groq API key in settings (gear icon).') }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Make sure the server is running.' }]);
    }
    setLoading(false);
  };

  const quickReply = (text) => {
    setInput(text);
    setTimeout(() => {
      const userMsg = { role: 'user', content: text };
      setMessages(prev => [...prev, userMsg]);
      setInput(''); setLoading(true);
      fetch(`${API}/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model: selectedModel, mode })
      }).then(r => r.json()).then(d => {
        if (d.success) setMessages(prev => [...prev, { role: 'assistant', content: d.data.content }]);
      }).catch(() => {}).finally(() => setLoading(false));
    }, 50);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API}/upload/ai-upload`, { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) {
        setMessages(prev => [...prev, { role: 'user', content: `[Uploaded file: ${d.data.filename} (${(d.data.size/1024).toFixed(1)}KB, ${d.data.type})]` }]);
        setMessages(prev => [...prev, { role: 'assistant', content: `I've received your file: **${d.data.filename}**. How can I help you with this?` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'File upload failed.' }]);
    }
  };

  const handleAnalyze = async (type) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const d = await r.json();
      if (d.success) {
        setMessages(prev => [
          ...prev,
          { role: 'user', content: `Analyze my ${type} data.` },
          { role: 'assistant', content: d.data.analysis }
        ]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Analysis failed.' }]);
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <h2>AI Assistant</h2>
          <div style={{display:'flex', background:'#e9ecef', borderRadius:8, padding:2, gap:2}}>
            <button
              className={`btn btn-sm ${mode === 'chat' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setMode('chat'); setPendingAction(null); }}
              style={{borderRadius:6}}>
              Chat
            </button>
            <button
              className={`btn btn-sm ${mode === 'agent' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setMode('agent'); setPendingAction(null); }}
              style={{borderRadius:6}}>
              Agent
            </button>
          </div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-sm btn-info" onClick={() => handleAnalyze('inventory')}>Inventory</button>
          <button className="btn btn-sm btn-info" onClick={() => handleAnalyze('sales')}>Sales</button>
          <button className="btn btn-sm btn-info" onClick={() => handleAnalyze('customers')}>Customers</button>
          <button className="btn btn-sm btn-outline" onClick={() => setShowSettings(!showSettings)}>⚙ API Key</button>
          <button className="btn btn-sm btn-outline" onClick={clearHistory}>Clear Chat</button>
        </div>
      </div>

      {showSettings && (
        <div className="card" style={{marginBottom:16, background:'#f8f9fa'}}>
          <h4 style={{marginBottom:12}}>Groq API Configuration</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Groq API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="gsk_your_api_key..." />
            </div>
            <div className="form-group">
              <label>Model</label>
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.name || m.id}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveApiKey}>Save & Connect</button>
          <p style={{fontSize:11, color:'#777', marginTop:8}}>
            Get your free API key at <a href="https://console.groq.com" target="_blank" rel="noreferrer">console.groq.com</a>. The key is stored locally.
          </p>
        </div>
      )}

      <div className="card" style={{padding:0}}>
        <div className="chat-container">
          <div className="chat-messages" ref={chatRef}>
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">{mode === 'agent' ? '🦾' : '🤖'}</div>
                <h3>Aditya Enterprises {mode === 'agent' ? 'AI Agent' : 'AI Assistant'}</h3>
                <p style={{fontSize:13, color:'#666'}}>Powered by Groq API (Llama 3.3, Mixtral, DeepSeek, Gemma, Qwen)</p>
                {mode === 'chat' ? (
                  <>
                    <p style={{fontSize:12, color:'#999'}}>
                      Ask me about: inventory, sales, GST, products, reports, or business insights.
                    </p>
                    <div style={{marginTop:12, display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
                      <span style={{background:'#e8f4fd',padding:'4px 10px',borderRadius:12,fontSize:11}}>Upload any file type</span>
                      <span style={{background:'#e8f4fd',padding:'4px 10px',borderRadius:12,fontSize:11}}>GST 2026 compliant</span>
                      <span style={{background:'#e8f4fd',padding:'4px 10px',borderRadius:12,fontSize:11}}>Business analytics</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{fontSize:12, color:'#e74c3c', fontWeight:600, marginTop:8}}>
                      Agent Mode: I can execute tasks for you.
                    </p>
                    <p style={{fontSize:11, color:'#999'}}>
                      Try saying: "Generate today's sales report as PDF", "Create a product", "Show repeat customers", "Give me GST summary"
                    </p>
                    <p style={{fontSize:10, color:'#999', marginTop:4}}>
                      Before making changes, I'll ask for your confirmation.
                    </p>
                    <div style={{marginTop:10, display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap'}}>
                      <button className="btn btn-sm btn-info" onClick={() => quickReply('Generate daily sales report as PDF')}>Daily Report</button>
                      <button className="btn btn-sm btn-info" onClick={() => quickReply('Show me inventory status')}>Inventory</button>
                      <button className="btn btn-sm btn-info" onClick={() => quickReply('Analyze repeat customers')}>Customers</button>
                      <button className="btn btn-sm btn-info" onClick={() => quickReply('Give me GST summary for this month')}>GST Summary</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.role}`}>
                <div className="chat-bubble">
                  {msg.content}
                  {mode === 'agent' && i === messages.length - 1 && msg.role === 'assistant' && msg.content.includes('[CONFIRM]') && (
                    <div style={{marginTop:10, display:'flex', gap:6, borderTop:'1px solid #ddd', paddingTop:8}}>
                      <button className="btn btn-sm btn-success" onClick={() => quickReply('YES - proceed')}>Yes</button>
                      <button className="btn btn-sm btn-danger" onClick={() => quickReply('NO - cancel')}>No</button>
                    </div>
                  )}
                  {mode === 'agent' && i === messages.length - 1 && msg.role === 'assistant' && msg.content.includes('[ACTION]') && (
                    <span className="badge badge-success" style={{marginLeft:8}}>Done</span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-msg assistant">
                <div className="chat-bubble">Thinking...</div>
              </div>
            )}
          </div>

          <div className="chat-input-area" style={{padding:12, background:'#fff', borderTop:'1px solid #eee'}}>
            <input
              type="file"
              ref={fileRef}
              onChange={handleFileUpload}
              style={{display:'none'}}
              accept="*/*"
            />
            <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} title="Upload any file type">📎</button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask about inventory, sales, GST, or upload a file..."
            />
            <button className="btn btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
