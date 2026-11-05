import { useCallback } from 'react';
import type { BoardState, Position, Piece } from '../../../types';
import { Square as SquareComponent } from './Square';

interface BoardProps {
  board: BoardState;
  selectedPosition: Position | null;
  validMoves: Position[];
  lastMove?: { from: Position; to: Position } | null;
  currentTurn: 'white' | 'black';
  onMove: (from: Position, to: Position) => void;
  onSelectSquare: (position: Position | null) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export function Board({
  board,
  selectedPosition,
  validMoves,
  lastMove,
  currentTurn,
  onMove,
  onSelectSquare,
}: BoardProps) {
  // Get piece at a position
  const getPiece = useCallback((pos: Position): Piece | null => {
    // Convert position to array indices
    const colIndex = FILES.indexOf(pos.file);
    const rowIndex = RANKS.indexOf(pos.rank);

    // Board array indices
    const boardRow = board.offsetRow + (7 - rowIndex);
    const boardCol = board.offsetCol + colIndex;

    if (
      boardRow >= 0 && boardRow < board.squares.length &&
      boardCol >= 0 && boardCol < board.squares[0].length
    ) {
      const square = board.squares[boardRow][boardCol];
      return square.piece;
    }
    return null;
  }, [board]);

  // Check if a position is a valid move
  const isValidMovePos = useCallback((pos: Position): boolean => {
    return validMoves.some(m => m.file === pos.file && m.rank === pos.rank);
  }, [validMoves]);

  // Handle square click
  const handleSquareClick = useCallback((pos: Position) => {
    const piece = getPiece(pos);

    // If clicking on a valid move destination
    if (selectedPosition && isValidMovePos(pos)) {
      onMove(selectedPosition, pos);
      onSelectSquare(null);
      return;
    }

    // If clicking on own piece, select it
    if (piece && piece.color === currentTurn) {
      onSelectSquare(pos);
      return;
    }

    // Otherwise, deselect
    onSelectSquare(null);
  }, [selectedPosition, validMoves, currentTurn, onMove, onSelectSquare, getPiece, isValidMovePos]);

  // Check if a position is in check
  const isInCheck = useCallback((pos: Position): boolean => {
    const piece = getPiece(pos);
    return Boolean(piece?.isRoyal && piece?.color === currentTurn);
  }, [currentTurn, getPiece]);

  // Check if position is selected
  const isSelected = useCallback((pos: Position): boolean => {
    if (!selectedPosition) return false;
    return selectedPosition.file === pos.file && selectedPosition.rank === pos.rank;
  }, [selectedPosition]);

  // Render board
  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative">
        {/* Board grid */}
        <div className="grid grid-cols-8 gap-0 border-2 border-line rounded-lg overflow-hidden shadow-2xl shadow-black/50">
          {RANKS.map((rank) =>
            FILES.map((file) => {
              const pos: Position = { file, rank };
              const piece = getPiece(pos);
              const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0;
              const isLastMoveFrom = lastMove?.from.file === file && lastMove?.from.rank === rank;
              const isLastMoveTo = lastMove?.to.file === file && lastMove?.to.rank === rank;

              return (
                <SquareComponent
                  key={`${file}${rank}`}
                  position={pos}
                  piece={piece}
                  isLight={isLight}
                  isSelected={isSelected(pos)}
                  isValidMove={isValidMovePos(pos)}
                  isLastMove={isLastMoveFrom || isLastMoveTo}
                  isCheck={isInCheck(pos)}
                  onClick={() => handleSquareClick(pos)}
                  onPieceClick={() => handleSquareClick(pos)}
                />
              );
            })
          )}
        </div>

        {/* Coordinate labels - top */}
        <div className="flex ml-8">
          {FILES.map((file) => (
            <div
              key={file}
              className="flex-1 text-center text-xs text-text/40 font-mono py-1"
            >
              {file}
            </div>
          ))}
        </div>

        {/* Coordinate labels - left */}
        <div className="absolute left-0 top-0 bottom-8 flex flex-col w-8">
          {RANKS.map((rank) => (
            <div
              key={rank}
              className="flex-1 flex items-center justify-center text-xs text-text/40 font-mono"
            >
              {rank}
            </div>
          ))}
        </div>
      </div>

      {/* Move notation indicator */}
      <div className="mt-4 text-center text-sm text-text-muted">
        <span className="font-mono">
          {currentTurn === 'white' ? '⚪ White' : '⚫ Black'} to move
        </span>
      </div>
    </div>
  );
}
