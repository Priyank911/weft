import { getLLMClient } from './llm-client.js';

export async function generateListingMetadata(rawDescription, fileMetadata) {
  const { client, model } = getLLMClient();
  if (!client) {
    // Fallback: generate basic metadata without AI
    return {
      title: rawDescription?.substring(0, 60) || 'Untitled Listing',
      description: rawDescription || '',
      category: 'general',
      tags: ['agent', 'tool'],
      capabilities: [],
      suggestedPriceCents: 0,
      sampleDescription: rawDescription?.substring(0, 120) || ''
    };
  }

  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that processes agent and tool listing descriptions. Return a JSON object with the following fields: title, description, category, tags (array of strings), capabilities (array of strings), suggestedPriceCents (number), sampleDescription.'
        },
        {
          role: 'user',
          content: `Raw Description: ${rawDescription}\nFile Metadata: ${JSON.stringify(fileMetadata)}`
        }
      ]
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed;
  } catch (error) {
    console.error('[OpenAI] Error in generateListingMetadata:', error.message);
    return {
      title: rawDescription?.substring(0, 60) || 'Untitled Listing',
      description: rawDescription || '',
      category: 'general',
      tags: ['agent', 'tool'],
      capabilities: [],
      suggestedPriceCents: 0,
      sampleDescription: rawDescription?.substring(0, 120) || ''
    };
  }
}

export async function semanticSearch(query, listings) {
  const { client, model } = getLLMClient();
  if (!client) {
    // Fallback: simple keyword matching
    const q = query.toLowerCase();
    return listings
      .map(l => ({
        ...l,
        relevance_score: (
          (l.title?.toLowerCase().includes(q) ? 50 : 0) +
          (l.description?.toLowerCase().includes(q) ? 30 : 0) +
          (l.tags?.toLowerCase().includes(q) ? 20 : 0)
        )
      }))
      .sort((a, b) => b.relevance_score - a.relevance_score);
  }

  try {
    const listingsStr = JSON.stringify(listings.map(l => ({ id: l.id, title: l.title, description: l.description, tags: l.tags })));
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a search relevance engine. Rank the provided listings based on the query. Return a JSON object containing a "results" array of objects with "id" and "relevance_score" (0-100).'
        },
        {
          role: 'user',
          content: `Query: ${query}\nListings: ${listingsStr}`
        }
      ]
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const rankedListings = listings.map(l => {
      const scoreObj = parsed.results.find(r => r.id === l.id);
      return { ...l, relevance_score: scoreObj ? scoreObj.relevance_score : 0 };
    }).sort((a, b) => b.relevance_score - a.relevance_score);

    return rankedListings;
  } catch (error) {
    console.error('[OpenAI] Error in semanticSearch:', error.message);
    return listings;
  }
}

export async function parseAgentQuery(rawQuery) {
  const { client, model } = getLLMClient();
  if (!client) {
    return { intent: 'search', category: null, priceRange: null, features: [] };
  }

  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Extract the intent, category, price_range, and features from this free-form search query. Return JSON format with these exact keys.'
        },
        {
          role: 'user',
          content: rawQuery
        }
      ]
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('[OpenAI] Error in parseAgentQuery:', error.message);
    return { intent: 'search', category: null, priceRange: null, features: [] };
  }
}

export async function generateFileManifest(fileList) {
  const { client, model } = getLLMClient();
  if (!client) {
    // Fallback: basic manifest without AI descriptions
    const manifest = {};
    fileList.forEach(f => { manifest[f] = 'Asset file'; });
    return manifest;
  }

  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Given a list of file names and paths inside a zip bundle, provide a one-line role description for each file. Return JSON object with file paths as keys and role descriptions as values.'
        },
        {
          role: 'user',
          content: JSON.stringify(fileList)
        }
      ]
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('[OpenAI] Error in generateFileManifest:', error.message);
    const manifest = {};
    fileList.forEach(f => { manifest[f] = 'Asset file'; });
    return manifest;
  }
}
