import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fetch-on-mount hook with loading / error / data states and a refetch. Handles
 * the four states every page must show (spec §41): loading, empty, error, retry.
 *
 * @param {Function} fn  a service call returning a promise
 * @param {Array} deps   re-run when these change
 * @param {object} opts  { poll: ms } to re-fetch on an interval (live data)
 */
export function useApi(fn, deps = [], { poll } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const mounted = useRef(true);

  const load = useCallback(async ({ quiet } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const result = await fnRef.current();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mounted.current && err.name !== 'AbortError') setError(err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    let timer;
    if (poll) {
      timer = setInterval(() => load({ quiet: true }), poll);
    }
    return () => {
      mounted.current = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch: load, setData };
}
