// Board and Position types
export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Position {
  file: File;
  rank: Rank;
}

export interface SquareCoord {
  row: number;
  col: number;
}

// Piece types
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PieceColor = 'white' | 'black';

export interface Piece {
  type: PieceType;
  color: PieceColor;
  id: string;
  hasMoved?: boolean;
  isRoyal?: boolean;
  isRevealed?: boolean;
}

// Board types
export interface Square {
  position: Position;
  piece: Piece | null;
  isHole?: boolean;
  isLocked?: boolean;
  isActive?: boolean;
  lastMove?: {
    from: Position;
    to: Position;
  };
  validMoveDot?: boolean;
  targetHighlight?: boolean;
}

export interface BoardState {
  squares: Square[][];
  activeBoardSize: number;
  offsetRow: number;
  offsetCol: number;
}

// Card types
export type CardColor = 'gold' | 'silver' | 'green' | 'blue' | 'bronze' | 'purple';

export interface Card {
  id: string;
  name: string;
  color: CardColor;
  description: string;
  value: number;
  clockThreshold?: number; // Time remaining in seconds to activate
  isLocked?: boolean;
  isUsed?: boolean;
  canUse?: boolean;
}

export interface Deck {
  cards: Card[];
  totalValue: number;
}

// Player types
export interface Player {
  id: string;
  name: string;
  rank: number;
  avatar?: string;
  timeRemaining: number;
  capturedPieces: Piece[];
  hand: Card[];
  isActive: boolean;
}

// Match types
export type GameMode = 'classic' | 'card-casual' | 'card-ranked';
export type MatchStatus = 'waiting' | 'preparing' | 'playing' | 'finished';
export type GameResult = 'win' | 'loss' | 'draw' | null;

export interface Move {
  id: string;
  from: Position;
  to: Position;
  piece: PieceType;
  color: PieceColor;
  capturedPiece?: PieceType;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isCastling?: 'kingside' | 'queenside';
  isEnPassant?: boolean;
  promotion?: PieceType;
  timestamp: number;
}

export interface CardAction {
  id: string;
  card: Card;
  target?: Position | Position[];
  timestamp: number;
}

export interface MatchState {
  id: string;
  mode: GameMode;
  status: MatchStatus;
  board: BoardState;
  players: [Player, Player];
  currentTurn: PieceColor;
  moves: Move[];
  cardActions: CardAction[];
  result: GameResult;
  winner?: PieceColor;
  timeControl: {
    initial: number;
    increment: number;
  };
  preparationPhase?: {
    lockedCards: Card[];
    selectedGold?: Piece;
    selectedSilver?: Piece;
    placedBronze?: Position;
  };
}

// Navigation types
export type Screen =
  | 'login'
  | 'lobby'
  | 'card-collection'
  | 'matchmaking'
  | 'preparation'
  | 'match'
  | 'result';

// UI Component types
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

// Theme token type
export interface ThemeTokens {
  bg: string;
  surface: string;
  surfaceRaised: string;
  line: string;
  text: string;
  textMuted: string;
  squareLight: string;
  squareDark: string;
  danger: string;
  cardGold: string;
  cardSilver: string;
  cardGreen: string;
  cardBlue: string;
  cardBronze: string;
  cardPurple: string;
}
