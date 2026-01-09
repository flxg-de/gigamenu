import { AutocompleteOption, ParamProvider } from '../types';
import { QueryParser } from '../query-parser';

/**
 * Result from fetching autocomplete suggestions.
 */
export interface FetchResult {
  options: AutocompleteOption[];
  isAsync: boolean;
}

/**
 * Fetch autocomplete suggestions from a provider.
 */
export async function fetchAutocompleteSuggestions(
  provider: ParamProvider,
  query: string,
  cache: Map<string, AutocompleteOption[]>
): Promise<FetchResult> {
  // Handle static array provider
  if (Array.isArray(provider)) {
    const cacheKey = `${JSON.stringify(provider)}-${query}`;
    if (cache.has(cacheKey)) {
      return { options: cache.get(cacheKey)!, isAsync: false };
    }
    cache.set(cacheKey, provider);
    return { options: provider, isAsync: false };
  }

  // Handle async function provider (server-side filtering)
  const result = await Promise.resolve(provider(query));
  return { options: result, isAsync: true };
}

/**
 * Filter suggestions client-side based on query.
 */
export function filterSuggestionsClientSide(
  options: AutocompleteOption[],
  query: string
): AutocompleteOption[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return options;
  return options.filter((opt) => opt.label.toLowerCase().includes(lowerQuery));
}

/**
 * Compute typeahead ghost text suggestion.
 * Returns the portion of the label that extends beyond the typed text.
 */
export function computeTypeaheadSuggestion(
  suggestions: AutocompleteOption[],
  selectedIndex: number,
  paramValue: string
): string | null {
  if (suggestions.length === 0) return null;

  const suggestion = suggestions[selectedIndex] ?? suggestions[0];
  if (!suggestion) return null;

  // Return portion of label that extends beyond typed text (case-insensitive prefix match)
  const suggestionLabel = suggestion.label;
  if (suggestionLabel.toLowerCase().startsWith(paramValue.toLowerCase())) {
    return suggestionLabel.slice(paramValue.length);
  }
  return null;
}

/**
 * Context for building a query with a selected autocomplete option.
 */
export interface SelectionContext {
  searchTerm: string;
  separator: string;
  argsArray: string[];
  paramIndex: number | null;
  queryParser: QueryParser;
}

/**
 * Build the new query string after selecting an autocomplete option.
 */
export function buildQueryWithSelection(
  ctx: SelectionContext,
  option: AutocompleteOption,
  addTrailingSpace: boolean
): string {
  if (ctx.paramIndex === null) return ctx.searchTerm;

  // Quote labels that contain spaces
  const escapedLabel = ctx.queryParser.escapeIfNeeded(option.label);

  // Replace current param with the selected option's label
  const newArgs = [...ctx.argsArray];
  newArgs[ctx.paramIndex] = escapedLabel;

  // Build new query with or without trailing space
  const baseQuery = ctx.searchTerm + ctx.separator + newArgs.join(' ');
  return addTrailingSpace ? baseQuery + ' ' : baseQuery;
}

/**
 * Result from selecting an autocomplete suggestion.
 */
export interface SelectionResult {
  newQuery: string;
  selectedOption: AutocompleteOption;
  paramIndex: number;
}

/**
 * Process autocomplete suggestion selection.
 * Returns the new query and the selected option for tracking.
 */
export function processAutocompleteSuggestionSelection(
  suggestions: AutocompleteOption[],
  selectedIdx: number,
  ctx: SelectionContext,
  addTrailingSpace: boolean
): SelectionResult | null {
  const option = suggestions[selectedIdx];
  if (!option || ctx.paramIndex === null) return null;

  const newQuery = buildQueryWithSelection(ctx, option, addTrailingSpace);

  return {
    newQuery,
    selectedOption: option,
    paramIndex: ctx.paramIndex,
  };
}

/**
 * Result from selecting and cycling to next suggestion.
 */
export interface CycleResult extends SelectionResult {
  nextIndex: number;
}

/**
 * Process autocomplete suggestion selection with cycling to next.
 * zsh-style: select current and prepare for next Tab press.
 */
export function processAutocompleteSuggestionAndCycle(
  suggestions: AutocompleteOption[],
  currentIdx: number,
  ctx: SelectionContext
): CycleResult | null {
  if (suggestions.length === 0) return null;

  const option = suggestions[currentIdx];
  if (!option || ctx.paramIndex === null) return null;

  // Don't add trailing space - keep cursor position for cycling
  const newQuery = buildQueryWithSelection(ctx, option, false);

  // Cycle to next suggestion
  const nextIdx = (currentIdx + 1) % suggestions.length;

  return {
    newQuery,
    selectedOption: option,
    paramIndex: ctx.paramIndex,
    nextIndex: nextIdx,
  };
}
