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
   * Handles quoted search terms (e.g., "'User Profile' param1 param2").
   */
  parseQuery(query: string): ParsedQuery {
    // Check if query starts with a quote
    if (query.startsWith("'") || query.startsWith('"')) {
      const quoteChar = query[0];
      const closingQuoteIndex = query.indexOf(quoteChar, 1);

      if (closingQuoteIndex !== -1) {
        // Found closing quote - search term is the quoted string (including quotes)
        const searchTerm = query.substring(0, closingQuoteIndex + 1);
        const afterQuote = query.substring(closingQuoteIndex + 1);

        // Args start after the separator following the closing quote
        if (afterQuote.startsWith(this.separator)) {
          return {
            searchTerm,
            args: afterQuote.substring(this.separator.length),
            hasSeparator: true,
          };
        }
        // No separator yet after closing quote
        return { searchTerm, args: '', hasSeparator: false };
      }
      // No closing quote yet - entire query is the search term (still typing)
      return { searchTerm: query, args: '', hasSeparator: false };
    }

    // Not quoted - split on first separator
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
   * Parse an arguments string into an array, handling quoted values.
   * Returns both unquoted values and display strings (with quotes preserved).
   */
  parseArgs(args: string): ParsedArgs {
    if (!args) {
      return { values: [], display: [] };
    }

    const values: string[] = [];
    const display: string[] = [];
    let currentValue = '';
    let currentDisplay = '';
    let inQuote: string | null = null;

    for (let i = 0; i < args.length; i++) {
      const char = args[i];
      if (!inQuote && (char === '"' || char === "'")) {
        inQuote = char;
        currentDisplay += char;
      } else if (char === inQuote) {
        inQuote = null;
        currentDisplay += char;
      } else if (char === ' ' && !inQuote) {
        if (currentValue) {
          values.push(currentValue);
          display.push(currentDisplay);
          currentValue = '';
          currentDisplay = '';
        }
      } else {
        currentValue += char;
        currentDisplay += char;
      }
    }
    if (currentValue) {
      values.push(currentValue);
      display.push(currentDisplay);
    }
    return { values, display };
  }

  /**
   * Strip quotes from a string if it's quoted.
   */
  stripQuotes(str: string): string {
    if ((str.startsWith("'") && str.endsWith("'")) ||
        (str.startsWith('"') && str.endsWith('"'))) {
      return str.slice(1, -1);
    }
    return str;
  }

  /**
   * Check if a string is quoted.
   */
  isQuoted(str: string): boolean {
    return (str.startsWith("'") && str.endsWith("'")) ||
           (str.startsWith('"') && str.endsWith('"'));
  }

  /**
   * Escape a string with single quotes if it contains spaces.
   */
  escapeIfNeeded(str: string): string {
    return str.includes(' ') ? `'${str}'` : str;
  }

  /**
   * Check if a search term matches a label (handles quoted search terms).
   */
  matchesLabel(searchTerm: string, label: string): boolean {
    const trimmed = searchTerm.trim();

    // Direct match
    if (trimmed === label) return true;

    // Check if search term is quoted and matches the label
    if (this.isQuoted(trimmed)) {
      return this.stripQuotes(trimmed) === label;
    }

    return false;
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
