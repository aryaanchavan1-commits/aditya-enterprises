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

async function getXLSX() {
  const mod = await import('xlsx');
  return mod.default || mod;
}

export async function exportToExcel(data, filename = 'export') {
  const X = await getXLSX();
  const ws = X.utils.json_to_sheet(data);
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Sheet1');
  X.writeFile(wb, `${filename}.xlsx`);
}

export async function readExcelFile(file) {
  const X = await getXLSX();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = X.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(X.utils.sheet_to_json(ws));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
