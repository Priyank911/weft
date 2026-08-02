import OpenAI from 'openai';
import fetch from 'node-fetch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const NANDA_INDEX_URL = process.env.NANDA_INDEX_URL || 'https://nest.projectnanda.org';

/**
 * Uses LLM to intelligently search and return the best matching NANDA agent IDs
 */
export async function aiSearchNanda(query) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  // 1. Fetch all agents from NANDA
  const response = await fetch(`${NANDA_INDEX_URL}/api/agents`);
  if (!response.ok) {
    throw new Error(`Failed to fetch from NANDA: ${response.status}`);
  }
  
  const data = await response.json();
  const agents = data.agents || data;

  if (!agents || agents.length === 0) {
    return [];
  }

  // Optimize payload for LLM (only send what is necessary to judge semantic relevance)
  const slimAgents = agents.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    specialties: a.specialties
  }));

  // 2. Build the prompt for the LLM
  const prompt = `You are the Weft Marketplace Search Intelligence Agent. 
Your job is to match a buyer's search query to the most relevant agents from the global NANDA network.

Buyer Query: "${query}"

Available Agents JSON:
${JSON.stringify(slimAgents, null, 2)}

Instructions:
- Carefully analyze the semantic meaning and intent behind the buyer's query.
- Find up to 10 agents from the JSON that best solve or match the query.
- You must return ONLY a raw JSON array containing the string IDs of the best matching agents.
- Example valid output: ["skill-1234", "agent-abcd"]
- If no agents match, return an empty array: []
- Do NOT output any markdown, backticks, explanations, or conversational text. ONLY output the raw JSON array.`;

  // 3. Query the LLM
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const output = completion.choices[0].message.content.trim();
    
    // 4. Parse response safely
    try {
      const parsedIds = JSON.parse(output);
      if (Array.isArray(parsedIds)) {
        return parsedIds;
      }
    } catch (parseError) {
      // Sometimes LLMs wrap in backticks despite instructions
      const match = output.match(/\[.*\]/s);
      if (match) {
        return JSON.parse(match[0]);
      }
      console.error('[WeftAgent] Failed to parse LLM output:', output);
      return [];
    }
  } catch (err) {
    console.error('[WeftAgent] LLM Search failed:', err);
    return [];
  }
  
  return [];
}
