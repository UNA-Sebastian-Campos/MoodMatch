/**
 * Formatting utilities for display values.
 */

/**
 * Formats duration in milliseconds to "m:ss" string.
 * @param {number} ms - Duration in milliseconds
 */
export function formatDuration(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Converts a popularity score (0-100) to a star rating display.
 * @param {number} score - 0 to 100
 */
export function popularityToLabel(score) {
  if (score >= 80) return '🔥 Trending';
  if (score >= 60) return '⭐ Popular';
  if (score >= 40) return '🎵 Known';
  return '💎 Hidden gem';
}

/**
 * Formats a timestamp to a relative string like "2 hours ago".
 * @param {string} isoString
 */
export function timeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Truncates a string to maxLength, appending "…" if needed.
 * @param {string} str
 * @param {number} maxLength
 */
export function truncate(str, maxLength = 30) {
  if (!str) return '';
  return str.length > maxLength ? str.slice(0, maxLength) + '…' : str;
}

/**
 * Capitalizes the first letter of a string.
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
