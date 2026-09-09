import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { isDemoActive, onDemoModeChange } from '../services/demoMode';

export function useApi<T>(fetchFn: () => Promise<T>) {
  const demoActive = useSyncExternalStore(onDemoModeChange, isDemoActive, isDemoActive);
  const [modeGeneration, setModeGeneration] = useState(0);
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null; demo: boolean }>(
    { data: null, loading: true, error: null, demo: demoActive });
  const latestFetch = useRef(fetchFn);
  const generation = useRef(0);
  const mounted = useRef(false);

  useEffect(() => { latestFetch.current = fetchFn; }, [fetchFn]);

  const refetch = useCallback(async () => {
    if (!mounted.current) return;
    const current = ++generation.current;
    const demo = isDemoActive();
    setState(previous => ({ data: previous.demo === demo ? previous.data : null, loading: true, error: null, demo }));
    try {
      const data = await latestFetch.current();
      if (mounted.current && current === generation.current && demo === isDemoActive()) {
        setState({ data, loading: false, error: null, demo });
      }
    } catch (e) {
      if (mounted.current && current === generation.current && demo === isDemoActive()) {
        setState(previous => ({ ...previous, loading: false, error: e instanceof Error ? e.message : 'An error occurred' }));
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = onDemoModeChange(() => {
      // Invalidate synchronously, including a switch away and back before React renders.
      generation.current += 1;
      setState({ data: null, loading: true, error: null, demo: isDemoActive() });
      setModeGeneration(value => value + 1);
    });
    return () => { mounted.current = false; generation.current += 1; unsubscribe(); };
  }, []);

  useEffect(() => {
    void refetch();
    return () => { generation.current += 1; };
  }, [demoActive, modeGeneration, refetch]);

  const currentMode = state.demo === demoActive;
  return { data: currentMode ? state.data : null, loading: !currentMode || state.loading,
    error: currentMode ? state.error : null, refetch };
}
