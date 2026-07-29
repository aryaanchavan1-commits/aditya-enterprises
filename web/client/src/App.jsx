import React, { useState, Component } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Categories from './components/Categories';
import BarcodeManager from './components/BarcodeManager';
import SalesPOS from './components/SalesPOS';
import Purchases from './components/Purchases';
import GSTInvoices from './components/GSTInvoices';
import AIChat from './components/AIChat';
import Settings from './components/Settings';
import Reports from './components/Reports';
import CRM from './components/CRM';
import Servicing from './components/Servicing';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:40, textAlign:'center'}}>
          <h2>Something went wrong</h2>
          <p style={{color:'#e74c3c', fontSize:13, margin:'10px 0'}}>{this.state.error?.message}</p>
          <button className="btn btn-primary" onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const [serverOnline, setServerOnline] = useState(true);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  React.useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  React.useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(() => setServerOnline(true)).catch(() => setServerOnline(false));
    const int = setInterval(() => {
      fetch('/api/health').then(r => r.json()).then(() => setServerOnline(true)).catch(() => setServerOnline(false));
    }, 30000);
    return () => clearInterval(int);
  }, []);

  const closeSidebar = () => { if (isMobile) setSidebarOpen(false); };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: 'D' },
    { path: '/products', label: 'Products', icon: 'P' },
    { path: '/categories', label: 'Categories', icon: 'C' },
    { path: '/barcode', label: 'Barcode', icon: 'B' },
    { path: '/pos', label: 'Sales / POS', icon: 'S' },
    { path: '/purchases', label: 'Purchases', icon: 'R' },
    { path: '/invoices', label: 'GST & Invoices', icon: 'I' },
    { path: '/reports', label: 'Reports', icon: 'T' },
    { path: '/crm', label: 'CRM', icon: 'M' },
    { path: '/services', label: 'Servicing', icon: 'V' },
    { path: '/ai', label: 'AI Assistant', icon: 'A' },
    { path: '/settings', label: 'Settings', icon: 'G' },
  ];

  return (
    <ErrorBoundary>
      <div className="app-layout">
        {!serverOnline && (
          <div className="offline-banner">
            <span>&#9888;</span> Server connection lost. Retrying...
          </div>
        )}
        {sidebarOpen && isMobile && (
          <div className="sidebar-backdrop" onClick={closeSidebar} />
        )}
        {!sidebarOpen && isMobile && (
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
            &#9776;
          </button>
        )}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <img src="/logo.jpg" alt="Logo" className="sidebar-logo" />
            {sidebarOpen && <span className="sidebar-title">Aditya ERP</span>}
          </div>
          <nav className="sidebar-nav">
            {menuItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={closeSidebar}
              >
                <span className="nav-icon-circle">{item.icon}</span>
                {sidebarOpen && <span className="nav-label">{item.label}</span>}
              </Link>
            ))}
          </nav>
          {!isMobile && (
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? '\u2039' : '\u203A'}
            </button>
          )}
        </aside>

        <main className="main-content">
          <header className="top-bar">
            <div className="top-bar-left">
              <h2>Aditya Enterprises ERP Suite 2026</h2>
              <span className={`badge ${serverOnline ? 'badge-success' : 'badge-danger'}`} style={{marginLeft:10, fontSize:10}}>
                {serverOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="top-bar-right">
              <span className="date-display">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </header>
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/barcode" element={<BarcodeManager />} />
              <Route path="/pos" element={<SalesPOS />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/invoices" element={<GSTInvoices />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/services" element={<Servicing />} />
              <Route path="/ai" element={<AIChat />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
