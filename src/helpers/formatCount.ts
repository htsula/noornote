/**
 * Format Count for Display
 * Converts large numbers to readable format (K, M)
 * Returns empty string for zero
 *
 * @param count - Number to format
 * @returns Formatted string (e.g., "1.5K", "15K", "1.5M")
 *
 * @example
 * formatCount(0)      // ""
 * formatCount(42)     // "42"
 * formatCount(1500)   // "1.5K"
 * formatCount(15000)  // "15K"
 * formatCount(1500000) // "1.5M"
 */

export function formatCount(count: number): string {
  if (count === 0) return '';
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}K`;
  if (count < 1000000) return `${Math.floor(count / 1000)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}
