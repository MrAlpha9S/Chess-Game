import { useState, useMemo, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge, Progress } from '../../components/ui/Dialog';
import { useAuth } from '../../contexts/AuthContext';
import { useGameStore } from '../../stores/gameStore';
import type { CardColor, Card as CardType } from '../../types';
import { allCards } from '../../data/cards';
import {
  ArrowLeft,
  Search,
  Check,
  Lock,
  Sparkles,
  Shield,
  Zap,
  Target,
  Flame,
  Eye,
  Save,
  Loader2,
} from 'lucide-react';

const CARD_ICONS: Record<CardColor, React.ReactNode> = {
  gold: <Sparkles className="w-5 h-5" />,
  silver: <Shield className="w-5 h-5" />,
  green: <Zap className="w-5 h-5" />,
  blue: <Target className="w-5 h-5" />,
  bronze: <Flame className="w-5 h-5" />,
  purple: <Eye className="w-5 h-5" />,
};

const CARD_COLORS: { color: CardColor; label: string }[] = [
  { color: 'gold', label: 'Gold' },
  { color: 'silver', label: 'Silver' },
  { color: 'green', label: 'Green' },
  { color: 'blue', label: 'Blue' },
  { color: 'bronze', label: 'Bronze' },
  { color: 'purple', label: 'Purple' },
];

interface CardItemProps {
  card: CardType;
  isSelected: boolean;
  canSelect: boolean;
  onClick: () => void;
}

function CardItem({ card, isSelected, canSelect, onClick }: CardItemProps) {
  const colorConfig = CARD_COLORS.find(c => c.color === card.color);

  return (
    <div
      onClick={canSelect ? onClick : undefined}
      className={`
        relative p-3 rounded-lg border transition-all cursor-pointer
        ${isSelected
          ? 'border-card-gold bg-card-gold/10'
          : canSelect
            ? 'border-line bg-surface hover:border-text-muted hover:bg-surface-raised'
            : 'border-line bg-surface opacity-50 cursor-not-allowed'
        }
      `}
    >
      {/* Color indicator */}
      <div className={`flex items-center gap-2 mb-2 ${colorConfig?.color === 'gold' ? 'text-card-gold' : ''} ${colorConfig?.color === 'silver' ? 'text-card-silver' : ''} ${colorConfig?.color === 'green' ? 'text-card-green' : ''} ${colorConfig?.color === 'blue' ? 'text-card-blue' : ''} ${colorConfig?.color === 'bronze' ? 'text-card-bronze' : ''} ${colorConfig?.color === 'purple' ? 'text-card-purple' : ''}`}>
        {CARD_ICONS[card.color]}
        <span className="font-medium text-sm">{card.name}</span>
      </div>

      {/* Description */}
      <p className="text-xs text-text-muted mb-2">{card.description}</p>

      {/* Value badge */}
      <div className="flex items-center justify-between">
        <Badge variant={card.color as any}>Value: {card.value}</Badge>
        {card.clockThreshold && (
          <span className="text-xs text-text-muted">
            ⏱️ {Math.floor(card.clockThreshold / 60)}:{(card.clockThreshold % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-card-gold flex items-center justify-center">
          <Check className="w-4 h-4 text-bg" />
        </div>
      )}
    </div>
  );
}

export function CardCollectionScreen() {
  const { user, profile, updateProfile } = useAuth();
  const { setScreen, playerDeck, setPlayerDeck, addToDeck, removeFromDeck } = useGameStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<CardColor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedMessage, setShowSavedMessage] = useState(false);

  const isGuest = !user;

  // Load saved deck from Firebase profile on mount
  useEffect(() => {
    if (profile?.decks && profile.decks.length > 0) {
      const lastDeck = profile.decks[profile.decks.length - 1];
      if (lastDeck?.cards) {
        const deckCards = lastDeck.cards
          .map((cardId: string) => allCards.find(c => c.id === cardId))
          .filter(Boolean) as CardType[];
        if (deckCards.length === 3) {
          setPlayerDeck(deckCards);
        }
      }
    }
  }, [profile]);

  const filteredCards = useMemo(() => {
    return allCards.filter(card => {
      // Search filter
      if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Color filter
      if (selectedColor && card.color !== selectedColor) {
        return false;
      }
      return true;
    });
  }, [searchQuery, selectedColor]);

  const deckTotalValue = useMemo(() => {
    return playerDeck.reduce((sum, card) => sum + card.value, 0);
  }, [playerDeck]);

  const isDeckValid = playerDeck.length === 3 && deckTotalValue <= 9;

  const canAddCard = (card: CardType) => {
    if (playerDeck.length >= 3) return false;
    if (playerDeck.some(c => c.id === card.id)) return false;
    // Check color uniqueness
    const currentColors = playerDeck.map(c => c.color);
    if (currentColors.includes(card.color)) return false;
    return true;
  };

  const handleAddCard = (card: CardType) => {
    if (canAddCard(card)) {
      addToDeck(card);
    }
  };

  const handleRemoveCard = (cardId: string) => {
    removeFromDeck(cardId);
  };

  const handleSaveDeck = async () => {
    if (isGuest || !isDeckValid) return;

    setIsSaving(true);
    try {
      const newDeck = {
        id: `deck-${Date.now()}`,
        name: `Deck ${(profile?.decks?.length || 0) + 1}`,
        cards: playerDeck.map(c => c.id),
        createdAt: new Date(),
      };

      const updatedDecks = [...(profile?.decks || []), newDeck];
      await updateProfile({ decks: updatedDecks });

      setShowSavedMessage(true);
      setTimeout(() => setShowSavedMessage(false), 2000);
    } catch (err) {
      console.error('Failed to save deck:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartMatch = () => {
    if (isDeckValid) {
      setScreen('matchmaking');
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScreen('lobby')}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <h1 className="text-xl font-semibold">Card Collection</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-text-muted">Deck Value</p>
                <p className={`font-mono font-bold ${deckTotalValue > 9 ? 'text-danger' : 'text-card-green'}`}>
                  {deckTotalValue}/9
                </p>
              </div>
              <Progress value={deckTotalValue} max={9} className="w-20" />
            </div>
          </div>

          {/* Deck Preview */}
          <div className="flex gap-4 p-4 bg-surface-raised rounded-lg overflow-x-auto">
            {(['gold', 'silver', 'green', 'blue', 'bronze', 'purple'] as CardColor[]).map((color) => {
              const deckCard = playerDeck.find(c => c.color === color);
              const colorConfig = CARD_COLORS.find(c => c.color === color);

              return (
                <div
                  key={color}
                  className={`
                    w-40 h-56 rounded-xl border-2 flex-shrink-0 flex flex-col items-center justify-center
                    ${deckCard ? 'border-solid bg-surface' : 'border-dashed border-line bg-surface/50'}
                  `}
                >
                  {deckCard ? (
                    <div className="p-3 w-full h-full flex flex-col">
                      <div className={`flex items-center gap-2 mb-2 ${
                        color === 'gold' ? 'text-card-gold' :
                        color === 'silver' ? 'text-card-silver' :
                        color === 'green' ? 'text-card-green' :
                        color === 'blue' ? 'text-card-blue' :
                        color === 'bronze' ? 'text-card-bronze' :
                        'text-card-purple'
                      }`}>
                        {CARD_ICONS[deckCard.color]}
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <p className="font-medium text-sm text-text">{deckCard.name}</p>
                          <p className="text-xs text-text-muted mt-1">{deckCard.description}</p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant={deckCard.color as any}>{deckCard.value} pts</Badge>
                          <button
                            onClick={() => handleRemoveCard(deckCard.id)}
                            className="p-1 rounded hover:bg-danger/20 text-text-muted hover:text-danger transition-colors"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className={`w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center mx-auto mb-2 ${
                        color === 'gold' ? 'text-card-gold' :
                        color === 'silver' ? 'text-card-silver' :
                        color === 'green' ? 'text-card-green' :
                        color === 'blue' ? 'text-card-blue' :
                        color === 'bronze' ? 'text-card-bronze' :
                        'text-card-purple'
                      }`}>
                        {CARD_ICONS[color]}
                      </div>
                      <p className="text-sm text-text-muted">{colorConfig?.label}</p>
                      <p className="text-xs text-text-muted mt-1">Empty</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Deck Status */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              {playerDeck.length === 3 ? (
                <Badge variant={isDeckValid ? 'green' : 'danger'}>
                  {isDeckValid ? '✅ Valid Deck' : '❌ Invalid (value > 9)'}
                </Badge>
              ) : (
                <Badge variant="default">
                  Select {3 - playerDeck.length} more card{3 - playerDeck.length > 1 ? 's' : ''}
                </Badge>
              )}
              {showSavedMessage && (
                <Badge variant="gold" className="animate-pulse">Saved!</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  playerDeck.forEach(c => removeFromDeck(c.id));
                }}
              >
                Clear Deck
              </Button>
              {!isGuest && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveDeck}
                  disabled={!isDeckValid || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Save Deck
                </Button>
              )}
              <Button
                onClick={handleStartMatch}
                disabled={!isDeckValid}
              >
                Find Match
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-line rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-text-muted"
            />
          </div>

          {/* Color filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedColor(null)}
              className={`px-3 py-2 rounded-lg border transition-all ${
                selectedColor === null
                  ? 'bg-text text-bg border-text'
                  : 'bg-surface border-line text-text hover:bg-surface-raised'
              }`}
            >
              All
            </button>
            {CARD_COLORS.map(({ color, label }) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`px-3 py-2 rounded-lg border transition-all ${
                  selectedColor === color
                    ? 'bg-surface-raised border-text-muted'
                    : 'bg-surface border-line text-text hover:bg-surface-raised'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredCards.map((card) => {
            const isInDeck = playerDeck.some(c => c.id === card.id);
            return (
              <CardItem
                key={card.id}
                card={card}
                isSelected={isInDeck}
                canSelect={canAddCard(card)}
                onClick={() => handleAddCard(card)}
              />
            );
          })}
        </div>

        {filteredCards.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-muted">No cards found matching your filters.</p>
          </div>
        )}
      </main>
    </div>
  );
}
