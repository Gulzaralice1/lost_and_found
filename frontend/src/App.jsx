import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = '/api';
const CATEGORIES = [
  ['mobile', '📱 Mobile'],
  ['wallet', '👛 Wallet'],
  ['documents', '📄 Documents'],
  ['keys', '🔑 Keys'],
  ['bag', '🎒 Bag'],
  ['electronics', '💻 Electronics'],
  ['jewelry', '💎 Jewelry'],
  ['clothing', '👕 Clothing'],
  ['other', '📦 Other']
];

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

async function api(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`The server returned an invalid response (${response.status}).`);
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }
  return data;
}

function Icon({ name, className = '' }) {
  return <i className={`fas fa-${name} ${className}`.trim()} aria-hidden="true" />;
}

function NoticeList({ notices }) {
  return (
    <div id="notificationContainer" aria-live="polite">
      {notices.map((notice) => (
        <div className={`notification ${notice.type}`} key={notice.id}>
          <Icon name={notice.type === 'error' ? 'times-circle' : notice.type === 'success' ? 'check-circle' : 'info-circle'} />
          {' '}{notice.message}
        </div>
      ))}
    </div>
  );
}

function ItemCard({ item, onOpen }) {
  const category = CATEGORIES.find(([value]) => value === item.category);
  return (
    <article
      className={`item-card-modern${item.status === 'matched' ? ' matched-highlight' : ''}`}
      onClick={() => onOpen(item._id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(item._id);
      }}
      role="button"
      tabIndex={0}
    >
      {item.image
        ? <img src={`/uploads/${encodeURIComponent(item.image)}`} alt={item.title} className="item-image-modern" />
        : <div className="item-image-placeholder"><Icon name="image" /></div>}
      <div className="item-badges">
        <span className={`item-badge-modern badge-${item.type}-modern`}>{item.type === 'lost' ? '🔴 LOST' : '🟢 FOUND'}</span>
        {item.status === 'matched' && <span className="item-badge-modern badge-matched-modern">✅ MATCHED</span>}
      </div>
      <h3 className="item-title-modern">{item.title}</h3>
      <p className="item-description-modern">{item.description?.slice(0, 90)}{item.description?.length > 90 ? '...' : ''}</p>
      <div className="item-meta-modern">
        <span><Icon name="map-marker-alt" /> {item.location}</span>
        <span>{category?.[1] || '📦 Other'}</span>
      </div>
      <div className="item-meta-modern item-card-date">
        <span><Icon name="calendar-alt" /> {new Date(item.date).toLocaleDateString()}</span>
        <span className="view-details-hint">View details →</span>
      </div>
    </article>
  );
}

function ItemGrid({ items, loading, error, onOpen }) {
  if (loading) {
    return <div className="loading-modern"><div className="spinner" /><p>Loading items...</p></div>;
  }
  if (error) return <div className="loading-modern" role="alert"><p>⚠️ {error}</p></div>;
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="box-open" />
        <h3>No items found</h3>
        <p>Try adjusting your filters or report a new item.</p>
      </div>
    );
  }
  return <div className="items-grid-modern">{items.map((item) => <ItemCard key={item._id} item={item} onOpen={onOpen} />)}</div>;
}

function ItemModal({ item, loading, error, onClose }) {
  useEffect(() => {
    if (!item && !loading && !error) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [item, loading, error, onClose]);

  if (!item && !loading && !error) return null;
  return (
    <div className="modal-modern open" role="dialog" aria-modal="true" aria-label="Item details">
      <button className="modal-overlay" onClick={onClose} aria-label="Close item details" />
      <div className="modal-content-modern glass-card">
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="times" /></button>
        <div className="modal-body-modern">
          {loading && <div className="loading-modern"><div className="spinner" /><p>Loading...</p></div>}
          {error && <p role="alert">{error}</p>}
          {item && <>
            <div className="modal-item-header">
              {item.image && <img src={`/uploads/${encodeURIComponent(item.image)}`} alt={item.title} className="modal-item-image" />}
              <div className="item-badges">
                <span className={`item-badge-modern badge-${item.type}-modern`}>{item.type.toUpperCase()}</span>
                {item.status === 'matched' && <span className="item-badge-modern badge-matched-modern">✅ MATCHED</span>}
              </div>
              <h2>{item.title}</h2>
            </div>
            <div className="modal-detail-grid">
              <Detail label="Description" icon="align-left">{item.description}</Detail>
              <Detail label="Category" icon="layer-group">{item.category}</Detail>
              <Detail label="Location" icon="map-marker-alt">{item.location}</Detail>
              <Detail label="Date" icon="calendar">{new Date(item.date).toLocaleDateString()}</Detail>
            </div>
            <div className="modal-contact-section">
              <h3><Icon name="address-card" /> Contact Information</h3>
              <div className="modal-detail-grid">
                <Detail label="Name" icon="user">{item.contactInfo?.name || 'N/A'}</Detail>
                <Detail label="Email" icon="envelope">{item.contactInfo?.email || 'N/A'}</Detail>
                <Detail label="Phone" icon="phone">{item.contactInfo?.phone || 'N/A'}</Detail>
              </div>
            </div>
            {item.matchedWith && (
              <div className="modal-match-section">
                <h3><Icon name="link" /> Matched with</h3>
                <p>{item.matchedWith.title} — {item.matchedWith.type}</p>
              </div>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, icon, children }) {
  return (
    <div className="modal-detail-item">
      <span className="detail-label"><Icon name={icon} /> {label}</span>
      <span className="detail-value">{children}</span>
    </div>
  );
}

function SiteApp({ user, token, onSession, onLogout, notify }) {
  const [route, setRoute] = useState(window.location.hash || '#home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [filters, setFilters] = useState({ type: '', category: '', location: '', search: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [items, setItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState('');
  const [myItemsLoading, setMyItemsLoading] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '#home');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!user && ['#report', '#dashboard'].includes(route)) window.location.hash = '#login';
    if (user && ['#login', '#signup'].includes(route)) window.location.hash = '#dashboard';
  }, [route, user]);

  useEffect(() => {
    if (route !== '#browse') return undefined;
    let active = true;
    const load = async () => {
      setItemsLoading(true);
      setItemsError('');
      const params = new URLSearchParams(Object.entries(appliedFilters).filter(([, value]) => value));
      try {
        const data = await api(`/items?${params}`);
        if (active) setItems(data.items || []);
      } catch (error) {
        if (active) setItemsError(error.message);
      } finally {
        if (active) setItemsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [route, appliedFilters, refreshKey]);

  useEffect(() => {
    if (route !== '#dashboard' || !token) return undefined;
    let active = true;
    setMyItemsLoading(true);
    api('/items/my-items', { token })
      .then((data) => { if (active) setMyItems(data.items || []); })
      .catch((error) => { if (active) notify(error.message, 'error'); })
      .finally(() => { if (active) setMyItemsLoading(false); });
    return () => { active = false; };
  }, [route, token, refreshKey, notify]);

  useEffect(() => {
    const socket = io(window.location.origin);
    socket.on('match-found', (data) => {
      notify(data.message || 'A potential item match has been found.', 'success');
      setRefreshKey((value) => value + 1);
    });
    return () => socket.disconnect();
  }, [notify]);

  const openItem = useCallback(async (id) => {
    setModalItem(null);
    setModalError('');
    setModalLoading(true);
    try {
      const data = await api(`/items/${id}`);
      setModalItem(data.item);
    } catch (error) {
      setModalError(error.message);
    } finally {
      setModalLoading(false);
    }
  }, []);
  const closeModal = useCallback(() => {
    setModalItem(null);
    setModalError('');
    setModalLoading(false);
  }, []);

  async function submitAuth(event, kind) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const data = await api(`/auth/${kind}`, { method: 'POST', body: JSON.stringify(payload) });
      onSession(data);
      notify(kind === 'login' ? 'Login successful. Welcome back!' : 'Account created successfully.', 'success');
      window.location.hash = '#dashboard';
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api('/items', { method: 'POST', token, body: form });
      notify(`Item reported successfully.${data.matchesFound ? ` ${data.matchesFound} potential match(es) found!` : ''}`, 'success');
      event.currentTarget.reset();
      setRefreshKey((value) => value + 1);
      window.location.hash = '#dashboard';
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  }

  return (
    <>
      <div className="background-animation"><div className="gradient-bg" /><div className="floating-shapes"><div className="shape shape-1" /><div className="shape shape-2" /><div className="shape shape-3" /></div></div>
      <nav className="navbar glass-nav">
        <div className="container nav-container">
          <a className="nav-brand" href="#home"><Icon name="search-location" className="brand-icon" /><span className="brand-text">Lost<span className="brand-highlight">&amp;Found</span></span></a>
          <button className="mobile-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation" aria-expanded={menuOpen}><span /><span /><span /></button>
          <div className={`nav-menu${menuOpen ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>
            <a href="#home" className={`nav-link${route === '#home' ? ' active' : ''}`}><Icon name="home" /> Home</a>
            <a href="#browse" className={`nav-link${route === '#browse' ? ' active' : ''}`}><Icon name="th-large" /> Browse</a>
            {user && <><a href="#report" className="nav-link"><Icon name="plus-circle" /> Report</a><a href="#dashboard" className="nav-link"><Icon name="chart-line" /> Dashboard</a></>}
            {user?.role === 'admin' && <a href="/admin" className="nav-link"><Icon name="shield-alt" /> Admin</a>}
            {!user
              ? <><a href="#login" className="nav-link"><Icon name="sign-in-alt" /> Login</a><a href="#signup" className="btn-gradient">Get Started</a></>
              : <button className="btn-gradient-danger" onClick={onLogout}><Icon name="sign-out-alt" /> Logout</button>}
          </div>
        </div>
      </nav>

      {route === '#home' && <section id="home" className="section hero-modern">
        <div className="container">
          <div className="hero-content-modern">
            <div className="hero-badge"><Icon name="star" /><span>Community-powered recovery</span></div>
            <h1 className="hero-title">Find What You&apos;ve <span className="gradient-text">Lost</span></h1>
            <p className="hero-subtitle">Report lost items, search found items, and connect with their owners through a simple community-powered system.</p>
            <div className="hero-buttons"><a href="#browse" className="btn-gradient-large"><Icon name="search" /> Browse Items</a>{user ? <a href="#report" className="btn-glass"><Icon name="plus-circle" /> Report Item</a> : <a href="#signup" className="btn-glass"><Icon name="rocket" /> Get Started</a>}</div>
            <div className="hero-stats"><div className="stat-item"><div className="stat-number">Lost</div><div className="stat-label">Report an item</div></div><div className="stat-item"><div className="stat-number">Found</div><div className="stat-label">Help its owner</div></div><div className="stat-item"><div className="stat-number">Together</div><div className="stat-label">Reconnect locally</div></div></div>
          </div>
          <div className="hero-illustration"><div className="floating-card card-1"><Icon name="mobile-alt" /><span>Mobile</span></div><div className="floating-card card-2"><Icon name="wallet" /><span>Wallet</span></div><div className="floating-card card-3"><Icon name="key" /><span>Keys</span></div></div>
        </div>
      </section>}

      {route === '#browse' && <section id="browse" className="section browse-modern">
        <div className="container">
          <header className="section-header"><h2 className="section-title"><Icon name="th-large" /> Browse <span className="gradient-text">Items</span></h2><p className="section-subtitle">Find what you&apos;re looking for with filters.</p></header>
          <form className="filters-modern glass-card" onSubmit={applyFilters}>
            <div className="filter-group">
              <Filter label="Type" icon="tag"><select className="modern-select" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All Types</option><option value="lost">Lost Items</option><option value="found">Found Items</option></select></Filter>
              <Filter label="Category" icon="layer-group"><select className="modern-select" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All Categories</option>{CATEGORIES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Filter>
              <Filter label="Location" icon="map-marker-alt"><input className="modern-input" value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} placeholder="Enter location..." /></Filter>
              <Filter label="Search" icon="search"><input className="modern-input" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search items..." /></Filter>
            </div>
            <div className="filter-actions"><button className="btn-gradient" type="submit"><Icon name="filter" /> Apply Filters</button><button className="btn-glass-secondary" type="button" onClick={() => { const empty = { type: '', category: '', location: '', search: '' }; setFilters(empty); setAppliedFilters(empty); }}><Icon name="redo" /> Clear</button></div>
          </form>
          <ItemGrid items={items} loading={itemsLoading} error={itemsError} onOpen={openItem} />
        </div>
      </section>}

      {route === '#report' && user && <section id="report" className="section report-modern">
        <div className="container"><SectionHeader icon="plus-circle" title={<>Report an <span className="gradient-text">Item</span></>} subtitle="Help reunite lost items with their owners." />
          <form className="form-modern glass-card report-form" onSubmit={submitReport}>
            <div className="form-group-modern"><label className="form-label"><Icon name="tag" /> Item Type *</label><div className="radio-group-modern"><label className="radio-card"><input type="radio" name="type" value="lost" required /><div className="radio-content"><Icon name="frown" /><span>Lost</span></div></label><label className="radio-card"><input type="radio" name="type" value="found" required /><div className="radio-content"><Icon name="smile" /><span>Found</span></div></label></div></div>
            <Field label="Title" icon="heading"><input className="modern-input" name="title" required placeholder="e.g., Black phone" /></Field>
            <Field label="Description" icon="align-left"><textarea className="modern-textarea" name="description" required rows="4" placeholder="Provide a detailed description..." /></Field>
            <div className="form-row-modern"><Field label="Category" icon="layer-group"><select className="modern-select" name="category" required defaultValue=""><option value="" disabled>Select Category</option>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Location" icon="map-marker-alt"><input className="modern-input" name="location" required placeholder="e.g., Central Park" /></Field></div>
            <Field label="Date" icon="calendar"><input className="modern-input" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label="Upload Image (Optional)" icon="image" optional><input className="modern-input" type="file" name="image" accept="image/*" /></Field>
            <button type="submit" className="btn-gradient-large btn-block"><Icon name="paper-plane" /> Submit Report</button>
          </form>
        </div>
      </section>}

      {route === '#dashboard' && user && <section id="dashboard" className="section dashboard-modern">
        <div className="container"><SectionHeader icon="chart-line" title={<>My <span className="gradient-text">Dashboard</span></>} subtitle="Track your reported items and matches." />
          <div className="dashboard-stats-modern"><StatCard icon="box" title="Total Items" value={myItems.length} /><StatCard icon="check-circle" title="Matched Items" value={myItems.filter((item) => item.status === 'matched').length} /><StatCard icon="clock" title="Active Items" value={myItems.filter((item) => item.status === 'active').length} /></div>
          <div className="dashboard-section-title"><h3><Icon name="list" /> My Reported Items</h3></div>
          <ItemGrid items={myItems} loading={myItemsLoading} onOpen={openItem} />
        </div>
      </section>}

      {route === '#login' && !user && <AuthPanel mode="login" onSubmit={submitAuth} />}
      {route === '#signup' && !user && <AuthPanel mode="signup" onSubmit={submitAuth} />}

      <footer className="site-footer"><div className="footer-inner"><div className="footer-brand"><Icon name="search-location" /> Lost<span>&amp;Found</span></div><p>© 2026 Lost &amp; Found System</p><p className="footer-sub">Helping reunite people with their belongings.</p></div></footer>
      <ItemModal item={modalItem} loading={modalLoading} error={modalError} onClose={closeModal} />
    </>
  );
}

function Filter({ label, icon, children }) {
  return <div className="filter-item"><label><Icon name={icon} /> {label}</label>{children}</div>;
}

function Field({ label, icon, children, optional = false }) {
  return <div className="form-group-modern"><label className="form-label"><Icon name={icon} /> {label}{optional ? '' : ' *'}</label>{children}</div>;
}

function SectionHeader({ icon, title, subtitle }) {
  return <header className="section-header"><h2 className="section-title"><Icon name={icon} /> {title}</h2><p className="section-subtitle">{subtitle}</p></header>;
}

function StatCard({ icon, title, value }) {
  return <div className="stat-card-modern glass-card"><div className="stat-icon"><Icon name={icon} /></div><div className="stat-info"><h3 className="stat-number">{value}</h3><p className="stat-label">{title}</p></div></div>;
}

function AuthPanel({ mode, onSubmit }) {
  const signup = mode === 'signup';
  return (
    <section className="section auth-modern">
      <div className="container"><div className="auth-container-modern glass-card">
        <div className="auth-header"><div className="auth-icon"><Icon name={signup ? 'user-plus' : 'sign-in-alt'} /></div><h2>{signup ? 'Create Account' : 'Welcome Back'}</h2><p>{signup ? 'Join us and start finding your items.' : 'Login to access your dashboard.'}</p></div>
        <form className="form-modern" onSubmit={(event) => onSubmit(event, signup ? 'signup' : 'login')}>
          {signup && <Field label="Full Name" icon="user"><input className="modern-input" name="name" required placeholder="Enter your full name" /></Field>}
          <Field label="Email" icon="envelope"><input className="modern-input" name="email" type="email" required placeholder="Enter your email" /></Field>
          {signup && <Field label="Phone Number" icon="phone"><input className="modern-input" name="phone" type="tel" required placeholder="Enter your phone number" /></Field>}
          <Field label="Password" icon="lock"><input className="modern-input" name="password" type="password" required minLength={signup ? 6 : undefined} placeholder={signup ? 'Create a password' : 'Enter your password'} /></Field>
          <button type="submit" className="btn-gradient-large btn-block"><Icon name={signup ? 'rocket' : 'sign-in-alt'} /> {signup ? 'Create Account' : 'Login to Dashboard'}</button>
        </form>
        <p className="auth-switch-modern">{signup ? 'Already have an account?' : "Don't have an account?"} <a href={signup ? '#login' : '#signup'} className="gradient-link">{signup ? 'Login here' : 'Sign up now'}</a></p>
      </div></div>
    </section>
  );
}

function AdminApp({ user, token, onLogout, notify }) {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState({ type: '', status: '', search: '' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    import('../css/admin.css');
  }, []);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      window.location.replace('/');
    }
  }, [token, user]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api('/admin/stats', { token });
      setStats(data.stats);
    } catch (error) {
      notify(error.message, 'error');
    }
  }, [token, notify]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/admin/users', { token });
      setUsers(data.users || []);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, notify]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    try {
      const data = await api(`/admin/items?${params}`, { token });
      setItems(data.items || []);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, filters, notify]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    if (tab === 'overview') loadStats();
    if (tab === 'users') loadUsers();
    if (tab === 'items') loadItems();
  }, [tab, reloadKey, loadStats, loadUsers, loadItems, user]);

  async function adminAction(path, options, successMessage) {
    try {
      const data = await api(path, { ...options, token });
      notify(data.message || successMessage, 'success');
      setReloadKey((value) => value + 1);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  function deleteUser(userToDelete) {
    if (window.confirm(`Delete "${userToDelete.name}" and all their reported items?`)) {
      adminAction(`/admin/users/${userToDelete._id}`, { method: 'DELETE' }, 'User deleted.');
    }
  }

  function deleteItem(item) {
    if (window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
      adminAction(`/admin/items/${item._id}`, { method: 'DELETE' }, 'Item deleted.');
    }
  }

  const titles = { overview: 'Overview', users: 'Manage Users', items: 'Manage Items' };
  if (user?.role !== 'admin') return null;

  return (
    <div className="admin-app">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-brand"><Icon name="shield-alt" /><span>Admin Panel</span></div>
        <nav className="sidebar-nav">
          {['overview', 'users', 'items'].map((name) => <button key={name} className={`sidebar-link${tab === name ? ' active' : ''}`} onClick={() => { setTab(name); setSidebarOpen(false); }}><Icon name={name === 'overview' ? 'tachometer-alt' : name === 'users' ? 'users' : 'box-open'} /> {titles[name]}</button>)}
          <a href="/" className="sidebar-link"><Icon name="arrow-left" /> Back to Site</a>
        </nav>
        <div className="sidebar-footer"><div className="admin-info"><Icon name="user-shield" /> {user?.name || 'Admin'}</div><button className="logout-btn" onClick={onLogout}><Icon name="sign-out-alt" /> Logout</button></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="sidebar-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle menu"><Icon name="bars" /></button><h1 className="topbar-title">{titles[tab]}</h1><span className="badge-admin"><Icon name="shield-alt" /> Admin</span></header>
        {tab === 'overview' && <section className="tab-content active"><div className="stats-grid">{[['users', 'Total Users', 'users', '#667eea'], ['items', 'Total Items', 'box-open', '#f5576c'], ['lost', 'Lost Items', 'search', '#4facfe'], ['found', 'Found Items', 'check-circle', '#00f2fe'], ['matched', 'Matched', 'link', '#f093fb'], ['resolved', 'Resolved', 'flag-checkered', '#ffd89b'], ['active', 'Active Items', 'clock', '#43e97b'], ['blocked', 'Blocked Users', 'ban', '#e74c3c']].map(([key, title, icon, accent]) => <div className="stat-box" style={{ '--accent': accent }} key={key}><div className="stat-icon"><Icon name={icon} /></div><div className="stat-body"><h2>{stats?.[key === 'users' ? 'totalUsers' : key === 'items' ? 'totalItems' : key === 'lost' ? 'lostItems' : key === 'found' ? 'foundItems' : key === 'matched' ? 'matchedItems' : key === 'resolved' ? 'resolvedItems' : key === 'active' ? 'activeItems' : 'blockedUsers'] ?? '—'}</h2><p>{title}</p></div></div>)}</div></section>}
        {tab === 'users' && <section className="tab-content active"><div className="panel-header"><h2><Icon name="users" /> Manage Users</h2><button className="btn-refresh" onClick={loadUsers}><Icon name="sync-alt" /> Refresh</button></div><div className="table-wrap"><table className="admin-table"><thead><tr>{['#', 'Name', 'Email', 'Phone', 'Items', 'Status', 'Joined', 'Actions'].map((title) => <th key={title}>{title}</th>)}</tr></thead><tbody>{loading ? <TableMessage columns={8}>Loading users...</TableMessage> : users.length ? users.map((entry, index) => <tr key={entry._id}><td>{index + 1}</td><td><strong>{entry.name}</strong></td><td>{entry.email}</td><td>{entry.phone || '—'}</td><td><span className="badge badge-active">{entry.itemCount}</span></td><td><span className={`badge ${entry.isBlocked ? 'badge-blocked' : 'badge-active-user'}`}>{entry.isBlocked ? 'Blocked' : 'Active'}</span></td><td>{formatDate(entry.createdAt)}</td><td><div className="action-btns"><button className="btn-block" onClick={() => adminAction(`/admin/users/${entry._id}/block`, { method: 'PATCH' }, 'User status updated.')}><Icon name={entry.isBlocked ? 'unlock' : 'ban'} /> {entry.isBlocked ? 'Unblock' : 'Block'}</button><button className="btn-del" onClick={() => deleteUser(entry)}><Icon name="trash" /> Delete</button></div></td></tr>) : <TableMessage columns={8}>No users found.</TableMessage>}</tbody></table></div></section>}
        {tab === 'items' && <section className="tab-content active"><div className="panel-header"><h2><Icon name="box-open" /> Manage Items</h2><div className="panel-filters"><select className="filter-select" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All Types</option><option value="lost">Lost</option><option value="found">Found</option></select><select className="filter-select" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All Status</option><option value="active">Active</option><option value="matched">Matched</option><option value="resolved">Resolved</option></select><input className="filter-input" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search title / location..." /><button className="btn-refresh" onClick={loadItems}><Icon name="sync-alt" /> Refresh</button></div></div><div className="table-wrap"><table className="admin-table"><thead><tr>{['#', 'Title', 'Type', 'Category', 'Location', 'Reported By', 'Status', 'Date', 'Actions'].map((title) => <th key={title}>{title}</th>)}</tr></thead><tbody>{loading ? <TableMessage columns={9}>Loading items...</TableMessage> : items.length ? items.map((item, index) => <tr key={item._id}><td>{index + 1}</td><td><strong>{item.title}</strong></td><td><span className={`badge badge-${item.type}`}>{item.type.toUpperCase()}</span></td><td>{item.category}</td><td>{item.location}</td><td>{item.user ? <>{item.user.name}<br /><small>{item.user.email}</small></> : 'Deleted user'}</td><td><select className="status-select" value={item.status} onChange={(event) => adminAction(`/admin/items/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) }, 'Status updated.')}><option value="active">Active</option><option value="matched">Matched</option><option value="resolved">Resolved</option></select></td><td>{formatDate(item.date)}</td><td><button className="btn-del" onClick={() => deleteItem(item)}><Icon name="trash" /> Delete</button></td></tr>) : <TableMessage columns={9}>No items found.</TableMessage>}</tbody></table></div></section>}
      </main>
    </div>
  );
}

function TableMessage({ columns, children }) {
  return <tr><td className="loading-row" colSpan={columns}>{children}</td></tr>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(storedUser);
  const [notices, setNotices] = useState([]);
  const isAdminPage = window.location.pathname.replace(/\/+$/, '') === '/admin';

  const notify = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotices((current) => [...current, { id, message, type }]);
    window.setTimeout(() => setNotices((current) => current.filter((notice) => notice.id !== id)), 4500);
  }, []);

  function saveSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    if (isAdminPage) window.location.replace('/');
    else {
      window.location.hash = '#home';
      notify('Logged out successfully.', 'success');
    }
  }

  return (
    <>
      <NoticeList notices={notices} />
      {isAdminPage
        ? <AdminApp user={user} token={token} onLogout={logout} notify={notify} />
        : <SiteApp user={user} token={token} onSession={saveSession} onLogout={logout} notify={notify} />}
    </>
  );
}
