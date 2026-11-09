import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Dialog';
import { useAuth } from '../../contexts/useAuth';
import { roomService } from '../../services/roomService';
import type { Room } from '../../types/room';
import { Trophy, Meh, Frown, Home, RotateCcw } from 'lucide-react';

/** The outcome of a finished game, as the result screen shows it. */
type Outcome = 'win' | 'loss' | 'draw';

/**
 * The result screen.
 *
 * The outcome comes from the room itself, so both players see the same
 * verdict without any extra bookkeeping.
 */

/** A single confetti flake. */
interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  glyph: string;
}

const CONFETTI_COLORS = ['#E5B53B', '#4C8DF6', '#3FB97A', '#9A6BFF', '#E5484D'];
const CONFETTI_GLYPHS = ['⭐', '✨', '🎊', '🏆'];

/**
 * A small deterministic pseudo-random generator.
 *
 * The confetti is seeded from the room id, so the same game always produces
 * the same celebration. That keeps the render pure — a render that drew
 * fresh random values would restart the animation on every pass.
 */
function seededRandom(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

/**
 * Build the confetti pieces for a game.
 */
function makeConfetti(seed: string): ConfettiPiece[] {
  const random = seededRandom(seed || 'chess');
  return Array.from({ length: 50 }, () => ({
    left: random() * 100,
    delay: random() * 2,
    duration: 2 + random() * 2,
    color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)],
    glyph: CONFETTI_GLYPHS[Math.floor(random() * CONFETTI_GLYPHS.length)],
  }));
}

export function ResultScreen() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const roomId = (location.state as { roomId?: string } | null)?.roomId ?? '';
  const [room, setRoom] = useState<Room | null>(null);

  // Read the finished room.
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const unsubscribe = roomService.subscribeToRoom(roomId, (updated) => {
      if (cancelled) return;
      setRoom(updated);
    });

    void roomService.getRoom(roomId).then((updated) => {
      if (!cancelled) setRoom(updated);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [roomId]);

  const outcome = useMemo<Outcome>(() => {
    if (!room) return 'draw';
    const winner = room.metadata.winner;
    if (!winner || winner === 'draw') return 'draw';
    const myColor = roomService.getPlayerColor(room, user?.uid ?? '');
    if (!myColor) return 'draw';
    return winner === myColor ? 'win' : 'loss';
  }, [room, user?.uid]);

  // The confetti is derived from the room id, so it is stable across
  // renders and the CSS animation plays once and fades itself out.
  const confetti = useMemo(() => makeConfetti(roomId), [roomId]);
  const showConfetti = outcome === 'win';

  const content = {
    win: {
      icon: <Trophy className="w-16 h-16 text-card-gold" />,
      title: 'Victory!',
      subtitle: 'Congratulations, you won!',
      color: 'text-card-gold',
      bgColor: 'bg-card-gold/10',
    },
    loss: {
      icon: <Frown className="w-16 h-16 text-danger" />,
      title: 'Defeat',
      subtitle: 'Better luck next time!',
      color: 'text-danger',
      bgColor: 'bg-danger/10',
    },
    draw: {
      icon: <Meh className="w-16 h-16 text-card-silver" />,
      title: 'Draw',
      subtitle: 'A well-fought match!',
      color: 'text-card-silver',
      bgColor: 'bg-card-silver/10',
    },
  }[outcome];

  const moveCount = room ? Object.keys(room.moveHistory).length : 0;
  const reason = room?.metadata.terminationReason;

  const reasonText: Record<string, string> = {
    checkmate: 'by checkmate',
    stalemate: 'by stalemate',
    insufficient_material: 'by insufficient material',
    fifty_move_rule: 'by the fifty-move rule',
    threefold_repetition: 'by threefold repetition',
    resignation: 'by resignation',
    timeout: 'on time',
    draw_agreement: 'by agreement',
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((piece, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${piece.left}%`,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                color: piece.color,
              }}
            >
              {piece.glyph}
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-md">
        <div className={`text-center p-8 rounded-t-2xl ${content.bgColor}`}>
          <div className="flex justify-center mb-4">{content.icon}</div>
          <h1 className={`text-4xl font-bold mb-2 ${content.color}`}>{content.title}</h1>
          <p className="text-text-muted">{content.subtitle}</p>
          {reason && reasonText[reason] && (
            <p className="text-sm text-text-muted mt-1">{reasonText[reason]}</p>
          )}
        </div>

        <div className="bg-surface border-x border-line p-6">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-sm text-text-muted mb-1">White</p>
              <p className="text-lg font-medium truncate max-w-24">
                {room?.players.white?.displayName ?? '—'}
              </p>
            </div>
            <span className="text-2xl text-text-muted">
              {outcome === 'draw' ? '↔' : '—'}
            </span>
            <div className="text-center">
              <p className="text-sm text-text-muted mb-1">Black</p>
              <p className="text-lg font-medium truncate max-w-24">
                {room?.players.black?.displayName ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex justify-center mt-4">
            <Badge variant={outcome === 'win' ? 'gold' : 'default'}>
              {moveCount} moves
            </Badge>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-b-2xl p-6 space-y-3">
          <Button
            variant="secondary"
            className="w-full h-12"
            onClick={() => navigate(`/match/${roomId}`)}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Review the board
          </Button>
          <Button className="w-full h-12 text-lg" onClick={() => navigate('/lobby')}>
            <Home className="w-5 h-5 mr-2" />
            Back to Lobby
          </Button>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          Playing as {profile?.displayName ?? 'guest'}.
        </p>
      </div>
    </div>
  );
}
