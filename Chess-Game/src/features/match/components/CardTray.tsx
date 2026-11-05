import { memo } from 'react';
import type { Card, CardColor } from '../../../types';
import { Lock, Clock, Check } from 'lucide-react';

interface CardTileProps {
  card: Card | null;
  isOwned: boolean;
  isActive?: boolean;
  isLocked?: boolean;
  isUsed?: boolean;
  canUse?: boolean;
  clockThreshold?: number;
  currentTime?: number;
  onClick?: () => void;
}

const CARD_COLORS: Record<CardColor, { bg: string; border: string; text: string; label: string }> = {
  gold: { bg: 'bg-card-gold/10', border: 'border-card-gold', text: 'text-card-gold', label: '🟡' },
  silver: { bg: 'bg-card-silver/10', border: 'border-card-silver', text: 'text-card-silver', label: '⬜' },
  green: { bg: 'bg-card-green/10', border: 'border-card-green', text: 'text-card-green', label: '🟢' },
  blue: { bg: 'bg-card-blue/10', border: 'border-card-blue', text: 'text-card-blue', label: '🔵' },
  bronze: { bg: 'bg-card-bronze/10', border: 'border-card-bronze', text: 'text-card-bronze', label: '🟤' },
  purple: { bg: 'bg-card-purple/10', border: 'border-card-purple', text: 'text-card-purple', label: '🟣' },
};

function CardTileComponent({
  card,
  isOwned,
  isActive = true,
  isLocked = false,
  isUsed = false,
  canUse = false,
  clockThreshold,
  currentTime,
  onClick,
}: CardTileProps) {
  // Hidden card (opponent's card - show only color)
  if (!isOwned) {
    return (
      <div className="w-20 h-28 rounded-lg border-2 border-line bg-surface-raised flex flex-col items-center justify-center opacity-50">
        <span className="text-3xl opacity-50">🎴</span>
        <span className="text-xs text-text-muted mt-1">Hidden</span>
      </div>
    );
  }

  // No card
  if (!card) {
    return (
      <div className="w-20 h-28 rounded-lg border-2 border-dashed border-line bg-surface/30 flex flex-col items-center justify-center">
        <span className="text-2xl text-text-muted">?</span>
      </div>
    );
  }

  const colorConfig = CARD_COLORS[card.color];

  // Check if clock condition is met
  const isClockReady = !clockThreshold || (currentTime !== undefined && currentTime <= clockThreshold);

  const isClickable = isActive && !isLocked && !isUsed && canUse && isClockReady;

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      className={`
        w-20 h-28 rounded-lg border-2 flex flex-col items-center justify-center p-2
        transition-all duration-200
        ${isClickable ? `cursor-pointer hover:scale-105 ${colorConfig.bg} ${colorConfig.border}` : `cursor-default ${colorConfig.bg} ${colorConfig.border}/50`}
        ${isLocked ? 'opacity-50' : ''}
        ${isUsed ? 'opacity-30 grayscale' : ''}
        ${canUse && !isLocked && !isUsed ? 'animate-pulse-subtle' : ''}
      `}
      title={card.description}
    >
      {/* Color indicator */}
      <span className="text-2xl">{colorConfig.label}</span>

      {/* Card name */}
      <span className={`text-[10px] font-medium mt-1 text-center leading-tight ${colorConfig.text}`}>
        {card.name}
      </span>

      {/* Status indicator */}
      <div className="mt-auto flex items-center gap-1">
        {isLocked ? (
          <span className="flex items-center text-danger" title="Locked">
            <Lock className="w-3 h-3" />
          </span>
        ) : isUsed ? (
          <span className="text-text-muted" title="Used">
            <Check className="w-3 h-3" />
          </span>
        ) : !isClockReady ? (
          <span className="flex items-center text-text-muted" title={`Requires ${Math.floor(clockThreshold! / 60)}:${(clockThreshold! % 60).toString().padStart(2, '0')} time remaining`}>
            <Clock className="w-3 h-3" />
          </span>
        ) : (
          <span className="text-card-green" title="Ready">
            ✓
          </span>
        )}
      </div>
    </button>
  );
}

export const CardTile = memo(CardTileComponent);

interface CardTrayProps {
  cards: Card[];
  isOwned: boolean;
  activeCardId?: string | null;
  currentTime?: number;
  onCardSelect?: (card: Card) => void;
}

export function CardTray({
  cards,
  isOwned,
  activeCardId,
  currentTime,
  onCardSelect,
}: CardTrayProps) {
  return (
    <div className="flex gap-3 justify-center">
      {/* Show 3 slots */}
      {[0, 1, 2].map((index) => {
        const card = cards[index] || null;
        return (
          <CardTile
            key={index}
            card={card}
            isOwned={isOwned}
            isActive={isOwned}
            isLocked={card?.isLocked}
            isUsed={card?.isUsed}
            canUse={activeCardId === card?.id}
            clockThreshold={card?.clockThreshold}
            currentTime={currentTime}
            onClick={() => card && onCardSelect?.(card)}
          />
        );
      })}
    </div>
  );
}
