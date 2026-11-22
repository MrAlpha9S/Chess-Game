import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { LoadingAnimation } from '../../components/common/LoadingAnimation';
import { Piece } from '../board/components/Piece';
import { useAuth } from '../../contexts/useAuth';
import { roomService, CARD_SELECT_MS } from '../../services/roomService';
import {
  CARD_CATALOG,
  DECK_SIZE,
  isValidDeck,
  type CardColor,
} from '../../cards/catalog';
import {
  DEFAULT_ARRANGEMENT,
  isValidArrangement,
  type RearrangedRole,
} from '../../engine/deployment';
import type { Room } from '../../types/room';
import { Check, Loader2, Sparkles, Timer, X } from 'lucide-react';

/** The eight back-rank files, shown left to right. */
const FILE_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/** The slot index (into the arrangement) of each rearrangeable file cell. */
function slotIndexForCell(cell: number): number | null {
  // Cells 0,1,2 are slots 0,1,2 (files a,b,c); cells 5,6,7 are slots 3,4,5
  // (files f,g,h). Cells 3 and 4 hold the fixed queen and king.
  return cell < 3 ? cell : cell >= 5 ? cell - 2 : null;
}

/**
 * The pre-match card selection stage.
 *
 * In card mode each player picks up to three cards from the six-card pool,
 * one per color, before the board opens. Both sides share a 30 second window
 * counted from the room's `prepStartMs`. Pressing Ready locks that side's
 * choice; when both sides are ready, or the window closes, the host commits
 * the room into the game and both clients follow the subscription to the board.
 */
export function CardSelectScreen() {
  const { roomId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [myReady, setMyReady] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [deployment, setDeployment] = useState<RearrangedRole[]>([...DEFAULT_ARRANGEMENT]);
  const autoReadyRef = useRef(false);
  const committedRef = useRef(false);

  /** Whether the Redeployment (bronze) card is in this side's deck. */
  const hasRedeployment = selected.includes('redeployment');

  const myColor = useMemo(() => {
    if (!room || !user) return null;
    return roomService.getPlayerColor(room, user.uid);
  }, [room, user]);

  const isHost = myColor === 'white';

  const opponentReady = useMemo(() => {
    if (!room || !myColor) return false;
    return myColor === 'white'
      ? room.cardState.black?.ready ?? false
      : room.cardState.white?.ready ?? false;
  }, [room, myColor]);

  // The shared deadline both clients count down from.
  const timeLeftMs = room?.metadata.prepStartMs
    ? Math.max(0, room.metadata.prepStartMs + CARD_SELECT_MS - now)
    : CARD_SELECT_MS;

  // Submit this side's deck, its Redeployment arrangement, and mark ready.
  const handleReady = useCallback(async () => {
    if (!user || myReady) return;
    setError('');
    if (!isValidDeck(selected)) {
      setError('You can only choose up to three different-color cards.');
      return;
    }
    const wantsRedeployment = selected.includes('redeployment');
    if (wantsRedeployment && !isValidArrangement(deployment)) {
      setError('The back-rank arrangement must hold two rooks, two knights and two bishops.');
      return;
    }
    try {
      await roomService.selectCards(
        roomId,
        user.uid,
        selected,
        wantsRedeployment ? deployment : null,
      );
      setMyReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your cards.');
    }
  }, [user, myReady, roomId, selected, deployment]);

  // Swap the two pieces of the Redeployment arrangement at two slots.
  const handleSwapSlots = useCallback(
    (a: number, b: number) => {
      if (myReady || a === b) return;
      setDeployment((prev) => {
        const next = [...prev];
        [next[a], next[b]] = [next[b], next[a]];
        return next;
      });
    },
    [myReady],
  );

  // Subscribe to the room so both players see each other's progress.
  useEffect(() => {
    if (!roomId) {
      navigate('/lobby');
      return;
    }
    const unsubscribe = roomService.subscribeToRoom(roomId, (updated) => {
      if (!updated) {
        navigate('/lobby');
        return;
      }
      setRoom(updated);
      if (updated.metadata.status === 'in_progress') {
        navigate(`/match/${roomId}`);
      }
    });
    return () => unsubscribe();
  }, [roomId, navigate]);

  // Tick the countdown while the stage is live.
  useEffect(() => {
    if (!room || room.metadata.status !== 'card_select') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [room]);

  // Auto-ready when the window closes, keeping the current selection.
  useEffect(() => {
    if (!room || room.metadata.status !== 'card_select') return;
    if (myReady || autoReadyRef.current || timeLeftMs > 0) return;
    autoReadyRef.current = true;
    void handleReady();
  }, [room, myReady, timeLeftMs, handleReady]);

  // The host drives the transition once both are ready or the timer ends.
  useEffect(() => {
    if (!isHost || !room || room.metadata.status !== 'card_select') return;
    if (committedRef.current) return;
    const shouldCommit = (myReady && opponentReady) || timeLeftMs <= 0;
    if (!shouldCommit) return;
    committedRef.current = true;
    void roomService.commitCardSelect(roomId).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Could not start the game.');
      committedRef.current = false;
    });
  }, [isHost, room, myReady, opponentReady, timeLeftMs, roomId]);

  const toggleCard = useCallback(
    (id: string) => {
      if (myReady) return;
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((c) => c !== id);
        if (prev.length >= DECK_SIZE) return prev;
        return [...prev, id];
      });
    },
    [myReady],
  );

  if (!room) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingAnimation variant="matchmaking" label="Loading card selection..." />
      </div>
    );
  }

  const totalSeconds = Math.ceil(timeLeftMs / 1000);
  const bothDone = myReady && opponentReady;

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="bg-surface border border-line rounded-xl p-6 sm:p-8 w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-card-purple" />
            <h1 className="text-xl font-bold">Pick Your Cards</h1>
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm ${
              totalSeconds <= 5 ? 'bg-danger/20 text-danger' : 'bg-surface-raised text-text'
            }`}
          >
            <Timer className="w-4 h-4" />
            0:{String(totalSeconds).padStart(2, '0')}
          </div>
        </div>

        <p className="text-sm text-text-muted mb-5 text-center">
          Choose up to {DECK_SIZE} cards (one per color), then press Ready. You may choose fewer.
        </p>

        {/* Card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {CARD_CATALOG.map((card) => {
            const isSelected = selected.includes(card.id);
            return (
              <button
                key={card.id}
                onClick={() => toggleCard(card.id)}
                disabled={myReady}
                className={`relative rounded-lg border p-3 text-left transition-all disabled:opacity-60 ${
                  isSelected
                    ? `border-current ${cardColorClass(card.color, 'selected')}`
                    : 'border-line bg-surface-raised hover:border-card-blue'
                }`}
              >
                <div className={`mb-2 h-1 w-8 rounded ${cardColorClass(card.color, 'swatch')}`} />
                <p className="font-semibold text-sm leading-tight">{card.name}</p>
                <p className="text-xs text-text-muted mt-1 line-clamp-4">{card.description}</p>
                <div className="absolute top-2 right-2 text-[10px] font-mono text-text-muted">
                  {card.points}pt
                </div>
                {isSelected && <Check className="absolute bottom-2 right-2 w-4 h-4 text-current" />}
              </button>
            );
          })}
        </div>

        {hasRedeployment && (
          <RedeploymentPanel
            deployment={deployment}
            onSwap={handleSwapSlots}
            disabled={myReady}
            color={myColor === 'black' ? 'b' : 'w'}
          />
        )}

        {error && <p className="text-danger text-sm text-center mb-4">{error}</p>}

        {/* Opponent status */}
        <div className="text-center text-sm text-text-muted mb-5">
          {opponentReady ? 'Opponent is ready.' : 'Opponent is still choosing...'}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!myReady ? (
            <Button
              onClick={() => void handleReady()}
              className="w-full h-12 bg-card-green hover:bg-card-green/80"
            >
              <Check className="w-5 h-5 mr-2" />
              Ready ({selected.length}/{DECK_SIZE})
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 text-card-green">
              <Loader2 className="w-5 h-5 animate-spin" />
              {bothDone ? 'Starting the game...' : 'Ready — waiting for opponent...'}
            </div>
          )}

          <Button variant="secondary" onClick={() => navigate('/lobby')} className="w-full">
            <X className="w-4 h-4 mr-2" />
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The Redeployment arrangement editor: the eight back-rank cells, with the
 * fixed queen and king in the middle and the six outer slots swappable.
 * Tapping two slots trades their pieces; the multiset stays two of each.
 *
 * The pieces render as the board's own sprites, in the color the local
 * player will command, so the arrangement reads exactly like the board.
 */
function RedeploymentPanel({
  deployment,
  onSwap,
  disabled,
  color,
}: {
  deployment: RearrangedRole[];
  onSwap: (a: number, b: number) => void;
  disabled: boolean;
  /** The color of the local player's pieces, as a piece-code prefix. */
  color: 'w' | 'b';
}) {
  const [first, setFirst] = useState<number | null>(null);

  const handleCellTap = (cell: number) => {
    if (disabled) return;
    const slot = slotIndexForCell(cell);
    if (slot === null) return; // the fixed queen/king cells
    if (first === null) {
      setFirst(slot);
      return;
    }
    if (first === slot) {
      setFirst(null);
      return;
    }
    onSwap(first, slot);
    setFirst(null);
  };

  /** The piece code rendered in a given cell. */
  const cellPiece = (cell: number): string => {
    const c = color;
    if (cell === 3) return `${c}q`; // fixed queen on d
    if (cell === 4) return `${c}k`; // fixed king on e
    const slot = slotIndexForCell(cell)!;
    return `${c}${deployment[slot] === 'rook' ? 'r' : deployment[slot] === 'knight' ? 'n' : 'b'}`;
  };

  return (
    <div className="mb-6 rounded-lg border border-card-bronze/40 bg-card-bronze/5 p-3">
      <p className="text-xs font-medium text-card-bronze mb-2">
        Back-rank arrangement
      </p>
      <div className="grid grid-cols-8 gap-1">
        {FILE_LETTERS.map((file, cell) => {
          const slot = slotIndexForCell(cell);
          const fixed = slot === null;
          const isPicked = first !== null && slot === first;
          return (
            <button
              key={file}
              disabled={disabled || fixed}
              onClick={() => handleCellTap(cell)}
              className={`
                relative aspect-square rounded overflow-hidden transition-colors
                ${fixed
                  ? 'bg-surface-raised cursor-not-allowed'
                  : isPicked
                    ? 'bg-card-bronze/40 ring-2 ring-card-bronze ring-inset'
                    : 'bg-square-light hover:bg-square-dark'
                }
              `}
              aria-label={`file ${file}`}
            >
              <Piece piece={cellPiece(cell)} />
              <span className="absolute bottom-0 inset-x-0 bg-black/40 text-[9px] font-mono text-white/80 text-center leading-3">
                {file}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-text-muted mt-2">
        Tap two pieces to swap them. The queen and king stay put.
      </p>
    </div>
  );
}

/**
 * Map a card color to a Tailwind text/background class. The color names come
 * from the theme tokens (--color-card-*).
 */
function cardColorClass(color: CardColor, kind: 'selected' | 'swatch'): string {
  const map: Record<CardColor, { selected: string; swatch: string }> = {
    gold: { selected: 'text-card-gold bg-card-gold/10', swatch: 'bg-card-gold' },
    silver: { selected: 'text-card-silver bg-card-silver/10', swatch: 'bg-card-silver' },
    green: { selected: 'text-card-green bg-card-green/10', swatch: 'bg-card-green' },
    blue: { selected: 'text-card-blue bg-card-blue/10', swatch: 'bg-card-blue' },
    bronze: { selected: 'text-card-bronze bg-card-bronze/10', swatch: 'bg-card-bronze' },
    purple: { selected: 'text-card-purple bg-card-purple/10', swatch: 'bg-card-purple' },
  };
  return map[color][kind];
}
