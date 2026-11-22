import { getCard } from '../../cards/catalog';
import { Button } from '../ui/Button';
import { iconByColor } from './PlayerCardIcons';
import type { RoomCardSide } from '../../types/room';
import type { InGameCardId } from '../../services/cardLogic';
import { X, Zap } from 'lucide-react';

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value).sort((a, b) => Number(a) - Number(b)).map((key) => (value as Record<string, unknown>)[key]).filter((item): item is string => typeof item === 'string');
}

export interface CardPanelProps {
  side: RoomCardSide | undefined;
  isMyTurn: boolean;
  isGameOver: boolean;
  fullMoveNumber: number;
  targetingCard: InGameCardId | null;
  targetCount: number;
  pending: boolean;
  onStartTargeting: (cardId: InGameCardId) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The in-game card action panel (sidebar on desktop, compact tray on mobile). */
export function CardPanel({
  side,
  isMyTurn,
  isGameOver,
  fullMoveNumber,
  targetingCard,
  targetCount,
  pending,
  onStartTargeting,
  onConfirm,
  onCancel,
}: CardPanelProps) {
  const deck = stringArray(side?.deck);
  if (!deck.length) return null;
  return (
    <section className="bg-surface border border-line rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-text-muted">Cards</p>
        {targetingCard && <button onClick={onCancel} className="text-text-muted hover:text-text" aria-label="Cancel targeting"><X className="w-4 h-4" /></button>}
      </div>
      <div className="flex gap-2 flex-wrap">
        {deck.map((id) => {
          const card = getCard(id);
          if (!card || !card.id || !card.color) return null;
          const cooldownRaw = side?.cooldowns?.[id];
          const cooldown = typeof cooldownRaw === 'number' ? Math.max(0, cooldownRaw) : 0;
          const isAvailable = id === 'abyss' && cooldown === 0 && isMyTurn && !isGameOver && fullMoveNumber >= 6;
          const lockedByOpening = fullMoveNumber < 6;
          return (
            <button
              key={id}
              type="button"
              disabled={!isAvailable || pending}
              onClick={() => onStartTargeting(id as InGameCardId)}
              className={`relative flex min-w-20 flex-1 flex-col items-center rounded-lg border p-2 text-xs transition-colors ${targetingCard === id ? 'border-card-blue bg-card-blue/15' : 'border-line bg-surface-raised'} ${!isAvailable ? 'opacity-45 cursor-not-allowed' : 'hover:border-card-blue'}`}
              title={lockedByOpening ? 'Unlocks from move 6' : cooldown ? `Cooldown: ${cooldown} turns` : card.name}
            >
              <img src={iconByColor[card.color]} alt="" className="w-8 h-8 object-contain" />
              <span className="mt-1 text-center leading-tight">{card.name}</span>
              {cooldown > 0 ? <span className="mt-1 text-[10px] text-card-blue">{cooldown} turns</span> : lockedByOpening ? <span className="mt-1 text-[10px] text-text-muted">Move 6</span> : null}
              {isAvailable && <Zap className="absolute right-1 top-1 w-3 h-3 text-card-blue" />}
            </button>
          );
        })}
      </div>
      {targetingCard === 'abyss' && (
        <div className="mt-3 rounded-md bg-card-blue/10 p-2 text-sm">
          <p className="text-card-blue font-medium">Choose 3 empty squares ({targetCount}/3)</p>
          <p className="text-xs text-text-muted mt-1">This is a free action and does not end your turn.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
            <Button size="sm" onClick={onConfirm} disabled={targetCount !== 3 || pending}>
              {pending ? 'Using…' : 'Use The Abyss'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
