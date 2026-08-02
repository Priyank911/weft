import React, { useState } from 'react';
import '../marketplace.css';
import { Search, X, Copy, Check, Zap, CreditCard, Cpu, Download, ArrowUpRight, ShieldCheck, Terminal } from 'lucide-react';

export default function DedicatedMarketplace({ listings, onInstallFree, onPurchaseClick }) {
  const [selectedCategory, setSelectedCategory] = useState('All Primitives');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const categories = [
    'All Primitives',
    'Agent Skills',
    'MCP Tools',
    'MCP Resources',
    'MCP Prompts',
    'Vision & ML Assets'
  ];

  // Filtering logic
  let filtered = listings;

  if (selectedCategory !== 'All Primitives') {
    filtered = filtered.filter(item => item.category === selectedCategory);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(item =>
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.sample_description && item.sample_description.toLowerCase().includes(q))
    );
  }

  const handleCopySnippet = (slug) => {
    navigator.clipboard.writeText(`$ npx weft-mcp add ${slug}`);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="dedicated-marketplace-page">
      {/* Header Bar */}
      <div className="marketplace-header-bar">
        <div className="marketplace-eyebrow">
          <Terminal size={14} className="accent-text-brand" /> DECENTRALIZED PRIMITIVES MARKETPLACE
        </div>
        <h1 className="marketplace-main-title">Agentic Skills, Tools & MCP Resources</h1>
        <p className="marketplace-subtitle">
          Discover, audit, and deploy verified MCP tools, agentic playbooks, and live A2A microservices.
        </p>
      </div>

      {/* Controls: Search & Category Tabs */}
      <div className="marketplace-controls-container">
        <div className="marketplace-search-row">
          <div className="marketplace-search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="marketplace-search-field"
              placeholder="Search by title, author, keyword, or capability (e.g., 'security', 'k8s', 'sql')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 5 Category Tabs Bar */}
        <div className="category-tabs-scroll">
          {categories.map(cat => {
            const count = cat === 'All Primitives'
              ? listings.length
              : listings.filter(l => l.category === cat).length;

            return (
              <button
                key={cat}
                className={`category-tab-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                <span>{cat}</span>
                <span className="category-count-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Items Grid (Small Rectangle Curved Cards - mcpmarket style) */}
      <div className="marketplace-items-grid">
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
            No agentic primitives match your current search criteria.
          </div>
        ) : (
          filtered.map(item => {
            const isFree = item.price_cents === 0;
            const priceDisplay = isFree ? 'FREE' : `$${(item.price_cents / 100).toFixed(2)}`;
            const isLive = item.listing_type === 'live';

            // Extract uploader author & usage count from sample_description or fallback
            const authorInfo = item.sample_description || 'by Weft Verified Developer';

            return (
              <div 
                key={item.id} 
                className="mcp-item-card"
                onClick={() => setSelectedItem(item)}
              >
                <div>
                  <div className="card-top-bar">
                    <span className="card-category-tag">{item.category || 'MCP Tool'}</span>
                    <span className="card-price-badge">{priceDisplay}</span>
                  </div>

                  <h3 className="card-item-title">{item.title}</h3>
                  <div className="card-author-line">
                    <Cpu size={12} className="accent-text-brand" />
                    <span>{authorInfo}</span>
                  </div>

                  <p className="card-item-desc">{item.description}</p>
                </div>

                <div className="card-bottom-bar">
                  <span className="card-uses-count">
                    <Zap size={13} className="accent-text-brand" />
                    {isLive ? 'Live A2A Endpoint' : 'MCP Stdio Package'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-brand)', fontWeight: 600 }}>
                    Details <ArrowUpRight size={13} />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal / Drawer View (skills.sh style) */}
      {selectedItem && (
        <div className="item-detail-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="item-detail-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="detail-modal-close-btn" onClick={() => setSelectedItem(null)}>
              <X size={18} />
            </button>

            <div className="detail-modal-header">
              <span className="detail-category-badge">{selectedItem.category || 'Agentic Primitive'}</span>
              <h2 className="detail-modal-title">{selectedItem.title}</h2>
              <div className="detail-author-row">
                <span>{selectedItem.sample_description || 'by Weft Verified Seller'}</span>
                <span>·</span>
                <span className="accent-text-brand">{selectedItem.price_cents === 0 ? 'FREE' : `$${(selectedItem.price_cents / 100).toFixed(2)}`}</span>
              </div>
            </div>

            {/* Install Snippet Box (skills.sh style) */}
            <div className="detail-install-snippet-box">
              <code className="snippet-code-text">
                $ <span>npx weft-mcp add</span> {selectedItem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
              </code>
              <button className="btn btn-secondary btn-sm" onClick={() => handleCopySnippet(selectedItem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}>
                {copiedSnippet ? <Check size={12} className="accent-text-brand" /> : <Copy size={12} />}
                {copiedSnippet ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Brief Summary Section (Does not directly reveal secret credentials/code) */}
            <div className="detail-section-block">
              <div className="detail-section-title">BRIEF SUMMARY & FUNCTIONALITY</div>
              <p className="detail-summary-text">
                {selectedItem.long_description || selectedItem.description}
              </p>
            </div>

            {/* Connection Process For Agent Section */}
            <div className="detail-connection-process-box">
              <h4 className="connection-process-title">
                <ShieldCheck size={16} className="accent-text-brand" /> Agent Connection Process (MCP Stdio & Prava)
              </h4>
              <div className="connection-steps-list">
                <div className="connection-step-item">
                  <span className="step-num">1.</span>
                  <span>Agent registers tracking <code>agent_id</code> via Stdio <code>register_agent</code>.</span>
                </div>
                <div className="connection-step-item">
                  <span className="step-num">2.</span>
                  <span>Agent executes NANDA search query to fetch metadata & tool schema.</span>
                </div>
                <div className="connection-step-item">
                  <span className="step-num">3.</span>
                  <span>For paid microservices, Weft creates Prava payment session & dispatches Linq receipt upon approval.</span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="detail-modal-footer">
              <span className="detail-price-text">
                {selectedItem.price_cents === 0 ? 'FREE DOWNLOAD' : `$${(selectedItem.price_cents / 100).toFixed(2)} USD`}
              </span>

              {selectedItem.price_cents === 0 ? (
                <button
                  className="btn btn-secondary btn-lg"
                  onClick={() => {
                    onInstallFree(selectedItem.id);
                    setSelectedItem(null);
                  }}
                >
                  <Zap size={16} /> Install Asset (Free)
                </button>
              ) : (
                <button
                  className="btn btn-brand btn-lg"
                  onClick={() => {
                    onPurchaseClick(selectedItem.id, selectedItem.title, selectedItem.price_cents);
                    setSelectedItem(null);
                  }}
                >
                  <CreditCard size={16} /> Buy via Prava Sandbox
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
