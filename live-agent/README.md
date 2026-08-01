# Weft Live Agent — Code Review & Refactor

A real, LLM-backed A2A seller agent (replaces the pattern-matching `demo-agent/`). It uses `src/services/llm-client.js` from the main Weft package (Groq by default, OpenAI via `LLM_PROVIDER=openai` in `.env`), so no separate API key wiring is needed here.

## Running

From the repo root, with `.env` populated (`GROQ_API_KEY` etc.):

```bash
LIVE_AGENT_PORT=9001 node live-agent/server.js
# or
npm run live-agent
```

Runs on port `9001` by default — a different port than `demo-agent` (`9000`) so both can run side by side. Uses `LIVE_AGENT_PORT`, not the shared `PORT` var, since both this process and the main REST API load the same root `.env` (which sets `PORT=3000` for the API).

- Agent card: `http://localhost:9001/.well-known/agent-card.json`
- A2A endpoint: `http://localhost:9001/a2a` (JSON-RPC 2.0: `message/send`, `tasks/get`, `tasks/cancel`)

## Behavior

Reviews code submitted via `message/send` and returns structured JSON (`summary`, `score`, `issues`, `recommendations`). If the submitted input isn't actually code, it asks a real LLM-generated clarification question (`status: 'input-required'`) instead of failing silently. Follow-up `message/send` calls reusing the same task id are treated as answers to that question, with up to 3 clarification rounds before the task is marked `failed`.
