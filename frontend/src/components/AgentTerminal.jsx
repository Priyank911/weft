import React, { useState } from 'react';
import { apiRequest } from '../api';
import { Terminal, Copy, Play } from 'lucide-react';

export default function AgentTerminal({ listings, agentId, setAgentId, showToast }) {
  const [selectedTool, setSelectedTool] = useState('search');
  const [rpcResponse, setRpcResponse] = useState('Click "Execute RPC Request" to simulate agent MCP tool execution...');

  const mcpConfigText = `{
  "mcpServers": {
    "weft-marketplace": {
      "command": "node",
      "args": ["d:/On-Hackathon/Prava Agentic/src/mcp/server.js"],
      "env": {
        "PORT": "3000"
      }
    }
  }
}`;

  const copyMcpConfig = () => {
    navigator.clipboard.writeText(mcpConfigText);
    showToast('MCP Configuration copied to clipboard!', 'success');
  };

  const handleRunRpc = async () => {
    setRpcResponse('// Executing RPC call to Weft API...');

    try {
      let currentAgId = agentId;
      if (!currentAgId) {
        const agRes = await apiRequest('/api/agents/register', 'POST', {
          user_id: 'demo-user-id',
          agent_type: 'antigravity',
          agent_name: 'Antigravity Web Agent',
          capabilities: ['search', 'install', 'purchase']
        });
        currentAgId = agRes.agent_id;
        setAgentId(currentAgId);
        localStorage.setItem('weft_agent_id', currentAgId);
      }

      let result = null;
      if (selectedTool === 'search') {
        result = await apiRequest('/api/marketplace/search', 'POST', {
          agent_id: currentAgId,
          query: 'code'
        });
      } else if (selectedTool === 'register_agent') {
        result = await apiRequest('/api/agents/register', 'POST', {
          user_id: 'demo-user-id',
          agent_type: 'claude_code',
          agent_name: 'Claude Code Agent',
          capabilities: ['refactoring', 'review']
        });
      } else if (selectedTool === 'purchase') {
        const firstListing = listings.find(l => l.price_cents > 0);
        if (!firstListing) throw new Error('No premium listing available to purchase');
        result = await apiRequest('/api/marketplace/purchase', 'POST', {
          agent_id: currentAgId,
          listing_id: firstListing.id
        });
      } else if (selectedTool === 'install') {
        const freeListing = listings.find(l => l.price_cents === 0);
        if (!freeListing) throw new Error('No free listing available to install');
        result = await apiRequest('/api/marketplace/install', 'POST', {
          agent_id: currentAgId,
          listing_id: freeListing.id
        });
      } else if (selectedTool === 'get_listing_detail') {
        if (listings.length > 0) {
          result = await apiRequest(`/api/listings/${listings[0].id}`, 'GET');
        } else {
          throw new Error('No listings found in database');
        }
      }

      setRpcResponse(JSON.stringify(result, null, 2));
    } catch (err) {
      setRpcResponse(JSON.stringify({ error: err.message }, null, 2));
    }
  };

  return (
    <section className="agent-terminal-section">
      <div className="terminal-container">
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="dot red"></span>
            <span className="dot yellow"></span>
            <span className="dot green"></span>
          </div>
          <div className="terminal-title">weft-mcp-agent-console // stdio-v1.0.0</div>
          <div className="terminal-badge">LIVE MCP ACTIVE</div>
        </div>

        <div className="terminal-body">
          <div className="terminal-intro">
            <p className="term-green">🤖 Welcome, AI Agent.</p>
            <p>You are viewing the machine interface for <strong>Weft Agentic Marketplace</strong>.</p>
            <p>Connect your agent process via Stdio transport using the configuration below:</p>
          </div>

          <div className="code-box">
            <div className="code-header-bar">
              <span>MCP Client Configuration (.mcp.json or claude_desktop_config.json)</span>
              <button className="btn-copy" onClick={copyMcpConfig}>
                <Copy size={12} /> Copy JSON
              </button>
            </div>
            <pre><code>{mcpConfigText}</code></pre>
          </div>

          <div className="skill-reader-box">
            <h3>SKILL.md Definition</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Pass this skill to your agent context or read directly:</p>
            <pre style={{ background: '#090a0f', padding: '10px', borderRadius: '4px', marginTop: '8px' }}>
              <code>curl -s http://localhost:3000/SKILL.md</code>
            </pre>
          </div>

          <div className="endpoint-tester-box">
            <h3>Interactive Agent RPC Tester</h3>
            <div className="tester-controls">
              <select value={selectedTool} onChange={(e) => setSelectedTool(e.target.value)}>
                <option value="search">1. search(query, agent_id)</option>
                <option value="register_agent">2. register_agent(agent_name, agent_type)</option>
                <option value="purchase">3. purchase(listing_id, agent_id)</option>
                <option value="install">4. install(listing_id, agent_id)</option>
                <option value="get_listing_detail">5. get_listing_detail(listing_id)</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleRunRpc}>
                <Play size={14} /> Execute RPC Request
              </button>
            </div>
            <div className="tester-output">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Response Payload:</div>
              <pre><code>{rpcResponse}</code></pre>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
