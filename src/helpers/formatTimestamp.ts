/**
 * Format timestamp to human readable format
 * Unified function supporting both compact and verbose modes
 *
 * @param timestamp - Unix timestamp in seconds
 * @param mode - Format mode: 'compact' (default) or 'verbose'
 * @returns Formatted time string
 *
 * @example
 * formatTimestamp(Date.now() / 1000 - 120)
 * // => "2m" (compact mode)
 *
 * formatTimestamp(Date.now() / 1000 - 7200, 'verbose')
 * // => "2 hours ago" (verbose mode)
 */

export function formatTimestamp(timestamp: number, mode: 'compact' | 'verbose' = 'compact'): string {
  if (!timestamp) return '';

  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (mode === 'verbose') {
    // Verbose mode: "X minutes ago", "X hours ago", etc.
    if (diff < 60) {
      return 'just now';
    } else if (diff < 3600) {
      const minutes = Math.floor(diff / 60);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (diff < 2592000) {
      const days = Math.floor(diff / 86400);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    } else {
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  } else {
    // Compact mode: "now", "5m", "14:35", "Sep 23"
    if (diff < 3600) {
      // Less than 1 hour - show relative time
      const minutes = Math.floor(diff / 60);
      return minutes <= 1 ? 'now' : `${minutes}m`;
    } else {
      // More than 1 hour - show absolute time
      const date = new Date(timestamp * 1000);
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();

      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
  }
}