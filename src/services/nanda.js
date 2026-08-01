import fetch from 'node-fetch';

const NANDA_INDEX_URL = process.env.NANDA_INDEX_URL || 'http://localhost:5000';

export function buildAgentFacts(listing) {
  return {
    id: listing.id,
    name: listing.title,
    description: listing.description,
    capabilities: listing.capabilities || [],
    category: listing.category,
    pricing: {
      price_cents: listing.price_cents,
      currency: listing.currency,
      rate_type: listing.rate_type,
      rate_limit: listing.rate_limit
    },
    tags: listing.tags || [],
    created_at: listing.created_at,
    type: listing.listing_type
  };
}

export async function publishAgentFacts(listing) {
  try {
    const facts = buildAgentFacts(listing);
    // Locally it would be stored via db (e.g. updateListing) but here we might POST to remote index
    try {
      const response = await fetch(`${NANDA_INDEX_URL}/api/v1/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(facts)
      });
      if (!response.ok) {
        console.warn(`[NandaService] Failed to sync with remote NANDA Index: ${response.status}`);
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
      
      const response = await fetch(`${NANDA_INDEX_URL}/api/v1/agents/search?${params.toString()}`);
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
      const response = await fetch(`${NANDA_INDEX_URL}/api/v1/agents/${listingId}`);
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
