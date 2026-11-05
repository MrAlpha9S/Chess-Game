import type { Move, CardAction } from '../../../types';
import { ScrollArea } from '../../../components/ui/ScrollArea';
import { Badge } from '../../../components/ui/Dialog';

interface MoveListProps {
  moves: Move[];
  cardActions: CardAction[];
}

function MoveItem({ move, index }: { move: Move; index: number }) {
  const moveNumber = Math.floor(index / 2) + 1;
  const isWhiteMove = index % 2 === 0;

  // Get piece symbol
  const PIECE_SYMBOLS: Record<string, string> = {
    king: 'K',
    queen: 'Q',
    rook: 'R',
    bishop: 'B',
    knight: 'N',
    pawn: '',
  };

  const pieceSymbol = PIECE_SYMBOLS[move.piece] || '';
  const capture = move.capturedPiece ? 'x' : '';
  const check = move.isCheck ? (move.isCheckmate ? '#' : '+') : '';
  const castling = move.isCastling === 'kingside' ? 'O-O' : move.isCastling === 'queenside' ? 'O-O-O' : null;

  return (
    <div className={`flex items-center gap-2 py-1 ${isWhiteMove ? '' : 'bg-surface/50'}`}>
      <span className="w-8 text-xs text-text-muted font-mono">{moveNumber}.</span>
      <span className={`font-mono ${move.isCheckmate ? 'text-card-gold font-bold' : ''}`}>
        {castling || `${pieceSymbol}${move.from.file}${move.from.rank}${capture}${move.to.file}${move.to.rank}${check}`}
      </span>
      {move.promotion && (
        <span className="text-card-gold font-bold">
          ={PIECE_SYMBOLS[move.promotion]}
        </span>
      )}
    </div>
  );
}

function CardActionItem({ action }: { action: CardAction; index: number }) {
  const colorConfig: Record<string, string> = {
    gold: 'text-card-gold',
    silver: 'text-card-silver',
    green: 'text-card-green',
    blue: 'text-card-blue',
    bronze: 'text-card-bronze',
    purple: 'text-card-purple',
  };

  return (
    <div className="flex items-center gap-2 py-1 bg-surface-raised/50 rounded px-2">
      <Badge variant={action.card.color as any} className="text-xs">
        {action.card.color.charAt(0).toUpperCase()}
      </Badge>
      <span className={`text-sm ${colorConfig[action.card.color]}`}>
        {action.card.name}
      </span>
      <span className="text-xs text-text-muted ml-auto">
        {new Date(action.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}

export function MoveList({ moves, cardActions }: MoveListProps) {
  // Combine and sort by timestamp
  const allEvents = [
    ...moves.map((m, i) => ({ type: 'move' as const, data: m, index: i })),
    ...cardActions.map((a, i) => ({ type: 'card' as const, data: a, index: i })),
  ].sort((a, b) => a.data.timestamp - b.data.timestamp);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-line">
        <h3 className="text-sm font-semibold text-text">Move History</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {allEvents.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">
              No moves yet
            </p>
          ) : (
            <div className="space-y-1">
              {allEvents.map((event, i) => (
                <div key={i}>
                  {event.type === 'move' ? (
                    <MoveItem move={event.data as Move} index={event.index} />
                  ) : (
                    <CardActionItem action={event.data as CardAction} index={event.index} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
