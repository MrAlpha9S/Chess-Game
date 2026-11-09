import { useEffect, useRef, useState } from 'react';

interface ClockDisplayProps {
  /** The time left on the clock, in seconds. */
  initialTime: number;
  /** True when this clock is the one running. */
  isRunning: boolean;
  /** The time added after each move, in seconds. */
  increment?: number;
  /** Called when the clock reaches zero. */
  onTimeUp?: () => void;
}

/**
 * A clock display for a single side.
 *
 * The remaining time comes from the room and is counted down locally, so the
 * display is smooth without a write per frame. The authoritative value is
 * pushed back into `initialTime` by whoever owns the clock.
 */
export function ClockDisplay({
  initialTime,
  isRunning,
  increment = 0,
  onTimeUp,
}: ClockDisplayProps) {
  // The countdown state, together with the stored value it was derived from.
  // A new stored value resets the countdown; the comparison happens during
  // render so that no effect has to set state.
  const [clock, setClock] = useState({ storedTime: initialTime, timeLeft: initialTime });

  if (clock.storedTime !== initialTime) {
    setClock({ storedTime: initialTime, timeLeft: initialTime });
  }

  const timeLeft = clock.storedTime === initialTime ? clock.timeLeft : initialTime;

  const lastUpdateRef = useRef(0);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [initialTime]);

  useEffect(() => {
    if (!isRunning) {
      lastUpdateRef.current = Date.now();
      return;
    }

    if (lastUpdateRef.current === 0) {
      lastUpdateRef.current = Date.now();
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      setClock((current) => {
        const next = Math.max(0, current.timeLeft - delta);
        if (next <= 0 && !firedRef.current) {
          firedRef.current = true;
          onTimeUp?.();
        }
        return { ...current, timeLeft: next };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, onTimeUp]);

  const isLow = timeLeft <= 10;
  const isVeryLow = timeLeft <= 5;

  // The increment is added once the clock stops, so it is not counted down.
  const displayed = isRunning ? timeLeft : timeLeft + increment;

  return (
    <div
      className={`
        font-mono text-2xl md:text-3xl font-bold tabular-nums
        px-4 py-2 rounded-lg
        transition-colors duration-200
        ${isRunning ? 'bg-surface-raised' : 'bg-surface'}
        ${isVeryLow ? 'text-danger animate-pulse' : isLow ? 'text-danger' : 'text-text'}
      `}
    >
      {formatTime(displayed)}
      {isLow && (
        <span className="ml-1 text-sm animate-ping opacity-50">⏰</span>
      )}
    </div>
  );
}

/** Format a duration in seconds as MM:SS. */
function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
