/**
 * Input sanitization utilities – client-side defense layer.
 * (NestJS also validates on the backend; this is early UI feedback.)
 */

const ALLOWED_PATTERN = /^[a-zA-ZÀ-ÿ0-9\s\-&,.'!?áéíóúÁÉÍÓÚñÑüÜ]+$/;
const MAX_LENGTH = 200;
const MIN_LENGTH = 2;

/**
 * Sanitizes a search query string.
 * Returns { valid: boolean, value: string, error: string|null }
 */
export function sanitizeQuery(raw) {
  if (typeof raw !== 'string') {
    return { valid: false, value: '', error: 'Input must be text' };
  }

  // Normalize whitespace
  const trimmed = raw.trim().replace(/\s+/g, ' ');

  if (trimmed.length === 0) {
    return { valid: false, value: '', error: 'Please enter a search query' };
  }

  if (trimmed.length < MIN_LENGTH) {
    return { valid: false, value: trimmed, error: 'Query is too short (min 2 characters)' };
  }

  if (trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      value: trimmed.slice(0, MAX_LENGTH),
      error: `Query is too long (max ${MAX_LENGTH} characters)`,
    };
  }

  if (!ALLOWED_PATTERN.test(trimmed)) {
    return {
      valid: false,
      value: trimmed,
      error: 'Query contains invalid characters',
    };
  }

  return { valid: true, value: trimmed, error: null };
}

/**
 * Strips potential XSS vectors from strings (for display only).
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
