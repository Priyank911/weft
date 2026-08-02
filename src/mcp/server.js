import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db/index.js';

const PORT = process.env.PORT || 3000;
const API_BASE = `http://localhost:${PORT}/api/marketplace`;

const server = new McpServer({
  name: 'weft-marketplace',
  version: '1.0.0'
});

// Helper to handle API responses
async function fetchApi(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errorData = await response.json();
      if (errorData.error && errorData.error.message) {
        errorMsg = errorData.error.message;
      }
    } catch (e) {}
    throw new Error(`API Error (${response.status}): ${errorMsg}`);
  }
  
  return response.json();
}

// Helper to validate agent and log usage
async function validateAgentAndLogUsage(agent_id, tool_name, params, listing_id = null) {
  const agent = db.getAgentById.get(agent_id);
  if (!agent) {
    throw new Error(`Agent not found: ${agent_id}`);
  }

  db.logAgentUsage.run(
    uuidv4(),
    agent_id,
    tool_name,
    listing_id,
    JSON.stringify(params).substring(0, 500),
    'Tool called via MCP'
  );

  return agent;
}

// Wrap tool handler to catch errors gracefully
function toolHandler(fn) {
  return async (params) => {
    try {
      const result = await fn(params);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: error.message || String(error) }, null, 2) }]
      };
    }
  };
}

// 1. register_agent
server.tool('register_agent', 'Register a new buyer agent on the Weft Marketplace. IMPORTANT: Before calling this tool, you MUST explicitly ask the user for ALL THREE of the following: (1) their full name, (2) their email address, and (3) their phone number. Do NOT assume or auto-fill any of these values. After registration completes, you MUST display the QR Code image and SMS activation link to the user in your output.', {
  agent_type: z.enum(['claude_code', 'codex', 'antigravity', 'other']).describe('The type of AI agent being registered'),
  user_name: z.string().describe('The full name of the human user registering the agent. You MUST ask the user for this.'),
  user_email: z.string().email().describe('The email address of the human user. You MUST ask the user for this.'),
  user_phone: z.string().describe('The phone number of the human user (e.g. +1234567890). You MUST ask the user for this.'),
  capabilities: z.array(z.string()).optional().describe('Optional list of agent capabilities')
}, toolHandler(async ({ agent_type, user_name, user_email, user_phone, capabilities }) => {
  let user = db.getUserByEmail.get(user_email);
  if (!user) {
    // Create user if not exists
    const userId = uuidv4();
    db.createUser.run(userId, user_email, 'dummy_hash_' + Date.now(), 'buyer', user_phone, null);
    user = db.getUserById.get(userId);
  } else if (!user.phone) {
    // Update existing user with phone if missing
    db.updateUser.run(user.role, user_phone, user.prava_customer_id, user.id);
    user = db.getUserById.get(user.id);
  }

  const agentId = uuidv4();
  db.createAgentProfile.run(
    agentId,
    user.id,
    agent_type,
    user_name,
    capabilities ? JSON.stringify(capabilities) : '[]',
    0,
    '{}'
  );
  const profile = db.getAgentById.get(agentId);

  const linqNumber = process.env.LINQ_PHONE_NUMBER || '+12063268039';
  const smsBody = 'Weft buyer account activate';
  const smsUri = `sms:${linqNumber.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(smsBody)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(smsUri)}`;

  return {
    agent_id: profile.id,
    user_name,
    user_email,
    user_phone,
    profile,
    activation_qr_code_image_url: qrCodeUrl,
    activation_sms_direct_link: smsUri,
    activation_prefilled_text: smsBody,
    message: `Account created for ${user_name}! MANDATORY INSTRUCTION FOR AGENT: You MUST show the human user the activation QR Code and SMS Link below so they can opt in to Linq iMessages:\n\n1. Display QR Code Image: ${qrCodeUrl}\n2. Display Direct SMS Link: ${smsUri}\n3. Instruct them to send "${smsBody}" to ${linqNumber}. They will receive "Weft account is successfully activated." from Weft.`
  };
}));

// 2. search
server.tool('search', 'Search for agents, skills, and tools in the marketplace. Live-agent results are ranked by semantic relevance to the query, not just returned in database order.', {
  query: z.string(),
  agent_id: z.string(),
  category: z.string().optional(),
  listing_type: z.enum(['static', 'live']).optional(),
  max_price_cents: z.number().optional()
}, toolHandler(async ({ query, agent_id, category, listing_type, max_price_cents }) => {
  await validateAgentAndLogUsage(agent_id, 'search', { query, category, listing_type, max_price_cents });

  const data = await fetchApi('/search', {
    method: 'POST',
    body: JSON.stringify({ agent_id, query, category, listing_type, max_price_cents })
  });
  
  // Format response for agents with guidance
  const results = data.data.results || [];
  const formattedResults = results.map(r => {
    let guidance = '';
    if (r.price_cents === 0) {
      guidance = "This is a free asset. Use the 'install' tool to get it immediately.";
    } else {
      const price = (r.price_cents / 100).toFixed(2);
      guidance = `This is a premium asset ($${price}). Use the 'purchase' tool to buy it — the user will need to approve payment.`;
    }
    
    return {
      id: r.id,
      title: r.title,
      price_cents: r.price_cents,
      currency: r.currency,
      category: r.category,
      listing_type: r.listing_type,
      description: r.description,
      tags: r.tags,
      capabilities: r.capabilities,
      rate_type: r.rate_type,
      guidance
    };
  });

  return { agent_id, results: formattedResults };
}));

// 3. get_listing_detail
server.tool('get_listing_detail', 'Get full details of a specific listing', {
  listing_id: z.string(),
  agent_id: z.string()
}, toolHandler(async ({ listing_id, agent_id }) => {
  await validateAgentAndLogUsage(agent_id, 'get_listing_detail', { listing_id }, listing_id);
  
  const listing = db.getListingById.get(listing_id);
  if (!listing) throw new Error('Listing not found');

  return { 
    agent_id, 
    listing: {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      long_description: listing.long_description,
      category: listing.category,
      listing_type: listing.listing_type,
      price_cents: listing.price_cents,
      currency: listing.currency,
      rate_type: listing.rate_type,
      rate_limit: listing.rate_limit,
      capabilities: listing.capabilities,
      tags: listing.tags,
      sample_description: listing.sample_description,
      download_count: listing.download_count
    } 
  };
}));

// 4. purchase
server.tool('purchase', 'Purchase a premium listing', {
  listing_id: z.string(),
  agent_id: z.string()
}, toolHandler(async ({ listing_id, agent_id }) => {
  await validateAgentAndLogUsage(agent_id, 'purchase', { listing_id }, listing_id);
  
  const data = await fetchApi('/purchase', {
    method: 'POST',
    body: JSON.stringify({ listing_id, agent_id })
  });
  
  return {
    agent_id,
    transaction_id: data.data.transaction_id,
    payment_url: data.data.payment_url,
    amount_cents: data.data.amount_cents,
    currency: data.data.currency,
    status: data.data.status,
    message: data.data.message || 'Please approve payment at the payment_url'
  };
}));

// 5. install
server.tool('install', 'Install a free listing directly', {
  listing_id: z.string(),
  agent_id: z.string()
}, toolHandler(async ({ listing_id, agent_id }) => {
  await validateAgentAndLogUsage(agent_id, 'install', { listing_id }, listing_id);
  
  const data = await fetchApi('/install', {
    method: 'POST',
    body: JSON.stringify({ listing_id, agent_id })
  });
  
  return {
    agent_id,
    files: data.data.files,
    manifest: data.data.manifest
  };
}));

// 6. get_purchase_status
server.tool('get_purchase_status', 'Check the status of a purchase transaction', {
  transaction_id: z.string(),
  agent_id: z.string()
}, toolHandler(async ({ transaction_id, agent_id }) => {
  await validateAgentAndLogUsage(agent_id, 'get_purchase_status', { transaction_id });
  
  const data = await fetchApi(`/purchase/${transaction_id}/status`);
  
  return {
    agent_id,
    status: data.data.status,
    payment_url: data.data.payment_url
  };
}));

// 7. download_purchased
server.tool('download_purchased', 'Download files for a purchased and approved listing', {
  transaction_id: z.string(),
  agent_id: z.string()
}, toolHandler(async ({ transaction_id, agent_id }) => {
  await validateAgentAndLogUsage(agent_id, 'download_purchased', { transaction_id });
  
  const data = await fetchApi(`/purchase/${transaction_id}/deliver`, {
    method: 'POST',
    body: JSON.stringify({ agent_id })
  });
  
  return {
    agent_id,
    files: data.data.files,
    manifest: data.data.manifest
  };
}));

// 8. rent
server.tool('rent', 'Rent a live agent or tool listing for a duration', {
  listing_id: z.string(),
  agent_id: z.string(),
  duration_minutes: z.number(),
  task_description: z.string()
}, toolHandler(async ({ listing_id, agent_id, duration_minutes, task_description }) => {
  await validateAgentAndLogUsage(agent_id, 'rent', { listing_id, duration_minutes, task_description }, listing_id);
  
  const data = await fetchApi('/rent', {
    method: 'POST',
    body: JSON.stringify({ listing_id, agent_id, duration_minutes, task_description })
  });
  
  return {
    agent_id,
    transaction_id: data.data.transaction_id,
    approval_url: data.data.approval_url,
    estimated_cost_cents: data.data.estimated_cost_cents,
    message: data.data.message
  };
}));

// 9. execute_rental_task
server.tool('execute_rental_task', 'Communicate with a rented live agent', {
  transaction_id: z.string(),
  agent_id: z.string(),
  message: z.string()
}, toolHandler(async ({ transaction_id, agent_id, message }) => {
  await validateAgentAndLogUsage(agent_id, 'execute_rental_task', { transaction_id, message: message.substring(0, 100) });
  
  const data = await fetchApi(`/rent/${transaction_id}/execute`, {
    method: 'POST',
    body: JSON.stringify({ agent_id, message })
  });
  
  return {
    agent_id,
    status: data.data.status,
    result: data.data.result,
    clarification_needed: data.data.clarification_needed,
    question: data.data.question
  };
}));

// 10. get_rental_status
server.tool('get_rental_status', 'Check the mandate approval status of a rental transaction', {
  transaction_id: z.string(),
  agent_id: z.string()
}, toolHandler(async ({ transaction_id, agent_id }) => {
  await validateAgentAndLogUsage(agent_id, 'get_rental_status', { transaction_id });

  const data = await fetchApi(`/rent/${transaction_id}/status`);

  return {
    agent_id,
    status: data.data.status,
    approval_url: data.data.approval_url
  };
}));

// 11. my_profile
server.tool('my_profile', 'Get the current agent\'s profile information', {
  agent_id: z.string()
}, toolHandler(async ({ agent_id }) => {
  const agent = await validateAgentAndLogUsage(agent_id, 'my_profile', {});
  
  return {
    agent_id,
    profile: agent
  };
}));

// 12. my_purchases
server.tool('my_purchases', 'List all purchases and rentals for the current agent', {
  agent_id: z.string()
}, toolHandler(async ({ agent_id }) => {
  await validateAgentAndLogUsage(agent_id, 'my_purchases', {});
  
  const transactions = db.getTransactionsByAgent.all(agent_id);
  
  return {
    agent_id,
    transactions
  };
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Weft Marketplace MCP Server running on stdio');
}

main().catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
