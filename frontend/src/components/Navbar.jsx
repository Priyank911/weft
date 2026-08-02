import React from 'react';
import { User, Bot, Store, Sparkles, Grid, BookOpen } from 'lucide-react';

export default function Navbar({ mode, setMode, view, setView }) {
  return (
    <header className="site-header">
      <div className="header-container">
        <a
          onClick={() => setView('landing')}
          className="site-brand"
        >
          <img src="/logo.png" alt="Weft Logo" className="brand-logo-img" />
          <span className="brand-title">
            WEFT<span className="brand-dot">.</span>
          </span>
          <span className="brand-tag">AGENTIC MARKETPLACE</span>
        </a>

        <nav className="desktop-nav">
          <button
            className={`nav-link ${view === 'landing' ? 'active' : ''}`}
            onClick={() => setView('landing')}
          >
            <Sparkles size={15} /> Home
          </button>
          <button
            className={`nav-link ${view === 'marketplace' ? 'active' : ''}`}
            onClick={() => setView('marketplace')}
          >
            <Grid size={15} /> Marketplace
          </button>
          <button
            className={`nav-link ${view === 'docs' ? 'active' : ''}`}
            onClick={() => setView('docs')}
          >
            <BookOpen size={15} /> Protocol Spec & Docs
          </button>
          <button
            className={`nav-link ${view === 'seller' ? 'active' : ''}`}
            onClick={() => setView('seller')}
          >
            <Store size={15} /> Seller Portal
          </button>
        </nav>

        <div className="header-actions">
          <div className="mode-toggle-pill">
            <button
              className={`mode-btn ${mode === 'human' ? 'active' : ''}`}
              onClick={() => setMode('human')}
              title="Switch to Human Portal"
            >
              <User size={14} /> I'm a Human
            </button>
            <button
              className={`mode-btn ${mode === 'agent' ? 'active' : ''}`}
              onClick={() => setMode('agent')}
              title="Switch to Agent MCP Terminal"
            >
              <Bot size={14} /> I'm an Agent
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
