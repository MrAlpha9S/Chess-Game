import { Loader2, Crown } from 'lucide-react';

interface LoadingAnimationProps {
  /** The style of the animation. */
  variant?: 'matchmaking' | 'board-init' | 'spinner';
  /** The size of the animation. */
  size?: 'sm' | 'md' | 'lg';
  /** The text shown under the animation. */
  label?: string;
}

const SIZES = {
  sm: { box: 'w-8 h-8', icon: 'w-8 h-8', text: 'text-sm' },
  md: { box: 'w-12 h-12', icon: 'w-12 h-12', text: 'text-base' },
  lg: { box: 'w-16 h-16', icon: 'w-16 h-16', text: 'text-lg' },
};

/**
 * The loading indicator shown while the app waits for the database.
 *
 * Three variants cover the places a wait can happen: a plain spinner for
 * short waits, a board-shaped hint while the position is being set up, and a
 * crown for a wait on another player.
 */
export function LoadingAnimation({
  variant = 'spinner',
  size = 'md',
  label,
}: LoadingAnimationProps) {
  const sizing = SIZES[size];

  if (variant === 'matchmaking') {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className={`${sizing.box} relative`}>
          <Crown className={`${sizing.icon} text-card-gold animate-pulse`} />
        </div>
        {label && <p className={`${sizing.text} text-text-muted`}>{label}</p>}
      </div>
    );
  }

  if (variant === 'board-init') {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div
          className={`${sizing.box} grid grid-cols-2 gap-0.5 p-1 rounded border border-line`}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className={`w-full aspect-square rounded-sm ${i % 2 === 0 ? 'bg-square-light' : 'bg-square-dark'}`}
            />
          ))}
        </div>
        {label && <p className={`${sizing.text} text-text-muted`}>{label}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Loader2 className={`${sizing.icon} text-card-gold animate-spin`} />
      {label && <p className={`${sizing.text} text-text-muted`}>{label}</p>}
    </div>
  );
}
