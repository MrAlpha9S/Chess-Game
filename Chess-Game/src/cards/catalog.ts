/**
 * The Phase 2 card catalog.
 *
 * The catalog is pure data: it names the cards, their colors, their value
 * points and their descriptions, and it validates deck selections. It owns
 * no game logic — applying card effects is a later phase. Keeping the
 * catalog here means the 6-card pool can grow toward the full 41-card set
 * without touching the engine or the services.
 *
 * The pool is one card per color, so any deck of three is automatically
 * three different colors, as the GDD requires.
 */

/** The six card colors, by the layer of the game they affect. */
export type CardColor =
  | 'gold'
  | 'silver'
  | 'green'
  | 'blue'
  | 'bronze'
  | 'purple';

/** A card as it appears in the selection screen and the deck. */
export interface CardDefinition {
  /** The stable id stored in the deck, e.g. "tower". */
  id: string;
  /** The display name. */
  name: string;
  /** The card's color category. */
  color: CardColor;
  /** Value points from the GDD balance table (deck cap is 9). */
  points: number;
  /** A short description shown on the card tile. */
  description: string;
  /**
   * The sprite file (without color prefix and extension) that replaces the
   * transformed piece after the card's transformation applies, when one
   * exists. "tower" -> the-tower.png, "charmer" -> the-charmer.png.
   */
  transformedSprite?: string;
}

/** The six cards of the Phase 2 launch pool. */
export const CARD_CATALOG: readonly CardDefinition[] = [
  {
    id: 'tower',
    name: 'The Tower',
    color: 'gold',
    points: 3,
    description:
      'Biến 1 Xe thành pháo đài: không di chuyển, mỗi lần bắn tiêu diệt 1 quân địch trong bán kính 5x5, hồi chiêu 3 lượt.',
    transformedSprite: 'the-tower',
  },
  {
    id: 'charmer',
    name: 'The Charmer',
    color: 'silver',
    points: 3,
    description:
      'Biến 1 Tốt: thôi miên 1 quân địch trong bán kính 5x5 và điều khiển nó đi 1 nước thường, hồi chiêu 6 lượt.',
    transformedSprite: 'the-charmer',
  },
  {
    id: 'small-reinforcements',
    name: 'Small Reinforcements',
    color: 'green',
    points: 1,
    description:
      'Triệu hồi 1 Mã hoặc 1 Tượng vào 1 ô trống ở sân nhà khi đồng hồ của bạn còn dưới ngưỡng.',
  },
  {
    id: 'abyss',
    name: 'The Abyss (Vực Thẳm)',
    color: 'blue',
    points: 2,
    description:
      'Biến 3 ô trống bất kỳ thành hố: quân không di chuyển hay triệu hồi vào được, bàn vẫn liên thông.',
  },
  {
    id: 'redeployment',
    name: 'Redeployment (Tái Bố Trí)',
    color: 'bronze',
    points: 2,
    description:
      'Sắp xếp lại 6 quân Xe, Mã, Tượng trên hàng sau theo ý muốn; Vua và Hậu giữ nguyên.',
  },
  {
    id: 'major-conflict',
    name: 'Major Conflict',
    color: 'purple',
    points: 5,
    description:
      'Kết giới 6x6 giam các quân bên trong; quân bên trong không ra được, tự tan sau tối đa 10 lượt mỗi bên.',
  },
];

/** How many cards a deck may hold. */
export const DECK_SIZE = 3;

/** Look up a card by its id. */
export function getCard(id: string): CardDefinition | undefined {
  return CARD_CATALOG.find((card) => card.id === id);
}

/**
 * Whether the given ids form a legal deck: at most three cards, no
 * duplicates, every id in the catalog, and no two cards of the same color
 * (the GDD rule that a deck always touches three different layers).
 */
export function isValidDeck(ids: readonly string[]): boolean {
  if (ids.length > DECK_SIZE) return false;
  const seen = new Set<string>();
  const colors = new Set<CardColor>();
  for (const id of ids) {
    const card = getCard(id);
    if (!card) return false;
    if (seen.has(id)) return false;
    if (colors.has(card.color)) return false;
    seen.add(id);
    colors.add(card.color);
  }
  return true;
}
