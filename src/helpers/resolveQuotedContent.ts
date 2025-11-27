/**
 * Resolve quoted nostr references in text to readable content
 * Single purpose: Replace nostr:event/note/nevent references with truncated note content
 *
 * @param text - Raw text content containing nostr references
 * @returns Processed text with references replaced by note content
 *
 * @example
 * resolveQuotedContent("Check this out! nostr:nevent1...")
 * // => "Check this out! [This is the first line of the quoted note...]"
 */

import { extractQuotedReferences } from './extractQuotedReferences';
import { truncateNoteContent } from './truncateNoteContent';
import { QuoteOrchestrator } from '../services/orchestration/QuoteOrchestrator';

export async function resolveQuotedContent(text: string): Promise<string> {
  if (!text || text.trim() === '') {
    return text;
  }

  // Extract all quoted references
  const quotedRefs = extractQuotedReferences(text);

  if (quotedRefs.length === 0) {
    return text;
  }

  const quoteOrch = QuoteOrchestrator.getInstance();
  let processedText = text;

  // Fetch and replace each reference
  for (const ref of quotedRefs) {
    try {
      const quotedEvent = await quoteOrch.fetchQuotedEvent(ref.id);

      if (quotedEvent && quotedEvent.content) {
        // Truncate the quoted content to first line (max 80 chars)
        const truncated = truncateNoteContent(quotedEvent.content, 80);
        // Replace the nostr reference with the truncated content (with line break before)
        processedText = processedText.replace(ref.fullMatch, `\n[${truncated}]`);
      } else {
        // If event not found, replace with placeholder
        processedText = processedText.replace(ref.fullMatch, '\n[Quoted note]');
      }
    } catch (error) {
      console.warn('Failed to fetch quoted event:', ref.id, error);
      // On error, replace with placeholder
      processedText = processedText.replace(ref.fullMatch, '[Quoted note]');
    }
  }

  return processedText;
}
