import { memo } from 'react';
import { pieceCodeToDisplay } from '../../../services/gameSync';

export interface GridCoord {
  row: number;
  col: number;
}

interface BoardGridProps {
  /** Full 10x10 board data (piece codes). The active 8x8 lives at rows 2-9, cols 0-7. */
  board: string[][];
  onCellClick: (row: number, col: number) => void;
  selectedCell: GridCoord | null;
  validMoves: GridCoord[];
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

// Active 8x8 region inside the 10x10 data grid
const ACTIVE_ROW_START = 2;
const ACTIVE_COL_START = 0;

// Width of the rank-label gutter on the left
const GUTTER = '1.25rem';

function BoardGridComponent({
  board,
  onCellClick,
  selectedCell,
  validMoves,
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
            {FILES.map((file) => (
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
            {RANKS.map((rank) => (
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
            {RANKS.map((rank, ar) => {
              const rowIdx = ACTIVE_ROW_START + ar;
              return FILES.map((file, ac) => {
                const colIdx = ACTIVE_COL_START + ac;
                const cell = board[rowIdx]?.[colIdx] ?? '';

                const isSelected =
                  selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                const isValidMove = validMoves.some(
                  (m) => m.row === rowIdx && m.col === colIdx
                );
                // a8 (top-left) is a light square
                const isLight = (rowIdx + colIdx) % 2 === 0;

                return (
                  <button
                    key={`${rowIdx}-${colIdx}`}
                    onClick={() => onCellClick(rowIdx, colIdx)}
                    aria-label={`${file}${rank}${cell ? `, ${cell}` : ', empty'}`}
                    className={`
                      relative aspect-square flex items-center justify-center
                      transition-all
                      ${isLight ? 'bg-square-light' : 'bg-square-dark'}
                      ${isSelected ? 'ring-2 ring-yellow-500 ring-inset' : ''}
                      ${isValidMove ? 'bg-green-500/50' : ''}
                      ${isValidMove && cell ? 'bg-red-500/50' : ''}
                      hover:brightness-110
                    `}
                    style={{ fontSize: '9cqw' }}
                  >
                    {cell && pieceCodeToDisplay(cell)}
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
