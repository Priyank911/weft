import OpenAI from 'openai';

let cachedClient = null;
let cachedModel = null;
let cachedProvider = null;

export function getLLMClient() {
  const provider = process.env.LLM_PROVIDER || 'groq';

  if (cachedClient !== null || cachedModel !== null) {
    if (provider === cachedProvider) {
      return { client: cachedClient, model: cachedModel };
    }
  }

  cachedProvider = provider;

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    cachedModel = process.env.OPENAI_MODEL || 'gpt-4o';
    if (!apiKey || apiKey === 'sk-your-openai-key') {
      console.warn('[LLM] No valid OPENAI_API_KEY configured. AI features will use fallbacks.');
      cachedClient = null;
    } else {
      cachedClient = new OpenAI({ apiKey });
    }
  } else {
    const apiKey = process.env.GROQ_API_KEY;
    cachedModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    if (!apiKey || apiKey === 'your-groq-key-here') {
      console.warn('[LLM] No valid GROQ_API_KEY configured. AI features will use fallbacks.');
      cachedClient = null;
    } else {
      cachedClient = new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey });
    }
  }

  return { client: cachedClient, model: cachedModel };
}
