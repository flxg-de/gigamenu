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

  /** Parsed search term (before first separator) */
  protected readonly searchTerm = computed(() => {
    const q = this.query();
    const separator = this.service.config().argSeparator ?? ' ';
    const sepIndex = q.indexOf(separator);
    if (sepIndex === -1) return q;
    return q.substring(0, sepIndex);
  });

  /** Parsed arguments (after first separator) */
  protected readonly args = computed(() => {
    const q = this.query();
    const separator = this.service.config().argSeparator ?? ' ';
    const sepIndex = q.indexOf(separator);
    if (sepIndex === -1) return '';
    return q.substring(sepIndex + separator.length);
  });

  /** Whether the query contains a separator (for display purposes) */
  protected readonly hasSeparator = computed(() => {
    const q = this.query();
    const separator = this.service.config().argSeparator ?? ' ';
    return q.includes(separator);
  });

  /**
   * Parse args string into array, handling quoted strings.
   * Returns both the unquoted values and the display strings (with quotes preserved).
   */
  private readonly parsedArgs = computed(() => {
    const args = this.args();
    if (!args) return { values: [] as string[], display: [] as string[] };

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
    const argsCount = this.argsArray().length;
    // If we have fewer args than params, we're editing the next param
    if (argsCount < item.params.length) return argsCount;
    // If we have all params, we're not editing any (can execute)
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

  protected onInputKeydown(event: KeyboardEvent): void {
    const items = this.filteredItems();
    const showingAutocomplete = this.showAutocomplete();
    const suggestions = this.autocompleteSuggestions();
    const item = this.selectedItem();
    const paramName = this.currentParamName();

    // Handle Tab key specially - toggles and cycles through autocomplete
    if (event.key === 'Tab') {
      event.preventDefault();

      // Check if we have autocomplete available for current param
      if (item && paramName && item.paramProviders?.[paramName] && suggestions.length > 0) {
        if (!showingAutocomplete) {
          // First Tab: show autocomplete
          this.showAutocomplete.set(true);
          this.autocompleteSelectedIndex.set(0);
        } else {
          // Subsequent Tabs: cycle through options (wrap around)
          this.autocompleteSelectedIndex.update((i) => (i + 1) % suggestions.length);
          // Need timeout to let DOM update before scrolling
          setTimeout(() => this.scrollAutocompleteIntoView(), 0);
        }
        return;
      }

      // No autocomplete available, do nothing
      return;
    }

    // Handle autocomplete navigation when showing suggestions
    if (showingAutocomplete && suggestions.length > 0) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.autocompleteSelectedIndex.update((i) => (i + 1) % suggestions.length);
          setTimeout(() => this.scrollAutocompleteIntoView(), 0);
          return;

        case 'ArrowUp':
          event.preventDefault();
          this.autocompleteSelectedIndex.update((i) => (i - 1 + suggestions.length) % suggestions.length);
          setTimeout(() => this.scrollAutocompleteIntoView(), 0);
          return;

        case 'Enter':
          event.preventDefault();
          this.selectAutocompleteSuggestion();
          return;

        case 'Escape':
          event.preventDefault();
          this.showAutocomplete.set(false);
          return;
      }
    }

    // Normal menu navigation when autocomplete is not showing
    switch (event.key) {
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
        if (this.canExecute()) {
          const selected = items[this.selectedIndex()];
          if (selected) {
            this.executeItem(selected);
          }
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.close();
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

    // Quote labels that contain spaces
    const escapedLabel = option.label.includes(' ') ? `'${option.label}'` : option.label;

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

    const words = query.split(/\s+/);
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
}
