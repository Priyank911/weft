// Unified API client for backend communication
export const API_BASE = 'http://localhost:3000';

export async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || data.message || 'API request failed');
    }
    return data.data;
  } catch (err) {
    console.error(`[API Error] ${method} ${endpoint}:`, err);
    throw err;
  }
}
