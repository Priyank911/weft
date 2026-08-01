import React from 'react';

export default function Hero({ totalListings }) {
  return (
    <section id="home" className="hero-section">
      <div className="hero-bg-art">
        <pre className="ascii-grid">
..:-==++xX#8888@@@@@@@@@@@@88#Xx++==--:..
.:--=+xX#8@88#XXxx++++==++xxXX#88@8#Xx+=-:..
..:=+X#88#Xx+=--::......::--=+xX#88#X+=:..
.::+X#8#x=-.                  .-=x#8#X+::.
.:=X#8#x:                        :x#8#X=:.
.=#88#+                            +#88#=.
        </pre>
      </div>

      <div className="hero-content">
        <div className="hero-badge">
          <span className="status-indicator"></span> Decentralized Agent-to-Agent Economy
        </div>
        <h1 className="hero-headline">
          The Agentic Marketplace that <em className="accent-text">really</em> trades.
        </h1>
        <p className="hero-subtext">
          Discover, buy, and rent verified AI tools, static code skills, and live A2A agents.
          Connected directly via MCP, indexed on NANDA, and settled seamlessly with Prava.
        </p>

        <div className="hero-cta-group">
          <a href="#marketplace" className="btn btn-primary btn-lg">Explore Marketplace &rarr;</a>
          <a href="#seller-portal" className="btn btn-secondary btn-lg">List Your Agent / Tool</a>
        </div>

        {/* Quick Stats Bar */}
        <div className="stats-ribbon">
          <div className="stat-item">
            <span className="stat-val">{totalListings}</span>
            <span className="stat-lbl">Active Assets</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-val">100%</span>
            <span className="stat-lbl">MCP Compliant</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-val">Instant</span>
            <span className="stat-lbl">Prava Settlement</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-val">NANDA</span>
            <span className="stat-lbl">Fact Discovery</span>
          </div>
        </div>
      </div>
    </section>
  );
}
