import type { LocalitySuggestionDto } from './api';

export interface LocalitySearchState {
  query: string;
  suggestions: LocalitySuggestionDto[];
  isLoading: boolean;
  error: string | null;
}

/** Cancels pending work and discards old results even when a transport ignores cancellation. */
export class LocalitySearchController {
  private revision = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;

  constructor(
    private readonly search: (query: string, signal: AbortSignal) => Promise<LocalitySuggestionDto[]>,
    private readonly publish: (state: LocalitySearchState) => void,
    private readonly debounceMs = 350,
  ) { }

  update(query: string): void {
    this.cancel();
    const revision = this.revision;
    const isSearchable = query.trim().length >= 2;
    this.publish({ query, suggestions: [], isLoading: isSearchable, error: null });
    if (!isSearchable) return;
    const abort = this.abort = new AbortController();
    this.timer = setTimeout(async () => {
      try {
        const suggestions = await this.search(query.trim(), abort.signal);
        if (revision === this.revision && !abort.signal.aborted)
          this.publish({ query, suggestions, isLoading: false, error: null });
      } catch (error: any) {
        if (revision === this.revision && !abort.signal.aborted)
          this.publish({ query, suggestions: [], isLoading: false, error: error?.message || 'Location search is unavailable. Please try again.' });
      }
    }, this.debounceMs);
  }

  cancel(): void {
    this.revision++;
    clearTimeout(this.timer);
    this.abort?.abort();
  }
}
