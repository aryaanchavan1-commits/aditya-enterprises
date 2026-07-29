const API = '/api';

export async function api(path, opts = {}) {
  try {
    const r = await fetch(`${API}${path}`, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { return { success: false, error: `Invalid server response: ${text.slice(0, 100)}` }; }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') return { success: false, error: 'Request timed out' };
    return { success: false, error: err.message || 'Network error' };
  }
}

export function withCache(key, ttl = 60000) {
  const cache = {};
  return async function(path, opts = {}) {
    const now = Date.now();
    if (cache[key] && now - cache[key].time < ttl) return cache[key].data;
    const data = await api(path, opts);
    if (data.success) { cache[key] = { data, time: now }; }
    return data;
  };
}
