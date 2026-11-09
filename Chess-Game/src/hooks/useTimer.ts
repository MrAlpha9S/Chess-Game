/**
 * The game clock.
 *
 * The clock is shared between the two players, so it cannot live in one
 * browser: the remaining time lives in the room, and both players read it
 * from there.
 *
 * The value in the database is only written once a second, which is far too
 * coarse to display smoothly. The hook therefore interpolates between the
 * last stored value and the current time, and writes the real value back
 * periodically while the local player is on the move.
 */

import { useEffect, useRef, useState } from 'react';

/** How often the clock is written back to the database, in milliseconds. */
const SYNC_INTERVAL_MS = 1000;

/** The clock as it is displayed. */
export interface TimerState {
  /** The time left on the clock, in milliseconds. */
  remainingMs: number;
  /** True when the clock is below ten seconds. */
  isLow: boolean;
  /** True when the clock is below five seconds. */
  isVeryLow: boolean;
}

interface UseTimerOptions {
  /** The time left in the database, in milliseconds. */
  storedRemainingMs: number;
  /** True when this clock is the one currently running. */
  isRunning: boolean;
  /** True when the game is over; the clock stops. */
  isGameOver?: boolean;
  /** Called when the clock reaches zero. */
  onTimeUp?: () => void;
  /** Called with the real remaining time so it can be stored. */
  onSync?: (remainingMs: number) => void;
}

/**
 * Drive a clock from the value stored in the database.
 */
export function useTimer({
  storedRemainingMs,
  isRunning,
  isGameOver = false,
  onTimeUp,
  onSync,
}: UseTimerOptions): TimerState {
  const [remainingMs, setRemainingMs] = useState(storedRemainingMs);

  // The moment the stored value was last read, so the display can be
  // interpolated from it. It starts at zero and is set by the effect below,
  // because reading the clock during render would make the render impure.
  const lastUpdateRef = useRef(0);
  const lastStoredRef = useRef(storedRemainingMs);
  const firedRef = useRef(false);

  const onTimeUpRef = useRef(onTimeUp);
  const onSyncRef = useRef(onSync);
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onSyncRef.current = onSync;
  }, [onTimeUp, onSync]);

  // A new stored value means the other player moved, or the clock was
  // corrected: restart the interpolation from it.
  useEffect(() => {
    if (storedRemainingMs === lastStoredRef.current) return;
    lastStoredRef.current = storedRemainingMs;
    lastUpdateRef.current = Date.now();
    setRemainingMs(storedRemainingMs);
    firedRef.current = false;
  }, [storedRemainingMs]);

  useEffect(() => {
    if (!isRunning || isGameOver) {
      lastUpdateRef.current = Date.now();
      return;
    }

    // The clock starts from the stored value, so the first tick measures
    // from now rather than from whenever the hook happened to be created.
    if (lastUpdateRef.current === 0) {
      lastUpdateRef.current = Date.now();
    }

    const tick = () => {
      const now = Date.now();
      const elapsed = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      setRemainingMs((previous) => {
        const next = Math.max(0, previous - elapsed);
        if (next <= 0 && !firedRef.current) {
          firedRef.current = true;
          onTimeUpRef.current?.();
        }
        return next;
      });
    };

    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [isRunning, isGameOver]);

  // Write the real remaining time back to the database every second.
  useEffect(() => {
    if (!isRunning || isGameOver) return;
    const interval = setInterval(() => {
      onSyncRef.current?.(remainingMs);
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isRunning, isGameOver, remainingMs]);

  return {
    remainingMs,
    isLow: remainingMs <= 10_000,
    isVeryLow: remainingMs <= 5_000,
  };
}

/** Format a duration in milliseconds as MM:SS. */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
