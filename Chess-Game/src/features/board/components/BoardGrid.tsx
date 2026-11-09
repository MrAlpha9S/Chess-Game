import { memo } from 'react';
import { Piece } from './Piece';
import {
  ACTIVE_MIN_COL,
  ACTIVE_MIN_ROW,
  gridToAlgebraic,
  type GridCoord,
} from '../../../engine';

interface BoardGridProps {
  /** The 10x10 board of piece codes. */
  board: string[][];
  /** Called when a square is clicked. */
  onCellClick: (row: number, col: number) => void;
  /** The square the player has picked up. */
  selectedCell: GridCoord | null;
  /** The squares the selected piece may move to. */
  validMoves: GridCoord[];
  /** The squares the last move touched. */
  lastMove?: { from: string; to: string } | null;
  /** The square of the king that is in check. */
  checkSquare?: GridCoord | null;
  /** True when the board should accept clicks. */
  isInteractive?: boolean;
  /** True when the board is seen from black's side. */
  isFlipped?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

/** The width of the rank-label gutter on the left. */
const GUTTER = '1.25rem';

function BoardGridComponent({
  board,
  onCellClick,
  selectedCell,
  validMoves,
  lastMove,
  checkSquare,
  isInteractive = true,
  isFlipped = false,
}: BoardGridProps) {
  /*
   * Sizing model
   * ------------
   * The wrapper is a square whose side W = min(available width, available height),
   * so it can never overflow the space it is given.
   *
   *   wrapper width      = W
   *   rank gutter        = GUTTER (1.25rem)
   *   board (8x8)        = W - GUTTER   (square via aspect-square)
   *   file-label row     = GUTTER
   *
   * Total content height = GUTTER + (W - GUTTER) = W  ->  exactly fits in the
   * container height, with the label row paying for the label gutter.
   */
  const side = 'min(100cqw, 100cqh)';
  const boardHeight = `calc(${side} - ${GUTTER})`;

  // When the board is flipped the files and ranks run the other way, so the
  // player always sees their own pieces at the bottom.
  const files = isFlipped ? [...FILES].reverse() : FILES;
  const ranks = isFlipped ? [...RANKS].reverse() : RANKS;

  const lastFrom = lastMove ? lastMove.from : null;
  const lastTo = lastMove ? lastMove.to : null;

  return (
    // Container query root: lets the board size itself against its own slot
    // instead of the viewport.
    <div
      className="w-full h-full grid place-items-center overflow-hidden"
      style={{ containerType: 'size' }}
    >
      <div className="flex flex-col" style={{ width: side }}>
        {/* File labels (a-h) */}
        <div
          className="shrink-0 grid grid-cols-[1.25rem_1fr]"
          style={{ height: GUTTER }}
        >
          <div />
          <div className="grid grid-cols-8">
            {files.map((file) => (
              <div
                key={file}
                className="flex items-center justify-center text-[10px] text-text/40 font-mono"
              >
                {file}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1.25rem_1fr]">
          {/* Rank labels (8-1) - one row per board row */}
          <div className="grid grid-rows-8" style={{ height: boardHeight }}>
            {ranks.map((rank) => (
              <div
                key={rank}
                className="flex items-center justify-center text-[10px] text-text/40 font-mono"
              >
                {rank}
              </div>
            ))}
          </div>

          {/* Active 8x8 board - its own container so pieces scale with it */}
          <div
            className="grid grid-cols-8 gap-0 border-2 border-line rounded-lg overflow-hidden shadow-2xl shadow-black/50 aspect-square"
            style={{ containerType: 'size' }}
          >
            {ranks.map((_, ar) => {
              const rowIdx = ACTIVE_MIN_ROW + ar;
              return files.map((_, ac) => {
                const colIdx = ACTIVE_MIN_COL + ac;
                const cell = board[rowIdx]?.[colIdx] ?? '';
                const algebraic = gridToAlgebraic(rowIdx, colIdx);

                const isSelected =
                  selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                const isValidMove = validMoves.some(
                  (m) => m.row === rowIdx && m.col === colIdx
                );
                const isCheck = checkSquare?.row === rowIdx && checkSquare?.col === colIdx;
                const isLastMove = algebraic === lastFrom || algebraic === lastTo;
                // a8 (top-left) is a light square
                const isLight = (rowIdx + colIdx) % 2 === 0;

                return (
                  <button
                    key={`${rowIdx}-${colIdx}`}
                    onClick={() => onCellClick(rowIdx, colIdx)}
                    disabled={!isInteractive}
                    aria-label={`${algebraic}${cell ? `, ${cell}` : ', empty'}`}
                    className={`
                      relative aspect-square flex items-center justify-center
                      transition-colors duration-150
                      ${isLight ? 'bg-square-light' : 'bg-square-dark'}
                      ${isLastMove ? 'bg-yellow-500/30' : ''}
                      ${isSelected ? 'ring-2 ring-card-gold ring-inset' : ''}
                      ${isInteractive ? 'hover:brightness-110 cursor-pointer' : 'cursor-default'}
                    `}
                  >
                    {isValidMove && (
                      <span
                        className={`
                          absolute pointer-events-none rounded-full
                          ${cell ? 'ring-4 ring-danger/70' : 'w-3 h-3 bg-text/30'}
                        `}
                        style={
                          cell
                            ? undefined
                            : { width: '22%', height: '22%' }
                        }
                      />
                    )}
                    {cell && (
                      <Piece
                        piece={cell}
                        isInCheck={isCheck}
                        isHighlighted={isLastMove}
                      />
                    )}
                  </button>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export const BoardGrid = memo(BoardGridComponent);
