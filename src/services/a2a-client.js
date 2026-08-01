import fetch from 'node-fetch';

const DEFAULT_TIMEOUT = 30000;

async function fetchWithTimeout(url, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function getAgentCard(agentUrl) {
  try {
    const response = await fetchWithTimeout(`${agentUrl}/.well-known/agent-card.json`);
    if (!response.ok) {
      throw new Error(`[A2AClient] Failed to fetch agent card: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[A2AClient] Error in getAgentCard:', error);
    throw { error: { code: 'A2A_CARD_ERROR', message: error.message } };
  }
}

export async function sendTask(agentUrl, { taskId, message, role = 'user' }) {
  try {
    const rpcPayload = {
      jsonrpc: '2.0',
      method: 'message/send',
      params: {
        message: {
          messageId: Date.now().toString(),
          role: role,
          parts: [{ kind: 'text', text: message }]
        },
        id: taskId
      },
      id: Date.now()
    };

    const response = await fetchWithTimeout(`${agentUrl}/a2a`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcPayload)
    });

    if (!response.ok) {
      throw new Error(`[A2AClient] sendTask failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[A2AClient] Error in sendTask:', error);
    throw { error: { code: 'A2A_SEND_TASK_ERROR', message: error.message } };
  }
}

export async function getTaskStatus(agentUrl, taskId) {
  try {
    const rpcPayload = {
      jsonrpc: '2.0',
      method: 'tasks/get',
      params: { id: taskId },
      id: Date.now()
    };

    const response = await fetchWithTimeout(`${agentUrl}/a2a`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcPayload)
    });

    if (!response.ok) {
      throw new Error(`[A2AClient] getTaskStatus failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[A2AClient] Error in getTaskStatus:', error);
    throw { error: { code: 'A2A_STATUS_ERROR', message: error.message } };
  }
}

export async function cancelTask(agentUrl, taskId) {
  try {
    const rpcPayload = {
      jsonrpc: '2.0',
      method: 'tasks/cancel',
      params: { id: taskId },
      id: Date.now()
    };

    const response = await fetchWithTimeout(`${agentUrl}/a2a`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcPayload)
    });

    if (!response.ok) {
      throw new Error(`[A2AClient] cancelTask failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[A2AClient] Error in cancelTask:', error);
    throw { error: { code: 'A2A_CANCEL_ERROR', message: error.message } };
  }
}

export function handleTaskResponse(response) {
  try {
    const result = response.result;
    if (!result) {
      throw new Error('Invalid JSON-RPC response');
    }
    
    return {
      status: result.status, // e.g., 'working', 'input-required', 'completed', 'failed'
      artifacts: result.artifacts || [],
      messages: result.messages || []
    };
  } catch (error) {
    console.error('[A2AClient] Error in handleTaskResponse:', error);
    throw { error: { code: 'A2A_RESPONSE_PARSE_ERROR', message: error.message } };
  }
}
