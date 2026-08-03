// Tiny auth helper: remembers the admin password for this browser session
// and attaches it to every fetch() so the whole API stays protected.

let pw = '';
try { pw = sessionStorage.getItem('ae_pw') || ''; } catch (e) {}

export const auth = {
  getPw: () => pw,
  setPw: v => {
    pw = v || '';
    try {
      if (pw) sessionStorage.setItem('ae_pw', pw);
      else sessionStorage.removeItem('ae_pw');
    } catch (e) {}
  },
  clear: () => auth.setPw(''),
};

// Wrap global fetch once so every component (POS, products, bridge polling,
// print jobs...) automatically sends the password when the API is protected.
if (typeof window !== 'undefined') {
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const opts = init || {};
    const headers = new Headers(opts.headers || {});
    if (pw && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + pw);
    return origFetch(input, { ...opts, headers });
  };
}
