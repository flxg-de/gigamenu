import { GigamenuItem } from '../types';
import { QueryParser } from '../query-parser';

/**
 * Filter items based on search query.
 */
export function filterItems(
  items: GigamenuItem[],
  searchTerm: string,
  queryParser: QueryParser
): GigamenuItem[] {
  const normalizedTerm = searchTerm.toLowerCase().trim();
  if (!normalizedTerm) {
    return items;
  }

  return items.filter((item) => matchesQuery(item, normalizedTerm, queryParser));
}

/**
 * Check if an item matches the search query.
 * Uses word-based matching across label, description, and keywords.
 */
export function matchesQuery(
  item: GigamenuItem,
  query: string,
  _queryParser: QueryParser
): boolean {
  const searchableText = [
    item.label,
    item.description,
    ...(item.keywords ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const words = query.split(/\s+/);
  return words.every((word) => searchableText.includes(word));
}

/**
 * Sort items by frecency scores (frequency + recency).
 */
export function sortByFrecency(
  items: GigamenuItem[],
  scores: Map<string, number>
): GigamenuItem[] {
  if (scores.size === 0) return items;

  return [...items].sort((a, b) => {
    const scoreA = scores.get(a.id) ?? 0;
    const scoreB = scores.get(b.id) ?? 0;
    return scoreB - scoreA;
  });
}

/**
 * Build searchable text from an item for matching.
 */
export function buildSearchableText(item: GigamenuItem): string {
  return [item.label, item.description, ...(item.keywords ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
