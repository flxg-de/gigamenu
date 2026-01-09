import { GigamenuItem, AutocompleteOption } from '../types';

/**
 * Actions that can be dispatched from keyboard handlers.
 */
export type MenuAction =
  | { type: 'setSelectedIndex'; value: number }
  | { type: 'setQuery'; value: string }
  | { type: 'executeAction'; item: GigamenuItem }
  | { type: 'executeLockedAction' }
  | { type: 'close' }
  | { type: 'toggle' }
  | { type: 'open' }
  | { type: 'scrollIntoView' }
  | { type: 'lockAction'; item: GigamenuItem }
  | { type: 'unlockAction' }
  | { type: 'nextParameter' }
  | { type: 'previousParameter' }
  | { type: 'selectSuggestion'; option: AutocompleteOption };

/**
 * Context for global keyboard handling.
 */
export interface GlobalKeydownContext {
  isOpen: boolean;
  isInputFocused: boolean;
}

/**
 * Handle global keydown events (Ctrl+K, /, Escape).
 * Returns action if handled, null otherwise.
 */
export function handleGlobalKeydown(
  event: KeyboardEvent,
  ctx: GlobalKeydownContext
): MenuAction | null {
  // Ctrl/Cmd + K: Toggle menu
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    return { type: 'toggle' };
  }

  // /: Open menu (only when no input is focused)
  if (event.key === '/' && !ctx.isInputFocused) {
    return { type: 'open' };
  }

  // Escape: Close menu (only when input is NOT focused - let input handler deal with it)
  if (event.key === 'Escape' && ctx.isOpen && !ctx.isInputFocused) {
    return { type: 'close' };
  }

  return null;
}

/**
 * Context for action selection state.
 */
export interface ActionSelectionContext {
  items: GigamenuItem[];
  selectedIndex: number;
  selectedItem: GigamenuItem | null;
}

/**
 * Handle keyboard events in ActionSelection state.
 */
export function handleActionSelectionKeydown(
  event: KeyboardEvent,
  ctx: ActionSelectionContext
): MenuAction[] {
  const actions: MenuAction[] = [];
  const item = ctx.selectedItem;

  switch (event.key) {
    case 'ArrowDown':
      actions.push({
        type: 'setSelectedIndex',
        value: Math.min(ctx.selectedIndex + 1, ctx.items.length - 1),
      });
      actions.push({ type: 'scrollIntoView' });
      break;

    case 'ArrowUp':
      actions.push({
        type: 'setSelectedIndex',
        value: Math.max(ctx.selectedIndex - 1, 0),
      });
      actions.push({ type: 'scrollIntoView' });
      break;

    case 'Tab':
      if (item) {
        // Tab: always tries to go to params first, or execute if no params
        if (item.params && item.params.length > 0) {
          actions.push({ type: 'lockAction', item });
        } else {
          actions.push({ type: 'executeAction', item });
        }
      }
      break;

    case 'Enter':
      if (item) {
        const hasRequiredParams = item.params && item.params.length > 0 && !hasOnlyOptionalParams(item);
        if (hasRequiredParams) {
          // Has required params - go to parameter input
          actions.push({ type: 'lockAction', item });
        } else {
          // No params or only optional - execute immediately
          actions.push({ type: 'executeAction', item });
        }
      }
      break;

    case 'Escape':
      actions.push({ type: 'close' });
      break;
  }

  return actions;
}

/**
 * Context for parameter input state.
 */
export interface ParameterInputContext {
  lockedItem: GigamenuItem;
  currentParamIndex: number;
  paramValues: string[];
  query: string;
  suggestions: AutocompleteOption[];
  selectedSuggestionIndex: number;
}

/**
 * Handle keyboard events in ParameterInput state.
 */
export function handleParameterInputKeydown(
  event: KeyboardEvent,
  ctx: ParameterInputContext
): MenuAction[] {
  const actions: MenuAction[] = [];
  const item = ctx.lockedItem;
  const params = item.params ?? [];
  const currentParam = params[ctx.currentParamIndex];
  const isLastParam = ctx.currentParamIndex >= params.length - 1;
  const hasSuggestions = ctx.suggestions.length > 0;

  switch (event.key) {
    case 'ArrowDown':
      if (hasSuggestions) {
        actions.push({
          type: 'setSelectedIndex',
          value: Math.min(ctx.selectedSuggestionIndex + 1, ctx.suggestions.length - 1),
        });
        actions.push({ type: 'scrollIntoView' });
      }
      break;

    case 'ArrowUp':
      if (hasSuggestions) {
        actions.push({
          type: 'setSelectedIndex',
          value: Math.max(ctx.selectedSuggestionIndex - 1, 0),
        });
        actions.push({ type: 'scrollIntoView' });
      }
      break;

    case 'Tab':
      // Tab: select suggestion (if any), then go to next param or execute
      if (hasSuggestions) {
        actions.push({ type: 'selectSuggestion', option: ctx.suggestions[ctx.selectedSuggestionIndex] });
      }
      if (isLastParam) {
        // Execute - args will be built at dispatch time from current state
        actions.push({ type: 'executeLockedAction' });
      } else {
        actions.push({ type: 'nextParameter' });
      }
      break;

    case 'Enter':
      // Enter: select suggestion if any
      if (hasSuggestions && ctx.selectedSuggestionIndex >= 0) {
        actions.push({ type: 'selectSuggestion', option: ctx.suggestions[ctx.selectedSuggestionIndex] });
      }

      if (isLastParam) {
        // Execute - args will be built at dispatch time from current state
        actions.push({ type: 'executeLockedAction' });
      } else {
        // More params - go to next (Enter acts like Tab when more required params)
        actions.push({ type: 'nextParameter' });
      }
      break;

    case 'Escape':
      // Escape: go back one step (like Backspace on empty)
      if (ctx.currentParamIndex > 0) {
        // Go to previous parameter
        actions.push({ type: 'previousParameter' });
      } else {
        // At first param, go back to action selection
        actions.push({ type: 'unlockAction' });
      }
      break;

    case 'Backspace':
      // Backspace when query is empty: go back
      if (ctx.query === '') {
        if (ctx.currentParamIndex > 0) {
          // Go to previous parameter
          actions.push({ type: 'previousParameter' });
        } else {
          // At first param, go back to action selection
          actions.push({ type: 'unlockAction' });
        }
      }
      break;
  }

  return actions;
}

/**
 * Check if item has only optional parameters (none required).
 * For now, we treat all params as required. Can be extended later.
 */
function hasOnlyOptionalParams(_item: GigamenuItem): boolean {
  // TODO: Add optional param support to GigamenuItem type
  return false;
}

/**
 * Handle zsh-like keyboard shortcuts (Ctrl+W, Ctrl+U).
 * Returns the new query if handled, null otherwise.
 */
export function handleZshShortcuts(
  event: KeyboardEvent,
  query: string
): string | null {
  // Ctrl+W or Alt+Backspace or Ctrl+Backspace: Delete last word
  if (
    (event.ctrlKey && event.key === 'w') ||
    (event.altKey && event.key === 'Backspace') ||
    (event.ctrlKey && event.key === 'Backspace')
  ) {
    return deleteLastWord(query);
  }

  // Ctrl+U: Clear line
  if (event.ctrlKey && event.key === 'u') {
    return '';
  }

  return null;
}

/**
 * Delete the last word from the query.
 */
export function deleteLastWord(query: string): string {
  if (!query) return '';

  let newQuery = query.replace(/\s+$/, '');
  const lastSpaceIndex = newQuery.lastIndexOf(' ');
  if (lastSpaceIndex !== -1) {
    newQuery = newQuery.substring(0, lastSpaceIndex);
  } else {
    newQuery = '';
  }

  return newQuery;
}

/**
 * Check if any actions were generated.
 */
export function hasActions(actions: MenuAction[]): boolean {
  return actions.length > 0;
}
