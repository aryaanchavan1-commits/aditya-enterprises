import React, { useEffect, useState } from 'react';
import ConfirmDialog from './components/ConfirmDialog';

// Shared promise-based confirm helper (replaces native window.confirm).
// `confirmAction({ title, message, danger, confirmText, cancelText })`
// resolves `true` when the user confirms, `false` when cancelled.
// Mount <ConfirmHost /> once in App.jsx.

let pendingResolve = null;
let pendingOptions = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function confirmAction(options = {}) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    pendingOptions = options;
    notify();
  });
}

export default function ConfirmHost() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    const fn = () => {
      if (pendingOptions) {
        setDialog(pendingOptions);
      }
    };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  const resolve = (result) => {
    setDialog(null);
    const r = pendingResolve;
    pendingResolve = null;
    pendingOptions = null;
    if (r) r(result);
  };

  if (!dialog) return null;
  return <ConfirmDialog options={dialog} onResolve={resolve} />;
}
