import { useEffect, useRef } from 'react';
import tippy, { type Instance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { getCard, type CardColor } from '../../cards/catalog';
import type { RoomCardSide } from '../../types/room';

const iconByColor: Record<CardColor, string> = {
  gold: '/assets/card-icon/gold-card-icon.png',
  silver: '/assets/card-icon/silver-card-icon.png',
  green: '/assets/card-icon/green-card-icon.png',
  blue: '/assets/card-icon/blue-card-icon.png',
  bronze: '/assets/card-icon/bronze-card-icon.png',
  purple: '/assets/card-icon/purple-card-icon.png',
};

function ids(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort((a, b) => Number(a) - Number(b)).map((key) => record[key]).filter((item): item is string => typeof item === 'string');
}

/** A compact row of a player's selected cards, with keyboard-friendly tooltips. */
export function PlayerCardIcons({ side, compact = false }: { side: RoomCardSide | undefined; compact?: boolean }) {
  const deck = ids(side?.deck);
  if (deck.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 align-middle" aria-label="Selected cards">
      {deck.map((id) => <CardIcon key={id} id={id} side={side} compact={compact} />)}
    </span>
  );
}

export function CardIcon({ id, side, compact = false }: { id: string; side: RoomCardSide | undefined; compact?: boolean }) {
  const card = getCard(id);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<Instance | null>(null);
  const cooldown = typeof side?.cooldowns?.[id] === 'number' ? Math.max(0, side.cooldowns[id]) : 0;
  const used = ids(side?.used).includes(id);
  useEffect(() => {
    if (!buttonRef.current || !card) return;
    tipRef.current = tippy(buttonRef.current, {
      content: `${card.name} — ${card.description}${cooldown > 0 ? ` Cooldown: ${cooldown} turns.` : ''}${used ? ' Used.' : ''}`,
      placement: 'top',
      trigger: 'mouseenter focus',
      animation: 'shift-away',
      theme: 'card',
    });
    return () => { tipRef.current?.destroy(); tipRef.current = null; };
  }, [card, cooldown, used]);
  if (!card) return null;
  return (
    <button ref={buttonRef} type="button" className={`relative shrink-0 ${compact ? 'w-6 h-6' : 'w-7 h-7'} ${used ? 'opacity-35 grayscale' : cooldown > 0 ? 'opacity-60' : ''}`} aria-label={card.name}>
      <img src={iconByColor[card.color]} alt="" className="w-full h-full object-contain" />
      {cooldown > 0 && <span className="absolute -right-1 -bottom-1 min-w-3 h-3 rounded-full bg-surface text-[8px] leading-3 text-center text-text border border-line">{cooldown}</span>}
    </button>
  );
}

export { iconByColor };
