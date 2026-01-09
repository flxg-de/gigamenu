// Scroll utilities
export { scrollSelectedIntoView, scrollAutocompleteIntoView } from './scroll-utils';

// Search functions
export { filterItems, matchesQuery, sortByFrecency, buildSearchableText } from './search';

// Parameter state functions
export {
  computeCurrentParamIndex,
  computeCurrentParamName,
  computeCurrentParamValue,
  computeCanExecute,
  computeCompletedArgsDisplay,
  computeArgsValues,
  computeHasAutocomplete,
} from './parameter-state';

// Template context functions
export {
  getParamColor,
  createItemContext,
  createEmptyContext,
  createFooterContext,
} from './template-contexts';

// Menu lifecycle functions
export {
  getInitialMenuState,
  isInputFocused,
  isSearchTermMatchingItem,
  completeItemLabel,
} from './menu-lifecycle';
export type { MenuResetState } from './menu-lifecycle';

// Autocomplete functions
export {
  fetchAutocompleteSuggestions,
  filterSuggestionsClientSide,
  computeTypeaheadSuggestion,
  buildQueryWithSelection,
  processAutocompleteSuggestionSelection,
  processAutocompleteSuggestionAndCycle,
} from './autocomplete';
export type { FetchResult, SelectionContext, SelectionResult, CycleResult } from './autocomplete';

// Keyboard handler functions
export {
  handleGlobalKeydown,
  handleZshShortcuts,
  deleteLastWord,
  handleActionSelectionKeydown,
  handleParameterInputKeydown,
  hasActions,
} from './keyboard-handlers';
export type {
  MenuAction,
  GlobalKeydownContext,
  ActionSelectionContext,
  ParameterInputContext,
} from './keyboard-handlers';
