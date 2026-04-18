import { Injectable, signal, computed } from '@angular/core';
import { Router, Routes } from '@angular/router';
import {
  GigamenuItem,
  GigamenuCommand,
  GigamenuPage,
  GigamenuConfig,
  DEFAULT_CONFIG,
  DiscoverRoutesOptions,
  RouteInfo,
  GigamenuProvider,
  GigamenuProviderOptions,
} from './types';

interface RegisteredProvider {
  provider: GigamenuProvider;
  options: Required<GigamenuProviderOptions>;
}

const DEFAULT_PROVIDER_OPTIONS: Required<GigamenuProviderOptions> = {
  minQueryLength: 2,
  debounceMs: 200,
  group: '',
};

@Injectable({ providedIn: 'root' })
export class GigamenuService {
  private _router?: Router;

  private readonly _items = signal<Map<string, GigamenuItem>>(new Map());
  private readonly _providers = signal<Map<string, RegisteredProvider>>(new Map());
  private readonly _isOpen = signal(false);
  private readonly _config = signal<GigamenuConfig>(DEFAULT_CONFIG);

  readonly items = computed(() => Array.from(this._items().values()));
  readonly providers = this._providers.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();
  readonly config = this._config.asReadonly();

  /**
   * Set the router instance. Must be called before using navigation features.
   */
  setRouter(router: Router): void {
    this._router = router;
  }

  private get router(): Router {
    if (!this._router) {
      throw new Error(
        'GigamenuService: Router not set. Call setRouter() in your app initialization.'
      );
    }
    return this._router;
  }

  configure(config: Partial<GigamenuConfig>): void {
    this._config.update((current) => ({ ...current, ...config }));
  }

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  toggle(): void {
    this._isOpen.update((v) => !v);
  }

  toggleDarkMode(): void {
    const darkModeClass = this._config().darkModeClass ?? 'dark';
    document.documentElement.classList.toggle(darkModeClass);
  }

  registerItem(item: GigamenuItem): void {
    this._items.update((items) => {
      const newItems = new Map(items);
      newItems.set(item.id, item);
      return newItems;
    });
  }

  unregisterItem(id: string): void {
    this._items.update((items) => {
      const newItems = new Map(items);
      newItems.delete(id);
      return newItems;
    });
  }

  /**
   * Register a dynamic item provider. The provider is invoked when the user
   * types in the menu (in action-selection mode) and its results are merged
   * into the displayed items alongside statically registered items.
   */
  registerProvider(
    id: string,
    provider: GigamenuProvider,
    options: GigamenuProviderOptions = {}
  ): void {
    const resolved: Required<GigamenuProviderOptions> = {
      ...DEFAULT_PROVIDER_OPTIONS,
      ...options,
    };
    this._providers.update((providers) => {
      const next = new Map(providers);
      next.set(id, { provider, options: resolved });
      return next;
    });
  }

  unregisterProvider(id: string): void {
    this._providers.update((providers) => {
      if (!providers.has(id)) return providers;
      const next = new Map(providers);
      next.delete(id);
      return next;
    });
  }

  registerCommand(command: GigamenuCommand): void {
    this.registerItem({
      ...command,
      category: 'command',
    });
  }

  registerPage(page: GigamenuPage): void {
    // Extract parameter names from path (e.g., /users/:id -> ['id'])
    const paramNames = this.extractParamNames(page.path);

    // Use manually specified params if provided, otherwise use extracted ones
    const finalParams = page.params ?? (paramNames.length > 0 ? paramNames : undefined);

    this.registerItem({
      ...page,
      category: 'page',
      params: finalParams,
      // Preserve paramProviders if specified
      paramProviders: page.paramProviders,
      action: (args?: string) => {
        let path = page.path;
        const paramsToReplace = finalParams ?? [];
        if (paramsToReplace.length > 0 && args) {
          // Split args by whitespace to get parameter values
          const argValues = args.trim().split(/\s+/);
          // Replace each parameter with corresponding arg value
          paramsToReplace.forEach((param, index) => {
            if (argValues[index]) {
              path = path.replace(`:${param}`, argValues[index]);
            }
          });
        }
        this.router.navigate([path]);
      },
    });
  }

  private extractParamNames(path: string): string[] {
    const paramRegex = /:([^/]+)/g;
    const params: string[] = [];
    let match;
    while ((match = paramRegex.exec(path)) !== null) {
      params.push(match[1]);
    }
    return params;
  }

  discoverRoutes(options?: DiscoverRoutesOptions): void;
  discoverRoutes(routes?: Routes, options?: DiscoverRoutesOptions): void;
  discoverRoutes(
    routesOrOptions?: Routes | DiscoverRoutesOptions,
    maybeOptions?: DiscoverRoutesOptions
  ): void {
    let routes: Routes;
    let options: DiscoverRoutesOptions | undefined;

    if (Array.isArray(routesOrOptions)) {
      routes = routesOrOptions;
      options = maybeOptions;
    } else {
      routes = this.router.config;
      options = routesOrOptions;
    }

    this.extractPagesFromRoutes(routes, '', options?.filter);
  }

  private extractPagesFromRoutes(
    routes: Routes,
    parentPath: string,
    filter?: (route: RouteInfo) => boolean
  ): void {
    for (const route of routes) {
      if (route.redirectTo !== undefined) continue;

      const fullPath = parentPath
        ? `${parentPath}/${route.path ?? ''}`
        : route.path ?? '';

      if (route.path !== undefined && route.path !== '**') {
        const routeInfo: RouteInfo = {
          path: route.path,
          fullPath: `/${fullPath}`,
          data: route.data as Record<string, unknown> | undefined,
          title: typeof route.title === 'string' ? route.title : undefined,
        };

        // Apply filter if provided
        if (filter && !filter(routeInfo)) {
          // Still process children even if this route is filtered
          if (route.children) {
            this.extractPagesFromRoutes(route.children, fullPath, filter);
          }
          continue;
        }

        const label = routeInfo.title || this.pathToLabel(route.path || 'Home');
        const paramNames = this.extractParamNames(`/${fullPath}`);
        const hasParams = paramNames.length > 0;

        this.registerPage({
          id: `page:${fullPath || '/'}`,
          label, // Params will be rendered separately with colors
          path: `/${fullPath}`,
          description: hasParams
            ? `Navigate to ${label} (requires: ${paramNames.join(', ')})`
            : `Navigate to ${label}`,
        });
      }

      if (route.children) {
        this.extractPagesFromRoutes(route.children, fullPath, filter);
      }
    }
  }

  private pathToLabel(path: string): string {
    return path
      .split('/')
      .pop()!
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
