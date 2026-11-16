import { useCallback, useEffect, useMemo, useState } from 'react';
import { mobileApi } from '../services/api';
import { LocalitySearchController, LocalitySearchState } from '../services/localitySearchController';

export function useLocalitySearch(query: string) {
  const [state, setState] = useState<LocalitySearchState>({ query: '', suggestions: [], isLoading: false, error: null });
  const [retryRevision, setRetryRevision] = useState(0);
  const controller = useMemo(() => new LocalitySearchController((text, signal) => mobileApi.searchLocalities(text, signal), setState), []);
  useEffect(() => {
    controller.update(query);
    return () => controller.cancel();
  }, [query, retryRevision, controller]);
  const retry = useCallback(() => setRetryRevision(value => value + 1), []);
  // Never expose results from the previous query while React schedules the effect.
  const current = state.query === query ? state : { query, suggestions: [], isLoading: query.trim().length >= 2, error: null };
  return { ...current, retry };
}
