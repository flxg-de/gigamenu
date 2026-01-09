import { GigamenuItem, AutocompleteOption } from '../types';

/**
 * Compute the current parameter index being edited.
 * Returns null if no parameter is being edited.
 */
export function computeCurrentParamIndex(
  item: GigamenuItem | null,
  args: string,
  argsCount: number
): number | null {
  if (!item || !item.params || item.params.length === 0) return null;

  const endsWithSpace = args.endsWith(' ');

  // If user is still typing a param (no trailing space) and has typed at least one arg
  if (!endsWithSpace && argsCount > 0 && argsCount <= item.params.length) {
    return argsCount - 1; // Currently editing the last typed arg
  }

  // If we have fewer args than params, we're about to type the next param
  if (argsCount < item.params.length) return argsCount;

  // All params complete (with trailing space confirming completion)
  return null;
}

/**
 * Get the name of the current parameter being edited.
 */
export function computeCurrentParamName(
  item: GigamenuItem | null,
  paramIndex: number | null
): string | null {
  if (paramIndex === null || !item || !item.params) return null;
  return item.params[paramIndex] ?? null;
}

/**
 * Compute the current partial value of the parameter being edited.
 */
export function computeCurrentParamValue(
  args: string,
  argsArray: string[],
  paramIndex: number | null
): string {
  const trimmedArgs = args.trim();
  if (!trimmedArgs) return '';
  if (paramIndex === null) return '';

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
}

/**
 * Check if the selected item can be executed (has all required params).
 */
export function computeCanExecute(
  item: GigamenuItem | null,
  argsCount: number
): boolean {
  if (!item) return false;
  if (!item.params || item.params.length === 0) return true;
  return argsCount >= item.params.length;
}

/**
 * Get completed arguments for display (excludes the incomplete arg being typed).
 */
export function computeCompletedArgsDisplay(
  display: string[],
  args: string
): string[] {
  const endsWithSpace = args.endsWith(' ');

  // If args ends with space, all args are complete
  if (endsWithSpace || !args) return display;

  // Otherwise, exclude the last incomplete arg (shown in currentParamValue)
  return display.slice(0, -1);
}

/**
 * Get actual values for args (substituting labels with values from selected options).
 */
export function computeArgsValues(
  argsArray: string[],
  selectedOptions: Map<number, AutocompleteOption>
): string[] {
  return argsArray.map((arg, index) => {
    const option = selectedOptions.get(index);
    // If we have a selected option for this param and the current arg matches its label, use the value
    if (option && arg === option.label) {
      return option.value;
    }
    return arg;
  });
}

/**
 * Check if the selected item has autocomplete available for the current param.
 */
export function computeHasAutocomplete(
  item: GigamenuItem | null,
  paramName: string | null
): boolean {
  if (!item || !paramName) return false;
  return !!(item.paramProviders?.[paramName]);
}
