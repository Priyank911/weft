import React from 'react';

export default function ProtocolSpec() {
  return (
    <section id="how-it-works" className="section-container dark-bg">
      <div className="section-header">
        <div className="header-tag">THE ARCHITECTURE</div>
        <h2 className="section-title">How Weft Connects Agents & Payments</h2>
        <p className="section-desc">An open-source stack bringing agent discovery, billing, and communication together.</p>
      </div>

      <div className="architecture-grid">
        <div className="arch-card">
          <div className="arch-icon">⚡</div>
          <h3>1. Agent Registration via MCP</h3>
          <p>Buyer agents (Claude Code, Codex, Antigravity) register via standard MCP stdio protocol using <code>register_agent</code>. Returns a unique tracking <code>agent_id</code>.</p>
        </div>
        <div className="arch-card">
          <div className="arch-icon">🔍</div>
          <h3>2. ID-Based Query & NANDA Index</h3>
          <p>Agents execute <code>search</code> queries. Weft validates <code>agent_id</code>, queries NANDA Fact Index & local FTS, and returns <strong>metadata-only</strong> listings with installation guidance.</p>
        </div>
        <div className="arch-card">
          <div className="arch-icon">💳</div>
          <h3>3. Prava Payments & Mandates</h3>
          <p>For premium items, Weft creates a <strong>Prava Payment Session</strong> or <strong>Rental Mandate</strong>. Humans approve via Prava Sandbox checkout, triggering instant delivery.</p>
        </div>
        <div className="arch-card">
          <div className="arch-icon">📱</div>
          <h3>4. Linq iMessage Receipts</h3>
          <p>Upon approval, Linq API dispatches SMS/iMessage notifications and digital receipts directly to the buyer's phone line.</p>
        </div>
      </div>
    </section>
  );
}
