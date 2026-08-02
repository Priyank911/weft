import fetch from 'node-fetch';

const NANDA_INDEX_URL = process.env.NANDA_INDEX_URL || 'http://localhost:5000';

function safeParseArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function buildAgentFacts(listing) {
  return {
    agent_id: listing.id,
    name: listing.title,
    endpoint: listing.a2a_endpoint_url || `https://weft.marketplace/api/listings/${listing.id}`,
    description: listing.description,
    capabilities: safeParseArray(listing.capabilities),
    category: listing.category,
    pricing: {
      price_cents: listing.price_cents,
      currency: listing.currency,
      rate_type: listing.rate_type,
      rate_limit: listing.rate_limit
    },
    tags: safeParseArray(listing.tags),
    created_at: listing.created_at,
    type: listing.listing_type
  };
}

export async function publishAgentFacts(listing) {
  try {
    const facts = buildAgentFacts(listing);
    // Locally it would be stored via db (e.g. updateListing) but here we might POST to remote index
    try {
      const response = await fetch(`${NANDA_INDEX_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(facts)
      });
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[NandaService] Failed to sync with remote NANDA Index: ${response.status}`, errText);
      } else {
        const data = await response.json();
        return { ...facts, agentId: data.agent_id || data.agentId };
      }
    } catch (e) {
      console.warn('[NandaService] NANDA Index unreachable, continuing locally', e.message);
    }
    return facts;
  } catch (error) {
    console.error('[NandaService] Error in publishAgentFacts:', error);
    throw { error: { code: 'NANDA_PUBLISH_ERROR', message: error.message } };
  }
}

export async function searchAgents(query, filters) {
  try {
    // Attempt remote NANDA sync search if possible
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (filters?.category) params.append('category', filters.category);
      
      const response = await fetch(`${NANDA_INDEX_URL}/api/agents/search?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        return data; // assuming array of agent facts
      }
    } catch (e) {
      console.warn('[NandaService] NANDA Index search unavailable, fallback to local', e.message);
    }

    // Local fallback return empty or let upper layers handle local search
    return []; 
  } catch (error) {
    console.error('[NandaService] Error in searchAgents:', error);
    throw { error: { code: 'NANDA_SEARCH_ERROR', message: error.message } };
  }
}

export async function getAgentFacts(listingId) {
  try {
    try {
      const response = await fetch(`${NANDA_INDEX_URL}/api/agents/${listingId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('[NandaService] NANDA Index unreachable for getAgentFacts', e.message);
    }
    return null;
  } catch (error) {
    console.error('[NandaService] Error in getAgentFacts:', error);
    throw { error: { code: 'NANDA_GET_ERROR', message: error.message } };
  }
}
