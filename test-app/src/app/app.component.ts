import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { GigamenuComponent, GigamenuService } from '@flxgde/gigamenu';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GigamenuComponent],
  template: `
    <div class="p-8">
      <header class="mb-8">
        <h1 class="text-2xl font-bold mb-2">Gigamenu Test App</h1>
        <p class="text-neutral-600 dark:text-neutral-400">
          Press <kbd class="px-2 py-1 bg-neutral-200 dark:bg-neutral-800 rounded">Ctrl+K</kbd> or
          <kbd class="px-2 py-1 bg-neutral-200 dark:bg-neutral-800 rounded">/</kbd> to open the command palette
        </p>
      </header>

      <main>
        <router-outlet />
      </main>
    </div>

    <gm-gigamenu />
  `,
})
export class AppComponent implements OnInit {
  private readonly gigamenu = inject(GigamenuService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    // Set the router for navigation features
    this.gigamenu.setRouter(this.router);

    // Configure the menu
    this.gigamenu.configure({
      placeholder: 'Search pages and commands...',
      maxResults: 10,
    });

    // Auto-discover routes from the router, but exclude /users/:id (we register it manually with autocomplete)
    this.gigamenu.discoverRoutes({
      filter: (route) => {
        // Exclude /users/:id since we register it manually with autocomplete
        return route.fullPath !== '/users/:id';
      },
    });

    // Register some custom commands
    this.gigamenu.registerCommand({
      id: 'cmd:toggle-theme',
      label: 'Toggle Theme',
      description: 'Switch between light and dark mode',
      icon: '🌓',
      keywords: ['dark', 'light', 'mode'],
      action: () => {
        this.gigamenu.toggleDarkMode();
      },
    });

    this.gigamenu.registerCommand({
      id: 'cmd:alert',
      label: 'Show Alert',
      description: 'Display an alert with custom message',
      icon: '💬',
      keywords: ['message', 'popup'],
      action: (args) => {
        alert(args || 'Hello from Gigamenu!');
      },
    });

    this.gigamenu.registerCommand({
      id: 'cmd:copy-url',
      label: 'Copy Current URL',
      description: 'Copy the current page URL to clipboard',
      icon: '📋',
      keywords: ['clipboard', 'link'],
      action: () => {
        navigator.clipboard.writeText(window.location.href);
      },
    });

    // User data for autocomplete examples
    const users = [
      { id: '1', name: 'Alice Johnson' },
      { id: '2', name: 'Bob Smith' },
      { id: '3', name: 'Felix Gebauer' },
      { id: '4', name: 'Diana Prince' },
      { id: '5', name: 'Eve Anderson' },
    ];

    // Register a PAGE with autocomplete (navigates to /users/:id)
    this.gigamenu.registerPage({
      id: 'page:user-profile',
      path: '/users/:id',
      label: 'User Profile',
      description: 'Navigate to user profile by name',
      icon: '👤',
      keywords: ['user', 'profile', 'person'],
      params: ['id'],  // Override auto-extracted param name for clarity
      paramProviders: {
        id: users.map((u) => ({ label: u.name, value: u.id })),
      },
    });

  }
}
