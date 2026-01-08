import {
  Component,
  signal,
  computed,
  effect,
  ElementRef,
  viewChild,
  contentChild,
  HostListener,
  PLATFORM_ID,
  Inject,
  TemplateRef,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { GigamenuService } from './gigamenu.service';
import { FrecencyService } from './frecency.service';
import { GigamenuItem, PARAM_COLORS, AutocompleteOption, ParamProvider } from './types';
import {
  GigamenuItemTemplate,
  GigamenuEmptyTemplate,
  GigamenuHeaderTemplate,
  GigamenuFooterTemplate,
  GigamenuPanelTemplate,
  GigamenuItemContext,
  GigamenuEmptyContext,
  GigamenuHeaderContext,
  GigamenuFooterContext,
  GigamenuPanelContext,
} from './gigamenu-templates.directive';
import { QueryParser } from './query-parser';
import { InputState } from './input-state';

@Component({
  selector: 'gm-gigamenu',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: 'gigamenu.component.html',
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class GigamenuComponent {
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly listContainer = viewChild<ElementRef<HTMLDivElement>>('listContainer');
  private readonly isBrowser: boolean;

  // Template queries
  protected readonly itemTemplate = contentChild(GigamenuItemTemplate);
  protected readonly emptyTemplate = contentChild(GigamenuEmptyTemplate);
  protected readonly headerTemplate = contentChild(GigamenuHeaderTemplate);
  protected readonly footerTemplate = contentChild(GigamenuFooterTemplate);
  protected readonly panelTemplate = contentChild(GigamenuPanelTemplate);

  protected readonly query = signal('');
  protected readonly selectedIndex = signal(0);

  // Autocomplete state
  protected readonly autocompleteSuggestions = signal<AutocompleteOption[]>([]);
  protected readonly autocompleteSelectedIndex = signal(0);
  protected readonly showAutocomplete = signal(false);
  private autocompleteCache = new Map<string, AutocompleteOption[]>();

  // Track selected autocomplete options: maps param index to {label, value}
  // This allows displaying labels in the search bar while remembering values for execution
  private readonly selectedParamOptions = signal<Map<number, AutocompleteOption>>(new Map());

  private readonly autocompleteContainer = viewChild<ElementRef<HTMLDivElement>>('autocompleteContainer');

  /** Query parser instance (recreated when separator changes) */
  private readonly queryParser = computed(() => {
    const separator = this.service.config().argSeparator ?? ' ';
    return new QueryParser(separator);
  });

  /** Parsed query (search term, args, hasSeparator) */
  private readonly parsedQuery = computed(() => {
    return this.queryParser().parseQuery(this.query());
  });

  /** Parsed search term (before first separator, handles quoted strings) */
  protected readonly searchTerm = computed(() => this.parsedQuery().searchTerm);

  /** Parsed arguments (after first separator) */
  protected readonly args = computed(() => this.parsedQuery().args);

  /** Whether the query contains a separator (for display purposes) */
  protected readonly hasSeparator = computed(() => this.parsedQuery().hasSeparator);

  /** Parsed args into array (values and display strings) */
  private readonly parsedArgs = computed(() => {
    return this.queryParser().parseArgs(this.args());
  });

  /** Parsed arguments as array (raw from input - may contain labels, quotes stripped) */
  protected readonly argsArray = computed(() => this.parsedArgs().values);

  /** Parsed arguments for display (preserves quotes for visual alignment) */
  protected readonly argsArrayDisplay = computed(() => this.parsedArgs().display);

  /** Get actual values for args (substituting labels with values from selected options) */
  protected readonly argsValues = computed(() => {
    const args = this.argsArray();
    const selectedOptions = this.selectedParamOptions();
    return args.map((arg, index) => {
      const option = selectedOptions.get(index);
      // If we have a selected option for this param and the current arg matches its label, use the value
      if (option && arg === option.label) {
        return option.value;
      }
      return arg;
    });
  });

  /** Currently selected item */
  protected readonly selectedItem = computed(() => {
    const items = this.filteredItems();
    const index = this.selectedIndex();
    return items[index] ?? null;
  });

  /** Whether the selected item can be executed (has all required params) */
  protected readonly canExecute = computed(() => {
    const item = this.selectedItem();
    if (!item) return false;
    if (!item.params || item.params.length === 0) return true;
    return this.argsArray().length >= item.params.length;
  });

  /** Current parameter being edited (index into params array) */
  protected readonly currentParamIndex = computed(() => {
    const item = this.selectedItem();
    if (!item || !item.params || item.params.length === 0) return null;

    const args = this.args();
    const argsCount = this.argsArray().length;
    const endsWithSpace = args.endsWith(' ');

    // If user is still typing a param (no trailing space) and has typed at least one arg
    if (!endsWithSpace && argsCount > 0 && argsCount <= item.params.length) {
      return argsCount - 1; // Currently editing the last typed arg
    }

    // If we have fewer args than params, we're about to type the next param
    if (argsCount < item.params.length) return argsCount;

    // All params complete (with trailing space confirming completion)
    return null;
  });

  /** Current parameter name being edited */
  protected readonly currentParamName = computed(() => {
    const item = this.selectedItem();
    const paramIndex = this.currentParamIndex();
    if (paramIndex === null || !item || !item.params) return null;
    return item.params[paramIndex] ?? null;
  });

  /** Current partial value of the parameter being edited */
  protected readonly currentParamValue = computed(() => {
    const args = this.args().trim();
    if (!args) return '';
    const argsArray = this.argsArray();
    const paramIndex = this.currentParamIndex();
    if (paramIndex === null) return '';

    // Check if we're currently typing (args ends with non-whitespace)
    const endsWithSpace = args.endsWith(' ');

    // If we're on the last arg and still typing
    if (!endsWithSpace && argsArray.length === paramIndex + 1) {
      return argsArray[paramIndex] ?? '';
    }

    // If we're starting a new arg (after a space)
    if (endsWithSpace || argsArray.length === paramIndex) {
      return '';
    }

    return '';
  });

  /** Check if selected item has autocomplete available for current param */
  protected readonly hasAutocomplete = computed(() => {
    const item = this.selectedItem();
    const paramName = this.currentParamName();
    if (!item || !paramName) return false;
    return !!(item.paramProviders?.[paramName]);
  });

  /** Typeahead ghost text - shows remaining portion of best matching suggestion (only in parameter mode) */
  protected readonly typeaheadSuggestion = computed(() => {
    const item = this.selectedItem();
    if (!item) return null;

    // Only show typeahead when in parameter mode (search term matches item label)
    if (!this.isSearchTermMatchingItem(item)) return null;

    const suggestions = this.autocompleteSuggestions();
    const selectedIdx = this.autocompleteSelectedIndex();
    const paramValue = this.currentParamValue();

    if (suggestions.length === 0) return null;

    const suggestion = suggestions[selectedIdx] ?? suggestions[0];
    if (!suggestion) return null;

    // Return portion of label that extends beyond typed text (case-insensitive prefix match)
    const suggestionLabel = suggestion.label;
    if (suggestionLabel.toLowerCase().startsWith(paramValue.toLowerCase())) {
      return suggestionLabel.slice(paramValue.length);
    }
    return null;
  });

  /** Current input state based on menu/query/autocomplete status */
  protected readonly currentState = computed((): InputState => {
    // Check if menu is open
    if (!this.service.isOpen()) {
      return InputState.Closed;
    }

    // Check if autocomplete overlay is showing
    if (this.showAutocomplete() && this.autocompleteSuggestions().length > 0) {
      return InputState.ParameterSelection;
    }

    // Check if we're in parameter input mode (search term matches selected item)
    const item = this.selectedItem();
    if (item && this.isSearchTermMatchingItem(item)) {
      return InputState.ParameterInput;
    }

    // Default: searching
    return InputState.Searching;
  });

  /** Get color class for a parameter index */
  protected getParamColor(index: number): string {
    return PARAM_COLORS[index % PARAM_COLORS.length];
  }

  protected readonly filteredItems = computed(() => {
    const searchTerm = this.searchTerm().toLowerCase().trim();
    const items = this.service.items();
    const maxResults = this.service.config().maxResults ?? 10;

    if (!searchTerm) {
      // No query: sort by frecency scores from empty searches
      const scores = this.frecency.getScores('');
      return this.sortByFrecency(items, scores).slice(0, maxResults);
    }

    // Filter matching items using only search term (not args)
    const matched = items.filter((item) => this.matchesQuery(item, searchTerm));

    // Sort by frecency for this search term
    const scores = this.frecency.getScores(searchTerm);
    return this.sortByFrecency(matched, scores).slice(0, maxResults);
  });

  constructor(
    protected readonly service: GigamenuService,
    private readonly frecency: FrecencyService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    effect(() => {
      if (this.service.isOpen() && this.isBrowser) {
        setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
      }
    });

    effect(() => {
      const items = this.filteredItems();
      const searchTerm = this.searchTerm();

      // Check for auto-select based on frecency
      if (searchTerm && items.length > 0) {
        const topMatch = this.frecency.getTopMatch(searchTerm);
        if (topMatch) {
          const idx = items.findIndex((item) => item.id === topMatch);
          if (idx !== -1) {
            this.selectedIndex.set(idx);
            return;
          }
        }
      }

      this.selectedIndex.set(0);
    });

    // Effect to update autocomplete suggestions when parameter changes
    effect(() => {
      const item = this.selectedItem();
      const paramIndex = this.currentParamIndex();
      const paramName = this.currentParamName();
      const paramValue = this.currentParamValue();
      const isOverlayShowing = this.showAutocomplete();

      // Hide autocomplete if no param is being edited
      if (paramIndex === null || !paramName || !item) {
        this.autocompleteSuggestions.set([]);
        return;
      }

      // Check if item has a provider for this parameter
      const provider = item.paramProviders?.[paramName];
      if (!provider) {
        this.autocompleteSuggestions.set([]);
        return;
      }

      // When overlay is showing (Tab-cycling mode), don't re-filter suggestions
      // This allows zsh-style cycling through all options
      if (isOverlayShowing) {
        return;
      }

      // Fetch suggestions (but don't auto-show - Tab triggers that)
      this.fetchAutocompleteSuggestions(provider, paramValue);
    });
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;

    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.service.toggle();
      return;
    }

    if (event.key === '/' && !this.isInputFocused()) {
      event.preventDefault();
      this.service.open();
      return;
    }

    if (event.key === 'Escape' && this.service.isOpen()) {
      event.preventDefault();
      this.close();
    }
  }

  /**
   * Main keyboard event handler - dispatches to state-specific handlers.
   */
  protected onInputKeydown(event: KeyboardEvent): void {
    // Handle zsh-like shortcuts first (apply to all states except ParameterSelection)
    const state = this.currentState();
    if (state !== InputState.ParameterSelection) {
      if (this.handleZshShortcuts(event)) {
        return;
      }
    }

    switch (state) {
      case InputState.Searching:
        this.handleSearchingKeydown(event);
        break;
      case InputState.ParameterInput:
        this.handleParameterInputKeydown(event);
        break;
      case InputState.ParameterSelection:
        this.handleParameterSelectionKeydown(event);
        break;
      // Closed state is handled by onGlobalKeydown
    }
  }

  /**
   * Handle zsh/readline-like keyboard shortcuts.
   * Returns true if the event was handled.
   */
  private handleZshShortcuts(event: KeyboardEvent): boolean {
    const query = this.query();

    // Ctrl+W or Alt+Backspace or Ctrl+Backspace: Delete last word
    if ((event.ctrlKey && event.key === 'w') ||
        (event.altKey && event.key === 'Backspace') ||
        (event.ctrlKey && event.key === 'Backspace')) {
      event.preventDefault();
      this.deleteLastWord();
      return true;
    }

    // Ctrl+U: Clear line (delete to beginning)
    if (event.ctrlKey && event.key === 'u') {
      event.preventDefault();
      this.query.set('');
      return true;
    }

    // Ctrl+H: Backspace (delete char before cursor) - browser handles this

    // Ctrl+A: Move to beginning - browser handles this
    // Ctrl+E: Move to end - browser handles this

    return false;
  }

  /**
   * Delete the last word from the query (zsh-style Ctrl+W).
   * Handles quoted strings as single words.
   */
  private deleteLastWord(): void {
    const query = this.query();
    if (!query) return;

    // Trim trailing whitespace (ES5 compatible)
    let newQuery = query.replace(/\s+$/, '');

    // If ends with a quote, delete until matching opening quote
    if (newQuery.endsWith("'") || newQuery.endsWith('"')) {
      const quoteChar = newQuery[newQuery.length - 1];
      const openingQuoteIndex = newQuery.lastIndexOf(quoteChar, newQuery.length - 2);
      if (openingQuoteIndex !== -1) {
        newQuery = newQuery.substring(0, openingQuoteIndex).replace(/\s+$/, '');
      } else {
        // No matching quote, just remove the quote
        newQuery = newQuery.slice(0, -1).replace(/\s+$/, '');
      }
    } else {
      // Delete until last whitespace
      const lastSpaceIndex = newQuery.lastIndexOf(' ');
      if (lastSpaceIndex !== -1) {
        newQuery = newQuery.substring(0, lastSpaceIndex);
      } else {
        // No spaces, clear everything
        newQuery = '';
      }
    }

    this.query.set(newQuery);
  }

  /**
   * Keyboard handler for Searching state.
   * User is typing a search term, navigating menu items.
   */
  private handleSearchingKeydown(event: KeyboardEvent): void {
    const items = this.filteredItems();
    const item = this.selectedItem();
    const separator = this.service.config().argSeparator ?? ' ';

    switch (event.key) {
      case 'Tab':
      case 'ArrowRight':
        // Complete item label
        if (item) {
          event.preventDefault();
          this.completeItemLabel(item, separator);
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.update((i) => Math.min(i + 1, items.length - 1));
        this.scrollSelectedIntoView();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.update((i) => Math.max(i - 1, 0));
        this.scrollSelectedIntoView();
        break;

      case 'Enter':
        event.preventDefault();
        if (this.canExecute() && item) {
          this.executeItem(item);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  /**
   * Keyboard handler for ParameterInput state.
   * User has selected an item and is typing parameter values.
   */
  private handleParameterInputKeydown(event: KeyboardEvent): void {
    const items = this.filteredItems();
    const item = this.selectedItem();
    const suggestions = this.autocompleteSuggestions();
    const paramName = this.currentParamName();
    const config = this.service.config();
    const tabBehavior = config.autocompleteTabBehavior ?? 'cycle';

    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        // Check if we have autocomplete available
        if (item && paramName && item.paramProviders?.[paramName] && suggestions.length > 0) {
          // zsh-style: Tab accepts current suggestion AND cycles to next
          // Accept the first suggestion (ghost text)
          this.selectAutocompleteSuggestionAndCycle();
          // Show overlay for visibility
          this.showAutocomplete.set(true);
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.update((i) => Math.min(i + 1, items.length - 1));
        this.scrollSelectedIntoView();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.update((i) => Math.max(i - 1, 0));
        this.scrollSelectedIntoView();
        break;

      case 'Enter':
        event.preventDefault();
        if (this.canExecute() && item) {
          this.executeItem(item);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  /**
   * Keyboard handler for ParameterSelection state.
   * Autocomplete overlay is open, user is navigating suggestions.
   */
  private handleParameterSelectionKeydown(event: KeyboardEvent): void {
    const suggestions = this.autocompleteSuggestions();

    switch (event.key) {
      case 'Tab':
        // zsh-style: Tab accepts current AND cycles to next
        event.preventDefault();
        this.selectAutocompleteSuggestionAndCycle();
        break;

      case 'Enter':
        // Enter accepts and closes overlay
        event.preventDefault();
        this.selectAutocompleteSuggestion();
        break;

      case 'ArrowDown':
        event.preventDefault();
        this.autocompleteSelectedIndex.update((i) => (i + 1) % suggestions.length);
        setTimeout(() => this.scrollAutocompleteIntoView(), 0);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.autocompleteSelectedIndex.update((i) => (i - 1 + suggestions.length) % suggestions.length);
        setTimeout(() => this.scrollAutocompleteIntoView(), 0);
        break;

      case 'Escape':
        // Close overlay, return to ParameterInput state
        event.preventDefault();
        this.showAutocomplete.set(false);
        break;
    }
  }

  private scrollSelectedIntoView(): void {
    const container = this.listContainer()?.nativeElement;
    if (!container) return;

    const selectedButton = container.querySelector(
      `[data-index="${this.selectedIndex()}"]`
    ) as HTMLElement | null;

    if (selectedButton) {
      selectedButton.scrollIntoView({ block: 'nearest' });
    }
  }

  private scrollAutocompleteIntoView(): void {
    const container = this.autocompleteContainer()?.nativeElement;
    if (!container) return;

    const selectedButton = container.querySelector(
      `[data-autocomplete-index="${this.autocompleteSelectedIndex()}"]`
    ) as HTMLElement | null;

    if (selectedButton) {
      selectedButton.scrollIntoView({ block: 'nearest' });
    }
  }

  protected onQueryChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);

    // Hide autocomplete overlay on typing if configured
    const dismissBehavior = this.service.config().autocompleteDismiss ?? 'on-type';
    if (dismissBehavior === 'on-type' && this.showAutocomplete()) {
      this.showAutocomplete.set(false);
    }
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  protected executeItem(item: GigamenuItem): void {
    // Record the selection for frecency learning (use search term, not full query)
    const searchTerm = this.searchTerm();
    this.frecency.recordSelection(searchTerm, item.id);

    // Get args values before closing (which resets query)
    // Use argsValues which substitutes labels with actual values
    const argsValues = this.argsValues();
    const args = argsValues.length > 0 ? argsValues.join(' ') : undefined;

    this.close();
    item.action(args);
  }

  // Template context getters
  protected getItemContext(item: GigamenuItem, index: number): GigamenuItemContext {
    return {
      $implicit: item,
      index,
      selected: this.selectedIndex() === index,
    };
  }

  protected getEmptyContext(): GigamenuEmptyContext {
    return {
      $implicit: this.query(),
    };
  }

  protected getHeaderContext(): GigamenuHeaderContext {
    return {
      $implicit: this.query(),
      searchTerm: this.searchTerm(),
      args: this.args(),
      hasSeparator: this.hasSeparator(),
      onQueryChange: (value: string) => this.query.set(value),
      onKeydown: (event: KeyboardEvent) => this.onInputKeydown(event),
      placeholder: this.service.config().placeholder ?? '',
    };
  }

  protected getFooterContext(): GigamenuFooterContext {
    return {
      $implicit: this.filteredItems().length,
      total: this.service.items().length,
    };
  }

  protected getPanelContext(): GigamenuPanelContext {
    return {
      $implicit: this.filteredItems(),
      query: this.query(),
      searchTerm: this.searchTerm(),
      args: this.args(),
      hasSeparator: this.hasSeparator(),
      selectedIndex: this.selectedIndex(),
      executeItem: (item: GigamenuItem) => this.executeItem(item),
      setSelectedIndex: (index: number) => this.selectedIndex.set(index),
      setQuery: (query: string) => this.query.set(query),
      close: () => this.close(),
      placeholder: this.service.config().placeholder ?? '',
    };
  }

  /**
   * Fetch autocomplete suggestions from a provider
   */
  private async fetchAutocompleteSuggestions(provider: ParamProvider, query: string): Promise<void> {
    try {
      let options: AutocompleteOption[];
      let isAsync = false;

      // Handle static array provider
      if (Array.isArray(provider)) {
        const cacheKey = `${JSON.stringify(provider)}-${query}`;
        // Check cache first (only for static providers)
        if (this.autocompleteCache.has(cacheKey)) {
          const cached = this.autocompleteCache.get(cacheKey)!;
          this.updateFilteredSuggestions(cached, query, true);
          return;
        }
        options = provider;
        this.autocompleteCache.set(cacheKey, options);
      } else {
        // Handle async function provider (server-side filtering)
        isAsync = true;
        const result = await Promise.resolve(provider(query));
        options = result;
      }

      // For async providers, skip client-side filtering (server already filtered)
      // For static providers, do client-side filtering
      this.updateFilteredSuggestions(options, query, !isAsync);
    } catch (error) {
      console.error('Error fetching autocomplete suggestions:', error);
      this.showAutocomplete.set(false);
      this.autocompleteSuggestions.set([]);
    }
  }

  /**
   * Filter and update suggestions based on current query
   * @param options The autocomplete options
   * @param query The current filter query
   * @param doClientFilter Whether to apply client-side filtering (false for async providers)
   */
  private updateFilteredSuggestions(options: AutocompleteOption[], query: string, doClientFilter: boolean): void {
    let filtered = options;

    // Only filter client-side for static providers
    if (doClientFilter) {
      const lowerQuery = query.toLowerCase().trim();
      filtered = lowerQuery
        ? options.filter((opt) => opt.label.toLowerCase().includes(lowerQuery))
        : options;
    }

    this.autocompleteSuggestions.set(filtered);
    // Don't auto-show - Tab triggers the dropdown
    // But hide if we have no suggestions left
    if (filtered.length === 0) {
      this.showAutocomplete.set(false);
    }
    this.autocompleteSelectedIndex.set(0);
  }

  /**
   * Select an autocomplete suggestion and update the query
   */
  protected selectAutocompleteSuggestion(option?: AutocompleteOption): void {
    if (!option) {
      const suggestions = this.autocompleteSuggestions();
      const selectedIdx = this.autocompleteSelectedIndex();
      option = suggestions[selectedIdx];
    }

    if (!option) return;

    const searchTerm = this.searchTerm();
    const separator = this.service.config().argSeparator ?? ' ';
    const argsArray = this.argsArray();
    const paramIndex = this.currentParamIndex();

    if (paramIndex === null) return;

    // Store the selected option for this param (maps label to value)
    this.selectedParamOptions.update(map => {
      const newMap = new Map(map);
      newMap.set(paramIndex, option);
      return newMap;
    });

    // Quote labels that contain spaces using QueryParser
    const escapedLabel = this.queryParser().escapeIfNeeded(option.label);

    // Replace current param with the selected option's label (display text)
    const newArgs = [...argsArray];
    newArgs[paramIndex] = escapedLabel;

    // Build new query with the selected label
    const newQuery = searchTerm + separator + newArgs.join(' ') + ' ';
    this.query.set(newQuery);

    // Hide autocomplete
    this.showAutocomplete.set(false);
    this.autocompleteSelectedIndex.set(0);
  }

  /**
   * zsh-style: Select current suggestion AND cycle to next.
   * This allows Tab to both accept and prepare for next Tab press.
   */
  private selectAutocompleteSuggestionAndCycle(): void {
    const suggestions = this.autocompleteSuggestions();
    const currentIdx = this.autocompleteSelectedIndex();

    if (suggestions.length === 0) return;

    const option = suggestions[currentIdx];
    if (!option) return;

    const searchTerm = this.searchTerm();
    const separator = this.service.config().argSeparator ?? ' ';
    const argsArray = this.argsArray();
    const paramIndex = this.currentParamIndex();

    if (paramIndex === null) return;

    // Store the selected option for this param (maps label to value)
    this.selectedParamOptions.update(map => {
      const newMap = new Map(map);
      newMap.set(paramIndex, option);
      return newMap;
    });

    // Quote labels that contain spaces using QueryParser
    const escapedLabel = this.queryParser().escapeIfNeeded(option.label);

    // Replace current param with the selected option's label (display text)
    // Don't add trailing space - keep cursor position for cycling
    const newArgs = [...argsArray];
    newArgs[paramIndex] = escapedLabel;

    // Build new query WITHOUT trailing space (so user can keep Tab-cycling)
    const newQuery = searchTerm + separator + newArgs.join(' ');
    this.query.set(newQuery);

    // Cycle to next suggestion for subsequent Tab presses
    const nextIdx = (currentIdx + 1) % suggestions.length;
    this.autocompleteSelectedIndex.set(nextIdx);

    // Keep overlay open (or it will show next time)
  }

  private close(): void {
    this.service.close();
    this.query.set('');
    this.selectedIndex.set(0);
    this.showAutocomplete.set(false);
    this.autocompleteSelectedIndex.set(0);
    this.autocompleteCache.clear();
    this.selectedParamOptions.set(new Map());
  }

  private sortByFrecency(items: GigamenuItem[], scores: Map<string, number>): GigamenuItem[] {
    if (scores.size === 0) return items;

    return [...items].sort((a, b) => {
      const scoreA = scores.get(a.id) ?? 0;
      const scoreB = scores.get(b.id) ?? 0;
      return scoreB - scoreA;
    });
  }

  private matchesQuery(item: GigamenuItem, query: string): boolean {
    const searchableText = [
      item.label,
      item.description,
      ...(item.keywords ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Strip quotes from query using QueryParser
    const searchQuery = this.queryParser().stripQuotes(query);
    const words = searchQuery.split(/\s+/);
    return words.every((word) => searchableText.includes(word));
  }

  private isInputFocused(): boolean {
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
   * Uses QueryParser for quote handling.
   */
  private isSearchTermMatchingItem(item: GigamenuItem): boolean {
    return this.queryParser().matchesLabel(this.searchTerm(), item.label);
  }

  /**
   * Complete the selected item's label in the search input.
   * Uses QueryParser for escaping labels with spaces.
   */
  private completeItemLabel(item: GigamenuItem, separator: string): void {
    const escapedLabel = this.queryParser().escapeIfNeeded(item.label);
    const hasParams = item.params && item.params.length > 0;
    const newQuery = hasParams ? escapedLabel + separator : escapedLabel;
    this.query.set(newQuery);
  }
}
