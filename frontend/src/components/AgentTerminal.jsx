import React, { useState } from 'react';
import { apiRequest } from '../api';
import { Terminal, Copy, Play, Bot, Check, ShieldCheck, Code, Cpu } from 'lucide-react';

export default function AgentTerminal({ listings, agentId, setAgentId, showToast }) {
  const [selectedTool, setSelectedTool] = useState('search');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [rpcResponse, setRpcResponse] = useState(`// Machine RPC Payload Output Terminal
// Ready for AI model inspection. Select an RPC method and execute.`);

  const mcpConfigText = `{
  "mcpServers": {
    "weft-marketplace": {
      "command": "node",
      "args": ["${window.location.origin.replace('5173', '3000')}/src/mcp/server.js"],
      "env": {
        "PORT": "3000",
        "PRAVA_SANDBOX": "enabled",
        "LINQ_RECEIPTS": "enabled"
      }
    }
  }
}`;

  const agentSystemPrompt = `<weft_agent_instructions>
  <protocol>MCP Stdio Transport v1.0</protocol>
  <endpoint>http://localhost:3000/api</endpoint>
  <capabilities>
    <tool name="search">Query NANDA Fact Index & local SQLite FTS5 for agent skills</tool>
    <tool name="register_agent">Register agent_id for session tracking</tool>
    <tool name="install">Install free package & fetch SKILL.md specification</tool>
    <tool name="purchase">Initiate Prava Payment Session & mandate authorization</tool>
  </capabilities>
</weft_agent_instructions>`;

  const copyMcpConfig = () => {
    navigator.clipboard.writeText(mcpConfigText);
    setCopiedConfig(true);
    showToast('MCP JSON configuration copied to clipboard!', 'success');
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const copySystemPrompt = () => {
    navigator.clipboard.writeText(agentSystemPrompt);
    setCopiedPrompt(true);
    showToast('Agent System Prompt copied to clipboard!', 'success');
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleRunRpc = async () => {
    setRpcResponse('// Dispatching JSON-RPC 2.0 payload over Stdio transport...');

    try {
      let currentAgId = agentId;
      if (!currentAgId) {
        const agRes = await apiRequest('/api/agents/register', 'POST', {
          user_id: 'demo-agent-user',
          agent_type: 'antigravity',
          agent_name: 'Antigravity Autonomous Agent',
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
          user_id: 'demo-agent-user',
          agent_type: 'claude_code',
          agent_name: 'Claude Code Model Agent',
          capabilities: ['code_review', 'mcp_execution']
        });
      } else if (selectedTool === 'purchase') {
        const firstListing = listings.find(l => l.price_cents > 0) || listings[0];
        if (!firstListing) throw new Error('No listing available for purchase payload');
        result = await apiRequest('/api/marketplace/purchase', 'POST', {
          agent_id: currentAgId,
          listing_id: firstListing.id
        });
      } else if (selectedTool === 'install') {
        const freeListing = listings.find(l => l.price_cents === 0) || listings[0];
        if (!freeListing) throw new Error('No listing available for install payload');
        result = await apiRequest('/api/marketplace/install', 'POST', {
          agent_id: currentAgId,
          listing_id: freeListing.id
        });
      } else if (selectedTool === 'get_nanda_index') {
        result = {
          nanda_fact_index: {
            status: "active",
            synced_nodes: 142,
            total_records: listings.length,
            records: listings.map(l => ({
              id: l.id,
              title: l.title,
              type: l.item_type,
              price_usd: (l.price_cents / 100).toFixed(2),
              prava_eligible: l.price_cents > 0
            }))
          }
        };
      }

      setRpcResponse(JSON.stringify(result, null, 2));
    } catch (err) {
      setRpcResponse(JSON.stringify({ error: err.message, timestamp: new Date().toISOString() }, null, 2));
    }
  };

  return (
    <section className="agent-terminal-section">
      <div className="agent-terminal-container">
        {/* Terminal Header Bar */}
        <div className="agent-terminal-header">
          <div className="terminal-header-title">
            <Bot size={16} className="accent-text-brand" />
            <span>AGENT_MCP_STDIO_INTERFACE // MACHINE_NODE</span>
          </div>
          <div className="terminal-live-status">
            <span className="live-status-dot">●</span> STDIO PROTOCOL ACTIVE
          </div>
        </div>

        {/* Terminal Body */}
        <div className="agent-terminal-body">
          {/* Machine Banner Intro */}
          <div className="machine-intro-box">
            <div className="machine-intro-top">
              <Cpu size={18} className="accent-text-brand" />
              <h3 className="machine-intro-title">Machine Context & Prompt Injection</h3>
            </div>
            <p className="machine-intro-text">
              This endpoint provides Machine-Readable JSON-RPC schemas and system prompts for LLM Agent processes (Claude Code, Codex, Antigravity, Cursor).
            </p>
            <div className="machine-btn-group">
              <button className="btn btn-secondary btn-sm" onClick={copySystemPrompt}>
                {copiedPrompt ? <Check size={12} className="accent-text-brand" /> : <Copy size={12} />} Copy System Prompt XML
              </button>
              <button className="btn btn-secondary btn-sm" onClick={copyMcpConfig}>
                {copiedConfig ? <Check size={12} className="accent-text-brand" /> : <Code size={12} />} Copy mcp.json Config
              </button>
            </div>
          </div>

          {/* MCP Stdio Config Block */}
          <div className="machine-code-block">
            <div className="code-block-header">
              <span className="code-block-filename">mcp.json (Claude Desktop / Agent Config)</span>
              <button className="btn-icon-copy" onClick={copyMcpConfig} title="Copy Configuration">
                <Copy size={13} />
              </button>
            </div>
            <pre className="code-block-content"><code>{mcpConfigText}</code></pre>
          </div>

          {/* Interactive Agent RPC Playground */}
          <div className="rpc-playground-card">
            <div className="playground-header">
              <h3 className="playground-title">
                <Terminal size={16} className="accent-text-brand" /> Interactive Stdio JSON-RPC 2.0 Tester
              </h3>
              <span className="playground-tag">AGENT EXECUTION PLAYGROUND</span>
            </div>

            <div className="rpc-controls-row">
              <select 
                value={selectedTool} 
                onChange={(e) => setSelectedTool(e.target.value)} 
                className="form-input rpc-select-input"
              >
                <option value="search">1. search(query: "code", agent_id)</option>
                <option value="register_agent">2. register_agent(agent_name: "Claude Code")</option>
                <option value="purchase">3. purchase(listing_id, agent_id) → Prava Session</option>
                <option value="install">4. install(listing_id, agent_id) → Deliver SKILL.md</option>
                <option value="get_nanda_index">5. get_nanda_index() → Fact Index Sync</option>
              </select>

              <button className="btn btn-brand btn-sm rpc-execute-btn" onClick={handleRunRpc}>
                <Play size={14} /> Execute Stdio RPC
              </button>
            </div>

            {/* Output Payload Terminal Window */}
            <div className="rpc-output-window">
              <div className="output-window-bar">
                <span className="output-dot red"></span>
                <span className="output-dot yellow"></span>
                <span className="output-dot green"></span>
                <span className="output-title">JSON-RPC Response Payload</span>
              </div>
              <pre className="output-payload-code"><code>{rpcResponse}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
