import React, { useState } from 'react';
import { ArrowRight, Copy, Check } from 'lucide-react';

export default function Hero() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('npx weft-mcp setup');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="home" className="hero-section">
      {/* Ambient Full-Screen Background Agent GIF */}
      <div className="hero-gif-overlay">
        <img src="/hero.gif" alt="Agent AI Background Motion" className="hero-gif-img" />
      </div>

      <div className="hero-content">
        <div className="hero-badge-pill">
          <span className="live-dot"></span>
          <span>New · Agentic Marketplace Protocol</span>
          <ArrowRight size={12} style={{ marginLeft: '4px', opacity: 0.8 }} />
        </div>

        <h1 className="hero-headline">
          The open marketplace for <span className="accent-text-brand">AI agents.</span>
        </h1>

        <p className="hero-subtext">
          Weft gives your agents state-of-the-art skills, live A2A microservices, and instant Prava billing, all built in. Connected via MCP. Works with any model.
        </p>

        {/* Supermemory-Style Terminal Setup Bar */}
        <div className="hero-code-snippet">
          <span className="code-prefix">$</span>
          <code className="code-text">npx weft-mcp setup</code>
          <button className="code-copy-btn" onClick={handleCopy} title="Copy setup command">
            {copied ? <Check size={14} color="var(--accent-green)" /> : <Copy size={14} />}
          </button>
        </div>

        {/* Supermemory-Style Clean Inline Partners Bar */}
        <div className="hero-partners-bar">
          <div className="partners-label">POWERED BY THE BEST PROTOCOLS</div>
          <div className="partners-logos">
            <span className="partner-logo-item">PRAVA</span>
            <span className="partner-logo-item">NANDA INDEX</span>
            <span className="partner-logo-item">LINQ</span>
            <span className="partner-logo-item">OPENAI FTS</span>
          </div>
        </div>
      </div>
    </section>
  );
}
