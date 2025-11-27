/**
 * Convert URLs to clickable links
 * Single purpose: HTML → HTML with linkified URLs
 *
 * @param html - HTML content with URLs
 * @returns HTML with URLs wrapped in <a> tags
 *
 * @example
 * linkifyUrls("Visit https://example.com")
 * // => 'Visit <a href="https://example.com" target="_blank" rel="noopener">https://example.com</a>'
 */

export function linkifyUrls(html: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+)/gi;
  return html.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}