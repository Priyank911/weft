import React, { useState } from 'react';
import '../docs.css';
import MermaidDiagram from './MermaidDiagram';
import { 
  BookOpen, Search, Copy, Check, Terminal, Shield, Zap, Cpu, Code, 
  ChevronRight, ExternalLink, Info, CheckCircle2, CreditCard, MessageSquare,
  Layers, ArrowRight, Server, Database, Lock, Smartphone
} from 'lucide-react';

export default function DocumentationView() {
  const [activeDoc, setActiveDoc] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const architectureMermaidChart = `
graph TD
    subgraph Buyer_Agents ["Buyer Agents"]
        Antigravity["Antigravity"]
        ClaudeCode["Claude Code"]
        Codex["Codex"]
    end

    subgraph Seller_Side ["Seller Side"]
        LiveAgent["Live Agent (A2A Server)"]
        SellerPortal["Seller Portal (Web Frontend)"]
    end

    subgraph Weft_Platform ["Weft Platform"]
        MCPServer["MCP Server (stdio transport)"]
        RESTAPI["REST API (Express.js)"]
        WeftAgent["Weft Agent (OpenAI SDK)"]
        SQLiteDB[("SQLite DB")]
        FileStorage["File Storage (local ./uploads)"]
    end

    subgraph External_Services ["External Services"]
        Prava["Prava Payments"]
        OpenAI["OpenAI API"]
        Linq["Linq Messaging"]
        NANDA["NANDA Index"]
    end

    Antigravity -->|MCP stdio| MCPServer
    ClaudeCode -->|MCP stdio| MCPServer
    Codex -->|MCP stdio| MCPServer

    SellerPortal -->|HTTP| RESTAPI
    LiveAgent -->|A2A Client| RESTAPI

    MCPServer --> RESTAPI
    RESTAPI --> WeftAgent
    RESTAPI --> SQLiteDB
    RESTAPI --> FileStorage

    RESTAPI -->|Payment Sessions| Prava
    WeftAgent --> OpenAI
    RESTAPI -->|iMessage Notifications| Linq
    RESTAPI -->|Publish/Search AgentFacts| NANDA
`;

  return (
    <div className="docs-page-container">
      {/* Main 3-Column Docs Layout */}
      <div className="docs-layout-wrapper">
        {/* Left Sidebar Nav */}
        <aside className="docs-sidebar-left">
          <div className="docs-sidebar-search">
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search docs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-shortcut">⌘K</span>
          </div>

          <div className="docs-nav-group">
            <div className="docs-nav-group-title">GETTING STARTED</div>
            <button 
              className={`docs-nav-item ${activeDoc === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveDoc('overview')}
            >
              <BookOpen size={15} className="docs-nav-icon" /> Overview & Architecture
            </button>
            <button 
              className={`docs-nav-item ${activeDoc === 'quickstart' ? 'active' : ''}`}
              onClick={() => setActiveDoc('quickstart')}
            >
              <Zap size={15} className="docs-nav-icon" /> Quickstart Guide
            </button>
          </div>

          <div className="docs-nav-group">
            <div className="docs-nav-group-title">PROTOCOL & MCP</div>
            <button 
              className={`docs-nav-item ${activeDoc === 'mcp-tools' ? 'active' : ''}`}
              onClick={() => setActiveDoc('mcp-tools')}
            >
              <Terminal size={15} className="docs-nav-icon" /> Tools Reference
            </button>
            <button 
              className={`docs-nav-item ${activeDoc === 'skill-spec' ? 'active' : ''}`}
              onClick={() => setActiveDoc('skill-spec')}
            >
              <Code size={15} className="docs-nav-icon" /> SKILL.md Specification
            </button>
          </div>

          <div className="docs-nav-group">
            <div className="docs-nav-group-title">SETTLEMENT & MESSAGING</div>
            <button 
              className={`docs-nav-item ${activeDoc === 'prava-payments' ? 'active' : ''}`}
              onClick={() => setActiveDoc('prava-payments')}
            >
              <CreditCard size={15} className="docs-nav-icon" /> Prava Payment Sessions
            </button>
            <button 
              className={`docs-nav-item ${activeDoc === 'linq-receipts' ? 'active' : ''}`}
              onClick={() => setActiveDoc('linq-receipts')}
            >
              <MessageSquare size={15} className="docs-nav-icon" /> Linq SMS Receipts
            </button>
          </div>

          <div className="docs-nav-group">
            <div className="docs-nav-group-title">INTEGRATIONS</div>
            <button 
              className={`docs-nav-item ${activeDoc === 'claude' ? 'active' : ''}`}
              onClick={() => setActiveDoc('claude')}
            >
              <Cpu size={15} className="docs-nav-icon" /> Claude Code & Desktop
            </button>
            <button 
              className={`docs-nav-item ${activeDoc === 'cursor' ? 'active' : ''}`}
              onClick={() => setActiveDoc('cursor')}
            >
              <Shield size={15} className="docs-nav-icon" /> Cursor IDE & Antigravity
            </button>
          </div>
        </aside>

        {/* Center Main Documentation Content */}
        <main className="docs-main-content">
          {/* SECTION 1: OVERVIEW & ARCHITECTURE */}
          {activeDoc === 'overview' && (
            <article>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Getting Started</span> <ChevronRight size={12} /> <span>Overview</span>
              </div>
              <h1 className="docs-article-title">Weft Protocol Architecture</h1>
              <p className="docs-article-lead">
                Weft is an open protocol and marketplace enabling autonomous AI agents (Claude Code, Codex, Antigravity, Cursor) to discover, purchase, and execute verified skills, MCP tools, and live A2A microservices.
              </p>

              <div className="docs-callout-box">
                <Info size={20} className="docs-callout-icon" />
                <div className="docs-callout-content">
                  <strong>Machine-Native Commerce:</strong> Agents interact using JSON-RPC 2.0 over standard Stdio transport. Prava handles card payment sessions and mandates, while Linq API dispatches instant SMS receipts to humans.
                </div>
              </div>

              {/* System Architecture Diagram (Mermaid Render) */}
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '36px', marginBottom: '14px' }}>
                System Architecture Diagram
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '16px' }}>
                The diagram below demystifies the complete data flow connecting Buyer Agents, Weft Stdio Platform, Prava Settlement Gateway, Linq Messaging, and the global NANDA Index.
              </p>

              <MermaidDiagram chart={architectureMermaidChart} />

              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '36px', marginBottom: '14px' }}>Core Protocol Pillars</h2>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Pillar</th>
                      <th>Component</th>
                      <th>Functionality</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>MCP Stdio</code></td>
                      <td>MCP Server (`src/mcp/server.js`)</td>
                      <td>Stdio JSON-RPC 2.0 transport for IDE agents and terminal swarms.</td>
                    </tr>
                    <tr>
                      <td><code>Discovery</code></td>
                      <td>NANDA Fact Index & SQLite FTS5</td>
                      <td>Decentralized metadata search and instant skill discovery.</td>
                    </tr>
                    <tr>
                      <td><code>Settlement</code></td>
                      <td>Prava Payment Gateway API</td>
                      <td>Sub-300ms card sandbox checkout and automated rental mandates.</td>
                    </tr>
                    <tr>
                      <td><code>Receipts</code></td>
                      <td>Linq Messaging Webhook API</td>
                      <td>Instant SMS and iMessage receipt dispatch directly to buyer phone numbers.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {/* SECTION 2: QUICKSTART GUIDE */}
          {activeDoc === 'quickstart' && (
            <article>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Getting Started</span> <ChevronRight size={12} /> <span>Quickstart</span>
              </div>
              <h1 className="docs-article-title">Developer Quickstart Guide</h1>
              <p className="docs-article-lead">
                Integrate Weft Marketplace into your AI agent or IDE environment in under 2 minutes.
              </p>

              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '28px', marginBottom: '12px' }}>1. Register Agent Session</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                Send a <code>register_agent</code> Stdio RPC request to acquire a unique tracking <code>agent_id</code>.
              </p>

              <div className="docs-code-card">
                <div className="docs-code-header">
                  <span>Stdio RPC Request (register_agent)</span>
                  <button className="btn-icon-copy" onClick={() => copyToClipboard('{\n  "jsonrpc": "2.0",\n  "method": "register_agent",\n  "params": {\n    "agent_name": "My Coding Agent",\n    "capabilities": ["search", "install"]\n  },\n  "id": 1\n}', 'qs1')}>
                    {copiedCode === 'qs1' ? <Check size={12} className="accent-text-brand" /> : <Copy size={12} />}
                  </button>
                </div>
                <pre className="docs-code-body"><code>{`{
  "jsonrpc": "2.0",
  "method": "register_agent",
  "params": {
    "agent_name": "My Coding Agent",
    "capabilities": ["search", "install"]
  },
  "id": 1
}`}</code></pre>
              </div>

              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '28px', marginBottom: '12px' }}>2. Query Available Skills</h2>
              <div className="docs-code-card">
                <div className="docs-code-header">
                  <span>Stdio RPC Request (search)</span>
                  <button className="btn-icon-copy" onClick={() => copyToClipboard('{\n  "jsonrpc": "2.0",\n  "method": "search",\n  "params": {\n    "query": "security audit",\n    "agent_id": "ag_991823"\n  },\n  "id": 2\n}', 'qs2')}>
                    {copiedCode === 'qs2' ? <Check size={12} className="accent-text-brand" /> : <Copy size={12} />}
                  </button>
                </div>
                <pre className="docs-code-body"><code>{`{
  "jsonrpc": "2.0",
  "method": "search",
  "params": {
    "query": "security audit",
    "agent_id": "ag_991823"
  },
  "id": 2
}`}</code></pre>
              </div>
            </article>
          )}

          {/* SECTION 3: MCP TOOLS REFERENCE */}
          {activeDoc === 'mcp-tools' && (
            <article>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Protocol & MCP</span> <ChevronRight size={12} /> <span>Tools Reference</span>
              </div>
              <h1 className="docs-article-title">MCP Stdio Tools Reference</h1>
              <p className="docs-article-lead">
                Exhaustive schema reference for all 5 Stdio RPC methods exposed by Weft MCP Server.
              </p>

              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>RPC Method</th>
                      <th>Inputs</th>
                      <th>Returns</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>search</code></td>
                      <td><code>query: string</code>, <code>agent_id</code></td>
                      <td><code>Array&lt;Listing&gt;</code></td>
                      <td>Searches SQLite FTS5 index and NANDA Fact Index.</td>
                    </tr>
                    <tr>
                      <td><code>register_agent</code></td>
                      <td><code>agent_name</code>, <code>capabilities</code></td>
                      <td><code>{`agent_id: string`}</code></td>
                      <td>Registers an agent session and issues tracking UUID.</td>
                    </tr>
                    <tr>
                      <td><code>install</code></td>
                      <td><code>listing_id</code>, <code>agent_id</code></td>
                      <td><code>SKILL.md + Manifest</code></td>
                      <td>Installs a free primitive and delivers instructions.</td>
                    </tr>
                    <tr>
                      <td><code>purchase</code></td>
                      <td><code>listing_id</code>, <code>agent_id</code></td>
                      <td><code>payment_url + txId</code></td>
                      <td>Creates Prava payment session and triggers Linq SMS.</td>
                    </tr>
                    <tr>
                      <td><code>get_nanda_index</code></td>
                      <td><code>none</code></td>
                      <td><code>FactIndexJSON</code></td>
                      <td>Fetches global NANDA fact index synchronization status.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {/* SECTION 4: SKILL.MD SPEC */}
          {activeDoc === 'skill-spec' && (
            <article>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Protocol & MCP</span> <ChevronRight size={12} /> <span>SKILL.md Spec</span>
              </div>
              <h1 className="docs-article-title">SKILL.md Specification</h1>
              <p className="docs-article-lead">
                Format specifications for packaging specialized domain knowledge and instructions for LLM agents.
              </p>

              <div className="docs-code-card">
                <div className="docs-code-header">
                  <span>SKILL.md Format Template</span>
                  <button className="btn-icon-copy" onClick={() => copyToClipboard('---\nname: k8s-incident-diagnostics\ndescription: Pinpoints k8s crash loops\nauthor: mattpocock/skills\nversion: 1.0.0\n---\n\n# Diagnostic Steps\n1. Run kubectl get pods -n production\n2. Inspect previous crash logs via kubectl logs --previous', 'sk1')}>
                    {copiedCode === 'sk1' ? <Check size={12} className="accent-text-brand" /> : <Copy size={12} />}
                  </button>
                </div>
                <pre className="docs-code-body"><code>{`---
name: k8s-incident-diagnostics
description: Pinpoints k8s crash loops and OOM kills
author: mattpocock/skills
version: 1.0.0
---

# Diagnostic Workflow
1. Run \`kubectl get pods -n production\` to locate crashlooping pods.
2. Retrieve last termination state via \`kubectl get pod <pod_name> -o jsonpath='{.status.containerStatuses[0].lastState}'\`.
3. Check ingress controller metrics for 502 Bad Gateway origin surges.`}</code></pre>
              </div>
            </article>
          )}

          {/* SECTION 5: PRAVA PAYMENTS */}
          {activeDoc === 'prava-payments' && (
            <article>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Settlement</span> <ChevronRight size={12} /> <span>Prava Payments</span>
              </div>
              <h1 className="docs-article-title">Prava Payment Sessions & Mandates</h1>
              <p className="docs-article-lead">
                Prava Payments powers agentic card checkouts, rental mandates, and sub-300ms transaction settlements.
              </p>

              <div className="docs-callout-box">
                <Shield size={20} className="docs-callout-icon" />
                <div className="docs-callout-content">
                  <strong>Sandbox Integration:</strong> Weft automatically creates Prava payment sessions (`/api/payments/session`) when an agent initiates a `purchase` RPC request.
                </div>
              </div>

              <div className="docs-code-card">
                <div className="docs-code-header">
                  <span>POST /api/payments/session Response</span>
                  <button className="btn-icon-copy" onClick={() => copyToClipboard('{\n  "status": "success",\n  "transaction_id": "tx_881923",\n  "payment_url": "https://sandbox.prava.pay/tx_881923",\n  "amount_cents": 1499,\n  "currency": "USD"\n}', 'pr1')}>
                    {copiedCode === 'pr1' ? <Check size={12} className="accent-text-brand" /> : <Copy size={12} />}
                  </button>
                </div>
                <pre className="docs-code-body"><code>{`{
  "status": "success",
  "transaction_id": "tx_881923",
  "payment_url": "https://sandbox.prava.pay/tx_881923",
  "amount_cents": 1499,
  "currency": "USD"
}`}</code></pre>
              </div>
            </article>
          )}

          {/* SECTION 6: LINQ MESSAGING */}
          {activeDoc === 'linq-receipts' && (
            <article>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Messaging</span> <ChevronRight size={12} /> <span>Linq Receipts</span>
              </div>
              <h1 className="docs-article-title">Linq SMS & iMessage Receipts</h1>
              <p className="docs-article-lead">
                Linq Messaging dispatches instant SMS and iMessage receipt notifications directly to human phone lines whenever an agent completes a transaction.
              </p>

              <div className="docs-code-card">
                <div className="docs-code-header">
                  <span>Linq SMS Dispatch Webhook Payload</span>
                  <button className="btn-icon-copy" onClick={() => copyToClipboard('{\n  "recipient_phone": "+15550192831",\n  "message": "WEFT RECEIPT: Your agent Antigravity purchased Next.js Security Audit ($14.99) via Prava.",\n  "dispatch_timestamp": "2026-08-02T14:00:00Z"\n}', 'lq1')}>
                    {copiedCode === 'lq1' ? <Check size={12} className="accent-text-brand" /> : <Copy size={12} />}
                  </button>
                </div>
                <pre className="docs-code-body"><code>{`{
  "recipient_phone": "+15550192831",
  "message": "WEFT RECEIPT: Your agent Antigravity purchased Next.js Security Audit ($14.99) via Prava.",
  "dispatch_timestamp": "2026-08-02T14:00:00Z"
}`}</code></pre>
              </div>
            </article>
          )}

          {/* SECTION 7: CLAUDE INTEGRATION */}
          {activeDoc === 'claude' && (
            <article>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Integrations</span> <ChevronRight size={12} /> <span>Claude</span>
              </div>
              <h1 className="docs-article-title">Claude Code & Claude Desktop Setup</h1>
              <p className="docs-article-lead">
                Configure Claude to use Weft MCP Stdio transport for automated skill discovery and tool execution.
              </p>

              <div className="docs-code-card">
                <div className="docs-code-header">
                  <span>claude_desktop_config.json</span>
                  <button className="btn-icon-copy" onClick={() => copyToClipboard('{\n  "mcpServers": {\n    "weft-marketplace": {\n      "command": "node",\n      "args": ["d:/On-Hackathon/Prava Agentic/src/mcp/server.js"],\n      "env": {\n        "PORT": "3000"\n      }\n    }\n  }\n}', 'cl1')}>
                    {copiedCode === 'cl1' ? <Check size={12} className="accent-text-brand" /> : <Copy size={12} />}
                  </button>
                </div>
                <pre className="docs-code-body"><code>{`{
  "mcpServers": {
    "weft-marketplace": {
      "command": "node",
      "args": ["d:/On-Hackathon/Prava Agentic/src/mcp/server.js"],
      "env": {
        "PORT": "3000"
      }
    }
  }
}`}</code></pre>
              </div>
            </article>
          )}

          {/* SECTION 8: CURSOR & ANTIGRAVITY */}
          {activeDoc === 'cursor' && (
            <article>
              <div className="docs-breadcrumb">
                <span>Docs</span> <ChevronRight size={12} /> <span>Integrations</span> <ChevronRight size={12} /> <span>Cursor IDE</span>
              </div>
              <h1 className="docs-article-title">Cursor IDE & Antigravity Agent Setup</h1>
              <p className="docs-article-lead">
                Connect Cursor IDE and Antigravity Web Agent to Weft Stdio server for instant code review and tool installation.
              </p>

              <div className="docs-code-card">
                <div className="docs-code-header">
                  <span>Cursor MCP Stdio Settings (.cursor/mcp.json)</span>
                  <button className="btn-icon-copy" onClick={() => copyToClipboard('{\n  "mcpServers": {\n    "weft": {\n      "command": "node",\n      "args": ["${window.location.origin.replace("5173", "3000")}/src/mcp/server.js"]\n    }\n  }\n}', 'cs1')}>
                    {copiedCode === 'cs1' ? <Check size={12} className="accent-text-brand" /> : <Copy size={12} />}
                  </button>
                </div>
                <pre className="docs-code-body"><code>{`{
  "mcpServers": {
    "weft": {
      "command": "node",
      "args": ["d:/On-Hackathon/Prava Agentic/src/mcp/server.js"]
    }
  }
}`}</code></pre>
              </div>
            </article>
          )}
        </main>

        {/* Right Sidebar ("On this page") */}
        <aside className="docs-sidebar-right">
          <div className="docs-toc-title">ON THIS PAGE</div>
          <div className="docs-toc-list">
            <span className="docs-toc-item" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Overview & Architecture
            </span>
            <span className="docs-toc-item">System Architecture Diagram</span>
            <span className="docs-toc-item">Core Protocol Pillars</span>
            <span className="docs-toc-item">Stdio Specification</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
