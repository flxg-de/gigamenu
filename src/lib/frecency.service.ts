import { Injectable, PLATFORM_ID, Inject, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GigamenuService } from './gigamenu.service';

interface FrecencyEntry {
  itemId: string;
  count: number;
  lastUsed: number;
}

interface FrecencyData {
  [searchTerm: string]: FrecencyEntry[];
}

const STORAGE_KEY = 'gigamenu_frecency';
const GLOBAL_KEY = '__global__';
const MAX_ENTRIES_PER_TERM = 10;
const MAX_TERMS = 100;
const DECAY_FACTOR = 0.9;

@Injectable({ providedIn: 'root' })
export class FrecencyService {
  private data: FrecencyData = {};
  private readonly isBrowser: boolean;
  private readonly gigamenu = inject(GigamenuService);

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.load();
  }

  /**
   * Record that an item was selected for a given search term.
   */
  recordSelection(searchTerm: string, itemId: string): void {
    if (!this.enabled) return;
    // Always record to global for overall frecency
    this.recordToKey(GLOBAL_KEY, itemId);

    // Also record to specific search term if provided
    const normalizedTerm = this.normalizeTerm(searchTerm);
    if (normalizedTerm) {
      this.recordToKey(normalizedTerm, itemId);
    }

    this.pruneAndSave();
  }

  private recordToKey(key: string, itemId: string): void {
    if (!this.data[key]) {
      this.data[key] = [];
    }

    const entries = this.data[key];
    const existing = entries.find((e) => e.itemId === itemId);

    if (existing) {
      existing.count++;
      existing.lastUsed = Date.now();
    } else {
      entries.push({
        itemId,
        count: 1,
        lastUsed: Date.now(),
      });
    }

    // Keep only top entries
    this.data[key] = entries
      .sort((a, b) => this.calculateScore(b) - this.calculateScore(a))
      .slice(0, MAX_ENTRIES_PER_TERM);
  }

  /**
   * Get frecency scores for items matching a search term.
   * Returns a map of itemId -> score (higher is better).
   */
  getScores(searchTerm: string): Map<string, number> {
    const scores = new Map<string, number>();
    if (!this.enabled) return scores;
    const normalizedTerm = this.normalizeTerm(searchTerm);

    // If no search term, return global scores
    if (!normalizedTerm) {
      const globalEntries = this.data[GLOBAL_KEY];
      if (globalEntries) {
        for (const entry of globalEntries) {
          scores.set(entry.itemId, this.calculateScore(entry));
        }
      }
      return scores;
    }

    // Exact match for search term
    const exactEntries = this.data[normalizedTerm];
    if (exactEntries) {
      for (const entry of exactEntries) {
        const score = this.calculateScore(entry);
        scores.set(entry.itemId, score);
      }
    }

    // Prefix matches (for partial typing)
    for (const [term, entries] of Object.entries(this.data)) {
      if (term !== GLOBAL_KEY && term !== normalizedTerm && term.startsWith(normalizedTerm)) {
        for (const entry of entries) {
          const currentScore = scores.get(entry.itemId) ?? 0;
          // Prefix matches get reduced weight
          const prefixScore = this.calculateScore(entry) * 0.5;
          scores.set(entry.itemId, Math.max(currentScore, prefixScore));
        }
      }
    }

    return scores;
  }

  /**
   * Get the most likely item for a search term (for auto-selection).
   * Returns itemId if there's a strong match, null otherwise.
   */
  getTopMatch(searchTerm: string): string | null {
    if (!this.enabled) return null;
    const normalizedTerm = this.normalizeTerm(searchTerm);
    if (!normalizedTerm) return null;

    const entries = this.data[normalizedTerm];
    if (!entries || entries.length === 0) return null;

    const topEntry = entries[0];
    const score = this.calculateScore(topEntry);

    // Only auto-select if strong confidence (used multiple times recently)
    if (topEntry.count >= 2 && score > 5) {
      return topEntry.itemId;
    }

    return null;
  }

  /** Disabled via `frecency: false` in the config (reactive, reads a signal). */
  private get enabled(): boolean {
    return this.gigamenu.config().frecency !== false;
  }

  private calculateScore(entry: FrecencyEntry): number {
    const ageInHours = (Date.now() - entry.lastUsed) / (60 * 60 * 24);
    const recencyScore = Math.pow(DECAY_FACTOR, ageInHours);
    return entry.count * recencyScore;
  }

  private normalizeTerm(term: string): string {
    return term.toLowerCase().trim();
  }

  private load(): void {
    if (!this.isBrowser) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.data = JSON.parse(stored);
      }
    } catch {
      this.data = {};
    }
  }

  private pruneAndSave(): void {
    if (!this.isBrowser) return;

    // Prune old terms if we have too many
    const terms = Object.keys(this.data);
    if (terms.length > MAX_TERMS) {
      const termScores = terms.map((term) => ({
        term,
        maxScore: Math.max(...this.data[term].map((e) => this.calculateScore(e))),
      }));
      termScores.sort((a, b) => b.maxScore - a.maxScore);

      const keepTerms = new Set(termScores.slice(0, MAX_TERMS).map((t) => t.term));
      for (const term of terms) {
        if (!keepTerms.has(term)) {
          delete this.data[term];
        }
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or unavailable
    }
  }
}
