/**
 * Format quoted references as placeholder elements
 * Single purpose: HTML + QuotedReference[] → HTML with formatted quote placeholders
 *
 * @param html - HTML content
 * @param quotedReferences - Array of QuotedReference objects
 * @returns HTML with references replaced by placeholder divs
 *
 * @example
 * formatQuotedReferences(html, [{ type: 'note', id: 'nostr:note1...', fullMatch: '...' }])
 * // => HTML with <div class="quoted-reference" data-type="note">...</div>
 */

export interface QuotedReference {
  type: 'event' | 'note' | 'addr';
  id: string;
  fullMatch: string;
}

export function formatQuotedReferences(html: string, quotedReferences: QuotedReference[]): string {
  quotedReferences.forEach(ref => {
    // Replace nostr reference with marker span (will be replaced by actual quote box after DOM mount)
    html = html.replace(
      ref.fullMatch,
      `<span class="quote-marker" data-quote-ref="${ref.fullMatch}"></span>`
    );
  });
  return html;
}