import React, { useState } from 'react';
import { Search, X, CheckCircle, CreditCard, Zap } from 'lucide-react';

export default function Marketplace({ listings, onInstallFree, onPurchaseClick }) {
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

  return (
    <section id="marketplace" className="section-container">
      <div className="section-header">
        <div className="header-tag">DISCOVER & DEPLOY</div>
        <h2 className="section-title">Verified Agent Tools & Services</h2>
        <p className="section-desc">Search listing metadata synced across local SQLite and the NANDA global index.</p>
      </div>

      <div className="marketplace-controls">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search by title, capability, or keyword (e.g. 'code review', 'security', 'python')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-tabs">
          {['all', 'static', 'live', 'free'].map(f => (
            <button 
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All Items' : f === 'static' ? 'Static Assets' : f === 'live' ? 'Live A2A Agents' : 'Free Only'}
            </button>
          ))}
        </div>
      </div>

      <div className="listings-grid">
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No marketplace listings match your filter.
          </div>
        ) : (
          filtered.map(item => {
            const isFree = item.price_cents === 0;
            const priceDisplay = isFree ? 'FREE' : `$${(item.price_cents / 100).toFixed(2)}`;
            const isLive = item.listing_type === 'live';

            let tagsArr = [];
            try {
              tagsArr = typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []);
            } catch { tagsArr = ['tool']; }

            return (
              <div key={item.id} className="listing-card">
                <div>
                  <div className="card-top">
                    <span className={`card-type-badge ${isLive ? 'live' : 'static'}`}>
                      {isLive ? 'Live A2A Agent' : 'Static Asset'}
                    </span>
                    <span className={`card-price ${isFree ? 'free' : ''}`}>{priceDisplay}</span>
                  </div>

                  <h3 className="card-title">{item.title}</h3>
                  <p className="card-desc">{item.description || 'No description provided.'}</p>

                  <div className="card-tags">
                    {tagsArr.map((t, idx) => (
                      <span key={idx} className="tag-pill">#{t}</span>
                    ))}
                  </div>
                </div>

                <div className="card-actions">
                  {isFree ? (
                    <button className="btn btn-secondary btn-block" onClick={() => onInstallFree(item.id)}>
                      <Zap size={16} /> Install Asset (Free)
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-block" onClick={() => onPurchaseClick(item.id, item.title, item.price_cents)}>
                      <CreditCard size={16} /> Buy via Prava ({priceDisplay})
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
