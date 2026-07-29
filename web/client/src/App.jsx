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

const TAB_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '\u25A3' },
  { path: '/products', label: 'Products', icon: '\u2693' },
  { path: '/pos', label: 'Sales', icon: '\u2699' },
  { path: '/purchases', label: 'Buy', icon: '\u2190' },
  { path: '/settings', label: 'Settings', icon: '\u2699' },
];
const MORE_ITEMS = [
  { path: '/categories', label: 'Categories', icon: 'C' },
  { path: '/barcode', label: 'Barcode', icon: 'B' },
  { path: '/invoices', label: 'GST & Invoices', icon: 'I' },
  { path: '/reports', label: 'Reports', icon: 'T' },
  { path: '/crm', label: 'CRM', icon: 'M' },
  { path: '/services', label: 'Servicing', icon: 'V' },
  { path: '/ai', label: 'AI Assistant', icon: 'A' },
];

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMore, setShowMore] = useState(false);
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
    setShowMore(false);
  }, [location.pathname]);

  React.useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(() => setServerOnline(true)).catch(() => setServerOnline(false));
    const int = setInterval(() => {
      fetch('/api/health').then(r => r.json()).then(() => setServerOnline(true)).catch(() => setServerOnline(false));
    }, 30000);
    return () => clearInterval(int);
  }, []);

  const closeSidebar = () => { if (isMobile) setSidebarOpen(false); };

  const pageTitle = TAB_ITEMS.concat(MORE_ITEMS).find(i => i.path === location.pathname)?.label || 'Aditya ERP';
  const isTabPath = (path) => location.pathname === path;

  return (
    <ErrorBoundary>
      <div className="app-layout">
        {!serverOnline && (
          <div className="offline-banner">
            <span>&#9888;</span> Server connection lost. Retrying...
          </div>
        )}

        {/* Mobile drawer backdrop */}
        {sidebarOpen && isMobile && (
          <div className="sidebar-backdrop" onClick={closeSidebar} />
        )}

        {/* More menu overlay (mobile) */}
        {showMore && isMobile && (
          <div className="more-overlay" onClick={() => setShowMore(false)} />
        )}

        {/* Sidebar (desktop drawer / mobile drawer) */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <img src="/logo.jpg" alt="Logo" className="sidebar-logo" />
            {sidebarOpen && <span className="sidebar-title">Aditya ERP</span>}
          </div>
          <nav className="sidebar-nav">
            {[...TAB_ITEMS, ...MORE_ITEMS].map(item => (
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
          {/* Top bar */}
          <header className="top-bar">
            <div className="top-bar-left">
              {isMobile && (
                <button className="top-bar-menu-btn" onClick={() => setSidebarOpen(true)}>
                  &#9776;
                </button>
              )}
              <h2>{pageTitle}</h2>
              <span className={`badge ${serverOnline ? 'badge-success' : 'badge-danger'}`} style={{marginLeft:8, fontSize:10}}>
                {serverOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </header>

          {/* Page content */}
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

        {/* Bottom tab bar (mobile only) */}
        {isMobile && (
          <nav className="bottom-tabs">
            {TAB_ITEMS.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`tab-item ${isTabPath(item.path) ? 'active' : ''}`}
              >
                <span className="tab-icon">{item.icon}</span>
                <span className="tab-label">{item.label}</span>
              </Link>
            ))}
            <button className={`tab-item ${showMore ? 'active' : ''}`} onClick={() => setShowMore(!showMore)}>
              <span className="tab-icon">...</span>
              <span className="tab-label">More</span>
            </button>
          </nav>
        )}

        {/* More menu popup (mobile) */}
        {showMore && isMobile && (
          <div className="more-menu">
            {MORE_ITEMS.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`more-item ${isTabPath(item.path) ? 'active' : ''}`}
                onClick={() => setShowMore(false)}
              >
                <span className="more-item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
