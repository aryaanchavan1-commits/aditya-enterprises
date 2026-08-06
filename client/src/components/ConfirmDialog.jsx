import React, { useEffect, useState } from 'react';

// Promise-based confirm dialog - one shared component for every destructive
// action in the app. Usage:
//   import { confirmAction } from '../confirm';
//   if (await confirmAction({ title: 'Delete?', message: 'This cannot be undone' })) { ... }
// The <ConfirmHost /> component must be mounted once (done in App.jsx).

export default function ConfirmDialog({ options, onResolve }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleClose = (result) => {
    setClosing(true);
    setTimeout(() => onResolve(result), 150);
  };

  const o = options || {};
  return (
    <div className={`modal-overlay ${closing ? 'modal-closing' : ''}`} style={{ zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) handleClose(false); }}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <h3 style={{ marginBottom: 10 }}>{o.title || 'Are you sure?'}</h3>
        {o.message && <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-line' }}>{o.message}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={() => handleClose(false)} autoFocus>{o.cancelText || 'Cancel'}</button>
          <button className={`btn ${o.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => handleClose(true)}>{o.confirmText || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}
