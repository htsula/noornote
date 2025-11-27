/**
 * Extract quoted nostr references from text content
 * Single purpose: text → QuotedReference[]
 * Handles: nostr:event, nostr:note, nostr:nevent, nostr:addr
 *
 * @param text - Raw text content to extract quoted references from
 * @returns Array of QuotedReference objects
 *
 * @example
 * extractQuotedReferences("See nostr:note1abc...")
 * // => [{ type: 'note', id: 'nostr:note1abc...', fullMatch: 'nostr:note1abc...' }]
 */

export interface QuotedReference {
  type: string;
  id: string;
  fullMatch: string;
}

export function extractQuotedReferences(text: string): QuotedReference[] {
  const quotes: QuotedReference[] = [];

  // Single regex to catch all nostr references (event, note, nevent, naddr)
  const nostrRegex = /nostr:(event1[a-z0-9]{58}|note1[a-z0-9]{58}|nevent1[a-z0-9]+|naddr[a-z0-9]+)/gi;
  const matches = text.match(nostrRegex) || [];

  matches.forEach(match => {
    // Determine type from the match
    let type = 'unknown';
    if (match.includes('event1')) type = 'event';
    else if (match.includes('note1')) type = 'note';
    else if (match.includes('nevent1')) type = 'nevent';
    else if (match.includes('naddr')) type = 'addr';

    quotes.push({
      type,
      id: match, // Keep full reference for fetching
      fullMatch: match
    });
  });

  return quotes;
}