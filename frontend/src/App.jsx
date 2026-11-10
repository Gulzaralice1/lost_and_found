import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = '/api';

const CATEGORIES = [
  { id: 'mobile', label: 'Mobile Phone', icon: 'mobile-alt', emoji: '📱' },
  { id: 'wallet', label: 'Wallet / Purse', icon: 'wallet', emoji: '👛' },
  { id: 'documents', label: 'Documents / ID', icon: 'id-card', emoji: '📄' },
  { id: 'keys', label: 'Keys', icon: 'key', emoji: '🔑' },
  { id: 'bag', label: 'Bag / Backpack', icon: 'suitcase-rolling', emoji: '🎒' },
  { id: 'electronics', label: 'Electronics', icon: 'laptop', emoji: '💻' },
  { id: 'jewelry', label: 'Jewelry / Watch', icon: 'gem', emoji: '💎' },
  { id: 'clothing', label: 'Clothing', icon: 'tshirt', emoji: '👕' },
  { id: 'other', label: 'Other Items', icon: 'box', emoji: '📦' }
];

const COMMON_LOCATIONS = [
  'Central Library',
  'Campus Cafeteria',
  'Student Center',
  'Parking Lot B',
  'Main Auditorium',
  'Gym & Sports Hall',
  'Bus Stop / Terminal'
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

function formatDatePretty(dateString) {
  if (!dateString) return 'Recent';
  const itemDate = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return itemDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function NoticeList({ notices, onDismiss }) {
  return (
    <div id="notificationContainer" aria-live="polite">
      {notices.map((notice) => (
        <div className={`notification ${notice.type}`} key={notice.id} role="status">
          <Icon name={notice.type === 'error' ? 'exclamation-circle' : notice.type === 'success' ? 'check-circle' : 'info-circle'} />
          <span style={{ flex: 1 }}>{notice.message}</span>
          {onDismiss && (
            <button
              onClick={() => onDismiss(notice.id)}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '2px' }}
              aria-label="Dismiss notice"
            >
              <Icon name="times" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-box skeleton-media" />
      <div className="skeleton-box skeleton-title" />
      <div className="skeleton-box skeleton-text" />
      <div className="skeleton-box skeleton-meta" />
    </div>
  );
}

function ItemCard({ item, onOpen }) {
  const category = CATEGORIES.find((cat) => cat.id === item.category);

  return (
    <article
      className={`item-card-modern${item.status === 'matched' ? ' matched-highlight' : ''}`}
      onClick={() => onOpen(item._id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(item._id);
      }}
      role="button"
      tabIndex={0}
      aria-label={`${item.type === 'lost' ? 'Lost' : 'Found'} item: ${item.title}`}
    >
      <div className="item-card-media">
        {item.image ? (
          <img
            src={`/uploads/${encodeURIComponent(item.image)}`}
            alt={item.title}
            className="item-image-modern"
            loading="lazy"
          />
        ) : (
          <div className="item-image-placeholder">
            <Icon name={category?.icon || 'box'} />
            <span>{category?.label || 'General Item'}</span>
          </div>
        )}
        <div className="item-badges-overlay">
          <span className={`item-badge-modern badge-${item.type}-modern`}>
            {item.type === 'lost' ? '🔴 LOST' : '🟢 FOUND'}
          </span>
          {item.status === 'matched' && <span className="item-badge-modern badge-matched-modern">⚡ MATCHED</span>}
          {item.status === 'resolved' && <span className="item-badge-modern badge-resolved-modern">✅ RESOLVED</span>}
        </div>
      </div>

      <div className="item-card-body">
        <h3 className="item-title-modern">{item.title}</h3>
        <p className="item-description-modern">
          {item.description?.slice(0, 85)}
          {item.description?.length > 85 ? '...' : ''}
        </p>

        <div className="item-meta-modern">
          <span className="item-meta-pill">
            <Icon name="map-marker-alt" /> {item.location}
          </span>
          <span className="item-meta-pill">
            <Icon name="calendar-alt" /> {formatDatePretty(item.date)}
          </span>
        </div>
        <div className="item-meta-modern" style={{ borderTop: 'none', paddingTop: '0.4rem' }}>
          <span>{category?.emoji || '📦'} {category?.label || item.category}</span>
          <span className="view-details-hint">
            Details <Icon name="arrow-right" />
          </span>
        </div>
      </div>
    </article>
  );
}

function ItemGrid({ items, loading, error, onOpen, viewMode = 'grid' }) {
  if (loading) {
    return (
      <div className="items-grid-modern">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state" role="alert">
        <div className="empty-state-icon"><Icon name="exclamation-triangle" /></div>
        <h3>Failed to load items</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Icon name="box-open" /></div>
        <h3>No matching items found</h3>
        <p>Try refining your search keyword or clearing filters to see more results.</p>
      </div>
    );
  }

  return (
    <div className={viewMode === 'list' ? 'items-list-modern' : 'items-grid-modern'}>
      {items.map((item) => (
        <ItemCard key={item._id} item={item} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ItemModal({ item, loading, error, onClose, canResolve, resolving, onResolve, notify }) {
  const [showConfirmResolve, setShowConfirmResolve] = useState(false);
  const category = CATEGORIES.find((cat) => cat.id === item?.category);

  useEffect(() => {
    setShowConfirmResolve(false);
  }, [item]);

  useEffect(() => {
    if (!item && !loading && !error) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [item, loading, error, onClose]);

  if (!item && !loading && !error) return null;

  const copyContact = () => {
    if (!item?.contactInfo) return;
    const info = `Lost & Found contact: ${item.contactInfo.name || 'Owner'} | Phone: ${item.contactInfo.phone || 'N/A'} | Email: ${item.contactInfo.email || 'N/A'}`;
    navigator.clipboard?.writeText(info);
    notify('Contact details copied to clipboard!', 'success');
  };

  const shareItem = () => {
    const url = window.location.href.split('#')[0] + '#browse';
    navigator.clipboard?.writeText(url);
    notify('Link copied to clipboard!', 'info');
  };

  return (
    <div className="modal-modern open" role="dialog" aria-modal="true" aria-label="Item details modal">
      <button className="modal-overlay" onClick={onClose} aria-label="Close modal background" />
      <div className="modal-content-modern glass-card">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <Icon name="times" />
        </button>

        <div className="modal-body-modern">
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div className="spinner" />
              <p style={{ color: 'var(--text-muted)' }}>Loading item details...</p>
            </div>
          )}
          {error && <p role="alert" style={{ color: '#fca5a5' }}>⚠️ {error}</p>}

          {item && (
            <>
              {item.image && (
                <img
                  src={`/uploads/${encodeURIComponent(item.image)}`}
                  alt={item.title}
                  className="modal-item-image"
                />
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <span className={`item-badge-modern badge-${item.type}-modern`}>
                  {item.type === 'lost' ? '🔴 LOST ITEM' : '🟢 FOUND ITEM'}
                </span>
                {item.status === 'matched' && <span className="item-badge-modern badge-matched-modern">⚡ MATCHED</span>}
                {item.status === 'resolved' && <span className="item-badge-modern badge-resolved-modern">✅ RESOLVED</span>}
              </div>

              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'white' }}>
                {item.title}
              </h2>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.98rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {item.description}
              </p>

              <div className="modal-detail-grid">
                <div className="modal-detail-item">
                  <span className="detail-label"><Icon name="layer-group" /> Category</span>
                  <span className="detail-value">{category?.emoji || '📦'} {category?.label || item.category}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="detail-label"><Icon name="map-marker-alt" /> Location</span>
                  <span className="detail-value">{item.location}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="detail-label"><Icon name="calendar-alt" /> Date Reported</span>
                  <span className="detail-value">{new Date(item.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="detail-label"><Icon name="info-circle" /> Status</span>
                  <span className="detail-value" style={{ textTransform: 'capitalize' }}>{item.status}</span>
                </div>
              </div>

              {item.matchedWith && (
                <div className="modal-match-section">
                  <h3><Icon name="link" /> Potential Match Found!</h3>
                  <p style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>
                    Paired with: <strong>{item.matchedWith.title}</strong> ({item.matchedWith.type?.toUpperCase()})
                  </p>
                </div>
              )}

              {/* Direct Reconnection Actions */}
              <div className="modal-contact-card">
                <div className="contact-card-header">
                  <h3><Icon name="address-book" /> Contact Finder / Reporter</h3>
                  <button
                    type="button"
                    className="btn-glass-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={copyContact}
                  >
                    <Icon name="copy" /> Copy
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Name</span>
                    <p style={{ fontWeight: 600, color: 'white' }}>{item.contactInfo?.name || 'Community Member'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Phone</span>
                    <p style={{ fontWeight: 600, color: 'white' }}>{item.contactInfo?.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Email</span>
                    <p style={{ fontWeight: 600, color: 'white' }}>{item.contactInfo?.email || 'Not provided'}</p>
                  </div>
                </div>

                <div className="contact-action-buttons">
                  {item.contactInfo?.phone && (
                    <a href={`tel:${item.contactInfo.phone}`} className="contact-btn">
                      <Icon name="phone-alt" /> Call Reporter
                    </a>
                  )}
                  {item.contactInfo?.email && (
                    <a href={`mailto:${item.contactInfo.email}?subject=Regarding lost/found item: ${encodeURIComponent(item.title)}`} className="contact-btn">
                      <Icon name="envelope" /> Send Email
                    </a>
                  )}
                  <button type="button" className="contact-btn" onClick={shareItem}>
                    <Icon name="share-alt" /> Share Link
                  </button>
                </div>
              </div>

              {/* Owner Resolve Action */}
              {canResolve && item.status !== 'resolved' && (
                <>
                  {!showConfirmResolve ? (
                    <button
                      className="btn-gradient-large btn-block"
                      type="button"
                      style={{ marginTop: '1rem' }}
                      onClick={() => setShowConfirmResolve(true)}
                    >
                      <Icon name="check-circle" /> Mark as Resolved & Reunited
                    </button>
                  ) : (
                    <div className="resolve-confirm-box">
                      <p>
                        Are you sure you want to resolve <strong>&ldquo;{item.title}&rdquo;</strong>?
                        {item.matchedWith ? ' Both this report and its matched listing will be marked resolved.' : ''}
                      </p>
                      <div className="confirm-actions-row">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            setShowConfirmResolve(false);
                            onResolve();
                          }}
                          disabled={resolving}
                        >
                          <Icon name={resolving ? 'spinner' : 'check'} /> {resolving ? 'Resolving...' : 'Yes, Mark Resolved'}
                        </button>
                        <button
                          type="button"
                          className="btn-glass-secondary"
                          onClick={() => setShowConfirmResolve(false)}
                          disabled={resolving}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SiteApp({ user, token, onSession, onLogout, notify }) {
  const [route, setRoute] = useState(window.location.hash || '#home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [filters, setFilters] = useState({ type: '', category: '', location: '', search: '', status: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');

  const [items, setItems] = useState([]);
  const [recentItems, setRecentItems] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [myItems, setMyItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState('');
  const [myItemsLoading, setMyItemsLoading] = useState(false);
  const [dashboardTab, setDashboardTab] = useState('all');

  const [modalItem, setModalItem] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [resolvingItemId, setResolvingItemId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Form states for Report Item
  const [reportType, setReportType] = useState('lost');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Home Hero search input state
  const [heroSearch, setHeroSearch] = useState('');

  useEffect(() => {
    const onHashChange = () => {
      const currentHash = window.location.hash || '#home';
      setRoute(currentHash);
      setMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!user && ['#report', '#dashboard'].includes(route)) {
      window.location.hash = '#login';
    }
    if (user && ['#login', '#signup'].includes(route)) {
      window.location.hash = '#dashboard';
    }
  }, [route, user]);

  // Load Recent Items for Home page
  useEffect(() => {
    let active = true;
    if (route === '#home') {
      setRecentLoading(true);
      api('/items?status=active')
        .then((data) => {
          if (active) setRecentItems((data.items || []).slice(0, 3));
        })
        .catch(() => {})
        .finally(() => {
          if (active) setRecentLoading(false);
        });
    }
    return () => { active = false; };
  }, [route, refreshKey]);

  // Fetch items for browse
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

  // Fetch items for dashboard
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

  // Socket.IO Match notifications
  useEffect(() => {
    const socket = io(window.location.origin);
    socket.on('match-found', (data) => {
      notify(data.message || '🎉 A potential item match has been found!', 'success');
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

  async function resolveItem() {
    if (!modalItem) return;
    setResolvingItemId(modalItem._id);
    try {
      const data = await api(`/items/${modalItem._id}/resolve`, { method: 'PATCH', token });
      setModalItem(data.item);
      setRefreshKey((value) => value + 1);
      notify(data.message || 'Item marked as resolved!', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setResolvingItemId('');
    }
  }

  async function submitAuth(event, kind) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const data = await api(`/auth/${kind}`, { method: 'POST', body: JSON.stringify(payload) });
      onSession(data);
      notify(kind === 'login' ? 'Login successful. Welcome back!' : 'Account created successfully. Welcome aboard!', 'success');
      window.location.hash = '#dashboard';
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  // Handle Drag & Drop Image
  function handleFileSelect(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please upload an image file (PNG, JPG, WEBP).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('File size exceeds 5MB limit.', 'error');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  }

  function removeSelectedImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submitReport(event) {
    event.preventDefault();
    setIsSubmittingReport(true);
    const form = new FormData(event.currentTarget);
    form.set('type', reportType);
    if (imageFile) {
      form.set('image', imageFile);
    }

    try {
      const data = await api('/items', { method: 'POST', token, body: form });
      notify(`Item reported successfully!${data.matchesFound ? ` Found ${data.matchesFound} potential match(es)!` : ''}`, 'success');
      event.currentTarget.reset();
      removeSelectedImage();
      setRefreshKey((value) => value + 1);
      window.location.hash = '#dashboard';
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  }

  // Quick hero search trigger
  function handleHeroSearchSubmit(event) {
    event.preventDefault();
    const newFilters = { ...filters, search: heroSearch.trim() };
    setFilters(newFilters);
    setAppliedFilters(newFilters);
    window.location.hash = '#browse';
  }

  // Quick category chip filter from Home or Browse
  function selectCategoryFilter(catId) {
    const nextCat = filters.category === catId ? '' : catId;
    const next = { ...filters, category: nextCat };
    setFilters(next);
    setAppliedFilters(next);
    if (route !== '#browse') window.location.hash = '#browse';
  }

  function handleTypeSegmentChange(type) {
    const next = { ...filters, type };
    setFilters(next);
    setAppliedFilters(next);
  }

  function clearAllFilters() {
    const empty = { type: '', category: '', location: '', search: '', status: '' };
    setFilters(empty);
    setAppliedFilters(empty);
  }

  // Sorted items
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return 0;
    });
  }, [items, sortBy]);

  // Dashboard filtered items
  const filteredMyItems = useMemo(() => {
    if (dashboardTab === 'all') return myItems;
    return myItems.filter((item) => item.status === dashboardTab);
  }, [myItems, dashboardTab]);

  const matchedCount = useMemo(() => myItems.filter((item) => item.status === 'matched').length, [myItems]);

  const hasActiveFilters = Boolean(appliedFilters.type || appliedFilters.category || appliedFilters.location || appliedFilters.search || appliedFilters.status);

  return (
    <>
      <div className="background-animation">
        <div className="gradient-bg" />
        <div className="floating-shapes">
          <div className="shape shape-1" />
          <div className="shape shape-2" />
          <div className="shape shape-3" />
        </div>
      </div>

      {/* Modern Sticky Navigation */}
      <nav className="navbar" role="navigation" aria-label="Main Navigation">
        <div className="container nav-container">
          <a className="nav-brand" href="#home">
            <div className="brand-icon-wrap">
              <Icon name="search-location" />
            </div>
            <span>Lost<span className="brand-highlight">&amp;Found</span></span>
          </a>

          <button
            className="mobile-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            <Icon name={menuOpen ? 'times' : 'bars'} />
          </button>

          <div className={`nav-menu${menuOpen ? ' active' : ''}`}>
            <a href="#home" className={`nav-link${route === '#home' ? ' active' : ''}`}>
              <Icon name="home" /> Home
            </a>
            <a href="#browse" className={`nav-link${route === '#browse' ? ' active' : ''}`}>
              <Icon name="compass" /> Browse Items
            </a>

            {user ? (
              <>
                <a href="#dashboard" className={`nav-link${route === '#dashboard' ? ' active' : ''}`}>
                  <Icon name="chart-pie" /> Dashboard
                </a>
                <a href="#report" className="nav-link nav-cta-report">
                  <Icon name="plus" /> Report Item
                </a>
                <a href="#admin" className="nav-link" style={{ color: '#fb7185' }}>
                  <Icon name="shield-halved" /> Admin
                </a>
                <div className="nav-divider" />
                <div className="user-nav-profile">
                  <div className="user-avatar-badge">{user.name?.charAt(0) || 'U'}</div>
                  <span className="user-name-text">{user.name}</span>
                  {user.role === 'admin' && <span className="role-pill">Admin</span>}
                </div>
                <button className="btn-gradient-danger" onClick={onLogout} title="Sign Out">
                  <Icon name="arrow-right-from-bracket" />
                </button>
              </>
            ) : (
              <>
                <a href="#admin" className="nav-link" title="Administrator Portal">
                  <Icon name="shield-halved" /> Admin
                </a>
                <a href="#login" className={`nav-link${route === '#login' ? ' active' : ''}`}>
                  <Icon name="arrow-right-to-bracket" /> Login
                </a>
                <a href="#signup" className="btn-gradient" style={{ padding: '0.55rem 1.25rem', borderRadius: 'var(--radius-pill)' }}>
                  <Icon name="sparkles" /> Get Started
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ====================================================================
          ROUTE: #home
          ==================================================================== */}
      {route === '#home' && (
        <>
          <section id="home" className="section hero-modern">
            <div className="container">
              <div className="hero-content-modern">
                <div className="hero-badge">
                  <Icon name="shield-heart" />
                  <span>Community-Driven Lost &amp; Found Network</span>
                </div>

                <h1 className="hero-title">
                  Reconnect With What <span className="gradient-text">Matters.</span>
                </h1>

                <p className="hero-subtitle">
                  Lost your essentials or discovered someone else&apos;s belongings? Report items, explore listings, and reunite effortlessly through smart matching.
                </p>

                {/* Live Hero Search Bar */}
                <div className="hero-search-wrapper">
                  <form className="hero-search-form" onSubmit={handleHeroSearchSubmit}>
                    <Icon name="search" className="hero-search-icon" />
                    <input
                      type="text"
                      className="hero-search-input"
                      placeholder="Search lost keys, wallet, phone, backpack..."
                      value={heroSearch}
                      onChange={(e) => setHeroSearch(e.target.value)}
                    />
                    <button type="submit" className="hero-search-btn">
                      <Icon name="magnifying-glass" /> <span>Find Now</span>
                    </button>
                  </form>
                </div>

                {/* Quick Category Chips */}
                <div className="hero-category-pills">
                  <span className="hero-category-label">Quick Browse:</span>
                  {CATEGORIES.slice(0, 6).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className="hero-pill-btn"
                      onClick={() => selectCategoryFilter(cat.id)}
                    >
                      <span>{cat.emoji}</span> {cat.label}
                    </button>
                  ))}
                  <a href="#browse" className="hero-pill-btn" style={{ color: '#fb7185' }}>
                    <span>All categories →</span>
                  </a>
                </div>

                {/* Action Cards: I Lost Something vs I Found Something */}
                <div className="hero-action-cards">
                  <a
                    href={user ? '#report' : '#signup'}
                    className="hero-action-card hero-action-lost"
                    onClick={() => setReportType('lost')}
                  >
                    <div className="action-card-icon">
                      <Icon name="magnifying-glass-arrow-right" />
                    </div>
                    <div className="action-card-info">
                      <h3>I Lost Something <Icon name="arrow-right" /></h3>
                      <p>Post your item with details, photos &amp; location to match with discovered reports.</p>
                    </div>
                  </a>

                  <a
                    href={user ? '#report' : '#signup'}
                    className="hero-action-card hero-action-found"
                    onClick={() => setReportType('found')}
                  >
                    <div className="action-card-icon">
                      <Icon name="hand-holding-heart" />
                    </div>
                    <div className="action-card-info">
                      <h3>I Found Something <Icon name="arrow-right" /></h3>
                      <p>Help return an item to its owner by listing what you found safely and securely.</p>
                    </div>
                  </a>
                </div>

                {/* Trust & Impact Stats */}
                <div className="hero-stats">
                  <div className="stat-item">
                    <div className="stat-number">100%</div>
                    <div className="stat-label">Free &amp; Community-Powered</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">⚡ Instant</div>
                    <div className="stat-label">Smart Match Engine</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">🔒 Safe</div>
                    <div className="stat-label">Direct Contact Exchange</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="how-it-works-section">
            <div className="container">
              <header className="section-header">
                <span className="section-tag"><Icon name="circle-nodes" /> Simple Workflow</span>
                <h2 className="section-title">How Lost &amp; Found <span className="gradient-text">Works</span></h2>
                <p className="section-subtitle">A seamless three-step process designed to bring items back to their rightful owners in record time.</p>
              </header>

              <div className="steps-grid">
                <div className="step-card">
                  <span className="step-number">01</span>
                  <div className="step-icon-wrap"><Icon name="file-pen" /></div>
                  <h3>Submit a Report</h3>
                  <p>Describe your lost or found item, specify category, location, and attach an optional photo to maximize visibility.</p>
                </div>

                <div className="step-card">
                  <span className="step-number">02</span>
                  <div className="step-icon-wrap"><Icon name="bolt-lightning" /></div>
                  <h3>Intelligent Matching</h3>
                  <p>Our algorithm compares details, dates, and locations in real-time, instantly notifying both parties when a potential match is identified.</p>
                </div>

                <div className="step-card">
                  <span className="step-number">03</span>
                  <div className="step-icon-wrap"><Icon name="handshake" /></div>
                  <h3>Safely Reconnect</h3>
                  <p>Connect directly with the finder or owner via secure verified email or phone, arrange return, and resolve the case.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Recent Listings Preview on Home */}
          {recentItems.length > 0 && (
            <section className="home-recent-section">
              <div className="container">
                <div className="recent-header-row">
                  <header className="section-header">
                    <span className="section-tag"><Icon name="clock-rotate-left" /> Live Feed</span>
                    <h2 className="section-title">Recent <span className="gradient-text">Listings</span></h2>
                  </header>
                  <a href="#browse" className="btn-glass" style={{ padding: '0.65rem 1.4rem', fontSize: '0.92rem' }}>
                    Explore All <Icon name="arrow-right" />
                  </a>
                </div>

                <ItemGrid items={recentItems} loading={recentLoading} onOpen={openItem} />
              </div>
            </section>
          )}
        </>
      )}

      {/* ====================================================================
          ROUTE: #browse
          ==================================================================== */}
      {route === '#browse' && (
        <section id="browse" className="section">
          <div className="container">
            <header className="section-header">
              <span className="section-tag"><Icon name="compass" /> Directory</span>
              <h2 className="section-title">Browse <span className="gradient-text">Items</span></h2>
              <p className="section-subtitle">Search, filter by category or location, and locate what you&apos;re looking for.</p>
            </header>

            {/* Filter Control Center */}
            <div className="browse-controls-panel">
              {/* Type Segmented Pill Bar */}
              <div className="type-segmented-bar">
                <button
                  type="button"
                  className={`type-segment-btn${appliedFilters.type === '' ? ' active' : ''}`}
                  onClick={() => handleTypeSegmentChange('')}
                >
                  <Icon name="boxes-stacked" /> All Items
                </button>
                <button
                  type="button"
                  className={`type-segment-btn lost${appliedFilters.type === 'lost' ? ' active' : ''}`}
                  onClick={() => handleTypeSegmentChange('lost')}
                >
                  <Icon name="magnifying-glass" /> 🔴 Lost Items
                </button>
                <button
                  type="button"
                  className={`type-segment-btn found${appliedFilters.type === 'found' ? ' active' : ''}`}
                  onClick={() => handleTypeSegmentChange('found')}
                >
                  <Icon name="hand-holding-heart" /> 🟢 Found Items
                </button>
              </div>

              {/* Keyword, Location & Status Row */}
              <form
                className="filter-inputs-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  setAppliedFilters({ ...filters });
                }}
              >
                <div className="input-with-icon">
                  <Icon name="search" />
                  <input
                    className="modern-input"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search keywords, brand, title..."
                  />
                  {filters.search && (
                    <button
                      type="button"
                      className="clear-input-btn"
                      onClick={() => {
                        const next = { ...filters, search: '' };
                        setFilters(next);
                        setAppliedFilters(next);
                      }}
                      aria-label="Clear search"
                    >
                      <Icon name="times" />
                    </button>
                  )}
                </div>

                <div className="input-with-icon">
                  <Icon name="location-dot" />
                  <input
                    className="modern-input"
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    placeholder="Filter by location..."
                  />
                  {filters.location && (
                    <button
                      type="button"
                      className="clear-input-btn"
                      onClick={() => {
                        const next = { ...filters, location: '' };
                        setFilters(next);
                        setAppliedFilters(next);
                      }}
                      aria-label="Clear location"
                    >
                      <Icon name="times" />
                    </button>
                  )}
                </div>

                <div className="input-with-icon">
                  <Icon name="filter" />
                  <select
                    className="modern-select"
                    value={filters.status}
                    onChange={(e) => {
                      const next = { ...filters, status: e.target.value };
                      setFilters(next);
                      setAppliedFilters(next);
                    }}
                  >
                    <option value="">Status: Active</option>
                    <option value="matched">Status: Matched</option>
                    <option value="resolved">Status: Resolved</option>
                  </select>
                </div>

                <button className="btn-gradient" type="submit" style={{ padding: '0.75rem 1.4rem' }}>
                  <Icon name="check" /> Apply
                </button>
              </form>

              {/* Category Chips Bar */}
              <div className="category-chips-bar">
                <button
                  type="button"
                  className={`category-chip${appliedFilters.category === '' ? ' active' : ''}`}
                  onClick={() => selectCategoryFilter('')}
                >
                  <Icon name="layer-group" /> All Categories
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-chip${appliedFilters.category === cat.id ? ' active' : ''}`}
                    onClick={() => selectCategoryFilter(cat.id)}
                  >
                    <span>{cat.emoji}</span> {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Meta Bar */}
            <div className="browse-meta-bar">
              <div className="results-count-text">
                <span className="results-pulse-dot" />
                <span>Showing <strong>{sortedItems.length}</strong> items</span>
                {hasActiveFilters && (
                  <button type="button" className="clear-all-filters-btn" onClick={clearAllFilters}>
                    <Icon name="rotate-left" /> Reset filters
                  </button>
                )}
              </div>

              <div className="browse-meta-right">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-dim)', fontWeight: 600 }}>Sort:</span>
                  <select
                    className="modern-select"
                    style={{ padding: '0.4rem 0.8rem', width: 'auto', fontSize: '0.85rem' }}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="title">Alphabetical (A-Z)</option>
                  </select>
                </div>

                <div className="view-mode-toggle">
                  <button
                    type="button"
                    className={`view-mode-btn${viewMode === 'grid' ? ' active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <Icon name="table-cells-large" />
                  </button>
                  <button
                    type="button"
                    className={`view-mode-btn${viewMode === 'list' ? ' active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List view"
                    aria-label="List view"
                  >
                    <Icon name="list" />
                  </button>
                </div>
              </div>
            </div>

            {/* Item List / Grid */}
            <ItemGrid
              items={sortedItems}
              loading={itemsLoading}
              error={itemsError}
              onOpen={openItem}
              viewMode={viewMode}
            />
          </div>
        </section>
      )}

      {/* ====================================================================
          ROUTE: #report
          ==================================================================== */}
      {route === '#report' && user && (
        <section id="report" className="section">
          <div className="container report-form-container">
            <header className="section-header">
              <span className="section-tag"><Icon name="bullhorn" /> New Listing</span>
              <h2 className="section-title">Report an <span className="gradient-text">Item</span></h2>
              <p className="section-subtitle">Provide accurate information so our system and community can help reconnect the item.</p>
            </header>

            <form className="form-modern glass-card" onSubmit={submitReport}>
              {/* Type Selection */}
              <div className="form-group-modern">
                <label className="form-label">
                  <span className="form-label-left"><Icon name="tag" /> What are you reporting? *</span>
                </label>
                <div className="type-radio-selector">
                  <label className="type-radio-card lost">
                    <input
                      type="radio"
                      name="type"
                      value="lost"
                      checked={reportType === 'lost'}
                      onChange={() => setReportType('lost')}
                    />
                    <div className="type-radio-inner">
                      <Icon name="magnifying-glass" />
                      <strong>I Lost an Item</strong>
                      <span>Help me find what I lost</span>
                    </div>
                  </label>

                  <label className="type-radio-card found">
                    <input
                      type="radio"
                      name="type"
                      value="found"
                      checked={reportType === 'found'}
                      onChange={() => setReportType('found')}
                    />
                    <div className="type-radio-inner">
                      <Icon name="hand-holding-heart" />
                      <strong>I Found an Item</strong>
                      <span>Help me return it to its owner</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Title */}
              <div className="form-group-modern">
                <label className="form-label">
                  <span className="form-label-left"><Icon name="heading" /> Title / Name of Item *</span>
                </label>
                <input
                  className="modern-input"
                  name="title"
                  required
                  placeholder="e.g. Navy Blue Leather Wallet, Silver iPhone 14 Pro..."
                  maxLength={100}
                />
              </div>

              {/* Description */}
              <div className="form-group-modern">
                <label className="form-label">
                  <span className="form-label-left"><Icon name="align-left" /> Detailed Description *</span>
                </label>
                <textarea
                  className="modern-textarea"
                  name="description"
                  required
                  rows={4}
                  placeholder="Provide identifiable details, distinct marks, case color, stickers, contents..."
                  maxLength={1000}
                />
              </div>

              {/* Category & Location */}
              <div className="form-row-modern">
                <div className="form-group-modern">
                  <label className="form-label">
                    <span className="form-label-left"><Icon name="layer-group" /> Category *</span>
                  </label>
                  <select className="modern-select" name="category" required defaultValue="">
                    <option value="" disabled>Select Item Category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-modern">
                  <label className="form-label">
                    <span className="form-label-left"><Icon name="map-marker-alt" /> Location *</span>
                  </label>
                  <input
                    className="modern-input"
                    name="location"
                    id="locationInput"
                    required
                    placeholder="e.g. Main Library 2nd Floor, Cafeteria..."
                  />
                  <div className="location-chips-row">
                    {COMMON_LOCATIONS.slice(0, 4).map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        className="location-chip-btn"
                        onClick={() => {
                          const el = document.getElementById('locationInput');
                          if (el) el.value = loc;
                        }}
                      >
                        + {loc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Date */}
              <div className="form-group-modern">
                <label className="form-label">
                  <span className="form-label-left"><Icon name="calendar-day" /> Date Lost or Found *</span>
                </label>
                <input
                  className="modern-input"
                  name="date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>

              {/* Drag and Drop Image Dropzone */}
              <div className="form-group-modern">
                <label className="form-label">
                  <span className="form-label-left"><Icon name="image" /> Item Photo (Optional)</span>
                </label>

                {!imagePreview ? (
                  <div
                    className={`dropzone-container${isDragOver ? ' drag-over' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="dropzone-file-input"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                      }}
                    />
                    <Icon name="cloud-arrow-up" className="dropzone-icon" />
                    <p className="dropzone-title">Drag &amp; drop item photo here, or browse</p>
                    <p className="dropzone-subtitle">Supports PNG, JPG, WEBP up to 5MB</p>
                  </div>
                ) : (
                  <div className="image-preview-box">
                    <img src={imagePreview} alt="Upload preview" className="image-preview-thumb" />
                    <div className="image-preview-info">
                      <p className="image-preview-filename">{imageFile?.name || 'Uploaded photo'}</p>
                      <p className="image-preview-size">
                        {imageFile?.size ? `${(imageFile.size / 1024).toFixed(1)} KB` : 'Ready to upload'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={removeSelectedImage}
                      title="Remove image"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn-gradient-large btn-block"
                disabled={isSubmittingReport}
              >
                <Icon name={isSubmittingReport ? 'spinner' : 'paper-plane'} className={isSubmittingReport ? 'fa-spin' : ''} />
                {isSubmittingReport ? 'Submitting Report...' : 'Publish Item Report'}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ====================================================================
          ROUTE: #dashboard
          ==================================================================== */}
      {route === '#dashboard' && user && (
        <section id="dashboard" className="section dashboard-modern">
          <div className="container">
            {/* User Welcome Banner */}
            <div className="dashboard-user-banner">
              <div className="user-banner-left">
                <div className="banner-avatar">{user.name?.charAt(0) || 'U'}</div>
                <div className="banner-user-info">
                  <h2>Welcome back, {user.name}!</h2>
                  <p><Icon name="envelope" /> {user.email} &bull; <Icon name="phone" /> {user.phone || 'No phone set'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a href="#report" className="btn-gradient">
                  <Icon name="plus-circle" /> Report New Item
                </a>
                <a href="#browse" className="btn-glass-secondary">
                  <Icon name="compass" /> Browse Feed
                </a>
              </div>
            </div>

            {/* Matched Notice Callout */}
            {matchedCount > 0 && (
              <div className="dashboard-match-alert">
                <div className="match-alert-content">
                  <div className="match-alert-icon"><Icon name="bolt" /></div>
                  <div>
                    <h4 style={{ color: 'white', fontSize: '1.05rem', fontWeight: 800 }}>
                      🎉 You have {matchedCount} potential item match{matchedCount > 1 ? 'es' : ''}!
                    </h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Check your matched listings below to review counterpart details and connect with the owner/finder.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setDashboardTab('matched')}
                >
                  View Matches
                </button>
              </div>
            )}

            {/* Stats Metric Cards */}
            <div className="dashboard-stats-modern">
              <div className="stat-card-modern">
                <div className="stat-icon total"><Icon name="boxes-stacked" /></div>
                <div className="stat-info">
                  <div className="stat-number">{myItems.length}</div>
                  <div className="stat-label">Total Reports</div>
                </div>
              </div>

              <div className={`stat-card-modern${matchedCount > 0 ? ' matched-glow' : ''}`}>
                <div className="stat-icon matched"><Icon name="link" /></div>
                <div className="stat-info">
                  <div className="stat-number">{matchedCount}</div>
                  <div className="stat-label">Matches Found</div>
                </div>
              </div>

              <div className="stat-card-modern">
                <div className="stat-icon active"><Icon name="hourglass-half" /></div>
                <div className="stat-info">
                  <div className="stat-number">{myItems.filter((i) => i.status === 'active').length}</div>
                  <div className="stat-label">Active Cases</div>
                </div>
              </div>

              <div className="stat-card-modern">
                <div className="stat-icon resolved"><Icon name="flag-checkered" /></div>
                <div className="stat-info">
                  <div className="stat-number">{myItems.filter((i) => i.status === 'resolved').length}</div>
                  <div className="stat-label">Resolved / Returned</div>
                </div>
              </div>
            </div>

            {/* User Item Filter Tabs */}
            <div className="dashboard-tabs-bar">
              <button
                type="button"
                className={`dashboard-tab-btn${dashboardTab === 'all' ? ' active' : ''}`}
                onClick={() => setDashboardTab('all')}
              >
                All Reports ({myItems.length})
              </button>
              <button
                type="button"
                className={`dashboard-tab-btn${dashboardTab === 'active' ? ' active' : ''}`}
                onClick={() => setDashboardTab('active')}
              >
                Active ({myItems.filter((i) => i.status === 'active').length})
              </button>
              <button
                type="button"
                className={`dashboard-tab-btn${dashboardTab === 'matched' ? ' active' : ''}`}
                onClick={() => setDashboardTab('matched')}
              >
                Matched ({matchedCount})
              </button>
              <button
                type="button"
                className={`dashboard-tab-btn${dashboardTab === 'resolved' ? ' active' : ''}`}
                onClick={() => setDashboardTab('resolved')}
              >
                Resolved ({myItems.filter((i) => i.status === 'resolved').length})
              </button>
            </div>

            <ItemGrid items={filteredMyItems} loading={myItemsLoading} onOpen={openItem} />
          </div>
        </section>
      )}

      {/* ====================================================================
          ROUTE: #login / #signup
          ==================================================================== */}
      {(route === '#login' || route === '#signup') && !user && (
        <AuthPanel mode={route === '#signup' ? 'signup' : 'login'} onSubmit={submitAuth} />
      )}

      {/* Site Footer */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-brand">
            <Icon name="search-location" style={{ color: '#fb7185' }} /> Lost<span>&amp;Found</span>
          </div>
          <p className="footer-sub">A community network dedicated to reconnecting lost items with their rightful owners safely and quickly.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
            <a href="#admin" style={{ color: '#fb7185', textDecoration: 'none', fontSize: '0.86rem', fontWeight: 700 }}>
              <Icon name="shield-halved" /> Administrator Access
            </a>
          </div>
          <p className="footer-copy">&copy; {new Date().getFullYear()} Lost &amp; Found System. Built for fast, trusted community recovery.</p>
        </div>
      </footer>

      {/* Item Detail Modal */}
      <ItemModal
        item={modalItem}
        loading={modalLoading}
        error={modalError}
        onClose={closeModal}
        canResolve={Boolean(user?.id && modalItem?.user?._id && String(modalItem.user._id) === String(user.id))}
        resolving={resolvingItemId === modalItem?._id}
        onResolve={resolveItem}
        notify={notify}
      />
    </>
  );
}

function AuthPanel({ mode, onSubmit }) {
  const signup = mode === 'signup';
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="section auth-modern">
      <div className="container">
        <div className="auth-container-modern glass-card">
          <div className="auth-header">
            <div className="auth-icon">
              <Icon name={signup ? 'user-plus' : 'shield-halved'} />
            </div>
            <h2>{signup ? 'Create an Account' : 'Welcome Back'}</h2>
            <p>{signup ? 'Join our community to report and track items.' : 'Sign in to access your reports and match alerts.'}</p>
          </div>

          <div className="auth-segmented-switch">
            <a href="#login" className={`auth-switch-btn${!signup ? ' active' : ''}`}>
              Sign In
            </a>
            <a href="#signup" className={`auth-switch-btn${signup ? ' active' : ''}`}>
              Register
            </a>
          </div>

          <form className="form-modern" style={{ padding: 0 }} onSubmit={(event) => onSubmit(event, signup ? 'signup' : 'login')}>
            {signup && (
              <div className="form-group-modern">
                <label className="form-label">
                  <span className="form-label-left"><Icon name="user" /> Full Name *</span>
                </label>
                <input className="modern-input" name="name" required placeholder="e.g. Alex Johnson" />
              </div>
            )}

            <div className="form-group-modern">
              <label className="form-label">
                <span className="form-label-left"><Icon name="envelope" /> Email Address *</span>
              </label>
              <input className="modern-input" name="email" type="email" required placeholder="name@example.com" />
            </div>

            {signup && (
              <div className="form-group-modern">
                <label className="form-label">
                  <span className="form-label-left"><Icon name="phone" /> Phone Number *</span>
                </label>
                <input className="modern-input" name="phone" type="tel" required placeholder="+1 (555) 000-0000" />
              </div>
            )}

            <div className="form-group-modern">
              <label className="form-label">
                <span className="form-label-left"><Icon name="lock" /> Password *</span>
              </label>
              <div className="password-input-wrap">
                <input
                  className="modern-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={signup ? 6 : undefined}
                  placeholder={signup ? 'Create a secure password (min 6 chars)' : 'Enter your password'}
                />
                <button
                  type="button"
                  className="toggle-pwd-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eye-slash' : 'eye'} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn-gradient-large btn-block" style={{ marginTop: '0.75rem' }}>
              <Icon name={signup ? 'rocket' : 'arrow-right-to-bracket'} /> {signup ? 'Create Free Account' : 'Sign In to Dashboard'}
            </button>
          </form>

          <p className="auth-switch-modern">
            {signup ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <a href={signup ? '#login' : '#signup'} className="gradient-link">
              {signup ? 'Log in here' : 'Sign up now'}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

function AdminLoginGateway({ onSession, notify }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function fillDefaultAdmin() {
    setEmail('admin@lostandfound.com');
    setPassword('Admin@1234');
    notify('Default admin credentials filled!', 'info');
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data.user?.role !== 'admin') {
        throw new Error('Access denied: Account does not have administrator privileges.');
      }
      onSession(data);
      notify(`Welcome to Admin Portal, ${data.user.name}!`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <div className="admin-login-badge">
          <Icon name="shield-halved" />
        </div>
        <h2>Administrator Portal</h2>
        <p>Sign in with your administrative credentials to manage listings, users, and platform settings.</p>

        <div className="admin-hint-box">
          <div>
            <strong>Default Admin:</strong>
            <div>admin@lostandfound.com</div>
          </div>
          <button type="button" className="quick-fill-btn" onClick={fillDefaultAdmin}>
            Quick Fill
          </button>
        </div>

        <form onSubmit={handleAdminLogin} style={{ textAlign: 'left' }}>
          <div className="form-group-modern">
            <label className="form-label">
              <span className="form-label-left"><Icon name="envelope" /> Admin Email</span>
            </label>
            <input
              type="email"
              className="modern-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@lostandfound.com"
            />
          </div>

          <div className="form-group-modern">
            <label className="form-label">
              <span className="form-label-left"><Icon name="lock" /> Password</span>
            </label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="modern-input"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
              />
              <button
                type="button"
                className="toggle-pwd-btn"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eye-slash' : 'eye'} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-gradient-large btn-block"
            disabled={loading}
            style={{ marginTop: '1.25rem' }}
          >
            <Icon name={loading ? 'spinner' : 'shield-check'} className={loading ? 'fa-spin' : ''} />
            {loading ? 'Authenticating...' : 'Sign In as Administrator'}
          </button>
        </form>

        <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
          <a href="/#home" className="view-all-link" style={{ color: 'var(--text-muted)' }}>
            <Icon name="arrow-left" /> Return to Public Site
          </a>
        </div>
      </div>
    </div>
  );
}

function AdminApp({ user, token, onSession, onLogout, notify }) {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState({ type: '', status: '', search: '' });
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Health check state
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Modal inspection inside Admin
  const [inspectItem, setInspectItem] = useState(null);

  useEffect(() => {
    import('../css/admin.css');
  }, []);

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

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
      notify(`System health status: ${data.database}`, data.status === 'ok' ? 'success' : 'error');
    } catch (err) {
      notify(`Health check failed: ${err.message}`, 'error');
    } finally {
      setHealthLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    if (tab === 'overview') {
      loadStats();
      loadUsers();
      loadItems();
    }
    if (tab === 'users') loadUsers();
    if (tab === 'items') loadItems();
    if (tab === 'health') checkHealth();
  }, [tab, reloadKey, loadStats, loadUsers, loadItems, checkHealth, user]);

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
    if (window.confirm(`Delete user "${userToDelete.name}" and all their reported items? This cannot be undone.`)) {
      adminAction(`/admin/users/${userToDelete._id}`, { method: 'DELETE' }, 'User deleted.');
    }
  }

  function deleteItem(item) {
    if (window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
      adminAction(`/admin/items/${item._id}`, { method: 'DELETE' }, 'Item deleted.');
    }
  }

  // Filtered users for User Management tab
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = !userSearch.trim() ||
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone?.includes(userSearch);
      const matchesStatus = !userStatusFilter ||
        (userStatusFilter === 'blocked' ? u.isBlocked : !u.isBlocked);
      return matchesSearch && matchesStatus;
    });
  }, [users, userSearch, userStatusFilter]);

  // If user is not authenticated as admin, show Admin Login Gateway
  if (!token || user?.role !== 'admin') {
    return <AdminLoginGateway onSession={onSession} notify={notify} />;
  }

  const titles = {
    overview: 'System Overview & Analytics',
    users: 'User Management',
    items: 'Item Listings Management',
    health: 'System Health & Engine'
  };

  return (
    <div className="admin-app">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <Icon name="shield-halved" />
          <span>Admin Portal</span>
        </div>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-link${tab === 'overview' ? ' active' : ''}`}
            onClick={() => { setTab('overview'); setSidebarOpen(false); }}
          >
            <Icon name="chart-pie" /> Dashboard
          </button>
          <button
            type="button"
            className={`sidebar-link${tab === 'users' ? ' active' : ''}`}
            onClick={() => { setTab('users'); setSidebarOpen(false); }}
          >
            <Icon name="users" /> Manage Users ({users.length})
          </button>
          <button
            type="button"
            className={`sidebar-link${tab === 'items' ? ' active' : ''}`}
            onClick={() => { setTab('items'); setSidebarOpen(false); }}
          >
            <Icon name="boxes-stacked" /> Manage Items ({items.length})
          </button>
          <button
            type="button"
            className={`sidebar-link${tab === 'health' ? ' active' : ''}`}
            onClick={() => { setTab('health'); setSidebarOpen(false); }}
          >
            <Icon name="heart-pulse" /> System &amp; Health
          </button>
          <a href="/#home" className="sidebar-link">
            <Icon name="arrow-left" /> Back to Public Site
          </a>
        </nav>
        <div className="sidebar-footer">
          <div className="admin-info">
            <Icon name="user-shield" /> {user?.name || 'Administrator'}
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <Icon name="arrow-right-from-bracket" /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="sidebar-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle sidebar menu">
              <Icon name="bars" />
            </button>
            <h1 className="topbar-title">{titles[tab]}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a href="/#browse" className="btn-glass-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}>
              <Icon name="external-link-alt" /> View Feed
            </a>
            <span className="badge-admin">
              <Icon name="shield-check" /> Verified Admin
            </span>
          </div>
        </header>

        {/* ==================== TAB: OVERVIEW ==================== */}
        {tab === 'overview' && (
          <section className="tab-content">
            <div className="stats-grid">
              {[
                ['users', 'Registered Users', 'users', '#6366f1'],
                ['items', 'Total Reports', 'boxes-stacked', '#e11d48'],
                ['lost', 'Lost Reports', 'magnifying-glass', '#f43f5e'],
                ['found', 'Found Reports', 'hand-holding-heart', '#10b981'],
                ['matched', 'Matched Cases', 'link', '#8b5cf6'],
                ['resolved', 'Resolved Cases', 'circle-check', '#f59e0b'],
                ['active', 'Active Cases', 'clock', '#06b6d4'],
                ['blocked', 'Blocked Users', 'ban', '#ef4444']
              ].map(([key, title, icon, accent]) => (
                <div className="stat-box" style={{ '--accent': accent }} key={key}>
                  <div className="stat-icon"><Icon name={icon} /></div>
                  <div className="stat-body">
                    <h2>
                      {stats?.[key === 'users' ? 'totalUsers' : key === 'items' ? 'totalItems' : key === 'lost' ? 'lostItems' : key === 'found' ? 'foundItems' : key === 'matched' ? 'matchedItems' : key === 'resolved' ? 'resolvedItems' : key === 'active' ? 'activeItems' : 'blockedUsers'] ?? '—'}
                    </h2>
                    <p>{title}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions Bar */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
              <button
                type="button"
                className="btn-glass-secondary"
                onClick={() => setTab('users')}
              >
                <Icon name="user-gear" /> Manage Users
              </button>
              <button
                type="button"
                className="btn-glass-secondary"
                onClick={() => {
                  setFilters({ type: 'lost', status: '', search: '' });
                  setTab('items');
                }}
              >
                <Icon name="magnifying-glass" /> View Lost Items
              </button>
              <button
                type="button"
                className="btn-glass-secondary"
                onClick={() => {
                  setFilters({ type: 'found', status: '', search: '' });
                  setTab('items');
                }}
              >
                <Icon name="hand-holding-heart" /> View Found Items
              </button>
              <button
                type="button"
                className="btn-glass-secondary"
                onClick={() => setTab('health')}
              >
                <Icon name="heart-pulse" /> Test Database Health
              </button>
            </div>

            {/* Overview Previews Grid */}
            <div className="overview-previews-grid">
              {/* Recent Reports Preview */}
              <div className="preview-panel">
                <div className="preview-header">
                  <h3><Icon name="clock-rotate-left" /> Recent Reported Listings</h3>
                  <button type="button" className="view-all-link" onClick={() => setTab('items')}>
                    View All ({items.length}) →
                  </button>
                </div>
                <div className="preview-list">
                  {items.slice(0, 5).map((item) => (
                    <div className="preview-item-row" key={item._id}>
                      <div className="preview-item-left">
                        {item.image ? (
                          <img src={`/uploads/${encodeURIComponent(item.image)}`} alt={item.title} className="preview-thumb" />
                        ) : (
                          <div className="preview-thumb-placeholder"><Icon name="box" /></div>
                        )}
                        <div>
                          <strong style={{ color: 'white', display: 'block', fontSize: '0.9rem' }}>{item.title}</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            {item.location} &bull; {formatDatePretty(item.date)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`badge badge-${item.type}`}>{item.type.toUpperCase()}</span>
                        <button
                          type="button"
                          className="btn-inspect"
                          onClick={() => setInspectItem(item)}
                          title="Inspect item"
                        >
                          <Icon name="eye" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '1rem' }}>No items reported yet.</p>}
                </div>
              </div>

              {/* Recent Users Preview */}
              <div className="preview-panel">
                <div className="preview-header">
                  <h3><Icon name="user-group" /> Recent Registered Users</h3>
                  <button type="button" className="view-all-link" onClick={() => setTab('users')}>
                    View All ({users.length}) →
                  </button>
                </div>
                <div className="preview-list">
                  {users.slice(0, 5).map((u) => (
                    <div className="preview-item-row" key={u._id}>
                      <div className="preview-item-left">
                        <div className="table-user-avatar">{u.name?.charAt(0) || 'U'}</div>
                        <div>
                          <strong style={{ color: 'white', display: 'block', fontSize: '0.9rem' }}>{u.name}</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{u.email}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge badge-active">{u.itemCount} items</span>
                        <span className={`badge ${u.isBlocked ? 'badge-blocked' : 'badge-active-user'}`}>
                          {u.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '1rem' }}>No registered users yet.</p>}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB: USERS ==================== */}
        {tab === 'users' && (
          <section className="tab-content">
            <div className="panel-header">
              <h2><Icon name="users" /> Manage Registered Users ({filteredUsers.length})</h2>
              <div className="panel-filters">
                <input
                  className="filter-input"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user name, email, phone..."
                  style={{ minWidth: '240px' }}
                />
                <select
                  className="filter-select"
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="blocked">Blocked Only</option>
                </select>
                <button className="btn-refresh" onClick={loadUsers}>
                  <Icon name="rotate" /> Refresh
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    {['#', 'User', 'Contact', 'Items', 'Status', 'Registered', 'Actions'].map((title) => (
                      <th key={title}>{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableMessage columns={7}>Loading users...</TableMessage>
                  ) : filteredUsers.length ? (
                    filteredUsers.map((entry, index) => (
                      <tr key={entry._id}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="table-user-cell">
                            <div className="table-user-avatar">{entry.name?.charAt(0) || 'U'}</div>
                            <div>
                              <strong>{entry.name}</strong>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{entry.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>{entry.phone || '—'}</td>
                        <td>
                          <span className="badge badge-active">{entry.itemCount} listings</span>
                        </td>
                        <td>
                          <span className={`badge ${entry.isBlocked ? 'badge-blocked' : 'badge-active-user'}`}>
                            {entry.isBlocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td>{formatDate(entry.createdAt)}</td>
                        <td>
                          <div className="action-btns">
                            <button
                              className="btn-block"
                              onClick={() => adminAction(`/admin/users/${entry._id}/block`, { method: 'PATCH' }, 'User status updated.')}
                            >
                              <Icon name={entry.isBlocked ? 'unlock' : 'ban'} /> {entry.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                            <button className="btn-del" onClick={() => deleteUser(entry)}>
                              <Icon name="trash" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <TableMessage columns={7}>No users match the search criteria.</TableMessage>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==================== TAB: ITEMS ==================== */}
        {tab === 'items' && (
          <section className="tab-content">
            <div className="panel-header">
              <h2><Icon name="boxes-stacked" /> Manage Item Listings ({items.length})</h2>
              <div className="panel-filters">
                <select
                  className="filter-select"
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                >
                  <option value="">All Types</option>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
                <select
                  className="filter-select"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="matched">Matched</option>
                  <option value="resolved">Resolved</option>
                </select>
                <input
                  className="filter-input"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search title or location..."
                  style={{ minWidth: '200px' }}
                />
                <button className="btn-refresh" onClick={loadItems}>
                  <Icon name="rotate" /> Refresh
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    {['#', 'Item', 'Type', 'Category', 'Location', 'Reporter', 'Status', 'Date', 'Actions'].map((title) => (
                      <th key={title}>{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableMessage columns={9}>Loading items...</TableMessage>
                  ) : items.length ? (
                    items.map((item, index) => {
                      const cat = CATEGORIES.find((c) => c.id === item.category);
                      return (
                        <tr key={item._id}>
                          <td>{index + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              {item.image ? (
                                <img src={`/uploads/${encodeURIComponent(item.image)}`} alt={item.title} className="preview-thumb" />
                              ) : (
                                <div className="preview-thumb-placeholder"><Icon name="box" /></div>
                              )}
                              <div>
                                <strong>{item.title}</strong>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.description}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-${item.type}`}>{item.type.toUpperCase()}</span>
                          </td>
                          <td>{cat?.emoji || '📦'} {cat?.label || item.category}</td>
                          <td>{item.location}</td>
                          <td>
                            {item.user ? (
                              <>
                                <strong>{item.user.name}</strong>
                                <br />
                                <small style={{ color: 'var(--text-dim)' }}>{item.user.email}</small>
                              </>
                            ) : (
                              'Deleted User'
                            )}
                          </td>
                          <td>
                            <select
                              className="status-select"
                              value={item.status}
                              onChange={(e) => adminAction(`/admin/items/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }, 'Status updated.')}
                            >
                              <option value="active">Active</option>
                              <option value="matched">Matched</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </td>
                          <td>{formatDate(item.date)}</td>
                          <td>
                            <div className="action-btns">
                              <button
                                className="btn-inspect"
                                onClick={() => setInspectItem(item)}
                                title="View item details"
                              >
                                <Icon name="eye" /> Inspect
                              </button>
                              <button className="btn-del" onClick={() => deleteItem(item)} title="Delete item">
                                <Icon name="trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <TableMessage columns={9}>No items match the current filters.</TableMessage>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==================== TAB: SYSTEM HEALTH ==================== */}
        {tab === 'health' && (
          <section className="tab-content">
            <div className="panel-header">
              <h2><Icon name="heart-pulse" /> System Status &amp; Database Engine</h2>
              <button className="btn-refresh" onClick={checkHealth} disabled={healthLoading}>
                <Icon name={healthLoading ? 'spinner' : 'rotate'} className={healthLoading ? 'fa-spin' : ''} /> Test Connectivity
              </button>
            </div>

            <div className="health-cards-grid">
              <div className="health-card">
                <h3><Icon name="database" /> Database Status</h3>
                <div style={{ margin: '1rem 0' }}>
                  <span className={`health-status-indicator ${healthData?.database === 'connected' ? 'status-ok' : 'status-err'}`}>
                    <Icon name={healthData?.database === 'connected' ? 'circle-check' : 'circle-xmark'} />
                    {healthData?.database?.toUpperCase() || 'CHECKING...'}
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  MongoDB URI status: {healthData?.mongo_uri_set ? '✅ Configured' : '❌ Not set in .env'}
                </p>
              </div>

              <div className="health-card">
                <h3><Icon name="server" /> Application Server</h3>
                <div style={{ margin: '1rem 0' }}>
                  <span className="health-status-indicator status-ok">
                    <Icon name="check-circle" /> ONLINE (Port 5000)
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Environment: <strong>{healthData?.environment || 'development'}</strong>
                </p>
              </div>

              <div className="health-card">
                <h3><Icon name="key" /> Security &amp; Tokens</h3>
                <div style={{ margin: '1rem 0' }}>
                  <span className="health-status-indicator status-ok">
                    <Icon name="shield-check" /> JWT ACTIVE
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  JWT Secret: {healthData?.jwt_secret_set ? '✅ Set securely' : '❌ Not configured'}
                </p>
              </div>
            </div>

            <div className="preview-panel" style={{ marginTop: '1.5rem' }}>
              <div className="preview-header">
                <h3><Icon name="user-shield" /> Administrator Credentials &amp; Provisioning</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1rem' }}>
                Default administrator credentials for this deployment:
              </p>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <p><strong>Email:</strong> admin@lostandfound.com</p>
                <p><strong>Password:</strong> Admin@1234</p>
                <p><strong>Role:</strong> admin</p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Inspect Item Modal */}
      {inspectItem && (
        <ItemModal
          item={inspectItem}
          loading={false}
          error=""
          onClose={() => setInspectItem(null)}
          canResolve={false}
          resolving={false}
          onResolve={() => {}}
          notify={notify}
        />
      )}
    </div>
  );
}

function TableMessage({ columns, children }) {
  return (
    <tr>
      <td className="loading-row" colSpan={columns}>
        {children}
      </td>
    </tr>
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(storedUser);
  const [notices, setNotices] = useState([]);
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#home');

  useEffect(() => {
    const handleHash = () => setCurrentHash(window.location.hash || '#home');
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const isAdminPage =
    window.location.pathname.replace(/\/+$/, '') === '/admin' ||
    currentHash === '#admin';

  const notify = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotices((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, 4500);
  }, []);

  const dismissNotice = useCallback((id) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
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
    if (isAdminPage) {
      window.location.hash = '#home';
      window.location.replace('/');
    } else {
      window.location.hash = '#home';
      notify('Logged out successfully. See you again!', 'success');
    }
  }

  return (
    <>
      <NoticeList notices={notices} onDismiss={dismissNotice} />
      {isAdminPage ? (
        <AdminApp user={user} token={token} onSession={saveSession} onLogout={logout} notify={notify} />
      ) : (
        <SiteApp user={user} token={token} onSession={saveSession} onLogout={logout} notify={notify} />
      )}
    </>
  );
}
