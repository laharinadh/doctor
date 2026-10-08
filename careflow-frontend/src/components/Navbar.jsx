import { useState } from 'react';

export default function Navbar({ activePage, onNavigate, onOpenDashboard, sessionUser }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'male-doctors', label: 'Male Doctors', icon: '👨‍⚕️', badge: 'Blue Page', colorClass: 'nav-male' },
    { id: 'female-doctors', label: 'Female Doctors', icon: '👩‍⚕️', badge: 'Pink Page', colorClass: 'nav-female' },
    { id: 'secondary-opinion', label: 'Secondary Opinion', icon: '📋', badge: 'Expert Desk', colorClass: 'nav-sec' },
  ];

  const handleNav = (pageId) => {
    onNavigate(pageId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="global-header-wrapper">
      {/* Top Banner with Icons & Quick Healthcare Highlights */}
      <div className="top-banner-strip">
        <div className="top-banner-container">
          <div className="top-banner-left">
            <span className="banner-pill live-pill">
              <span className="pulse-dot"></span> 24/7 Live Doctors Online
            </span>
            <span className="banner-item hide-mobile">
              <span className="b-icon">🛡️</span> NABH & ISO 27001 Certified Specialists
            </span>
            <span className="banner-item hide-mobile">
              <span className="b-icon">⚡</span> 15-Minute Avg Response Time
            </span>
          </div>

          <div className="top-banner-right">
            <a href="tel:18002273356" className="banner-link">
              <span className="b-icon">📞</span>
              <span className="bold-helpline">Helpline: 1800-CARE-FLOW</span>
            </a>
            <span className="divider-dot">|</span>
            <span className="banner-item hide-mobile">
              <span className="b-icon">🌐</span> Secondary Opinion Desk Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <nav className="main-navbar" aria-label="Main Navigation">
        <div className="navbar-container">
          {/* Logo & Brand */}
          <div className="brand-logo" onClick={() => handleNav('home')}>
            <div className="brand-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                <path d="M12 9v6" />
                <path d="M9 12h6" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-name">Careflow</span>
              <span className="brand-sub">CARE<em>+</em></span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="nav-links-desktop">
            {navItems.map(item => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  className={`nav-tab-btn ${item.colorClass} ${isActive ? 'active' : ''}`}
                  onClick={() => handleNav(item.id)}
                >
                  <span className="tab-icon">{item.icon}</span>
                  <span className="tab-label">{item.label}</span>
                  {item.badge && <span className={`tab-badge ${item.id}`}>{item.badge}</span>}
                </button>
              );
            })}
          </div>

          {/* Action Area: Portal & Emergency */}
          <div className="nav-actions-desktop">
            <button
              className="dashboard-portal-btn"
              onClick={onOpenDashboard}
              title="Open Admin, Doctor or Patient Dashboard"
            >
              <span className="dash-ic">📊</span>
              <span className="dash-text">{sessionUser ? `Portal (${sessionUser.role})` : 'Dashboard Portal'}</span>
            </button>

            <button
              className="quick-book-cta"
              onClick={() => handleNav('male-doctors')}
            >
              Book Specialist →
            </button>
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            className="mobile-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="mobile-nav-drawer">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`mobile-nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => handleNav(item.id)}
              >
                <span className="m-tab-ic">{item.icon}</span>
                <span className="m-tab-lbl">{item.label}</span>
                {item.badge && <span className={`m-badge ${item.id}`}>{item.badge}</span>}
              </button>
            ))}
            <div className="mobile-actions">
              <button className="mobile-dash-btn" onClick={() => { setMobileMenuOpen(false); onOpenDashboard(); }}>
                📊 Open Dashboard Portal
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
