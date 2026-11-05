import { memo } from 'react';
import type { Piece as PieceType } from '../../../types';

interface PieceProps {
  piece: PieceType;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const PIECE_UNICODE: Record<string, { white: string; black: string }> = {
  king: { white: '♔', black: '♚' },
  queen: { white: '♕', black: '♛' },
  rook: { white: '♖', black: '♜' },
  bishop: { white: '♗', black: '♝' },
  knight: { white: '♘', black: '♞' },
  pawn: { white: '♙', black: '♟' },
};

function PieceComponent({ piece, isSelected, isHovered, onClick, style }: PieceProps) {
  const unicode = PIECE_UNICODE[piece.type]?.[piece.color] || '?';
  const isWhite = piece.color === 'white';

  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center justify-center
        w-full h-full
        transition-all duration-150
        ${isSelected ? 'scale-110 z-10' : ''}
        ${isHovered ? 'scale-105' : ''}
        ${piece.isRoyal ? 'cursor-pointer' : ''}
        active:scale-95
      `}
      style={{
        transform: isSelected ? 'scale(1.1)' : isHovered ? 'scale(1.05)' : 'scale(1)',
        filter: isSelected ? 'drop-shadow(0 4px 8px rgba(229, 181, 59, 0.5))' : undefined,
        ...style,
      }}
    >
      {/* Main piece */}
      <span
        className="text-5xl md:text-6xl select-none pointer-events-none transition-transform duration-200"
        style={{
          color: isWhite ? '#F5F5F5' : '#1a1a1a',
          textShadow: isWhite
            ? '0 2px 4px rgba(0,0,0,0.3), 0 0 1px rgba(0,0,0,0.5)'
            : '0 2px 4px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.1)',
        }}
      >
        {unicode}
      </span>

      {/* Royal crown indicator */}
      {piece.isRoyal && (
        <span className="absolute -top-1 -right-1 text-xs">👑</span>
      )}

      {/* Selected ring */}
      {isSelected && (
        <span className="absolute inset-0 rounded-full border-2 border-card-gold animate-pulse" />
      )}

      {/* Check indicator */}
      {piece.isRoyal && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-danger animate-pulse" />
      )}
    </button>
  );
}

export const Piece = memo(PieceComponent);
