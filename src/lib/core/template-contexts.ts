import { GigamenuItem, PARAM_COLORS } from '../types';
import {
  GigamenuItemContext,
  GigamenuEmptyContext,
  GigamenuFooterContext,
} from '../gigamenu-templates.directive';

/**
 * Get color class for a parameter index.
 */
export function getParamColor(index: number): string {
  return PARAM_COLORS[index % PARAM_COLORS.length];
}

/**
 * Create context for item template.
 */
export function createItemContext(
  item: GigamenuItem,
  index: number,
  selectedIndex: number
): GigamenuItemContext {
  return {
    $implicit: item,
    index,
    selected: selectedIndex === index,
  };
}

/**
 * Create context for empty state template.
 */
export function createEmptyContext(query: string): GigamenuEmptyContext {
  return {
    $implicit: query,
  };
}

/**
 * Create context for footer template.
 */
export function createFooterContext(
  filteredCount: number,
  totalCount: number
): GigamenuFooterContext {
  return {
    $implicit: filteredCount,
    total: totalCount,
  };
}
