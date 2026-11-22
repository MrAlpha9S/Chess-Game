/**
 * Pure logic for in-game card actions.
 *
 * Everything here is a plain function over plain data so the card rules can
 * be unit-tested without a database. The service layer (`roomService`) calls
 * these helpers, applies the effect through the `VariantEngine`, and writes
 * the result in one atomic patch.
 *
 * The Abyss is a free action: using it does not flip the turn, and it is
 * reusable — it goes on a 15-turn cooldown owned by the player who used it.
 */

import { getCard } from '../cards/catalog';
import type { Room, RoomCardSide } from '../types/room';

/** Full moves after which cards unlock (GDD opening lock: from move 6). */
export const CARD_OPENING_LOCK_FULL_MOVES = 6;

/** How many of the user's own turns The Abyss stays on cooldown. */
export const ABYSS_COOLDOWN_TURNS = 15;

/** The ids of card actions implemented in-game. */
export type InGameCardId = 'abyss';

/**
 * Realtime Database returns arrays as objects with numeric keys ("0", "1" …),
 * and drops empty containers on read. Normalise either shape back into a
 * plain array of ids.
 */
export function toIdArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .map(Number)
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
    if (
      keys.length > 0 &&
      keys.every((k, i) => k === i) &&
      keys.every((k) => typeof record[String(k)] === 'string')
    ) {
      return keys.map((k) => record[String(k)] as string);
    }
  }
  return [];
}

/** The remaining cooldown of a card: 0 when absent or ready. */
export function cooldownOf(
  side: RoomCardSide | undefined,
  cardId: InGameCardId,
): number {
  const value = side?.cooldowns?.[cardId];
  return typeof value === 'number' && value > 0 ? Math.floor(value) : 0;
}

/** Whether the card is in this side's deck. */
export function cardInDeck(
  side: RoomCardSide | undefined,
  cardId: InGameCardId,
): boolean {
  return toIdArray(side?.deck).includes(cardId);
}

/**
 * Why a card action may not be started now, or null when it may.
 *
 * This answers "can this player begin using the card" — it does not validate
 * the chosen target squares (the engine does that against the position).
 */
export function cardUnavailableReason(
  room: Room,
  color: 'white' | 'black',
  cardId: InGameCardId,
): string | null {
  const boardState = room.boardState;
  if (!boardState) return 'The game has not started yet.';
  if (room.metadata.status !== 'in_progress') return 'The game is over.';
  if (boardState.turn !== color) return 'It is not your turn.';
  const side = room.cardState[color];
  const card = getCard(cardId);
  if (!card) return 'That card is not in the catalog.';
  if (!cardInDeck(side, cardId)) return 'That card is not in your deck.';
  // The opening lock: no card before the sixth full move.
  if (boardState.fullMoveNumber < CARD_OPENING_LOCK_FULL_MOVES) {
    return `Cards unlock from move ${CARD_OPENING_LOCK_FULL_MOVES}.`;
  }
  const cooldown = cooldownOf(side, cardId);
  if (cooldown > 0) return `${card.name} is on cooldown: ${cooldown} turns.`;
  return null;
}

/**
 * The cooldowns to write after one of the player's normal moves: every deck
 * card still cooling down drops by one. Returns a sparse map of only the
 * keys that must change.
 */
export function tickCooldowns(
  side: RoomCardSide | undefined,
): Record<string, number> {
  const next: Record<string, number> = {};
  const deck = toIdArray(side?.deck);
  if (deck.length === 0) return next;
  for (const cardId of deck) {
    const remaining = cooldownOf(side, cardId as InGameCardId);
    if (remaining > 0) next[cardId] = remaining - 1;
  }
  return next;
}
