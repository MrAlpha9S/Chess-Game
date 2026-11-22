/**
 * The Redeployment prep effect.
 *
 * A side that picks the bronze Redeployment card may reorder its six
 * rook/knight/bishop slots on the back rank (files a, b, c, f, g, h); the
 * queen and king stay on d and e. The effect applies at the start of the
 * game, so the module's job is to turn two sides' arrangements into the
 * starting FEN. It is pure: no engine, no database.
 *
 * Castling rights follow the GDD's "king in its original position" rule and
 * standard FEN conventions: a side only keeps the right whose back-file
 * rook is still on its edge file after the rearrangement.
 */

/** The three roles that may be rearranged. */
export type RearrangedRole = 'rook' | 'knight' | 'bishop';

/** One side's arrangement of the six back-rank slots, in file order a,b,c,f,g,h. */
export type BackRankArrangement = RearrangedRole[];

/** The standard starting arrangement. */
export const DEFAULT_ARRANGEMENT: BackRankArrangement = [
  'rook',
  'knight',
  'bishop',
  'bishop',
  'knight',
  'rook',
];

/** The piece letter on the FEN rank for each rearranged role. */
const LETTER: Record<RearrangedRole, string> = {
  rook: 'R',
  knight: 'N',
  bishop: 'B',
};

/** The six slots, as file indices (0-based): a,b,c,f,g,h. */
const SLOT_FILES = [0, 1, 2, 5, 6, 7] as const;

/**
 * Whether the arrangement is legal: exactly six slots holding the starting
 * multiset of two rooks, two knights and two bishops.
 */
export function isValidArrangement(arrangement: readonly RearrangedRole[] | null | undefined): boolean {
  if (!arrangement || arrangement.length !== 6) return false;
  const counts = new Map<RearrangedRole, number>();
  for (const role of arrangement) {
    if (role !== 'rook' && role !== 'knight' && role !== 'bishop') return false;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return counts.get('rook') === 2 && counts.get('knight') === 2 && counts.get('bishop') === 2;
}

/**
 * Realtime Database may hand arrays back as objects with numeric keys, so
 * an arrangement read from the room is normalised before use.
 */
export function normalizeArrangement(
  value: unknown,
): BackRankArrangement | null {
  if (!Array.isArray(value)) {
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).map(Number).sort((a, b) => a - b);
      if (keys.length === 6 && keys.every((k, i) => k === i)) {
        const arr = keys.map((k) => record[String(k)]) as unknown[];
        if (arr.every((v) => v === 'rook' || v === 'knight' || v === 'bishop')) {
          return arr as BackRankArrangement;
        }
        return null;
      }
    }
    return null;
  }
  const arr = value as unknown[];
  if (arr.length === 6 && arr.every((v) => v === 'rook' || v === 'knight' || v === 'bishop')) {
    return arr as BackRankArrangement;
  }
  return null;
}

/** One side's back rank as an 8-char FEN field, upper- or lowercase. */
function rankField(
  arrangement: BackRankArrangement | null,
  color: 'white' | 'black',
): string {
  const source = arrangement;
  const arr: BackRankArrangement =
    source && isValidArrangement(source) ? source : DEFAULT_ARRANGEMENT;
  const letters: Record<RearrangedRole, string> =
    color === 'white'
      ? LETTER
      : { rook: 'r', knight: 'n', bishop: 'b' };
  const cells = Array(8).fill('');
  cells[3] = color === 'white' ? 'Q' : 'q';
  cells[4] = color === 'white' ? 'K' : 'k';
  for (let i = 0; i < 6; i++) {
    cells[SLOT_FILES[i]] = letters[arr[i]];
  }
  return cells.join('');
}

/**
 * Build the starting FEN for two sides' redeployment choices.
 *
 * `null` means that side did not play the card and gets the standard rank.
 */
export function buildPrepFen(
  white: BackRankArrangement | null,
  black: BackRankArrangement | null,
): string {
  const whiteArr = isValidArrangement(white) ? white! : DEFAULT_ARRANGEMENT;
  const blackArr = isValidArrangement(black) ? black! : DEFAULT_ARRANGEMENT;

  const whiteRights =
    (whiteArr[0] === 'rook' ? 'K' : '') + (whiteArr[5] === 'rook' ? 'Q' : '');
  const blackRights =
    (blackArr[0] === 'rook' ? 'k' : '') + (blackArr[5] === 'rook' ? 'q' : '');
  const castling = whiteRights + blackRights || '-';

  return `${rankField(black, 'black')}/pppppppp/8/8/8/8/PPPPPPPP/${rankField(
    white,
    'white',
  )} w ${castling} - 0 1`;
}
