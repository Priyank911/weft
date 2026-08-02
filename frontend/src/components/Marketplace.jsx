import React, { useState } from 'react';
import { Search, X, CreditCard, Zap, Cpu, Download, ArrowRight, Flame } from 'lucide-react';

export default function Marketplace({ listings, onInstallFree, onPurchaseClick, onGoToMarketplace }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  let filtered = listings;

  if (filter === 'static') {
    filtered = filtered.filter(l => l.listing_type === 'static');
  } else if (filter === 'live') {
    filtered = filtered.filter(l => l.listing_type === 'live');
  } else if (filter === 'free') {
    filtered = filtered.filter(l => l.price_cents === 0);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(l => 
      l.title.toLowerCase().includes(q) || 
      (l.description && l.description.toLowerCase().includes(q)) ||
      (l.category && l.category.toLowerCase().includes(q))
    );
  }

  // Sort DB items by live execution volume / download_count DESC for true DB leaderboard
  const sortedListings = [...filtered].sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
  const baseItems = sortedListings.slice(0, 8);
  // Duplicate list to achieve 100% seamless infinite marquee animation loop
  const marqueeItems = baseItems.length > 0 ? [...baseItems, ...baseItems] : [];

  return (
    <section id="marketplace" className="section-container" style={{ paddingBottom: '40px' }}>
      <div className="section-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <div className="header-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Flame size={13} className="accent-text-brand" /> LIVE DB TRENDING & LEADERBOARD
        </div>
        <h2 className="section-title">Most Requested Agentic Primitives</h2>
        <p className="section-desc">Top active tools and playbooks ranked by execution calls, NANDA index queries, and Prava settlement volume.</p>
      </div>

      <div className="marketplace-filters" style={{ marginBottom: '20px' }}>
        <div className="search-input-wrapper">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            className="search-input"
            placeholder="Search trending primitives (e.g. 'security', 'k8s', 'sql')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-pills">
          {['all', 'static', 'live', 'free'].map(f => (
            <button 
              key={f}
              className={`filter-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All Trending' : f === 'static' ? 'Static Assets' : f === 'live' ? 'Live A2A' : 'Free Only'}
            </button>
          ))}
        </div>
      </div>

      {/* Infinite Auto-Marquee Track (Scrollbar Hidden, Continuous Loop Left-to-Right) */}
      <div className="marquee-outer-container">
        {marqueeItems.length === 0 ? (
          <div style={{ width: '100%', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
            No marketplace listings match your current search criteria.
          </div>
        ) : (
          <div className="marquee-inner-track">
            {marqueeItems.map((item, index) => {
              const isFree = item.price_cents === 0;
              const priceDisplay = isFree ? 'FREE' : `$${(item.price_cents / 100).toFixed(2)}`;

              return (
                <div 
                  key={`${item.id}-${index}`} 
                  className="compact-trending-card"
                  onClick={onGoToMarketplace}
                  style={{
                    minWidth: '310px',
                    maxWidth: '330px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '18px',
                    flexShrink: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="card-category-tag">{item.category || 'MCP Tool'}</span>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{priceDisplay}</span>
                    </div>

                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </h4>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4, marginBottom: '14px' }}>
                      {item.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {(item.download_count || 0).toLocaleString()} executions
                    </span>
                    <span style={{ color: 'var(--accent-brand)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      Deploy <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {onGoToMarketplace && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onGoToMarketplace}>
            Browse All {listings.length} Agentic Primitives in Dedicated Marketplace <ArrowRight size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
