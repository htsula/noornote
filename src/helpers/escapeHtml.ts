/**
 * Escape HTML entities to prevent XSS
 * Single purpose: text → escaped HTML-safe text
 *
 * @param text - Raw text that may contain HTML characters
 * @returns HTML-escaped safe text
 *
 * @example
 * escapeHtml("<script>alert('xss')</script>")
 * // => "&lt;script&gt;alert('xss')&lt;/script&gt;"
 */

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}