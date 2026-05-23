/**
 * MoodMatch API Service
 * - Development: uses Vite proxy → /api → http://localhost:3001/api
 * - Production:  uses VITE_API_URL env var → https://your-backend.railway.app/api
 */

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export async function searchMusic(query, offset = 0) {
  const response = await fetch(`${BASE_URL}/music/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, offset }),
    signal: AbortSignal.timeout(30_000),
  });

  const json = await response.json();

  if (!response.ok) {
    const error = new Error(json.message || 'Search failed');
    error.statusCode = response.status;
    error.errorCode = json.errorCode || 'UNKNOWN_ERROR';
    throw error;
  }

  return json.data;
}
