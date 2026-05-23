/**
 * Favorites storage – LocalStorage adapter.
 * Schema: { id, name, artist, album, imageUrl, previewUrl, spotifyUrl, duration, popularity }
 */

const STORAGE_KEY = 'moodmatch_favorites';

function safeRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupted storage – reset gracefully
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function safeWrite(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    // Storage quota exceeded or unavailable
    console.warn('Failed to write favorites to LocalStorage:', e.message);
    return false;
  }
}

/** Returns all saved favorites */
export function getFavorites() {
  return safeRead();
}

/** Adds a track to favorites. Prevents duplicates by id. */
export function addFavorite(track) {
  const current = safeRead();
  if (current.some((t) => t.id === track.id)) return false; // already exists

  const toSave = {
    id: track.id,
    name: track.name,
    artist: track.artist,
    album: track.album,
    imageUrl: track.imageUrl,
    previewUrl: track.previewUrl || null,
    spotifyUrl: track.spotifyUrl,
    duration: track.duration,
    popularity: track.popularity,
    savedAt: new Date().toISOString(),
  };

  return safeWrite([toSave, ...current]);
}

/** Removes a track from favorites by id. */
export function removeFavorite(trackId) {
  const current = safeRead();
  const filtered = current.filter((t) => t.id !== trackId);
  return safeWrite(filtered);
}

/** Checks if a track is already in favorites. */
export function isFavorite(trackId) {
  return safeRead().some((t) => t.id === trackId);
}

/** Clears all favorites. */
export function clearFavorites() {
  localStorage.removeItem(STORAGE_KEY);
}
