import { memo } from 'react';
import type { RoomMove } from '../../types/room';

interface MoveLogProps {
  /** The moves in the order they were played. */
  moves: RoomMove[];
  /** The colour the reader sits on, used to highlight their own moves. */
  myColor?: 'white' | 'black' | null;
}

/**
 * The list of moves played in the game.
 *
 * The moves are shown in pairs, one move per player, which is how a chess
 * game is normally read.
 */
function MoveLogComponent({ moves, myColor }: MoveLogProps) {
  if (moves.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-6">
        No moves yet.
      </p>
    );
  }

  const rows: { number: number; white?: RoomMove; black?: RoomMove }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ number: i / 2 + 1, white: moves[i], black: moves[i + 1] });
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <div
          key={row.number}
          className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center text-sm"
        >
          <span className="text-text-muted font-mono text-xs">{row.number}.</span>
          <span
            className={row.white && myColor === 'white' ? 'text-card-gold font-semibold' : 'text-text'}
          >
            {row.white?.san ?? ''}
          </span>
          <span
            className={row.black && myColor === 'black' ? 'text-card-gold font-semibold' : 'text-text'}
          >
            {row.black?.san ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

export const MoveLog = memo(MoveLogComponent);
