import React from 'react';
import { Terminal, CreditCard, CheckCircle2, Shield } from 'lucide-react';

export default function ProtocolSpec() {
  return (
    <section id="how-it-works" className="protocol-spec-section">
      {/* Top Section Header Bar */}
      <div className="section-index-bar">
        <div className="index-left">
          <span className="index-arrow">›</span> HOW IT WORKS
        </div>
      </div>

      <div className="protocol-spec-container">
        <div className="protocol-grid">
          {/* Left Column: Headline & Overview */}
          <div className="protocol-intro-col">
            <div className="header-tag">THE ARCHITECTURE</div>
            <h2 className="protocol-main-title">
              We built an architecture that <span className="accent-text-brand">empowers agents.</span>
            </h2>
            <p className="protocol-desc">
              Weft integrates machine context, decentralized discovery, card payments, and SMS receipts into a seamless open protocol.
            </p>

            <div className="protocol-features-list">
              <div className="feature-row">
                <CheckCircle2 size={16} className="feature-icon" />
                <span>Standard MCP Stdio transport for all AI models</span>
              </div>
              <div className="feature-row">
                <CheckCircle2 size={16} className="feature-icon" />
                <span>NANDA Fact Index & SQLite FTS5 instant discovery</span>
              </div>
              <div className="feature-row">
                <CheckCircle2 size={16} className="feature-icon" />
                <span>Prava payment sessions & automated A2A mandates</span>
              </div>
              <div className="feature-row">
                <CheckCircle2 size={16} className="feature-icon" />
                <span>Linq SMS & iMessage receipts delivered to humans</span>
              </div>
            </div>
          </div>

          {/* Right Column: Precision Blueprint Cards with Corner Handles */}
          <div className="protocol-cards-col">
            {/* Card 1: Discovery & MCP */}
            <div className="blueprint-card">
              <span className="corner-handle top-left"></span>
              <span className="corner-handle top-right"></span>
              <span className="corner-handle bottom-left"></span>
              <span className="corner-handle bottom-right"></span>

              <div className="blueprint-header">
                <Terminal size={18} className="blueprint-icon" />
                <span className="blueprint-tag">01 / DISCOVERY & MCP</span>
              </div>

              <h3 className="blueprint-title">
                MCP REGISTRATION & NANDA FACT INDEX.
              </h3>

              <p className="blueprint-text">
                Buyer agents (Claude Code, Codex, Antigravity) register via standard MCP stdio transport using <code>register_agent</code>. Queries return metadata-only listings synced across local FTS5 and the global NANDA Fact Index.
              </p>
            </div>

            {/* Card 2: Payments & Settlement */}
            <div className="blueprint-card">
              <span className="corner-handle top-left"></span>
              <span className="corner-handle top-right"></span>
              <span className="corner-handle bottom-left"></span>
              <span className="corner-handle bottom-right"></span>

              <div className="blueprint-header">
                <CreditCard size={18} className="blueprint-icon" />
                <span className="blueprint-tag">02 / SETTLEMENT & RECEIPTS</span>
              </div>

              <h3 className="blueprint-title">
                PRAVA MANDATES & LINQ RECEIPT DISPATCH.
              </h3>

              <p className="blueprint-text">
                For premium items and live A2A microservices, Weft creates Prava payment sessions or automated rental mandates. Upon human approval, Linq API dispatches instant SMS/iMessage receipts directly to the buyer line.
              </p>

              <div className="blueprint-badge-inline">
                <Shield size={12} /> &lt;300ms Prava Settlement
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
