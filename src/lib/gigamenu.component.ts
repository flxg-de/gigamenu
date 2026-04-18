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
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { GigamenuService } from './gigamenu.service';
import { FrecencyService } from './frecency.service';
import { GigamenuItem, AutocompleteOption, GigamenuProviderItem } from './types';
import {
  GigamenuItemTemplate,
  GigamenuEmptyTemplate,
  GigamenuHeaderTemplate,
  GigamenuFooterTemplate,
  GigamenuPanelTemplate,
} from './gigamenu-templates.directive';
import { QueryParser } from './query-parser';
import { InputState, computeInputState } from './input-state';
import {
  // Scroll utilities
  scrollSelectedIntoView,
  // Search functions
  filterItems,
  sortByFrecency,
  // Parameter state functions
  computeHasAutocomplete,
  // Template context functions
  getParamColor,
  createItemContext,
  createEmptyContext,
  createFooterContext,
  // Menu lifecycle functions
  isInputFocused,
  // Autocomplete functions
  fetchAutocompleteSuggestions,
  filterSuggestionsClientSide,
  // Keyboard handler functions
  handleGlobalKeydown,
  handleZshShortcuts,
  handleActionSelectionKeydown,
  handleParameterInputKeydown,
  hasActions,
  // Types
  type MenuAction,
  type ActionSelectionContext,
  type ParameterInputContext,
} from './core';

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

  // Core state signals
  protected readonly query = signal('');
  protected readonly selectedIndex = signal(0);

  // Step-by-step input state
  protected readonly lockedAction = signal<GigamenuItem | null>(null);
  protected readonly paramValues = signal<string[]>([]);

  // Autocomplete state signals
  protected readonly autocompleteSuggestions = signal<AutocompleteOption[]>([]);
  private autocompleteCache = new Map<string, AutocompleteOption[]>();
  private readonly selectedParamOptions = signal<Map<number, AutocompleteOption>>(new Map());

  // Dynamic provider state
  private readonly providerResults = signal<Map<string, GigamenuItem[]>>(new Map());
  private providerTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private providerGeneration = new Map<string, number>();

  // Query parsing (simplified - only used for filtering)
  private readonly queryParser = computed(() => {
    const separator = this.service.config().argSeparator ?? ' ';
    return new QueryParser(separator);
  });

  // Selected item from display list
  protected readonly selectedItem = computed(() => {
    const items = this.displayItems();
    const index = this.selectedIndex();
    return items[index] ?? null;
  });

  protected readonly currentParamIndex = computed(() => {
    const action = this.lockedAction();
    if (!action || !action.params) return null;
    const filled = this.paramValues().length;
    if (filled >= action.params.length) return null;
    return filled;
  });

  protected readonly currentParamName = computed(() => {
    const action = this.lockedAction();
    const idx = this.currentParamIndex();
    if (!action || idx === null || !action.params) return null;
    return action.params[idx] ?? null;
  });

  protected readonly hasAutocomplete = computed(() => {
    const action = this.lockedAction();
    const paramName = this.currentParamName();
    if (!action || !paramName) return false;
    return computeHasAutocomplete(action, paramName);
  });

  protected readonly currentState = computed((): InputState => {
    return computeInputState({
      isOpen: this.service.isOpen(),
      hasLockedAction: this.lockedAction() !== null,
    });
  });

  protected readonly filteredItems = computed(() => {
    const searchTerm = this.query().toLowerCase().trim();
    const items = this.service.items();
    const maxResults = this.service.config().maxResults ?? 10;

    if (!searchTerm) {
      const scores = this.frecency.getScores('');
      return sortByFrecency(items, scores).slice(0, maxResults);
    }

    const matched = filterItems(items, searchTerm, this.queryParser());
    const scores = this.frecency.getScores(searchTerm);
    return sortByFrecency(matched, scores).slice(0, maxResults);
  });

  // Display items: actions in ActionSelection, suggestions in ParameterInput
  protected readonly displayItems = computed((): GigamenuItem[] => {
    const state = this.currentState();
    if (state === InputState.ParameterInput) {
      // In parameter mode, show autocomplete suggestions as items
      return this.autocompleteSuggestions().map((opt) => ({
        id: `suggestion-${opt.value}`,
        label: opt.label,
        description: opt.value !== opt.label ? opt.value : undefined,
        category: 'command' as const,
        action: () => {}, // Handled via selectSuggestion action
      }));
    }

    // Action selection: static items + dynamic provider results
    const staticItems = this.filteredItems();
    const dynamic: GigamenuItem[] = [];
    for (const items of this.providerResults().values()) {
      dynamic.push(...items);
    }
    return [...staticItems, ...dynamic];
  });

  // Template helper
  protected getParamColor = getParamColor;

  constructor(
    protected readonly service: GigamenuService,
    private readonly frecency: FrecencyService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Focus effect
    effect(() => {
      if (this.service.isOpen() && this.isBrowser) {
        setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
      }
    });

    // Frecency auto-select effect (only in ActionSelection mode)
    effect(() => {
      const state = this.currentState();
      if (state !== InputState.ActionSelection) return;

      const items = this.filteredItems();
      const query = this.query();

      if (query && items.length > 0) {
        const topMatch = this.frecency.getTopMatch(query);
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

    // Dynamic provider effect (only in ActionSelection mode)
    effect(() => {
      const state = this.currentState();
      const providers = this.service.providers();
      const query = this.query();

      if (state !== InputState.ActionSelection) {
        this.clearProviderResults();
        return;
      }

      // Cancel timers for providers that no longer exist
      for (const id of this.providerTimers.keys()) {
        if (!providers.has(id)) {
          clearTimeout(this.providerTimers.get(id)!);
          this.providerTimers.delete(id);
        }
      }
      // Drop results from removed providers
      const currentResults = this.providerResults();
      if (currentResults.size > 0) {
        let changed = false;
        const next = new Map(currentResults);
        for (const id of next.keys()) {
          if (!providers.has(id)) {
            next.delete(id);
            changed = true;
          }
        }
        if (changed) this.providerResults.set(next);
      }

      // Schedule each provider
      providers.forEach((registered, id) => {
        const trimmed = query.trim();
        if (trimmed.length < registered.options.minQueryLength) {
          // Clear any previous results for this provider when below threshold
          if (this.providerResults().has(id)) {
            this.providerResults.update((map) => {
              const next = new Map(map);
              next.delete(id);
              return next;
            });
          }
          const existing = this.providerTimers.get(id);
          if (existing) {
            clearTimeout(existing);
            this.providerTimers.delete(id);
          }
          return;
        }

        const existing = this.providerTimers.get(id);
        if (existing) clearTimeout(existing);

        const generation = (this.providerGeneration.get(id) ?? 0) + 1;
        this.providerGeneration.set(id, generation);

        const timer = setTimeout(async () => {
          this.providerTimers.delete(id);
          try {
            const raw = await registered.provider(trimmed);
            if (this.providerGeneration.get(id) !== generation) return;
            const items = this.normalizeProviderItems(raw, id, registered.options.group);
            this.providerResults.update((map) => {
              const next = new Map(map);
              next.set(id, items);
              return next;
            });
          } catch (err) {
            console.error(`gigamenu provider "${id}" failed:`, err);
          }
        }, registered.options.debounceMs);

        this.providerTimers.set(id, timer);
      });
    });

    // Autocomplete effect (only in ParameterInput mode)
    effect(() => {
      const action = this.lockedAction();
      const paramIndex = this.currentParamIndex();
      const paramName = this.currentParamName();
      const paramValue = this.query(); // In ParameterInput, query is the param value

      if (!action || paramIndex === null || !paramName) {
        this.autocompleteSuggestions.set([]);
        return;
      }

      const provider = action.paramProviders?.[paramName];
      if (!provider) {
        this.autocompleteSuggestions.set([]);
        return;
      }

      this.fetchSuggestions(provider, paramValue);
    });
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;

    const action = handleGlobalKeydown(event, {
      isOpen: this.service.isOpen(),
      isInputFocused: isInputFocused(),
    });

    if (action) {
      event.preventDefault();
      this.dispatchAction(action);
    }
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    const state = this.currentState();

    // Handle zsh-like shortcuts first
    const newQuery = handleZshShortcuts(event, this.query());
    if (newQuery !== null) {
      event.preventDefault();
      this.query.set(newQuery);
      return;
    }

    // Get actions from state-specific handler
    const actions = this.getActionsForState(state, event);

    if (hasActions(actions)) {
      event.preventDefault();
      actions.forEach((action) => this.dispatchAction(action));
    }
  }

  private getActionsForState(state: InputState, event: KeyboardEvent): MenuAction[] {
    switch (state) {
      case InputState.ActionSelection: {
        const ctx: ActionSelectionContext = {
          items: this.displayItems(),
          selectedIndex: this.selectedIndex(),
          selectedItem: this.selectedItem(),
        };
        return handleActionSelectionKeydown(event, ctx);
      }
      case InputState.ParameterInput: {
        const action = this.lockedAction();
        if (!action) return [];
        const ctx: ParameterInputContext = {
          lockedItem: action,
          currentParamIndex: this.currentParamIndex() ?? 0,
          paramValues: this.paramValues(),
          query: this.query(),
          suggestions: this.autocompleteSuggestions(),
          selectedSuggestionIndex: this.selectedIndex(),
        };
        return handleParameterInputKeydown(event, ctx);
      }
      default:
        return [];
    }
  }

  private dispatchAction(action: MenuAction): void {
    switch (action.type) {
      case 'setSelectedIndex':
        this.selectedIndex.set(action.value);
        break;
      case 'setQuery':
        this.query.set(action.value);
        break;
      case 'executeAction':
        // Execute an action directly (no params)
        this.executeItemWithArgs(action.item, []);
        break;
      case 'executeLockedAction':
        // Build args from current state (includes any changes from selectSuggestion)
        const lockedItem = this.lockedAction();
        if (lockedItem) {
          const args = this.buildArgsWithValues();
          this.executeItemWithArgs(lockedItem, args);
        }
        break;
      case 'close':
        this.close();
        break;
      case 'toggle':
        this.service.toggle();
        break;
      case 'open':
        this.service.open();
        break;
      case 'scrollIntoView':
        scrollSelectedIntoView(this.listContainer()?.nativeElement ?? null, this.selectedIndex());
        break;
      case 'lockAction':
        this.lockedAction.set(action.item);
        this.query.set('');
        this.selectedIndex.set(0);
        break;
      case 'unlockAction':
        this.lockedAction.set(null);
        this.paramValues.set([]);
        this.query.set('');
        this.selectedIndex.set(0);
        break;
      case 'nextParameter':
        // Push current query value to paramValues, clear query
        this.paramValues.update((values) => [...values, this.query()]);
        this.query.set('');
        this.selectedIndex.set(0);
        break;
      case 'previousParameter':
        // Pop last param value back to query
        const values = this.paramValues();
        if (values.length > 0) {
          const lastValue = values[values.length - 1];
          this.paramValues.update((v) => v.slice(0, -1));
          this.query.set(lastValue);
          this.selectedIndex.set(0);
        }
        break;
      case 'selectSuggestion':
        this.selectSuggestion(action.option);
        break;
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

  protected onItemClick(item: GigamenuItem, index: number): void {
    // Only proceed if this is the selected item
    if (this.selectedIndex() !== index) {
      this.selectedIndex.set(index);
      return;
    }

    const state = this.currentState();
    if (state === InputState.ParameterInput) {
      // In parameter mode, clicking selects the suggestion
      const suggestions = this.autocompleteSuggestions();
      const option = suggestions[index];
      if (option) {
        this.selectSuggestion(option);
      }
    } else {
      // In action selection mode, trigger the action selection
      const actions = handleActionSelectionKeydown(
        new KeyboardEvent('keydown', { key: 'Enter' }),
        {
          items: this.displayItems(),
          selectedIndex: index,
          selectedItem: item,
        }
      );
      actions.forEach((action) => this.dispatchAction(action));
    }
  }

  private executeItemWithArgs(item: GigamenuItem, args: string[]): void {
    // Record frecency for the action
    this.frecency.recordSelection(this.query(), item.id);

    // Build args string from array
    const argsStr = args.length > 0 ? args.join(' ') : undefined;

    this.close();
    item.action(argsStr);
  }

  private selectSuggestion(option: AutocompleteOption): void {
    // Set the query to the selected option's label (for display)
    this.query.set(option.label);

    // Track the selected option for value substitution when executing
    const paramIndex = this.currentParamIndex();
    if (paramIndex !== null) {
      this.selectedParamOptions.update((map) => {
        const newMap = new Map(map);
        newMap.set(paramIndex, option);
        return newMap;
      });
    }
  }

  /**
   * Build args array using values from selectedParamOptions when available.
   * For each param, if a suggestion was selected, use its value; otherwise use the typed text.
   */
  private buildArgsWithValues(): string[] {
    const paramValues = this.paramValues();
    const currentQuery = this.query();
    const selectedOptions = this.selectedParamOptions();

    const args: string[] = [];

    // Add completed param values (use selected option's value if available)
    for (let i = 0; i < paramValues.length; i++) {
      const selectedOption = selectedOptions.get(i);
      if (selectedOption) {
        args.push(selectedOption.value);
      } else {
        args.push(paramValues[i]);
      }
    }

    // Add current param value (use selected option's value if available)
    if (currentQuery) {
      const currentParamIdx = this.currentParamIndex();
      if (currentParamIdx !== null) {
        const selectedOption = selectedOptions.get(currentParamIdx);
        if (selectedOption) {
          args.push(selectedOption.value);
        } else {
          args.push(currentQuery);
        }
      } else {
        args.push(currentQuery);
      }
    }

    return args.filter(Boolean);
  }

  // Template context methods
  protected getItemContext(item: GigamenuItem, index: number) {
    return createItemContext(item, index, this.selectedIndex());
  }

  protected getEmptyContext() {
    return createEmptyContext(this.query());
  }

  protected getFooterContext() {
    return createFooterContext(this.displayItems().length, this.service.items().length);
  }

  protected getHeaderContext() {
    return {
      $implicit: this.query(),
      query: this.query(),
      lockedAction: this.lockedAction(),
      paramValues: this.paramValues(),
      currentParamName: this.currentParamName(),
      placeholder: this.service.config().placeholder ?? '',
      onQueryChange: (value: string) => this.query.set(value),
      onKeydown: (event: KeyboardEvent) => this.onInputKeydown(event),
      onUnlockAction: () => this.unlockActionFromUI(),
      onGoToParam: (index: number) => this.goToParam(index),
    };
  }

  protected getPanelContext() {
    return {
      $implicit: this.displayItems(),
      items: this.displayItems(),
      query: this.query(),
      lockedAction: this.lockedAction(),
      paramValues: this.paramValues(),
      selectedIndex: this.selectedIndex(),
      placeholder: this.service.config().placeholder ?? '',
      onItemClick: (item: GigamenuItem, index: number) => this.onItemClick(item, index),
      onSelectIndex: (index: number) => this.selectedIndex.set(index),
      onQueryChange: (query: string) => this.query.set(query),
      onClose: () => this.close(),
    };
  }

  // Autocomplete methods
  private async fetchSuggestions(provider: NonNullable<GigamenuItem['paramProviders']>[string], query: string): Promise<void> {
    try {
      const { options, isAsync } = await fetchAutocompleteSuggestions(provider, query, this.autocompleteCache);
      const filtered = isAsync ? options : filterSuggestionsClientSide(options, query);
      this.autocompleteSuggestions.set(filtered);
      this.selectedIndex.set(0);
    } catch (error) {
      console.error('Error fetching autocomplete suggestions:', error);
      this.autocompleteSuggestions.set([]);
    }
  }

  private close(): void {
    this.service.close();
    this.query.set('');
    this.selectedIndex.set(0);
    this.lockedAction.set(null);
    this.paramValues.set([]);
    this.autocompleteCache.clear();
    this.selectedParamOptions.set(new Map());
    this.clearProviderResults();
  }

  private clearProviderResults(): void {
    for (const timer of this.providerTimers.values()) clearTimeout(timer);
    this.providerTimers.clear();
    // Bump all generations to invalidate any in-flight responses
    for (const id of this.providerGeneration.keys()) {
      this.providerGeneration.set(id, (this.providerGeneration.get(id) ?? 0) + 1);
    }
    if (this.providerResults().size > 0) {
      this.providerResults.set(new Map());
    }
  }

  private normalizeProviderItems(
    raw: GigamenuProviderItem[],
    providerId: string,
    group: string
  ): GigamenuItem[] {
    return raw.map((item) => ({
      ...item,
      category: item.category ?? 'command',
      providerId,
      group: item.group ?? (group || undefined),
    }));
  }

  // Template helper for going back from breadcrumb
  protected unlockActionFromUI(): void {
    this.dispatchAction({ type: 'unlockAction' });
  }

  protected goToParam(index: number): void {
    // Go back to a specific parameter
    const values = this.paramValues();
    if (index < values.length) {
      // Set query to the value at that index
      this.query.set(values[index]);
      // Keep only values before that index
      this.paramValues.set(values.slice(0, index));
      this.selectedIndex.set(0);
    }
  }
}
