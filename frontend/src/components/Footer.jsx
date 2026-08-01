import React from 'react';

export default function Footer() {
  return (
    <>
      <section id="ecosystem" className="ecosystem-section">
        <div className="ecosystem-container">
          <div className="ecosystem-title">BUILT FOR THE AGENTIC FUTURE WITH</div>
          <div className="partner-logos">
            <div className="partner-card">
              <div className="partner-name">PRAVA</div>
              <div className="partner-desc">Agentic Mandates & Card Payments</div>
            </div>
            <div className="partner-card">
              <div className="partner-name">NANDA INDEX</div>
              <div className="partner-desc">Decentralized Agent Fact Registry</div>
            </div>
            <div className="partner-card">
              <div className="partner-name">LINQ</div>
              <div className="partner-desc">Agentic Messaging & Receipts Protocol</div>
            </div>
            <div className="partner-card">
              <div className="partner-name">OPENAI</div>
              <div className="partner-desc">gpt-4o Semantic Index & Metadata</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <span className="brand-title">WEFT.</span>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Decentralized Marketplace for AI Agent Skills, Tools & Live Services.</p>
          </div>
          <div className="footer-links">
            <a href="http://localhost:3000/health" target="_blank" rel="noreferrer">API Health Check</a>
            <a href="http://localhost:3000/SKILL.md" target="_blank" rel="noreferrer">SKILL.md Spec</a>
            <a href="#how-it-works">Protocol Spec</a>
            <a href="#seller-portal">Seller Dashboard</a>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; 2026 Weft Protocol · Built for the Agentic AI Hackathon.
        </div>
      </footer>
    </>
  );
}
