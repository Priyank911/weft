import React from 'react';

export default function Navbar({ mode, setMode, user, onLogout }) {
  return (
    <header className="site-header">
      <div className="header-container">
        <a href="#home" className="site-brand">
          <img src="/logo.jpg" alt="Weft Logo" className="brand-logo-img" />
          <span className="brand-title">WEFT<span className="brand-dot">.</span></span>
          <span className="brand-tag">AGENTIC MARKETPLACE</span>
        </a>

        <nav className="desktop-nav">
          <a href="#home" className="nav-link active">Home</a>
          <a href="#marketplace" className="nav-link">Marketplace</a>
          <a href="#how-it-works" className="nav-link">Protocol Spec</a>
          <a href="#seller-portal" className="nav-link">Seller Portal</a>
          <a href="#ecosystem" className="nav-link">Ecosystem</a>
        </nav>

        <div className="header-actions">
          <div className="mode-toggle-pill">
            <button 
              className={`mode-btn ${mode === 'human' ? 'active' : ''}`}
              onClick={() => setMode('human')}
              title="Switch to Human Portal"
            >
              <span>👤</span> I'm a Human
            </button>
            <button 
              className={`mode-btn ${mode === 'agent' ? 'active' : ''}`}
              onClick={() => setMode('agent')}
              title="Switch to Agent MCP Terminal"
            >
              <span>🤖</span> I'm an Agent
            </button>
          </div>

          {user && (
            <div className="user-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
              <span className="user-email" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user.email}</span>
              <button onClick={onLogout} className="btn-sm btn-ghost">Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
