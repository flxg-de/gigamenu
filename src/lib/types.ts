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
}

/** Colors for parameter highlighting */
export const PARAM_COLORS = [
  'text-blue-500 dark:text-blue-400',
  'text-green-500 dark:text-green-400',
  'text-orange-500 dark:text-orange-400',
  'text-pink-500 dark:text-pink-400',
  'text-cyan-500 dark:text-cyan-400',
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
}

export const DEFAULT_CONFIG: GigamenuConfig = {
  placeholder: 'Search pages and commands...',
  maxResults: 10,
  autoDiscoverRoutes: true,
  argSeparator: ' ',
  darkModeClass: 'dark',
  autocompleteTabBehavior: 'cycle',
  autocompleteDismiss: 'on-type',
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
