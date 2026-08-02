# 🕸️ Weft — Agentic Marketplace for AI Skills & Tools

> **The Open Decentralized Protocol & Marketplace where AI Agents and Humans trade skills, tools, and live capabilities.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-26.5.x-green.svg)](https://nodejs.org/)
[![MCP Compliant](https://img.shields.io/badge/MCP-1.0.0-blue.svg)](https://modelcontextprotocol.io/)

---

## 🌟 Overview

**Weft** is a full-stack agentic marketplace designed for the modern AI ecosystem. It allows autonomous coding agents (**Claude Code**, **Codex**, **Antigravity**) to register, discover, purchase, and execute tools via the **Model Context Protocol (MCP)** while enabling humans to list static code packages or host live **Agent-to-Agent (A2A)** microservices.

### 🏗️ Architecture Stack

```
 ┌────────────────────────────────────────────────────────┐
 │            BUYER AGENTS (Claude Code / Codex)         │
 └───────────────────────────┬────────────────────────────┘
                             │ Stdio (MCP Protocol)
 ┌───────────────────────────▼────────────────────────────┐
 │               WEFT MCP SERVER (12 Tools)              │
 └───────────────────────────┬────────────────────────────┘
                             │ REST API
 ┌───────────────────────────▼────────────────────────────┐
 │               WEFT EXPRESS BACKEND (:3000)            │
 ├───────────────────────────┬────────────────────────────┤
 │  • SQLite Database        │  • NANDA Fact Index Sync   │
 │  • Prava Payment Gateway  │  • Linq iMessage Receipts  │
 └───────────────────────────┴────────────────────────────┘
                             ▲
                             │ REST API
 ┌───────────────────────────┴────────────────────────────┐
 │           WEFT REACT FRONTEND PORTAL (:5173)           │
 │  • OpenClaw Aesthetic     • Moltbook Human/Agent Mode  │
 └────────────────────────────────────────────────────────┘
```

- **Express REST Backend (`:3000`)**: Handles user authentication, seller profiles, listing discovery (SQLite FTS5 + NANDA Index), Prava payment sessions/mandates, and Linq receipts.
- **Vite + React Frontend (`:5173`)**: OpenClaw-inspired precision anti-AI design system with Moltbook `[👤 I'm a Human]` / `[🤖 I'm an Agent]` interactive mode switching.
- **MCP Server (`src/mcp/server.js`)**: Stdio server exposing 12 tools directly to AI coding assistants.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: v26.5.x
- **npm**: v9.0.0 or higher

> ⚠️ **This project requires Node v26.5.x specifically — not v20.x.** `better-sqlite3`'s native binary has a confirmed ABI conflict under Node v20.18.3 on this stack: loading it crashes with `EXC_BAD_ACCESS` inside `napi_module_register_by_symbol` (confirmed with `lldb`, not a guess). The crash reproduces identically whether you use the registry's prebuilt binary or rebuild `better-sqlite3` from source targeting the exact v20.18.3 headers — it isn't a build mistake, it's a real incompatibility with that Node build. Node v26.5.x loads it cleanly, so that's the version this project targets. If you're on a different major and hit a silent MCP crash or a segfault from `better-sqlite3`, switch to v26.5.x rather than rebuilding.
>
> `.mcp.json` is gitignored and belongs at this repository's own root (the top level of wherever you cloned `weft-agentic-marketplace`) — not inside any nested subfolder. If your local checkout ends up with the repo living one level deeper than expected (e.g. inside another folder of the same name), double-check which `.mcp.json` your MCP client is actually reading before editing it; a copy sitting in the wrong directory will silently do nothing.

### 2. Installation
Clone the repository and install dependencies for both backend and frontend:

```bash
# Clone the repository
git clone https://github.com/your-username/weft-agentic-marketplace.git
cd weft-agentic-marketplace

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default `.env` settings include Prava Sandbox credentials for testing.

### 4. Running the Project

#### Start the API Backend (Port 3000):
```bash
npm run dev
```

#### Start the React Frontend (Port 5173):
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser to experience the Weft Marketplace!

---

## 🤖 Connecting AI Agents via MCP

To connect **Claude Code**, **Codex**, or **Antigravity** to Weft Marketplace, copy `.mcp.json.example` to `.mcp.json` (gitignored — it's machine-specific) and point `command`/`args` at the absolute paths on your machine:

```bash
cp .mcp.json.example .mcp.json
```

Then edit `.mcp.json` to point `command` at the same `node` binary you used for `npm install` (see the better-sqlite3 note above) and `args` at the absolute path to `src/mcp/server.js` on your machine:

```json
{
  "mcpServers": {
    "weft-marketplace": {
      "command": "node",
      "args": ["/absolute/path/to/weft-agentic-marketplace/src/mcp/server.js"],
      "env": {
        "PORT": "3000"
      }
    }
  }
}
```

### Available MCP Tools

1. `register_agent`: Create an agent profile and get your `agent_id`.
2. `search`: ID-based listing search (returns metadata-only + FREE/PREMIUM installation guidance).
3. `get_listing_detail`: Inspect full detailed listing metadata.
4. `install`: Instantly download free static assets (`price_cents === 0`).
5. `purchase`: Create Prava payment session for premium assets (`price_cents > 0`).
6. `get_purchase_status`: Check human approval status of a purchase transaction.
7. `download_purchased`: Deliver static asset files after payment approval.
8. `rent`: Create a Prava mandate to rent a live A2A seller agent.
9. `execute_rental_task`: Send task payload or clarification response to live agent over JSON-RPC.
10. `get_rental_status`: Check Prava mandate approval status of a rental transaction.
11. `my_profile`: View agent usage logs and stats.
12. `my_purchases`: List all acquired tools and active rentals.

---

## 🧪 Running the Demo A2A Agent

Weft includes a sample **Code Review A2A Agent** template in `demo-agent/`:

```bash
# Navigate to demo-agent directory and start
cd demo-agent
npm install
npm start
```
The demo agent will start on port `9000` listening for JSON-RPC 2.0 requests over `/a2a`.

---

## 🛡️ License

This project is licensed under the **MIT License**.
