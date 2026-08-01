import 'dotenv/config';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getLLMClient } from '../src/services/llm-client.js';

const app = express();
// Deliberately not process.env.PORT: that's shared with the main REST API's .env (PORT=3000)
// and would collide with it since both processes load the same .env file.
const PORT = process.env.LIVE_AGENT_PORT || 9001;

const MAX_CLARIFICATION_ROUNDS = 3;

// In-memory task store: id -> { id, status, originalInput, qaHistory, clarificationRounds, output, clarification_question, created_at, updated_at }
const tasks = new Map();

app.use(express.json());

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[Live Agent] ${timestamp} ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.body) {
    console.log(`[Live Agent] Method: ${req.body.method || 'N/A'}, ID: ${req.body.id || 'N/A'}`);
  }
  next();
});

/**
 * Agent Metadata Card
 */
app.get('/.well-known/agent-card.json', (req, res) => {
  res.json({
    name: 'Weft Code Review & Refactor Agent',
    description: 'A live, LLM-backed A2A seller agent that performs real code reviews: bugs, security issues, style problems, and refactor recommendations.',
    version: '1.0.0',
    provider: 'Weft Seller Marketplace',
    capabilities: [
      'code-review',
      'security-audit',
      'refactoring-recommendations',
      'style-analysis'
    ],
    a2a: {
      version: '1.0',
      endpoint: '/a2a',
      methods: ['message/send', 'tasks/get', 'tasks/cancel']
    }
  });
});

// --- Message extraction (A2A JSON-RPC params can carry text a few different ways) ---
function extractMessageText(params) {
  const message = params?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message?.parts)) {
    const textPart = message.parts.find(p => typeof p?.text === 'string');
    if (textPart) return textPart.text;
  }
  if (typeof message?.text === 'string') return message.text;
  if (typeof params?.text === 'string') return params.text;
  return '';
}

function extractTaskId(params) {
  return params?.id || params?.taskId || params?.task_id || null;
}

// --- LLM review call ---
const SYSTEM_PROMPT = `You are a senior code reviewer working for a live agent rental service. You will be given either a fresh code review request, or a continuation that includes an original request plus clarification questions you previously asked and the buyer's answers.

Decide whether you have enough real code to review. If the input is not actually code (empty, prose, gibberish, or missing the code itself), set "is_valid_input" to false and write a specific "clarification_question" asking the buyer for what's missing (e.g. the actual code, or which language it's in).

If you do have real code to review, set "is_valid_input" to true, "clarification_question" to null, and perform a genuine review: identify real bugs, security issues, and style problems.

Respond with ONLY a single JSON object, no prose, no markdown fences, with exactly these keys:
{
  "is_valid_input": boolean,
  "clarification_question": string or null,
  "summary": string,
  "score": integer from 0 to 100,
  "issues": [{ "severity": "low"|"medium"|"high", "explanation": string }],
  "recommendations": [string]
}`;

function buildFreshUserContent(input) {
  return `Code review request:\n\n${input}`;
}

function buildResumptionUserContent(originalInput, qaHistory) {
  let context = `Original task request:\n${originalInput}\n\n`;
  qaHistory.forEach((qa, i) => {
    context += `Clarification round ${i + 1}:\nQuestion you asked: ${qa.question}\nBuyer's answer: ${qa.answer}\n\n`;
  });
  context += `Using the original request together with all clarification answers above, attempt the code review now. Only ask another clarification_question if it's genuinely still impossible to review.`;
  return context;
}

async function tryParseJSON(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(cleaned);
}

async function callReviewLLM(userContent) {
  const { client, model } = getLLMClient();
  if (!client) {
    return {
      is_valid_input: false,
      clarification_question: 'The live agent has no LLM provider configured (missing API key). Please contact the seller.',
      summary: 'LLM unavailable.',
      score: 0,
      issues: [],
      recommendations: []
    };
  }

  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ]
    });
    return await tryParseJSON(response.choices[0].message.content);
  } catch (jsonModeError) {
    console.warn('[Live Agent] JSON mode call failed, retrying with plain-JSON prompt:', jsonModeError.message);
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\nReturn ONLY valid JSON, no prose, no markdown fences.` },
          { role: 'user', content: userContent }
        ]
      });
      return await tryParseJSON(response.choices[0].message.content);
    } catch (fallbackError) {
      console.error('[Live Agent] LLM call failed:', fallbackError.message);
      return {
        is_valid_input: false,
        clarification_question: 'The live agent hit an internal error trying to process this request. Could you resend the code?',
        summary: 'LLM call failed.',
        score: 0,
        issues: [],
        recommendations: []
      };
    }
  }
}

function askClarification(task, question) {
  task.clarificationRounds += 1;
  if (task.clarificationRounds >= MAX_CLARIFICATION_ROUNDS) {
    task.status = 'failed';
    task.clarification_question = null;
    task.output = {
      summary: 'Unable to complete the code review: too many clarification rounds without a usable answer.',
      rounds_attempted: task.clarificationRounds
    };
  } else {
    task.status = 'input-required';
    task.clarification_question = question || 'Could you provide more detail?';
    task.output = null;
  }
}

function completeTask(task, parsed) {
  task.status = 'completed';
  task.clarification_question = null;
  task.output = {
    summary: parsed.summary,
    score: parsed.score,
    issues: parsed.issues || [],
    recommendations: parsed.recommendations || []
  };
}

function touch(task) {
  task.updated_at = new Date().toISOString();
}

function taskResultPayload(task) {
  return {
    task_id: task.id,
    status: task.status,
    clarification_question: task.clarification_question || null,
    output: task.output || null,
    created_at: task.created_at,
    updated_at: task.updated_at
  };
}

/**
 * Main A2A JSON-RPC 2.0 Endpoint
 */
app.post('/a2a', async (req, res) => {
  const { jsonrpc, method, params, id } = req.body || {};

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
      id: id || null
    });
  }

  switch (method) {
    case 'message/send': {
      const taskMessage = extractMessageText(params);
      const incomingTaskId = extractTaskId(params);

      let task = incomingTaskId ? tasks.get(incomingTaskId) : null;

      if (task && task.status === 'input-required') {
        // Resume: treat the incoming message as the answer to our own clarification_question.
        task.qaHistory.push({ question: task.clarification_question, answer: taskMessage });
        const userContent = buildResumptionUserContent(task.originalInput, task.qaHistory);
        const parsed = await callReviewLLM(userContent);

        if (!parsed.is_valid_input) {
          askClarification(task, parsed.clarification_question);
        } else {
          completeTask(task, parsed);
        }
        touch(task);

        return res.json({ jsonrpc: '2.0', result: taskResultPayload(task), id });
      }

      // Brand-new task: either no existing task, or the existing one is terminal (completed/cancelled/failed) — reuse the same id if provided.
      const taskId = incomingTaskId || uuidv4();
      const now = new Date().toISOString();
      task = {
        id: taskId,
        status: 'pending',
        originalInput: taskMessage,
        qaHistory: [],
        clarificationRounds: 0,
        output: null,
        clarification_question: null,
        created_at: now,
        updated_at: now
      };
      tasks.set(taskId, task);

      const parsed = await callReviewLLM(buildFreshUserContent(taskMessage));
      if (!parsed.is_valid_input) {
        askClarification(task, parsed.clarification_question);
      } else {
        completeTask(task, parsed);
      }
      touch(task);

      return res.json({ jsonrpc: '2.0', result: taskResultPayload(task), id });
    }

    case 'tasks/get': {
      const taskId = extractTaskId(params);
      if (!taskId || !tasks.has(taskId)) {
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32602, message: `Task not found with ID: ${taskId}` },
          id
        });
      }
      return res.json({ jsonrpc: '2.0', result: taskResultPayload(tasks.get(taskId)), id });
    }

    case 'tasks/cancel': {
      const taskId = extractTaskId(params);
      if (!taskId || !tasks.has(taskId)) {
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32602, message: `Task not found with ID: ${taskId}` },
          id
        });
      }
      const task = tasks.get(taskId);
      task.status = 'cancelled';
      touch(task);
      return res.json({
        jsonrpc: '2.0',
        result: { task_id: task.id, status: task.status, message: 'Task cancelled successfully', updated_at: task.updated_at },
        id
      });
    }

    default: {
      return res.json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not found: ${method}` },
        id
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`[Live Agent] Express server listening on http://localhost:${PORT}`);
  console.log(`[Live Agent] Agent card: http://localhost:${PORT}/.well-known/agent-card.json`);
  console.log(`[Live Agent] A2A Endpoint: http://localhost:${PORT}/a2a`);
});
