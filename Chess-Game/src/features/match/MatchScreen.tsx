import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClockDisplay } from './components/ClockDisplay';
import { CardTray } from './components/CardTray';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { matchmakingService, type MatchEntry } from '../../services/matchmaking';
import { gameSyncService, submitMove, type GameState } from '../../services/gameSync';
import { BoardGrid, type GridCoord } from '../board/components/BoardGrid';
import { legalMovesFrom, type EngineState } from '@chess-game/chess-engine';
import { Flag, ChevronUp, User } from 'lucide-react';

export function MatchScreen() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const matchId = location.state?.matchId as string;
  const userId = user?.uid || '';

  const [match, setMatch] = useState<MatchEntry | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedCell, setSelectedCell] = useState<GridCoord | null>(null);
  const [showMoveList, setShowMoveList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if no matchId
  useEffect(() => {
    if (!matchId || !user) {
      console.log('MatchScreen: Missing match info, redirecting to lobby');
      navigate('/lobby');
    }
  }, [matchId, user, navigate]);

  // Subscribe to match updates
  useEffect(() => {
    if (!matchId) return;

    console.log('MatchScreen: Subscribing to match:', matchId);

    const unsubscribe = matchmakingService.onMatchUpdate(matchId, (updatedMatch) => {
      if (!updatedMatch) {
        console.log('MatchScreen: Match deleted, redirecting to lobby');
        navigate('/lobby');
        return;
      }

      console.log('MatchScreen: Match updated:', updatedMatch.status);
      setMatch(updatedMatch);

      // Check if game finished
      if (updatedMatch.status === 'finished') {
        console.log('MatchScreen: Game finished, winner:', updatedMatch.winner);
        navigate('/result', { state: { winner: updatedMatch.winner } });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [matchId, navigate]);

  // Subscribe to the authoritative game state written by the Cloud Function.
  useEffect(() => {
    if (!matchId) return;

    const unsubscribe = gameSyncService.subscribeToGame(matchId, (updatedGame) => {
      setGame(updatedGame);
      // A new position invalidates any pending selection.
      setSelectedCell(null);
    });

    return () => {
      unsubscribe();
    };
  }, [matchId]);

  // Get my color
  const getMyColor = (): 'white' | 'black' | null => {
    if (!match || !userId) return null;
    const myPlayer = match.players.find(p => p.userId === userId);
    return myPlayer?.color || null;
  };

  const myColor = getMyColor();
  const myPlayer = match?.players.find(p => p.userId === userId);
  const oppPlayer = match?.players.find(p => p.userId !== userId);
  const isMyTurn = game?.currentTurn === myColor;
  const board = game?.board ?? [];

  // The engine state the local hints are computed from.
  const engineState: EngineState | null = useMemo(() => {
    if (!game) return null;
    return {
      board: game.board,
      turn: game.currentTurn,
      castlingRights: game.castlingRights ?? [],
      epSquare: game.epSquare,
      halfmoves: game.halfmoves ?? 0,
      fullmoves: game.fullmoves ?? 1,
    };
  }, [game]);

  // The legal destinations for the selected piece, derived from the position.
  const validMoves: GridCoord[] = useMemo(() => {
    if (!engineState || !selectedCell) return [];
    return legalMovesFrom(engineState, selectedCell.row, selectedCell.col);
  }, [engineState, selectedCell]);

  const handleCellClick = useCallback(
    async (row: number, col: number) => {
      if (!game || !matchId) return;

      const isValidTarget = validMoves.some(m => m.row === row && m.col === col);

      // Completing a move: send it to the server for validation.
      if (selectedCell && isValidTarget) {
        const from = { row: selectedCell.row, col: selectedCell.col };
        const to = { row, col };

        setSelectedCell(null);
        setError(null);

        const result = await submitMove(matchId, from, to);
        if (!result.ok) {
          setError(result.error ?? 'Move rejected.');
        }
        return;
      }

      // Selecting one of your own pieces.
      const piece = game.board[row]?.[col] ?? '';
      if (piece && piece[0] === (myColor === 'white' ? 'w' : 'b')) {
        setSelectedCell({ row, col });
        return;
      }

      setSelectedCell(null);
    },
    [game, matchId, myColor, selectedCell, validMoves],
  );

  if (!match || match.status !== 'playing') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-muted">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-surface border-b border-line p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className={`font-semibold ${myColor === 'white' ? 'text-white' : 'text-black'}`}>
              {myPlayer?.displayName || 'You'}
            </span>
            <span className="text-text-muted">vs</span>
            <span className={`font-semibold ${oppPlayer?.color === 'white' ? 'text-white' : 'text-black'}`}>
              {oppPlayer?.displayName || 'Opponent'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ClockDisplay initialTime={match.timeControl} isRunning={isMyTurn} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 flex flex-col p-4">
        <div className="flex-1 min-h-0 max-w-4xl w-full mx-auto flex flex-col">
          {/* Turn indicator */}
          <div className={`shrink-0 text-center mb-3 p-2 rounded-lg ${isMyTurn ? 'bg-card-green/20 text-card-green' : 'bg-surface text-text-muted'}`}>
            {isMyTurn ? 'Your turn!' : "Opponent's turn"}
          </div>

          {error && (
            <div className="shrink-0 mb-3 p-2 rounded-lg bg-card-red/20 text-card-red text-sm">
              {error}
            </div>
          )}

          {/* Board - sized to the space left between header and bottom bar */}
          <div className="flex-1 min-h-0">
            <BoardGrid
              board={board}
              onCellClick={handleCellClick}
              selectedCell={selectedCell}
              validMoves={validMoves}
            />
          </div>

          {/* Card Tray */}
          {match.gameMode?.startsWith('card') && myPlayer && (
            <div className="shrink-0 mt-3">
              <CardTray
                cards={[]}
                isOwned={true}
                currentTime={match.timeControl}
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom bar */}
      <div className="shrink-0 bg-surface border-t border-line p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="danger" onClick={() => navigate('/lobby')}>
            <Flag className="w-4 h-4 mr-2" />
            Resign
          </Button>

          <Button variant="ghost" onClick={() => setShowMoveList(!showMoveList)}>
            <ChevronUp className={`w-4 h-4 mr-2 transition-transform ${showMoveList ? 'rotate-180' : ''}`} />
            Move List
          </Button>

          <Button variant="secondary">
            <User className="w-4 h-4 mr-2" />
            Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
