import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowUpRight, ShieldCheck, ExternalLink, Activity, Zap, CreditCard, MessageSquare } from 'lucide-react';

export default function Footer({ onGoToSeller, hideBanner }) {
  const [executionCount, setExecutionCount] = useState(1505649971);

  // Live counter animation ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setExecutionCount(prev => prev + Math.floor(Math.random() * 5) + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {!hideBanner && (
        <>
          {/* Creative Technical Line Break Divider Above Pre-Footer */}
          <div className="creative-divider">
            <div className="divider-line"></div>
            <div className="divider-badge">
              <span className="badge-pulse-wrapper">
                <span className="badge-pulse-ring"></span>
                <span className="badge-pulse-dot"></span>
              </span>
              <span className="divider-badge-text">WEFT DECENTRALIZED PROTOCOL ECOSYSTEM</span>
            </div>
            <div className="divider-line"></div>
          </div>

          {/* Compact & Detail-Rich Pre-Footer Section */}
          <section className="prefooter-section">
            <div className="prefooter-container">
              <h2 className="prefooter-title">
                Your <span className="title-agent-badge">Agent</span> needs its <span className="accent-text-brand">Weft.</span>
              </h2>

              <div className="prefooter-grid">
                {/* Left Detailed Compact Counter Card */}
                <div className="counter-card-banner">
                  <div className="counter-card-header-row">
                    <span className="counter-banner-label">TOTAL EXECUTIONS SERVED</span>
                    <span className="counter-live-tag">
                      <Activity size={12} className="accent-text-brand" /> LIVE NETWORK
                    </span>
                  </div>

                  <div className="counter-banner-val">{executionCount.toLocaleString()}</div>

                  {/* Detailed Telemetry Telemetry Breakdown Pills */}
                  <div className="counter-breakdown-row">
                    <div className="telemetry-pill">
                      <Zap size={13} className="pill-icon accent-text-brand" />
                      <span className="pill-val">4,892</span>
                      <span className="pill-lbl">MCP Sessions</span>
                    </div>

                    <div className="telemetry-pill">
                      <CreditCard size={13} className="pill-icon accent-text-brand" />
                      <span className="pill-val">$1.4M</span>
                      <span className="pill-lbl">Prava Settled</span>
                    </div>

                    <div className="telemetry-pill">
                      <MessageSquare size={13} className="pill-icon accent-text-brand" />
                      <span className="pill-val">100%</span>
                      <span className="pill-lbl">Linq Receipts</span>
                    </div>
                  </div>
                </div>

                {/* Right Compact Action Stack */}
                <div className="prefooter-action-stack">
                  <a href="#marketplace" className="btn btn-brand btn-lg btn-block prefooter-cta-btn">
                    Start Building <ArrowRight size={16} />
                  </a>

                  <div className="prefooter-stats-card">
                    <div className="stats-card-top">
                      <ShieldCheck size={18} className="accent-text-brand" />
                      <ArrowUpRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="prefooter-stats-val">100% Native</div>
                    <div className="prefooter-stats-lbl">MCP 1.0 Standard · &lt;300ms Latency</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Compact Theme-Based Footer */}
      <footer className="site-footer">
        <div className="footer-container">
          {/* Brand Intro Column with Logo Before Headline */}
          <div className="footer-brand-col">
            <div className="footer-brand-header">
              <img src="/logo.png" alt="Weft Logo" className="footer-brand-logo" />
              <span className="brand-title">WEFT<span className="brand-dot">.</span></span>
            </div>
            <p className="footer-brand-subtext">
              The open decentralized marketplace and protocol where AI agents and humans trade skills, tools, and live capabilities.
            </p>
          </div>

          {/* Nav Columns (Project Specific Only) */}
          <div className="footer-col">
            <h5>MARKETPLACE</h5>
            <a href="#marketplace">Discover Agent Tools</a>
            <a href="#marketplace">Live A2A Services</a>
            <a href="#marketplace">Free Code Packages</a>
          </div>

          <div className="footer-col">
            <h5>PROTOCOL</h5>
            <a href="#how-it-works">MCP 1.0 Architecture</a>
            <a href="http://localhost:3000/SKILL.md" target="_blank" rel="noreferrer">
              SKILL.md Spec <ExternalLink size={11} style={{ display: 'inline', marginLeft: '3px' }} />
            </a>
            <a href="http://localhost:3000/health" target="_blank" rel="noreferrer">
              API Health Endpoint <ExternalLink size={11} style={{ display: 'inline', marginLeft: '3px' }} />
            </a>
          </div>

          <div className="footer-col">
            <h5>INFRASTRUCTURE</h5>
            <a href="#how-it-works">Prava Payment Gateway</a>
            <a href="#how-it-works">NANDA Fact Index</a>
            <a href="#how-it-works">Linq iMessage Receipts</a>
          </div>

          <div className="footer-col">
            <h5>SELLERS</h5>
            <button onClick={onGoToSeller} className="footer-link-btn">Seller Login & Register</button>
            <button onClick={onGoToSeller} className="footer-link-btn">Seller Portal Dashboard</button>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="footer-bottom">
          <div>&copy; 2026 WEFT PROTOCOL INC. · ALL RIGHTS RESERVED</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a href="#how-it-works">MCP Standard</a>
            <a href="#how-it-works">Prava Mandates</a>
            <a href="#how-it-works">NANDA Index</a>
          </div>
        </div>

        {/* Upper Bottom Shifted GIF Motion Background */}
        <div className="footer-gif-tail-overlay">
          <img src="/hero.gif" alt="Footer Motion GIF" className="footer-gif-tail-img" />
        </div>
      </footer>
    </>
  );
}
