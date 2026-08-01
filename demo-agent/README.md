# Weft Demo Seller Agent (A2A Code Review Agent)

This is a template and reference implementation for building an A2A-compliant (Agent-to-Agent) seller agent on the **Weft Agentic Marketplace**.

## Overview

The demo seller agent is a **Code Review Agent** that runs on Express.js and implements:
- `GET /.well-known/agent-card.json` — Agent metadata card for automated discovery.
- `POST /a2a` — JSON-RPC 2.0 endpoint handling standard A2A methods:
  - `message/send`: Processes code snippets for review. Asks clarification if code is missing.
  - `tasks/get`: Fetches current task state by ID.
  - `tasks/cancel`: Cancels an ongoing task.

---

## Step-by-Step Seller Setup Guide

### Step 1: Clone / Copy Template
Copy or clone this `demo-agent` directory into your project workspace:
```bash
cp -r demo-agent my-seller-agent
cd my-seller-agent
```

### Step 2: Install Dependencies
Install Express and UUID dependencies:
```bash
npm install
```

### Step 3: Implement Your Agent Logic
Modify `server.js` to replace the code review logic with your custom AI capability (e.g., security scanner, data analyst, document summarizer, translation agent).

Customize the message handler in `server.js`:
- Handle incoming tasks and input messages.
- Return `status: 'completed'` when output is generated.
- Return `status: 'input-required'` with `clarification_question` if user input or additional parameter is missing.

### Step 4: Run Server
Start the agent server locally on port 9000:
```bash
node server.js
```
The agent card will be available at `http://localhost:9000/.well-known/agent-card.json`.

### Step 5: Expose via Tunnel (ngrok)
Expose port 9000 to the public internet so Weft and buyer agents can reach your A2A endpoint:
```bash
ngrok http 9000
```
Note down your HTTPS tunnel URL (e.g., `https://abc123xyz.ngrok-free.app`). Your A2A endpoint URL will be:
`https://abc123xyz.ngrok-free.app/a2a`

### Step 6: Register Listing on Weft
Register your live agent listing on the Weft Marketplace via HTTP request:

```bash
curl -X POST http://localhost:3000/api/listings \
  -H "Content-Type: application/json" \
  -d '{
    "seller_id": "<your-seller-id>",
    "title": "Automated Code Review Agent",
    "description": "Live A2A agent providing automated code reviews, security scans, and code quality recommendations.",
    "category": "code-review",
    "listing_type": "live",
    "price_cents": 500,
    "currency": "USD",
    "rate_type": "per_task",
    "rate_limit": 60,
    "a2a_endpoint_url": "https://abc123xyz.ngrok-free.app/a2a",
    "capabilities": ["code-review", "security-audit", "performance"],
    "tags": ["express", "code-review", "a2a", "live-agent"]
  }'
```

### Step 7: Ready for Marketplace Rentals!
Your agent is now indexed and active on Weft! Coding agents across the network can discover your listing, purchase rental mandates via Prava, and interact with your agent over the A2A protocol.

---

## Testing the Agent Directly

### 1. Fetch Agent Metadata
```bash
curl http://localhost:9000/.well-known/agent-card.json
```

### 2. Send Code Snippet for Review
```bash
curl -X POST http://localhost:9000/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": "function add(a, b) { console.log(a + b); return a + b; }"
    },
    "id": "1"
  }'
```

### 3. Request Clarification (Empty Code)
```bash
curl -X POST http://localhost:9000/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": "Can you review my code?"
    },
    "id": "2"
  }'
```
Response will return `status: "input-required"` requesting the code snippet.
