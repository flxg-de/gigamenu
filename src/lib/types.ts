export type GigamenuItemCategory = 'page' | 'command';

/**
 * Autocomplete option for parameter suggestions.
 * label: Display text shown in the autocomplete dropdown
 * value: Actual value that gets passed to the action
 */
export interface AutocompleteOption {
  label: string;
  value: string;
}

/**
 * Provider for autocomplete suggestions.
 * Can be either a static array of options or an async function that returns options.
 */
export type ParamProvider =
  | AutocompleteOption[]
  | ((query: string) => Promise<AutocompleteOption[]> | AutocompleteOption[]);

export interface GigamenuItem {
  id: string;
  label: string;
  description?: string;
  /** Emoji or text icon */
  icon?: string;
  /** CSS class for icon libraries (e.g., 'pi pi-home', 'fa fa-home') */
  iconClass?: string;
  keywords?: string[];
  category: GigamenuItemCategory;
  /** Action to execute. Receives args string if user typed text after the separator. */
  action: (args?: string) => void;
  /** Required parameter names for this item (e.g., ['id', 'commentId']) */
  params?: string[];
  /**
   * Autocomplete providers for parameters.
   * Key: parameter name (must match a name in params array)
   * Value: ParamProvider (static array or async function)
   */
  paramProviders?: Record<string, ParamProvider>;
  /**
   * Optional section/group label. Items supplied by dynamic providers typically
   * set this so the UI can render them under a heading (e.g. "Recipes").
   */
  group?: string;
  /** Provider id when produced by a dynamic provider. Set automatically. */
  providerId?: string;
}

/**
 * A dynamic provider returns items that depend on the current query, e.g. results
 * fetched from a server. Returned items skip the built-in fuzzy filter.
 */
export type GigamenuProvider = (
  query: string
) => Promise<GigamenuProviderItem[]> | GigamenuProviderItem[];

/**
 * Items returned from a provider. Same shape as GigamenuItem but `category` is
 * optional — it defaults to 'command'. Providers typically omit it.
 */
export type GigamenuProviderItem = Omit<GigamenuItem, 'category'> & {
  category?: GigamenuItemCategory;
};

export interface GigamenuProviderOptions {
  /** Minimum query length before the provider is invoked. Default: 2. */
  minQueryLength?: number;
  /** Debounce window in ms before invoking the provider. Default: 200. */
  debounceMs?: number;
  /** Optional group label applied to all items from this provider. */
  group?: string;
}

/** Colors for parameter highlighting (themeable via --gm-param-1 ... --gm-param-5) */
export const PARAM_COLORS = [
  'text-(color:--_gm-param-1)',
  'text-(color:--_gm-param-2)',
  'text-(color:--_gm-param-3)',
  'text-(color:--_gm-param-4)',
  'text-(color:--_gm-param-5)',
] as const;

export interface GigamenuPage extends Omit<GigamenuItem, 'category' | 'action'> {
  path: string;
}

export interface GigamenuCommand extends Omit<GigamenuItem, 'category'> {
  shortcut?: string;
}

export interface GigamenuConfig {
  placeholder?: string;
  maxResults?: number;
  autoDiscoverRoutes?: boolean;
  /** Separator between search query and arguments (default: ' ') */
  argSeparator?: string;
  /** CSS class name for dark mode (default: 'dark') */
  darkModeClass?: string;
  /** Tab behavior for autocomplete: 'cycle' always cycles, 'accept-first' accepts on first tab (default: 'cycle') */
  autocompleteTabBehavior?: 'cycle' | 'accept-first';
  /** When to dismiss autocomplete overlay: 'on-type' hides on any keystroke, 'manual' only on Escape/selection (default: 'on-type') */
  autocompleteDismiss?: 'on-type' | 'manual';
  /** Reset query, selection, locked action and parameters whenever the menu closes (default: true) */
  resetOnClose?: boolean;
  /** Rank results by usage (frecency) and persist it to localStorage (default: true) */
  frecency?: boolean;
  /** Show the footer with key hints and branding (default: true) */
  showFooter?: boolean;
  /** Show the category tag ("page" / "command") on each item (default: true) */
  showCategoryTags?: boolean;
  /** Override built-in texts. Unset keys keep their defaults. */
  labels?: GigamenuLabels;
}

export interface GigamenuLabels {
  /** Fallback icon badge for items without icon, pages (default: 'P') */
  pageBadge?: string;
  /** Fallback icon badge for items without icon, commands (default: 'C') */
  commandBadge?: string;
  /** Category tag of pages (default: 'page') */
  pageTag?: string;
  /** Category tag of commands (default: 'command') */
  commandTag?: string;
  /** Hint shown next to items with parameter autocomplete (default: 'Tab') */
  paramHint?: string;
  /** Branding text at the right of the footer; empty string hides it (default: 'gigamenu') */
  footerBrand?: string;
  /** Empty state text (default: 'No results found') */
  noResults?: string;
  /** Footer key hints */
  navigate?: string;
  params?: string;
  next?: string;
  select?: string;
  execute?: string;
}

export const DEFAULT_LABELS: Required<GigamenuLabels> = {
  pageBadge: 'P',
  commandBadge: 'C',
  pageTag: 'page',
  commandTag: 'command',
  paramHint: 'Tab',
  footerBrand: 'gigamenu',
  noResults: 'No results found',
  navigate: 'navigate',
  params: 'params',
  next: 'next',
  select: 'select',
  execute: 'execute',
};

export const DEFAULT_CONFIG: GigamenuConfig = {
  placeholder: 'Search pages and commands...',
  maxResults: 10,
  autoDiscoverRoutes: true,
  argSeparator: ' ',
  darkModeClass: 'dark',
  autocompleteTabBehavior: 'cycle',
  autocompleteDismiss: 'on-type',
  resetOnClose: true,
  frecency: true,
  showFooter: true,
  showCategoryTags: true,
};

/**
 * Base interface for defining a command in a separate file.
 * Each command file should export a constant implementing this interface.
 */
export interface CommandDefinition {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: string;
  readonly iconClass?: string;
  readonly keywords?: string[];
  readonly shortcut?: string;
  execute(): void;
}

/**
 * Helper function to define a command with type safety.
 */
export function defineCommand(command: CommandDefinition): CommandDefinition {
  return command;
}

/**
 * Information about a route passed to the filter function.
 */
export interface RouteInfo {
  path: string;
  fullPath: string;
  data?: Record<string, unknown>;
  title?: string;
}

/**
 * Filter function to include/exclude routes from discovery.
 * Return true to include the route, false to exclude it.
 */
export type RouteFilter = (route: RouteInfo) => boolean;

/**
 * Mapped page data returned from the map function.
 */
export interface MappedPage {
  label?: string;
  description?: string;
  icon?: string;
  iconClass?: string;
  keywords?: string[];
}

/**
 * Map function to customize page data for discovered routes.
 * Return partial page data to override defaults, or null to skip the route.
 */
export type RouteMapper = (route: RouteInfo) => MappedPage | null;

/**
 * Options for route discovery.
 */
export interface DiscoverRoutesOptions {
  filter?: RouteFilter;
  map?: RouteMapper;
}
