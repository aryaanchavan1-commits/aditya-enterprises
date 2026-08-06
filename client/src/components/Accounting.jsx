import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { confirmAction } from '../confirm';

const API = '/api';
const CATEGORIES = ['Office', 'Travel', 'Utilities', 'Salary', 'Maintenance', 'Transport', 'Marketing', 'Other'];
const PAY_MODES = ['cash', 'upi', 'card', 'bank', 'credit'];

export default function Accounting() {
  const [tab, setTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [cashBook, setCashBook] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'in', category: '', payment_mode: 'cash', reference: '', notes: '' });
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    api('/accounting/summary').then(d => { if (d.success) setSummary(d.data); });
    api('/accounting/cash-book').then(d => { if (d.success) setCashBook(d.data); });
    api('/accounting/expenses').then(d => { if (d.success) setExpenses(d.data); });
    api('/accounting/incomes').then(d => { if (d.success) setIncomes(d.data); });
  }, []);

  const refreshAll = () => {
    api('/accounting/summary').then(d => { if (d.success) setSummary(d.data); });
    api('/accounting/cash-book').then(d => { if (d.success) setCashBook(d.data); });
    api('/accounting/expenses').then(d => { if (d.success) setExpenses(d.data); });
    api('/accounting/incomes').then(d => { if (d.success) setIncomes(d.data); });
  };

  const handleSubmit = async (type) => {
    if (!form.description || !form.amount) { showToast('Description and amount required', 'error'); return; }
    const body = { ...form, amount: Number(form.amount) || 0 };
    const route = type === 'cash' ? '/accounting/cash-book' : type === 'expense' ? '/accounting/expenses' : '/accounting/incomes';
    const d = await api(route, { method: 'POST', body });
    if (d.success) { showToast('Saved'); setShowForm(null); setForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'in', category: '', payment_mode: 'cash', reference: '', notes: '' }); refreshAll(); }
    else showToast(d.error || 'Failed', 'error');
  };

  const handleDelete = async (type, id) => {
    if (!(await confirmAction({ title: 'Delete entry?', message: 'This entry will be permanently removed.', danger: true, confirmText: 'Delete' }))) return;
    const route = type === 'cash' ? `/accounting/cash-book/${id}` : type === 'expense' ? `/accounting/expenses/${id}` : `/accounting/incomes/${id}`;
    const d = await api(route, { method: 'DELETE' });
    if (d.success) { showToast('Deleted'); refreshAll(); }
    else showToast(d.error || 'Delete failed', 'error');
  };

  const tabs = ['dashboard', 'cash_book', 'expenses', 'incomes'];
  const tabLabels = { dashboard: 'Summary', cash_book: 'Cash Book', expenses: 'Expenses', incomes: 'Incomes' };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
        {tabs.map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t)}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && summary && (
        <div className="stats-grid" style={{marginBottom:20}}>
          <div className="stat-card success">
            <span className="stat-label">Total Sales</span>
            <span className="stat-value">&#8377;{Number(summary.totalSales).toLocaleString('en-IN')}</span>
          </div>
          <div className="stat-card danger">
            <span className="stat-label">Total Purchases</span>
            <span className="stat-value">&#8377;{Number(summary.totalPurchases).toLocaleString('en-IN')}</span>
          </div>
          <div className="stat-card warning">
            <span className="stat-label">Expenses</span>
            <span className="stat-value">&#8377;{Number(summary.totalExpenses).toLocaleString('en-IN')}</span>
          </div>
          <div className="stat-card accent">
            <span className="stat-label">Other Incomes</span>
            <span className="stat-value">&#8377;{Number(summary.totalIncomes).toLocaleString('en-IN')}</span>
          </div>
          <div className="stat-card success">
            <span className="stat-label">Cash Balance</span>
            <span className="stat-value">&#8377;{Number(summary.cashBalance).toLocaleString('en-IN')}</span>
          </div>
          <div className="stat-card" style={{borderLeft:`4px solid ${summary.netProfit >= 0 ? '#27ae60' : '#e74c3c'}`}}>
            <span className="stat-label">Net Profit</span>
            <span className="stat-value" style={{color: summary.netProfit >= 0 ? '#27ae60' : '#e74c3c'}}>
              &#8377;{Number(summary.netProfit).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}

      {tab === 'cash_book' && (
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <h3>Cash Book</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(showForm === 'cash' ? null : 'cash')}>
              {showForm === 'cash' ? 'Cancel' : '+ Add Entry'}
            </button>
          </div>
          {showForm === 'cash' && (
            <div className="card" style={{marginBottom:12}}>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    <option value="in">Cash In (Receive)</option>
                    <option value="out">Cash Out (Pay)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="e.g. Petty cash, daily collection" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount (&#8377;)</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="">-- Select --</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Reference</label>
                <input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} placeholder="Optional ref number" />
              </div>
              <button className="btn btn-success" onClick={() => handleSubmit('cash')}>Save Entry</button>
            </div>
          )}
          <div className="desktop-table">
            <div className="table-container">
              {cashBook.length > 0 ? (
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Category</th><th>Ref</th><th></th></tr></thead>
                  <tbody>
                    {cashBook.map(e => (
                      <tr key={e.id}>
                        <td>{e.date}</td>
                        <td>{e.description}</td>
                        <td><span className={`badge ${e.type === 'in' ? 'badge-success' : 'badge-danger'}`}>{e.type === 'in' ? 'IN' : 'OUT'}</span></td>
                        <td style={{color: e.type === 'in' ? '#27ae60' : '#e74c3c', fontWeight:600}}>&#8377;{Number(e.amount).toLocaleString('en-IN')}</td>
                        <td>{e.category || '-'}</td>
                        <td style={{fontSize:11}}>{e.reference || '-'}</td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete('cash', e.id)}>Del</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{textAlign:'center',color:'#999',padding:30}}>No cash entries yet</div>
              )}
            </div>
          </div>
          <div className="show-mobile-cards">
            <div className="mobile-cards">
              {cashBook.map(e => (
                <div key={e.id} className="mobile-card">
                  <div className="mobile-card-row"><span className="label">Date</span><span className="value">{e.date}</span></div>
                  <div className="mobile-card-row"><span className="label">Description</span><span className="value">{e.description}</span></div>
                  <div className="mobile-card-row">
                    <span className="label">Type</span>
                    <span className="value"><span className={`badge ${e.type === 'in' ? 'badge-success' : 'badge-danger'}`}>{e.type === 'in' ? 'IN' : 'OUT'}</span></span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="label">Amount</span>
                    <span className="value" style={{color: e.type === 'in' ? '#27ae60' : '#e74c3c'}}>&#8377;{Number(e.amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mobile-card-actions">
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete('cash', e.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {cashBook.length === 0 && <div style={{textAlign:'center',color:'#999',padding:20}}>No entries</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <h3>Expenses</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(showForm === 'expense' ? null : 'expense')}>
              {showForm === 'expense' ? 'Cancel' : '+ Add Expense'}
            </button>
          </div>
          {showForm === 'expense' && (
            <div className="card" style={{marginBottom:12}}>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="">-- Select --</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What was this expense for?" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount (&#8377;)</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Payment Mode</label>
                  <select value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})}>
                    {PAY_MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
              </div>
              <button className="btn btn-success" onClick={() => handleSubmit('expense')}>Save Expense</button>
            </div>
          )}
          <div className="desktop-table">
            <div className="table-container">
              {expenses.length > 0 ? (
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Mode</th><th></th></tr></thead>
                  <tbody>
                    {expenses.map(e => (
                      <tr key={e.id}>
                        <td>{e.date}</td>
                        <td>{e.description}</td>
                        <td><span className="badge badge-info">{e.category || '-'}</span></td>
                        <td style={{color:'#e74c3c', fontWeight:600}}>&#8377;{Number(e.amount).toLocaleString('en-IN')}</td>
                        <td><span className="badge badge-warning">{e.payment_mode}</span></td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete('expense', e.id)}>Del</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{textAlign:'center',color:'#999',padding:30}}>No expenses recorded</div>
              )}
            </div>
          </div>
          <div className="show-mobile-cards">
            <div className="mobile-cards">
              {expenses.map(e => (
                <div key={e.id} className="mobile-card">
                  <div className="mobile-card-header">{e.description}</div>
                  <div className="mobile-card-row"><span className="label">Date</span><span className="value">{e.date}</span></div>
                  <div className="mobile-card-row"><span className="label">Category</span><span className="value">{e.category || '-'}</span></div>
                  <div className="mobile-card-row"><span className="label">Amount</span><span className="value" style={{color:'#e74c3c'}}>&#8377;{Number(e.amount).toLocaleString('en-IN')}</span></div>
                  <div className="mobile-card-row"><span className="label">Mode</span><span className="value"><span className="badge badge-warning">{e.payment_mode}</span></span></div>
                  <div className="mobile-card-actions">
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete('expense', e.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {expenses.length === 0 && <div style={{textAlign:'center',color:'#999',padding:20}}>No expenses</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'incomes' && (
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <h3>Other Incomes</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(showForm === 'income' ? null : 'income')}>
              {showForm === 'income' ? 'Cancel' : '+ Add Income'}
            </button>
          </div>
          {showForm === 'income' && (
            <div className="card" style={{marginBottom:12}}>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="">-- Select --</option>
                    {['Interest', 'Rent', 'Commission', 'Sale of Asset', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Income source" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount (&#8377;)</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Payment Mode</label>
                  <select value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})}>
                    {PAY_MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
              </div>
              <button className="btn btn-success" onClick={() => handleSubmit('income')}>Save Income</button>
            </div>
          )}
          <div className="desktop-table">
            <div className="table-container">
              {incomes.length > 0 ? (
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Mode</th><th></th></tr></thead>
                  <tbody>
                    {incomes.map(e => (
                      <tr key={e.id}>
                        <td>{e.date}</td>
                        <td>{e.description}</td>
                        <td><span className="badge badge-info">{e.category || '-'}</span></td>
                        <td style={{color:'#27ae60', fontWeight:600}}>&#8377;{Number(e.amount).toLocaleString('en-IN')}</td>
                        <td><span className="badge badge-warning">{e.payment_mode}</span></td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete('income', e.id)}>Del</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{textAlign:'center',color:'#999',padding:30}}>No other incomes recorded</div>
              )}
            </div>
          </div>
          <div className="show-mobile-cards">
            <div className="mobile-cards">
              {incomes.map(e => (
                <div key={e.id} className="mobile-card">
                  <div className="mobile-card-header">{e.description}</div>
                  <div className="mobile-card-row"><span className="label">Date</span><span className="value">{e.date}</span></div>
                  <div className="mobile-card-row"><span className="label">Category</span><span className="value">{e.category || '-'}</span></div>
                  <div className="mobile-card-row"><span className="label">Amount</span><span className="value" style={{color:'#27ae60'}}>&#8377;{Number(e.amount).toLocaleString('en-IN')}</span></div>
                  <div className="mobile-card-row"><span className="label">Mode</span><span className="value"><span className="badge badge-warning">{e.payment_mode}</span></span></div>
                  <div className="mobile-card-actions">
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete('income', e.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {incomes.length === 0 && <div style={{textAlign:'center',color:'#999',padding:20}}>No incomes</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
