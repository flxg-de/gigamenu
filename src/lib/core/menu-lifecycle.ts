import { GigamenuItem, AutocompleteOption } from '../types';
import { QueryParser } from '../query-parser';

/**
 * Initial state for menu reset.
 */
export interface MenuResetState {
  query: string;
  selectedIndex: number;
  showAutocomplete: boolean;
  autocompleteSelectedIndex: number;
  selectedParamOptions: Map<number, AutocompleteOption>;
}

/**
 * Get the initial/reset state for the menu.
 */
export function getInitialMenuState(): MenuResetState {
  return {
    query: '',
    selectedIndex: 0,
    showAutocomplete: false,
    autocompleteSelectedIndex: 0,
    selectedParamOptions: new Map(),
  };
}

/**
 * Check if an input element is currently focused.
 */
export function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    (activeElement as HTMLElement).isContentEditable
  );
}

/**
 * Check if the current search term matches the selected item's label.
 */
export function isSearchTermMatchingItem(
  searchTerm: string,
  itemLabel: string,
  queryParser: QueryParser
): boolean {
  return queryParser.matchesLabel(searchTerm, itemLabel);
}

/**
 * Complete the selected item's label in the search input.
 * Returns the new query string.
 */
export function completeItemLabel(
  item: GigamenuItem,
  separator: string,
  queryParser: QueryParser
): string {
  const escapedLabel = queryParser.escapeIfNeeded(item.label);
  const hasParams = item.params && item.params.length > 0;
  return hasParams ? escapedLabel + separator : escapedLabel;
}
