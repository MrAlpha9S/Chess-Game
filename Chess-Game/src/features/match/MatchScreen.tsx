import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { MoveLog } from '../../components/hud/MoveLog';
import { CardPanel } from '../../components/hud/CardPanel';
import { PlayerCardIcons } from '../../components/hud/PlayerCardIcons';
import { LoadingAnimation } from '../../components/common/LoadingAnimation';
import { useAuth } from '../../contexts/useAuth';
import { useGameSync } from '../../hooks/useGameSync';
import { formatTime, useTimer } from '../../hooks/useTimer';
import { usePointerField } from '../../hooks/usePointerField';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { BoardGrid } from '../board/components/BoardGrid';
import { playSound } from '../../lib/audio';
import { roomService } from '../../services/roomService';
import {
  VariantEngine,
  gridToAlgebraic,
  type GridCoord,
  type GridPair,
  type MoveRequest,
} from '../../engine';
import { toIdArray, type InGameCardId } from '../../services/cardLogic';
import 'tippy.js/dist/tippy.css';
import { Flag, Handshake, Crown, User, Wifi } from 'lucide-react';

/**
 * The main game screen.
 *
 * Two players share one room in the database; this screen subscribes to it,
 * shows the position, and sends the moves the local player makes.
 */
export function MatchScreen() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const identity = useMemo(
    () =>
      user
        ? {
            uid: user.uid,
            displayName: profile?.displayName || user.displayName || 'Player',
            photoURL: profile?.photoURL ?? user.photoURL ?? null,
            rank: profile?.rankClassic ?? 1200,
          }
        : null,
    [user, profile],
  );

  const {
    room,
    board,
    myColor,
    opponent,
    isMyTurn,
    isGameOver,
    error,
    loaded,
    actions,
  } = useGameSync(roomId, identity);

  // The selection, together with the position it was made on. A new position
  // clears the selection; the reset happens during render rather than in an
  // effect, so no extra pass is needed.
  const [selection, setSelection] = useState<{
    fen: string;
    cell: GridCoord | null;
    moves: GridCoord[];
  }>({ fen: '', cell: null, moves: [] });

  const positionFen = room?.boardState?.fen ?? '';
  const selectedCell = useMemo(
    () => (selection.fen === positionFen ? selection.cell : null),
    [positionFen, selection.cell, selection.fen],
  );
  const validMoves = useMemo(
    () => (selection.fen === positionFen ? selection.moves : []),
    [positionFen, selection.fen, selection.moves],
  );

  const [showLog, setShowLog] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Card targeting: which card is being aimed and the squares picked so far.
  const [targetingCard, setTargetingCard] = useState<InGameCardId | null>(null);
  const [targetCells, setTargetCells] = useState<GridCoord[]>([]);
  const [cardPending, setCardPending] = useState(false);

  // The squares destroyed by card effects, kept as "row,col" keys.
  const holes = useMemo(
    () =>
      toIdArray(room?.boardState?.gridConfig?.holes).filter(
        (v) => typeof v === 'string' && v.includes(','),
      ),
    [room?.boardState?.gridConfig?.holes],
  );

  const pointerFieldEnabled = useSettingsStore((state) => state.pointerFieldEnabled);
  usePointerField(boardRef, { maxTilt: 4, enabled: pointerFieldEnabled });

  const myClock = room?.players[myColor ?? 'white']?.timeRemainingMs ?? 0;
  const opponentClock =
    room?.players[myColor === 'white' ? 'black' : 'white']?.timeRemainingMs ?? 0;

  // The card side each player sees next to their name: the local side is the
  // one the user plays, the remote side is the opponent's.
  const mySide = myColor ? room?.cardState?.[myColor] : undefined;
  const opponentSide = myColor ? room?.cardState?.[myColor === 'white' ? 'black' : 'white'] : undefined;

  const onTimeUp = useCallback(() => {
    if (!identity) return;
    void roomService.flagTimeout(roomId, identity.uid).catch(() => undefined);
  }, [roomId, identity]);

  const myTimer = useTimer({
    storedRemainingMs: myClock,
    isRunning: isMyTurn && !isGameOver,
    isGameOver,
    onTimeUp,
    onSync: actions.syncClock,
  });

  const opponentTimer = useTimer({
    storedRemainingMs: opponentClock,
    isRunning: !isMyTurn && !isGameOver,
    isGameOver,
  });

  // Leave the room when the screen closes.
  useEffect(() => {
    if (!identity) return;
    void roomService.setPresence(identity.uid, roomId).catch(() => undefined);
    return () => {
      void roomService.clearPresence(identity.uid).catch(() => undefined);
    };
  }, [identity, roomId]);

  // Play a sound for the opponent's move.
  const lastMoveKey = room?.boardState?.lastMove?.timestamp ?? 0;
  useEffect(() => {
    if (!lastMoveKey) return;
    const move = room?.boardState?.lastMove;
    if (!move) return;
    if (move.type === 'card') return;
    if (move.san.startsWith('O-O')) playSound('castle');
    else if (room?.boardState?.isCheck) playSound('check');
    else if (move.type === 'capture') playSound('capture');
    else playSound('move');
  }, [lastMoveKey, room?.boardState?.lastMove, room?.boardState?.isCheck]);

  // Go to the result screen when the game ends.
  useEffect(() => {
    if (isGameOver && room) {
      const timer = setTimeout(() => navigate('/result', { state: { roomId } }), 1200);
      return () => clearTimeout(timer);
    }
  }, [isGameOver, room, navigate, roomId]);

  // Firebase omits empty objects, so a room can have no moveHistory field
  // until its first move.
  const moves = useMemo(() => {
    const moveHistory = room?.moveHistory ?? {};
    return Object.keys(moveHistory)
      .map(Number)
      .sort((a, b) => a - b)
      .map((key) => moveHistory[String(key)]);
  }, [room?.moveHistory]);

  /** The legal destinations of the selected square. */
  const computeValidMoves = useCallback(
    (cell: GridCoord): GridCoord[] => {
      const boardState = room?.boardState;
      if (!boardState) return [];
      // The variant engine respects the card effects (holes, transformed
      // pieces, the active barrier) that the standard engine would ignore.
      const effects = {
        holes,
        transformed: boardState.variantState?.transformed ?? {},
        barrier: boardState.variantState?.barrier ?? null,
      };
      const engine = new VariantEngine(boardState.fen, effects);
      const algebraic = gridToAlgebraic(cell.row, cell.col);
      const engineMoves = engine.getLegalGridMoves(algebraic);
      return engineMoves.map(([row, col]) => ({ row, col }));
    },
    [room?.boardState, holes],
  );

  const handleCellClick = useCallback(
    async (row: number, col: number) => {
      if (!isMyTurn || isGameOver || cardPending) return;

      // While targeting The Abyss, clicks only select empty non-hole squares.
      if (targetingCard === 'abyss') {
        const key = `${row},${col}`;
        if (holes.includes(key) || board[row]?.[col]) return;
        setTargetCells((previous) => {
          const index = previous.findIndex((target) => target.row === row && target.col === col);
          if (index >= 0) return previous.filter((_, i) => i !== index);
          if (previous.length >= 3) return previous;
          return [...previous, { row, col }];
        });
        return;
      }

      const cell: GridCoord = { row, col };
      const piece = board[row]?.[col] ?? '';
      const isOwnPiece = piece.startsWith(myColor === 'white' ? 'w' : 'b');

      // Clicking a legal destination plays the move.
      const isDestination = validMoves.some((m) => m.row === row && m.col === col);
      if (selectedCell && isDestination) {
        const request: MoveRequest = {
          from: gridToAlgebraic(selectedCell.row, selectedCell.col),
          to: gridToAlgebraic(row, col),
        };

        // A pawn reaching the last rank must promote.
        const from = board[selectedCell.row]?.[selectedCell.col] ?? '';
        if (from.endsWith('p')) {
          const toRank = 9 - row;
          const promoting = myColor === 'white' ? toRank === 8 : toRank === 1;
          if (promoting) {
            request.promotion = 'q';
          }
        }

        setSelection({ fen: positionFen, cell: null, moves: [] });
        await actions.playMove(request, myTimer.remainingMs);
        return;
      }

      // Clicking one of your own pieces selects it.
      if (isOwnPiece) {
        setSelection({
          fen: positionFen,
          cell,
          moves: computeValidMoves(cell),
        });
        return;
      }

      // Clicking elsewhere clears the selection.
      setSelection({ fen: positionFen, cell: null, moves: [] });
    },
    [
      actions,
      board,
      computeValidMoves,
      isGameOver,
      isMyTurn,
      myColor,
      myTimer.remainingMs,
      positionFen,
      selectedCell,
      validMoves,
      targetingCard,
      cardPending,
      holes,
    ],
  );

  const handleStartTargeting = useCallback(
    (cardId: InGameCardId) => {
      setTargetingCard(cardId);
      setTargetCells([]);
      // A targeting click must not start from a piece selection.
      setSelection({ fen: positionFen, cell: null, moves: [] });
    },
    [positionFen],
  );

  const handleCancelTargeting = useCallback(() => {
    setTargetingCard(null);
    setTargetCells([]);
  }, []);

  const handleConfirmAbyss = useCallback(async () => {
    if (targetingCard !== 'abyss' || targetCells.length !== 3 || cardPending) return;
    setCardPending(true);
    const targets: GridPair[] = targetCells.map(({ row, col }) => [row, col]);
    const ok = await actions.useCard('abyss', targets);
    setCardPending(false);
    if (ok) {
      setTargetingCard(null);
      setTargetCells([]);
    }
  }, [actions, targetingCard, targetCells, cardPending]);

  // Leave targeting as soon as it stops being the local player's turn.
  useEffect(() => {
    if (!isMyTurn || isGameOver) {
      setTargetingCard(null);
      setTargetCells([]);
    }
  }, [isMyTurn, isGameOver]);

  // A card that just landed (or an opponent-side event) changed the board:
  // drop any still-picked target squares.
  useEffect(() => {
    setTargetCells([]);
  }, [positionFen]);

  const handleResign = useCallback(async () => {
    if (!window.confirm('Are you sure you want to resign?')) return;
    await actions.resign();
  }, [actions]);

  const handleDraw = useCallback(async () => {
    if (room?.metadata.drawOfferedBy) {
      await actions.acceptDraw();
    } else {
      await actions.offerDraw();
    }
  }, [actions, room?.metadata.drawOfferedBy]);

  const drawOfferedByOpponent =
    room?.metadata.drawOfferedBy && room.metadata.drawOfferedBy !== identity?.uid;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingAnimation variant="board-init" label="Setting up the board..." />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted mb-4">This game is no longer available.</p>
          <Button onClick={() => navigate('/lobby')}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  const isFlipped = myColor === 'black';
  const drawOfferedByMe = room.metadata.drawOfferedBy === identity?.uid;

  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-surface border-b border-line px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Wifi className="w-4 h-4 text-card-green shrink-0" />
            <span className="text-xs text-text-muted font-mono truncate">
              {roomId}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <PlayerCardIcons side={opponentSide} compact />
            <div className="text-right">
              <p className="text-xs text-text-muted truncate max-w-28">
                {opponent?.displayName ?? 'Waiting...'}
              </p>
              <p
                className={`font-mono text-lg font-bold tabular-nums ${
                  opponentTimer.isVeryLow ? 'text-danger animate-pulse' : 'text-text'
                }`}
              >
                {formatTime(opponentTimer.remainingMs)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-surface-raised flex items-center justify-center shrink-0 overflow-hidden">
              {opponent?.photoURL ? (
                <img src={opponent.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-text-muted" />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 flex flex-col p-3">
        <div className="flex-1 min-h-0 max-w-5xl w-full mx-auto flex flex-col md:flex-row gap-3">
          {/* Board */}
          <div className="flex-1 w-full min-h-0 flex flex-col">
            <div
              className={`
                shrink-0 text-center mb-2 py-1.5 rounded-lg text-sm font-medium
                ${isGameOver
                  ? 'bg-surface text-text-muted'
                  : isMyTurn
                    ? 'bg-card-green/20 text-card-green'
                    : 'bg-surface text-text-muted'}
              `}
            >
              {isGameOver
                ? 'Game over'
                : isMyTurn
                  ? 'Your turn'
                  : `${opponent?.displayName ?? 'Opponent'}'s turn`}
            </div>

            <div ref={boardRef} className="flex-1 min-h-0">
              <BoardGrid
                board={board}
                onCellClick={handleCellClick}
                selectedCell={selectedCell}
                validMoves={validMoves}
                lastMove={room.boardState?.lastMove ?? null}
                isInteractive={isMyTurn && !isGameOver && !cardPending}
                isFlipped={isFlipped}
                holes={holes}
                targetCells={targetingCard === 'abyss' ? targetCells : []}
                isTargeting={targetingCard === 'abyss'}
              />
            </div>
          </div>

          {/* Side panel */}
          <aside className="hidden md:flex w-56 shrink-0 flex-col gap-3">
            <CardPanel
              side={mySide}
              isMyTurn={isMyTurn}
              isGameOver={isGameOver}
              fullMoveNumber={room.boardState?.fullMoveNumber ?? 1}
              targetingCard={targetingCard}
              targetCount={targetCells.length}
              pending={cardPending}
              onStartTargeting={handleStartTargeting}
              onConfirm={() => void handleConfirmAbyss()}
              onCancel={handleCancelTargeting}
            />
            <div className="bg-surface border border-line rounded-lg p-3">
              <p className="text-xs text-text-muted mb-1">You play</p>
              <p className="font-medium">
                {myColor === 'white' ? 'White' : myColor === 'black' ? 'Black' : '—'}
              </p>
            </div>

            <div className="bg-surface border border-line rounded-lg p-3 flex-1 min-h-0 overflow-y-auto">
              <p className="text-xs text-text-muted mb-2">Moves</p>
              <MoveLog moves={moves} myColor={myColor} />
            </div>

            {drawOfferedByOpponent && (
              <div className="bg-card-blue/20 border border-card-blue rounded-lg p-3 text-sm">
                <p className="mb-2">Your opponent offers a draw.</p>
                <Button onClick={handleDraw} className="w-full h-9 text-sm">
                  Accept
                </Button>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Bottom bar */}
      <div className="shrink-0 bg-surface border-t border-line px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface-raised flex items-center justify-center shrink-0 overflow-hidden">
              {identity && room.players[myColor ?? 'white']?.photoURL ? (
                <img
                  src={room.players[myColor ?? 'white']!.photoURL!}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-text-muted" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-muted truncate max-w-24">
                {profile?.displayName ?? 'You'}
              </p>
              <p
                className={`font-mono text-lg font-bold tabular-nums leading-none ${
                  myTimer.isVeryLow ? 'text-danger animate-pulse' : 'text-card-gold'
                }`}
              >
                {formatTime(myTimer.remainingMs)}
              </p>
            </div>
            <PlayerCardIcons side={mySide} compact />
          </div>

          <div className="flex items-center gap-2">
            {myColor === 'white' && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-text-muted">
                <Crown className="w-3 h-3" />
                White
              </span>
            )}
            {myColor === 'black' && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-text-muted">
                <Crown className="w-3 h-3" />
                Black
              </span>
            )}

            <Button
              variant="ghost"
              onClick={() => setShowLog((value) => !value)}
              className="md:hidden"
            >
              Moves
            </Button>

            <Button
              variant="ghost"
              onClick={handleDraw}
              disabled={isGameOver || Boolean(drawOfferedByMe)}
            >
              <Handshake className="w-4 h-4 mr-2" />
              {drawOfferedByOpponent ? 'Accept' : drawOfferedByMe ? 'Offered' : 'Draw'}
            </Button>

            <Button variant="danger" onClick={handleResign} disabled={isGameOver}>
              <Flag className="w-4 h-4 mr-2" />
              Resign
            </Button>
          </div>
        </div>

        {mySide && (
          <div className="md:hidden max-w-5xl mx-auto mt-2">
            <CardPanel
              side={mySide}
              isMyTurn={isMyTurn}
              isGameOver={isGameOver}
              fullMoveNumber={room.boardState?.fullMoveNumber ?? 1}
              targetingCard={targetingCard}
              targetCount={targetCells.length}
              pending={cardPending}
              onStartTargeting={handleStartTargeting}
              onConfirm={() => void handleConfirmAbyss()}
              onCancel={handleCancelTargeting}
            />
          </div>
        )}

        {error && (
          <p className="max-w-5xl mx-auto mt-2 text-sm text-danger text-center">{error}</p>
        )}
      </div>

      {/* Mobile move log */}
      {showLog && (
        <div className="md:hidden shrink-0 bg-surface border-t border-line p-3 max-h-48 overflow-y-auto">
          <MoveLog moves={moves} myColor={myColor} />
        </div>
      )}
    </div>
  );
}
