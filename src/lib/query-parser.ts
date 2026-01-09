/**
 * Parsed query result containing search term and arguments.
 */
export interface ParsedQuery {
  /** The search term (may include quotes if label contains spaces) */
  searchTerm: string;
  /** The raw arguments string after the search term */
  args: string;
  /** Whether the query contains a separator after the search term */
  hasSeparator: boolean;
}

/**
 * Parsed arguments result containing both values and display strings.
 */
export interface ParsedArgs {
  /** Unquoted argument values */
  values: string[];
  /** Display strings (preserves quotes for visual alignment) */
  display: string[];
}

/**
 * Handles parsing of gigamenu query input.
 * Supports quoted strings for labels/values containing spaces.
 */
export class QueryParser {
  constructor(private readonly separator: string = ' ') {}

  /**
   * Parse a query string into search term and arguments.
   * Simple split on first separator - no quote handling.
   */
  parseQuery(query: string): ParsedQuery {
    const sepIndex = query.indexOf(this.separator);
    if (sepIndex === -1) {
      return { searchTerm: query, args: '', hasSeparator: false };
    }
    return {
      searchTerm: query.substring(0, sepIndex),
      args: query.substring(sepIndex + this.separator.length),
      hasSeparator: true,
    };
  }

  /**
   * Parse an arguments string into an array.
   * Simple space-based splitting - quotes are ignored.
   */
  parseArgs(args: string): ParsedArgs {
    if (!args) {
      return { values: [], display: [] };
    }

    // Simple split on spaces, filter out empty strings
    const parts = args.split(' ').filter(part => part.length > 0);
    return { values: parts, display: parts };
  }

  /**
   * Strip quotes from a string if it's quoted (legacy, kept for compatibility).
   */
  stripQuotes(str: string): string {
    if ((str.startsWith("'") && str.endsWith("'")) ||
        (str.startsWith('"') && str.endsWith('"'))) {
      return str.slice(1, -1);
    }
    return str;
  }

  /**
   * Return the string as-is (no escaping needed).
   */
  escapeIfNeeded(str: string): string {
    return str;
  }

  /**
   * Check if a search term matches a label (case-insensitive).
   */
  matchesLabel(searchTerm: string, label: string): boolean {
    const trimmed = searchTerm.trim().toLowerCase();
    return trimmed === label.toLowerCase();
  }

  /**
   * Build a query string from search term and args.
   */
  buildQuery(searchTerm: string, args: string[]): string {
    if (args.length === 0) {
      return searchTerm;
    }
    return searchTerm + this.separator + args.join(' ');
  }
}
