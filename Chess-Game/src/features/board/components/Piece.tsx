import { memo } from 'react';
import { pieceImage, type PieceCode } from './pieceImages';

interface PieceProps {
  /** The piece code, for example 'wk'. */
  piece: PieceCode;
  /** True when the piece is the king of the side being checked. */
  isInCheck?: boolean;
  /** True when the piece is the last one to have moved. */
  isHighlighted?: boolean;
}

/**
 * A chess piece sprite.
 *
 * The sprite scales with its square: the board sets its size through the
 * container query units on the parent, so the piece fills the square without
 * a fixed pixel size.
 */
function PieceComponent({ piece, isInCheck, isHighlighted }: PieceProps) {
  return (
    <span
      className="pointer-events-none select-none flex items-center justify-center w-full h-full"
      style={{
        filter: isInCheck
          ? 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.95))'
          : isHighlighted
            ? 'drop-shadow(0 0 6px rgba(229, 181, 59, 0.85))'
            : 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45))',
      }}
    >
      <img
        src={pieceImage(piece)}
        alt=""
        draggable={false}
        className="w-[92%] h-[92%] object-contain"
      />
    </span>
  );
}

export const Piece = memo(PieceComponent);
