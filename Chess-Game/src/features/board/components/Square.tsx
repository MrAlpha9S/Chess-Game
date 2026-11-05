import { memo } from 'react';
import type { Position, Piece as PieceType } from '../../../types';
import { Piece } from './Piece';

interface SquareProps {
  position: Position;
  piece: PieceType | null;
  isLight: boolean;
  isSelected: boolean;
  isValidMove: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  targetColor?: string;
  onClick: () => void;
  onPieceClick: () => void;
}

function SquareComponent({
  position,
  piece,
  isLight,
  isSelected,
  isValidMove,
  isLastMove,
  isCheck,
  targetColor,
  onClick,
  onPieceClick,
}: SquareProps) {
  // Determine background color
  let bgColor = isLight ? 'bg-square-light' : 'bg-square-dark';

  if (isSelected) {
    bgColor = 'bg-card-gold/40';
  } else if (isCheck && piece?.isRoyal) {
    bgColor = 'bg-danger/30';
  } else if (isLastMove) {
    bgColor = isLight ? 'bg-card-gold/20' : 'bg-card-gold/15';
  }

  // Get file letter
  const fileLetter = position.file;

  return (
    <button
      onClick={onClick}
      className={`
        relative
        w-full aspect-square
        flex items-center justify-center
        transition-colors duration-100
        ${bgColor}
        hover:brightness-110
        focus:outline-none focus:ring-2 focus:ring-inset focus:ring-card-gold
      `}
      aria-label={`${fileLetter}${position.rank}${piece ? `, ${piece.type} ${piece.color}` : ', empty'}`}
    >
      {/* Target highlight from card */}
      {targetColor && (
        <div
          className="absolute inset-1 rounded-sm opacity-50"
          style={{
            border: `3px solid var(--color-card-${targetColor})`,
            boxShadow: `inset 0 0 10px var(--color-card-${targetColor})`,
          }}
        />
      )}

      {/* Valid move dot */}
      {isValidMove && !piece && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-4 h-4 rounded-full bg-text/40" />
        </div>
      )}

      {/* Capture indicator */}
      {isValidMove && piece && (
        <div className="absolute inset-1 rounded-sm border-2 border-text/40 pointer-events-none" />
      )}

      {/* Piece */}
      {piece && (
        <Piece
          piece={piece}
          isSelected={isSelected}
          onClick={onPieceClick}
        />
      )}

      {/* Coordinate labels */}
      {position.rank === 1 && (
        <span className="absolute bottom-0.5 right-1 text-[10px] text-text/30 font-mono pointer-events-none">
          {fileLetter}
        </span>
      )}
      {position.file === 'a' && (
        <span className="absolute top-0.5 left-1 text-[10px] text-text/30 font-mono pointer-events-none">
          {position.rank}
        </span>
      )}
    </button>
  );
}

export const Square = memo(SquareComponent);
