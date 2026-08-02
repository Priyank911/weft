import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 9000;

// In-memory task store
const tasks = new Map();

// Middleware: JSON parsing
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[Demo Agent] ${timestamp} ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.body) {
    console.log(`[Demo Agent] Method: ${req.body.method || 'N/A'}, ID: ${req.body.id || 'N/A'}`);
  }
  next();
});

/**
 * Agent Metadata Card
 * Standard GET /.well-known/agent-card.json endpoint for A2A discovery
 */
app.get('/.well-known/agent-card.json', (req, res) => {
  res.json({
    name: "Weft Code Review Agent",
    description: "An A2A seller agent that performs automated code reviews, security scans, and optimization suggestions.",
    version: "1.0.0",
    provider: "Weft Seller Marketplace",
    capabilities: [
      "code-review",
      "static-analysis",
      "security-audit",
      "performance-optimization",
      "refactoring-recommendations"
    ],
    a2a: {
      version: "1.0",
      endpoint: "/a2a",
      methods: ["message/send", "tasks/get", "tasks/cancel"]
    }
  });
});

/**
 * Helper to check if text contains code
 * @param {string} text 
 * @returns {boolean}
 */
function isCodeSnippet(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;

  // Code indicators: fenced code blocks, common keywords, structural symbols
  const codePatterns = [
    /```[\s\S]*```/,
    /\b(function|const|let|var|class|import|export|return|if|else|for|while|try|catch|async|await|def|public|private|protected)\b/,
    /[{}()[\];=<>&|!+\-*/]{4,}/
  ];

  return codePatterns.some(pattern => pattern.test(trimmed));
}

// Accept both the simple demo payload and the A2A message.parts structure used
// by the marketplace A2A client.
function extractMessageText(params) {
  const message = params?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message?.parts)) {
    const textPart = message.parts.find(part => typeof part?.text === 'string');
    if (textPart) return textPart.text;
  }
  if (typeof message?.text === 'string') return message.text;
  if (typeof params?.text === 'string') return params.text;
  return '';
}

/**
 * Helper to perform mock code review
 * @param {string} code 
 * @returns {object} Review report
 */
function performCodeReview(code) {
  const lines = code.split('\n');
  const issues = [];
  const suggestions = [];

  // Check for common patterns
  if (code.includes('console.log')) {
    issues.push({ line: 'N/A', severity: 'warning', text: 'Found console.log statements. Remove production logging or use a formal logger.' });
  }
  if (code.includes('var ')) {
    issues.push({ line: 'N/A', severity: 'warning', text: 'Use "let" or "const" instead of "var" for block-scoped variable declaration.' });
  }
  if (!code.includes('try') && !code.includes('catch') && (code.includes('async') || code.includes('Promise') || code.includes('fetch'))) {
    issues.push({ line: 'N/A', severity: 'medium', text: 'Async operations detected without explicit try/catch error handling.' });
  }
  if (code.includes('eval(') || code.includes('exec(') || code.includes('password') || code.includes('secret')) {
    issues.push({ line: 'N/A', severity: 'high', text: 'Potential security vulnerability: possible sensitive data or unsafe execution.' });
  }

  // Default suggestions if issues are minimal
  if (issues.length === 0) {
    suggestions.push('Code structure looks clean and follows modern JavaScript conventions.');
    suggestions.push('Consider adding JSDoc annotations to document functions and parameters.');
    suggestions.push('Add unit tests covering edge cases.');
  } else {
    suggestions.push('Refactor flagged lines to improve reliability and security.');
    suggestions.push('Add TypeScript annotations or JSDoc types to improve developer ergonomics.');
  }

  const score = Math.max(60, 100 - issues.length * 10);

  return {
    summary: `Code review complete. Analyzed ${lines.length} lines of code.`,
    score: `${score}/100`,
    issues_found: issues.length,
    issues,
    recommendations: suggestions,
    reviewed_at: new Date().toISOString()
  };
}

/**
 * Main A2A JSON-RPC 2.0 Endpoint
 */
app.post('/a2a', (req, res) => {
  const { jsonrpc, method, params, id } = req.body || {};

  // Validate JSON-RPC version
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
      const existingTaskId = params?.taskId || params?.task_id || params?.id;

      let task;
      if (existingTaskId && tasks.has(existingTaskId)) {
        task = tasks.get(existingTaskId);
      } else {
        const taskId = uuidv4();
        task = {
          id: taskId,
          status: 'pending',
          input: taskMessage,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        tasks.set(taskId, task);
      }

      // Check if code was provided
      if (!isCodeSnippet(taskMessage)) {
        task.status = 'input-required';
        task.clarification_question = 'Please provide a valid code snippet (e.g. JavaScript, Python, TypeScript) for code review.';
        task.output = null;
        task.updated_at = new Date().toISOString();

        return res.json({
          jsonrpc: '2.0',
          result: {
            task_id: task.id,
            status: task.status,
            clarification_question: task.clarification_question,
            output: null,
            created_at: task.created_at,
            updated_at: task.updated_at
          },
          id
        });
      }

      // Process code review
      const reviewResult = performCodeReview(taskMessage);
      task.status = 'completed';
      task.clarification_question = null;
      task.output = reviewResult;
      task.updated_at = new Date().toISOString();

      return res.json({
        jsonrpc: '2.0',
        result: {
          task_id: task.id,
          status: task.status,
          output: task.output,
          created_at: task.created_at,
          updated_at: task.updated_at
        },
        id
      });
    }

    case 'tasks/get': {
      const taskId = params?.id || params?.taskId || params?.task_id;
      if (!taskId || !tasks.has(taskId)) {
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32602, message: `Task not found with ID: ${taskId}` },
          id
        });
      }

      const task = tasks.get(taskId);
      return res.json({
        jsonrpc: '2.0',
        result: {
          task_id: task.id,
          status: task.status,
          clarification_question: task.clarification_question || null,
          output: task.output || null,
          created_at: task.created_at,
          updated_at: task.updated_at
        },
        id
      });
    }

    case 'tasks/cancel': {
      const taskId = params?.id || params?.taskId || params?.task_id;
      if (!taskId || !tasks.has(taskId)) {
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32602, message: `Task not found with ID: ${taskId}` },
          id
        });
      }

      const task = tasks.get(taskId);
      task.status = 'cancelled';
      task.updated_at = new Date().toISOString();

      return res.json({
        jsonrpc: '2.0',
        result: {
          task_id: task.id,
          status: task.status,
          message: 'Task cancelled successfully',
          updated_at: task.updated_at
        },
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

// Start Express server
app.listen(PORT, () => {
  console.log(`[Demo Agent] Express server listening on http://localhost:${PORT}`);
  console.log(`[Demo Agent] Agent card: http://localhost:${PORT}/.well-known/agent-card.json`);
  console.log(`[Demo Agent] A2A Endpoint: http://localhost:${PORT}/a2a`);
});
