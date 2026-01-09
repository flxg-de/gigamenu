/**
 * Scroll the selected menu item into view.
 */
export function scrollSelectedIntoView(
  container: HTMLElement | null,
  selectedIndex: number
): void {
  if (!container) return;

  const selectedButton = container.querySelector(
    `[data-index="${selectedIndex}"]`
  ) as HTMLElement | null;

  if (selectedButton) {
    selectedButton.scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Scroll the selected autocomplete suggestion into view.
 */
export function scrollAutocompleteIntoView(
  container: HTMLElement | null,
  selectedIndex: number
): void {
  if (!container) return;

  const selectedButton = container.querySelector(
    `[data-autocomplete-index="${selectedIndex}"]`
  ) as HTMLElement | null;

  if (selectedButton) {
    selectedButton.scrollIntoView({ block: 'nearest' });
  }
}
