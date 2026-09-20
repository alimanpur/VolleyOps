import { useCallback, useEffect, useRef, useState } from 'react';
import { scorerService } from '../services/scorerService.js';
import { ApiError } from '../services/apiError.js';

/*
 * Offline-tolerant scoring outbox (spec §11).
 *
 * Every rally is assigned a unique clientEventId and appended to a queue that is
 * persisted in localStorage keyed by match. Events flush to the server strictly
 * in order. Because the server is idempotent on (match, clientEventId), a replay
 * after reconnect can never create a duplicate point.
 *
 * Failure handling:
 *  - Network error  -> keep the queue, retry on interval and on 'online'.
 *  - Server rejection (4xx/409) -> STOP, surface the message, preserve the queue.
 *    The caller must resolve before scoring continues (no unsafe continuation).
 *
 * The authoritative match state returned by the server is exposed via onSynced
 * so the console always reconciles to server truth.
 */
export function useScoringOutbox(matchId, { onSynced } = {}) {
  const storageKey = `vops_outbox_${matchId}`;
  const [pending, setPending] = useState(() => readQueue(storageKey));
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const flushing = useRef(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const persist = useCallback(
    (queue) => {
      setPending(queue);
      try {
        localStorage.setItem(storageKey, JSON.stringify(queue));
      } catch {
        /* storage full/unavailable — queue still lives in memory */
      }
    },
    [storageKey]
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSyncing(true);
    try {
      let queue = readQueue(storageKey);
      while (queue.length > 0) {
        const event = queue[0];
        try {
          const res = await scorerService.rally(matchId, event);
          // Success (or idempotent duplicate) — drop the head, reconcile state.
          queue = queue.slice(1);
          persist(queue);
          setError(null);
          if (res?.match && onSyncedRef.current) onSyncedRef.current(res);
        } catch (err) {
          if (err instanceof ApiError && err.status === 0) {
            // Network problem — stop, keep the queue, we'll retry later.
            break;
          }
          // Server rejected the event: do not continue unsafely.
          setError(err.message || 'The server rejected a scoring event');
          break;
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
  }, [matchId, storageKey, persist]);

  const enqueue = useCallback(
    (event) => {
      const withId = { clientEventId: cryptoId(), ...event };
      const queue = [...readQueue(storageKey), withId];
      persist(queue);
      // Try to flush immediately; if offline it stays queued.
      flush();
      return withId.clientEventId;
    },
    [storageKey, persist, flush]
  );

  // Undo requires the server (it re-derives state); it is not queued offline.
  const undo = useCallback(async () => {
    if (!online) {
      setError('Undo needs a connection. Reconnect to undo the last point.');
      return null;
    }
    setSyncing(true);
    try {
      const res = await scorerService.undo(matchId);
      if (res?.match && onSyncedRef.current) onSyncedRef.current(res);
      setError(null);
      return res;
    } catch (err) {
      setError(err.message || 'Undo failed');
      return null;
    } finally {
      setSyncing(false);
    }
  }, [matchId, online]);

  const clearError = useCallback(() => setError(null), []);

  // Retry on reconnect and on a slow interval while events are pending.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = setInterval(() => {
      if (readQueue(storageKey).length > 0 && !error) flush();
    }, 5000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, [flush, storageKey, error]);

  return {
    enqueue,
    undo,
    flush,
    clearError,
    pending: pending.length,
    pendingEvents: pending,
    syncing,
    error,
    online,
  };
}

function readQueue(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
