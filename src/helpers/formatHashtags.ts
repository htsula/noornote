/**
 * Format hashtags as clickable elements
 * Single purpose: HTML + hashtags[] → HTML with formatted hashtags
 *
 * @param html - HTML content
 * @param hashtags - Array of hashtag strings (without # prefix)
 * @returns HTML with hashtags wrapped in styled spans
 *
 * @example
 * formatHashtags("Hello #nostr world", ['nostr'])
 * // => 'Hello <span class="hashtag" data-tag="nostr">#nostr</span> world'
 */

export function formatHashtags(html: string, hashtags: string[]): string {
  hashtags.forEach(tag => {
    html = html.replace(
      new RegExp(`#${tag}`, 'g'),
      `<span class="hashtag" data-tag="${tag}">#${tag}</span>`
    );
  });
  return html;
}