/**
 * Represents the different states of the gigamenu input.
 */
export enum InputState {
  /** Menu is closed */
  Closed = 'closed',

  /** User is typing a search term (no separator, or inside quoted string) */
  Searching = 'searching',

  /** User is typing a parameter value (search term matches item) */
  ParameterInput = 'parameterInput',

  /** Autocomplete overlay is open, user is navigating suggestions */
  ParameterSelection = 'parameterSelection',
}

/**
 * Result of handling a keyboard event.
 */
export interface KeyboardHandlerResult {
  /** Whether the event was handled (should prevent default) */
  handled: boolean;

  /** Optional new state to transition to */
  newState?: InputState;
}

/**
 * Context provided to keyboard handlers.
 */
export interface KeyboardHandlerContext {
  /** The keyboard event */
  event: KeyboardEvent;

  /** Current query string */
  query: string;

  /** Parsed search term */
  searchTerm: string;

  /** Whether there's a separator in the query */
  hasSeparator: boolean;

  /** Currently selected menu item */
  selectedItem: { label: string; params?: string[]; paramProviders?: Record<string, unknown> } | null;

  /** Number of filtered items */
  itemCount: number;

  /** Current selected index in the menu */
  selectedIndex: number;

  /** Autocomplete suggestions */
  suggestions: { label: string; value: string }[];

  /** Currently selected suggestion index */
  suggestionIndex: number;

  /** Whether typeahead ghost text is available */
  hasTypeahead: boolean;

  /** Tab behavior config */
  tabBehavior: 'cycle' | 'accept-first';

  /** Separator character */
  separator: string;
}

/**
 * Actions that can be dispatched from keyboard handlers.
 */
export type KeyboardAction =
  | { type: 'navigate'; direction: 'up' | 'down' }
  | { type: 'navigateSuggestion'; direction: 'up' | 'down' }
  | { type: 'selectItem' }
  | { type: 'selectSuggestion' }
  | { type: 'completeItemLabel' }
  | { type: 'showAutocomplete' }
  | { type: 'hideAutocomplete' }
  | { type: 'close' }
  | { type: 'setQuery'; query: string };
