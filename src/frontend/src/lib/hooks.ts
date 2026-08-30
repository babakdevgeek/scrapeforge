import { useCallback, useEffect, useRef, useState } from 'react';

/** Tiny data-fetching hook: enough for a localhost app, no client cache needed. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fn();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError((err as Error).message);
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    void run();
    return () => {
      mounted.current = false;
    };
  }, [run]);

  return { data, error, loading, reload: run, setData };
}

export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useInterval(callback: () => void, ms: number | null) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    if (ms === null) return;
    const timer = setInterval(() => ref.current(), ms);
    return () => clearInterval(timer);
  }, [ms]);
}
