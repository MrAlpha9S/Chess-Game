import { useState, useEffect, useRef } from 'react';

interface ClockDisplayProps {
  initialTime: number;
  isRunning: boolean;
  increment?: number;
  onTimeUp?: () => void;
}

export function ClockDisplay({
  initialTime,
  isRunning,
  increment: _increment = 0,
  onTimeUp,
}: ClockDisplayProps) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const lastUpdateRef = useRef(Date.now());

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Update timer
  useEffect(() => {
    if (!isRunning) {
      lastUpdateRef.current = Date.now();
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      setTimeLeft((prev) => {
        const newTime = Math.max(0, prev - delta);
        if (newTime <= 0 && onTimeUp) {
          onTimeUp();
        }
        return newTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, onTimeUp]);

  const isLow = timeLeft <= 10;
  const isVeryLow = timeLeft <= 5;

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
      {formatTime(timeLeft)}
      {isLow && (
        <span className="ml-1 text-sm animate-ping opacity-50">⏰</span>
      )}
    </div>
  );
}
