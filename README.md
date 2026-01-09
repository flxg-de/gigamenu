# Gigamenu

A keyboard-driven command palette menu for Angular applications. Inspired by VS Code's Command Palette, Spotlight and zsh-completion.

## Features

- **Keyboard shortcuts**: `Ctrl/Cmd+K` and `/` (when no input is focused)
- **Auto-discovery**: Routes from Angular Router with filtering and mapping
- **Command registration**: With parameters, keywords, and icon support
- **Step-by-step input**: Select action first, then fill parameters one at a time
- **Keyboard navigation**: Arrow keys, Enter, Escape, Tab for step progression
- **Zsh-like editing**: `Ctrl+W` delete word, `Ctrl+U` clear line, and more
- **Smart search**: Multi-word fuzzy filtering with keyword matching
- **Frecency ranking**: Learns from your usage patterns
- **Parameter autocomplete**: Suggestions shown in main list during parameter input
- **Breadcrumb navigation**: Visual trail of locked action + filled parameters
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

### 4. Commands with Parameters

Commands can define parameters that are filled in step-by-step:

```typescript
this.gigamenu.registerCommand({
  id: 'cmd:send-message',
  label: 'Send Message',
  description: 'Send a message to a user',
  icon: '💬',
  keywords: ['message', 'chat', 'notify'],
  params: ['user', 'message'], // Parameters filled one at a time
  paramProviders: {
    user: [
      { label: 'Alice', value: 'user-1' },
      { label: 'Bob', value: 'user-2' },
    ],
  },
  action: (args) => {
    // args contains space-separated parameter values
    console.log('Sending:', args);
  },
});
```

**Step-by-step flow:**
1. User searches "Send Message" and presses Tab/Enter
2. Action is locked, input clears for "user" parameter
3. Autocomplete suggestions appear in the list
4. User selects or types a value, presses Tab
5. Input clears for "message" parameter
6. User types message, presses Enter to execute

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

  <!-- Custom header with breadcrumb support -->
  <ng-template gmHeader let-query
               let-lockedAction="lockedAction"
               let-paramValues="paramValues"
               let-currentParamName="currentParamName"
               let-onQueryChange="onQueryChange"
               let-onKeydown="onKeydown"
               let-onUnlockAction="onUnlockAction"
               let-placeholder="placeholder">
    <!-- Show breadcrumb when action is locked -->
    @if (lockedAction) {
      <div class="breadcrumb">
        <button (click)="onUnlockAction()">{{ lockedAction.label }}</button>
        @for (value of paramValues; track $index) {
          <span>›</span>
          <span>{{ lockedAction.params?.[$index] }}: {{ value }}</span>
        }
        @if (currentParamName) {
          <span>› {{ currentParamName }}:</span>
        }
      </div>
    }
    <input
      [value]="query"
      [placeholder]="lockedAction ? currentParamName : placeholder"
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
  argSeparator?: string;     // Separator between args when passed to action
  darkModeClass?: string;    // CSS class for dark mode (default: 'dark')
}
```

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
| `gmHeader` | Search input and header area | `query`, `lockedAction`, `paramValues`, `currentParamName`, `placeholder`, `onQueryChange`, `onKeydown`, `onUnlockAction`, `onGoToParam` |
| `gmFooter` | Footer/status area | `count` (filtered), `total` (all items) |
| `gmPanel` | Entire panel container | `items`, `query`, `lockedAction`, `paramValues`, `selectedIndex`, `placeholder`, `onItemClick`, `onSelectIndex`, `onQueryChange`, `onClose` |

## Advanced Features

### Step-by-Step Input Flow

Gigamenu uses a step-by-step approach for commands with parameters:

**State Machine:**
1. **ActionSelection**: Search and select an action from the list
2. **ParameterInput**: Fill in parameters one at a time (when action has params)

**Behavior by Action Type:**
- **No params**: Tab or Enter executes immediately
- **Required params**: Tab or Enter locks action, enters parameter input mode
- **Optional params**: Enter executes, Tab enters parameter input mode

**Parameter Input Mode:**
- Input field only captures the current parameter value
- Main list shows autocomplete suggestions (if `paramProviders` defined)
- Breadcrumb shows: `[Action] › [param1: value] › [param2: value] › current:`
- Navigate suggestions with arrow keys, select with Tab or Enter

**Navigation:**
- Backspace (on empty) or Escape: Go back to previous parameter
- At first parameter: Go back to action selection
- Click breadcrumb items to jump back to any step

### Frecency-Based Ranking

Gigamenu uses intelligent ranking based on **frequency** and **recency** of selections:

- Learns from your usage patterns
- Recent selections are weighted higher
- Automatically selects frequently used items
- Decays scores over time (formula: `count × 0.9^ageInHours`)
- Persists to localStorage for cross-session learning
- Auto-prunes low-scoring entries (max 100 terms, 10 items per term)

No configuration needed - it works automatically!

### Parameter Color Coding

Filled parameter values in the breadcrumb are color-coded:

```
[Send Message] › [user: Alice] › [message: Hello]
                  ↑ blue          ↑ green
```

5 colors cycle for multiple parameters: blue, green, orange, pink, cyan (with dark mode variants).

## Keyboard Shortcuts

### Action Selection Mode
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+K` | Open/toggle menu |
| `/` | Open menu (when no input focused) |
| `↑` / `↓` | Navigate items |
| `Enter` | Execute (or enter param mode if required params) |
| `Tab` | Enter param mode (or execute if no params) |
| `Escape` | Close menu |

### Parameter Input Mode
| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate autocomplete suggestions |
| `Tab` | Accept suggestion + next param (or execute if last) |
| `Enter` | Accept suggestion + next param (or execute if last) |
| `Backspace` (empty) | Go back to previous param |
| `Escape` | Go back to previous param (or action selection) |

### Zsh-like Editing
| Shortcut | Action |
|----------|--------|
| `Ctrl+W` | Delete last word |
| `Ctrl+U` | Clear entire line |
| `Ctrl+Backspace` | Delete last word |
| `Alt+Backspace` | Delete last word |

## Styling

Gigamenu uses Tailwind CSS and supports dark mode. By default, it uses the `dark` class on `<html>`, but this is customizable via the `darkModeClass` configuration option:

```typescript
this.gigamenu.configure({
  darkModeClass: 'dark-theme', // Use your custom class name
});
```

## Architecture

For contributors and maintainers, here's an overview of the codebase structure:

### File Structure

```
src/lib/
├── gigamenu.component.ts       # Main component (~520 lines, orchestrator)
├── gigamenu.component.html     # Template
├── gigamenu.service.ts         # State management service
├── frecency.service.ts         # Usage-based ranking
├── types.ts                    # Type definitions
├── query-parser.ts             # Query/args parsing
├── input-state.ts              # State machine enum
├── gigamenu-templates.directive.ts  # Template directives
└── core/                       # Pure functions (business logic)
    ├── index.ts                # Barrel export
    ├── scroll-utils.ts         # DOM scroll helpers
    ├── search.ts               # Filtering & sorting
    ├── parameter-state.ts      # Parameter computations
    ├── template-contexts.ts    # Template context builders
    ├── menu-lifecycle.ts       # Menu state utilities
    ├── autocomplete.ts         # Autocomplete logic
    └── keyboard-handlers.ts    # Keyboard handlers + actions
```

### Design Principles

- **Separation of concerns**: Business logic lives in `core/` as pure, testable functions
- **Action dispatch pattern**: Keyboard handlers return `MenuAction[]` objects instead of mutating state
- **State machine**: `InputState` enum (Closed, ActionSelection, ParameterInput) drives behavior
- **Step-by-step flow**: Input parses one thing at a time (action search OR parameter value)
- **Angular signals**: All reactive state uses `signal()` and `computed()`

## License

MIT
