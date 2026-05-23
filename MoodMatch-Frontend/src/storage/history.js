/**
 * Search history storage – LocalStorage adapter.
 * Schema: { id, query, timestamp, resultCount }
 */

const STORAGE_KEY = 'moodmatch_history';
const MAX_ITEMS = 20; // configurable limit

function safeRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function safeWrite(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Failed to write history to LocalStorage:', e.message);
    return false;
  }
}

/** Returns all history items, newest first. */
export function getHistory() {
  return safeRead();
}

/**
 * Adds a search entry. If the same query exists, it's moved to top.
 * Enforces MAX_ITEMS limit.
 */
export function addToHistory(query, resultCount = 0) {
  if (!query || query.trim().length === 0) return false;

  const current = safeRead();

  // Remove existing entry with same query (case-insensitive)
  const filtered = current.filter(
    (h) => h.query.toLowerCase() !== query.toLowerCase(),
  );

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    query: query.trim(),
    timestamp: new Date().toISOString(),
    resultCount,
  };

  // Prepend new entry and trim to limit
  const updated = [entry, ...filtered].slice(0, MAX_ITEMS);
  return safeWrite(updated);
}

/** Removes a specific history entry by id. */
export function removeFromHistory(id) {
  const current = safeRead();
  return safeWrite(current.filter((h) => h.id !== id));
}

/** Clears all search history. */
export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
