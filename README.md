# Gigamenu

A keyboard-driven command palette menu for Angular applications. Inspired by VS Code's Command Palette, Spotlight, and Linear's command menu.

## Features

- **Keyboard shortcuts**: `Ctrl/Cmd+K` and `/` (when no input is focused)
- **Auto-discovery**: Routes from Angular Router with filtering and mapping
- **Command registration**: With parameters, keywords, and icon support
- **Keyboard navigation**: Arrow keys, Enter, Escape, Tab completion
- **Zsh-like editing**: `Ctrl+W` delete word, `Ctrl+U` clear line, and more
- **Smart search**: Multi-word fuzzy filtering with keyword matching
- **Frecency ranking**: Learns from your usage patterns
- **Parameter handling**: Pass arguments to commands with validation
- **Typeahead autocomplete**: Ghost text suggestions with floating overlay
- **Quoted string support**: Labels with spaces handled automatically
- **Custom templates**: 5 template directives for full UI customization
- **Dark mode**: Configurable class name support
- **Icon libraries**: Support for emoji and CSS icon classes (FontAwesome, PrimeIcons, etc.)
- **Type-safe**: Full TypeScript support with helper functions
- **Tailwind CSS**: Beautiful default styling with dark mode variants

## Installation

```bash
npm install gigamenu
```

## Usage

### 1. Import the component

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { GigamenuComponent, GigamenuService } from 'gigamenu';

@Component({
  selector: 'app-root',
  imports: [GigamenuComponent],
  template: `
    <router-outlet />
    <gm-gigamenu />
  `,
})
export class App implements OnInit {
  private readonly gigamenu = inject(GigamenuService);

  ngOnInit(): void {
    // Auto-discover routes from Angular Router
    this.gigamenu.discoverRoutes();
  }
}
```

### 2. Register custom commands

```typescript
this.gigamenu.registerCommand({
  id: 'cmd:toggle-dark',
  label: 'Toggle Dark Mode',
  description: 'Switch between light and dark theme',
  icon: '🌙',
  keywords: ['theme', 'dark', 'light'],
  action: () => this.gigamenu.toggleDarkMode(),
});
```

### 3. Register custom pages

```typescript
this.gigamenu.registerPage({
  id: 'page:dashboard',
  label: 'Dashboard',
  path: '/dashboard',
  description: 'Go to the main dashboard',
});
```

### 4. Advanced Commands with Parameters

Commands can accept arguments after the search term:

```typescript
this.gigamenu.registerCommand({
  id: 'cmd:alert',
  label: 'Show Alert',
  description: 'Display a custom message',
  icon: '💬',
  keywords: ['message', 'popup', 'notify'],
  params: ['message'], // Required parameters
  action: (args) => {
    alert(args || 'Hello!');
  },
});
```

Users can type: `Show Alert Hello World` to pass "Hello World" as the argument.

### 5. Route Discovery with Filtering and Mapping

Customize which routes are discovered and how they appear:

```typescript
this.gigamenu.discoverRoutes({
  filter: (route) => {
    // Exclude admin routes
    return !route.fullPath.includes('admin');
  },
  map: (route) => {
    // Customize page data
    return {
      icon: route.data?.['icon'],
      keywords: route.data?.['keywords'],
      description: route.data?.['description'],
    };
  },
});
```

### 6. Custom Templates

Customize the appearance of menu items, empty states, header, footer, or the entire panel:

```html
<gm-gigamenu>
  <!-- Custom item template -->
  <ng-template gmItem let-item let-selected="selected">
    <div [class.selected]="selected">
      <span>{{ item.icon }}</span>
      <strong>{{ item.label }}</strong>
      <em>{{ item.description }}</em>
    </div>
  </ng-template>

  <!-- Custom empty state -->
  <ng-template gmEmpty let-query>
    <p>No results for "{{ query }}"</p>
  </ng-template>

  <!-- Custom header -->
  <ng-template gmHeader let-query let-searchTerm="searchTerm" let-args="args"
               let-onQueryChange="onQueryChange" let-onKeydown="onKeydown"
               let-placeholder="placeholder">
    <input
      [value]="query"
      [placeholder]="placeholder"
      (input)="onQueryChange($any($event.target).value)"
      (keydown)="onKeydown($event)" />
  </ng-template>

  <!-- Custom footer -->
  <ng-template gmFooter let-count let-total="total">
    <p>Showing {{ count }} of {{ total }} items</p>
  </ng-template>
</gm-gigamenu>
```

## API

### GigamenuService

| Method | Description |
|--------|-------------|
| `setRouter(router)` | Set the router instance (required for navigation) |
| `open()` | Open the menu |
| `close()` | Close the menu |
| `toggle()` | Toggle menu visibility |
| `toggleDarkMode()` | Toggle dark mode using configured class |
| `discoverRoutes(options?)` | Auto-discover pages from Angular Router with optional filter/map |
| `registerCommand(command)` | Register a custom command |
| `registerPage(page)` | Register a custom page |
| `registerItem(item)` | Register a generic menu item |
| `unregisterItem(id)` | Remove an item by ID |
| `configure(config)` | Update configuration |

### Configuration

```typescript
interface GigamenuConfig {
  placeholder?: string;      // Search input placeholder
  maxResults?: number;       // Maximum items to show (default: 10)
  autoDiscoverRoutes?: boolean; // Auto-discover on init
  argSeparator?: string;     // Separator between query and args (default: ' ')
  darkModeClass?: string;    // CSS class for dark mode (default: 'dark')
  autocompleteTabBehavior?: 'cycle' | 'accept-first';  // Tab behavior (default: 'cycle')
  autocompleteDismiss?: 'on-type' | 'manual';          // Overlay dismiss (default: 'on-type')
}
```

**Autocomplete Configuration:**
- `autocompleteTabBehavior: 'cycle'` - Tab shows overlay, use arrows to navigate
- `autocompleteTabBehavior: 'accept-first'` - First Tab accepts ghost text immediately
- `autocompleteDismiss: 'on-type'` - Overlay hides when you continue typing
- `autocompleteDismiss: 'manual'` - Overlay stays until Escape or selection

### Types

```typescript
interface GigamenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;                    // Emoji or text icon
  iconClass?: string;               // CSS class for icon libraries (e.g., 'pi pi-home', 'fa fa-user')
  keywords?: string[];              // Additional searchable keywords
  params?: string[];                // Required parameter names (e.g., ['id', 'commentId'])
  category: 'page' | 'command';
  action: (args?: string) => void;  // Receives arguments after separator
}

interface GigamenuCommand extends Omit<GigamenuItem, 'category'> {
  shortcut?: string;                // Keyboard shortcut display (e.g., 'Ctrl+S')
}

interface GigamenuPage extends Omit<GigamenuItem, 'category' | 'action'> {
  path: string;                     // Navigation path (params auto-extracted)
}

interface DiscoverRoutesOptions {
  filter?: (route: RouteInfo) => boolean;    // Filter which routes to include
  map?: (route: RouteInfo) => MappedPage | null;  // Customize page data
}

interface RouteInfo {
  path: string;                     // Segment path
  fullPath: string;                 // Complete path from root
  data?: Record<string, unknown>;   // Route data
  title?: string;                   // Route title
}

interface MappedPage {
  label?: string;
  description?: string;
  icon?: string;
  iconClass?: string;
  keywords?: string[];
}

// Type-safe command definitions
interface CommandDefinition {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: string;
  readonly iconClass?: string;
  readonly keywords?: string[];
  readonly shortcut?: string;
  execute(): void;
}

// Helper for type-safe command creation
function defineCommand(command: CommandDefinition): CommandDefinition
```

### Template Directives

All template directives provide context objects for customization:

| Directive | Purpose | Context Properties |
|-----------|---------|-------------------|
| `gmItem` | Custom item rendering | `item`, `index`, `selected` |
| `gmEmpty` | Empty state when no results | `query` (search term) |
| `gmHeader` | Search input and header area | `query`, `searchTerm`, `args`, `hasSeparator`, `onQueryChange`, `onKeydown`, `placeholder` |
| `gmFooter` | Footer/status area | `count` (filtered), `total` (all items) |
| `gmPanel` | Entire panel container | `filteredItems`, `query`, `searchTerm`, `args`, `hasSeparator`, `selectedIndex`, `executeItem`, `setSelectedIndex`, `setQuery`, `close`, `placeholder` |

## Advanced Features

### Autocomplete with Typeahead

When commands have `paramProviders`, gigamenu provides intelligent autocomplete:

**Typeahead Ghost Text:**
- As you type a parameter, a muted ghost text shows the best matching suggestion
- The ghost text completes your current input based on prefix matching

**Floating Overlay:**
- Press `Tab` to show all available suggestions in a floating overlay
- Navigate with `↑`/`↓`, select with `Tab` or `Enter`
- Press `Escape` to dismiss

**Example Flow:**
```
1. Type "user" → "User Profile" is highlighted
2. Press Tab → Input becomes "'User Profile' "
3. Start typing "Fe" → Ghost text shows "lix" (matching "Felix")
4. Press Tab → Overlay shows all matching users
5. Select with Enter → Parameter value is set
```

**Quoted Labels:**
Labels with spaces are automatically quoted to preserve them as single values:
- `User Profile` becomes `'User Profile'` in the input
- Ctrl+W deletes the entire quoted string as one word

### Frecency-Based Ranking

Gigamenu uses intelligent ranking based on **frequency** and **recency** of selections:

- Learns from your usage patterns
- Recent selections are weighted higher
- Automatically selects frequently used items
- Decays scores over time (formula: `count × 0.9^ageInHours`)
- Persists to localStorage for cross-session learning
- Auto-prunes low-scoring entries (max 100 terms, 10 items per term)

No configuration needed - it works automatically!

### Parameter Highlighting

Parameters in commands are automatically color-coded:

```typescript
// When user types: "Go to user 123 comment 456"
// - "123" is highlighted in blue
// - "456" is highlighted in green
```

5 colors cycle for multiple parameters: blue, green, orange, pink, cyan (with dark mode variants).

## Keyboard Shortcuts

### General Navigation
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+K` | Open menu |
| `/` | Open menu (when no input focused) |
| `↑` / `↓` | Navigate items |
| `Enter` | Execute selected item |
| `Escape` | Close menu |
| `Tab` / `→` | Complete item label (when searching) |

### Autocomplete (Parameter Selection)
| Shortcut | Action |
|----------|--------|
| `Tab` | Show autocomplete overlay / Select suggestion |
| `↑` / `↓` | Navigate suggestions |
| `Enter` | Select suggestion |
| `Escape` | Close overlay |

### Zsh-like Editing
| Shortcut | Action |
|----------|--------|
| `Ctrl+W` | Delete last word |
| `Ctrl+U` | Clear entire line |
| `Ctrl+Backspace` | Delete last word |
| `Alt+Backspace` | Delete last word |
| `Ctrl+A` | Move to beginning |
| `Ctrl+E` | Move to end |

## Styling

Gigamenu uses Tailwind CSS and supports dark mode. By default, it uses the `dark` class on `<html>`, but this is customizable via the `darkModeClass` configuration option:

```typescript
this.gigamenu.configure({
  darkModeClass: 'dark-theme', // Use your custom class name
});
```

## License

MIT
