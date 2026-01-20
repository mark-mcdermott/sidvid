/**
 * Truncates a title to a target number of words (3-5), adding ellipsis if needed
 * @param title The title to truncate
 * @returns Truncated title with ellipsis if longer than 5 words
 */
export function truncateTitle(title: string): string {
  const words = title.trim().split(/\s+/);

  // If 3 words or less, return as-is
  if (words.length <= 3) {
    return title.trim();
  }

  // If 4 words, return as-is
  if (words.length === 4) {
    return words.join(' ');
  }

  // If 5 words, return as-is
  if (words.length === 5) {
    return words.join(' ');
  }

  // If more than 5 words, take first 5 and add ellipsis
  return words.slice(0, 5).join(' ') + '...';
}
