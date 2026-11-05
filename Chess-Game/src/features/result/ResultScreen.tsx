import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Dialog';
import { useAuth } from '../../contexts/AuthContext';
import { useGameStore } from '../../stores/gameStore';
import {
  Trophy,
  Meh,
  Frown,
  RotateCcw,
  Home,
  Eye,
  Star,
} from 'lucide-react';

interface ResultScreenProps {
  result: 'win' | 'loss' | 'draw';
  eloChange: number;
  oldRank: number;
  newRank: number;
  duration: number;
  moveCount: number;
  cardsUsed: number;
  totalCards: number;
  gameMode: 'classic' | 'card';
}

export function ResultScreen({
  result,
  eloChange,
  oldRank,
  newRank,
  duration,
  moveCount,
  cardsUsed,
  totalCards,
  gameMode,
}: ResultScreenProps) {
  const { updateProfile, refreshProfile } = useAuth();
  const { setScreen } = useGameStore();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Show confetti for wins
  useEffect(() => {
    if (result === 'win') {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  // Update rank in Firebase when result is shown
  useEffect(() => {
    const saveResult = async () => {
      if (result !== 'draw' && eloChange !== 0) {
        setIsSaving(true);
        try {
          if (gameMode === 'card') {
            await updateProfile({ rankCard: newRank });
          } else {
            await updateProfile({ rankClassic: newRank });
          }
          await refreshProfile();
        } catch (err) {
          console.error('Failed to save result:', err);
        } finally {
          setIsSaving(false);
        }
      }
    };

    saveResult();
  }, [result, eloChange, newRank, gameMode]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResultContent = () => {
    switch (result) {
      case 'win':
        return {
          icon: <Trophy className="w-16 h-16 text-card-gold" />,
          title: 'Victory!',
          subtitle: 'Congratulations, you won!',
          color: 'text-card-gold',
          bgColor: 'bg-card-gold/10',
        };
      case 'loss':
        return {
          icon: <Frown className="w-16 h-16 text-danger" />,
          title: 'Defeat',
          subtitle: 'Better luck next time!',
          color: 'text-danger',
          bgColor: 'bg-danger/10',
        };
      case 'draw':
        return {
          icon: <Meh className="w-16 h-16 text-card-silver" />,
          title: 'Draw',
          subtitle: 'A well-fought match!',
          color: 'text-card-silver',
          bgColor: 'bg-card-silver/10',
        };
    }
  };

  const content = getResultContent();

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      {/* Confetti effect for wins */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                color: ['#E5B53B', '#4C8DF6', '#3FB97A', '#9A6BFF', '#E5484D'][
                  Math.floor(Math.random() * 5)
                ],
              }}
            >
              {['⭐', '✨', '🎊', '🏆'][Math.floor(Math.random() * 4)]}
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Result header */}
        <div className={`text-center p-8 rounded-t-2xl ${content.bgColor}`}>
          <div className="flex justify-center mb-4 animate-bounce">
            {content.icon}
          </div>
          <h1 className={`text-4xl font-bold mb-2 ${content.color}`}>
            {content.title}
          </h1>
          <p className="text-text-muted">{content.subtitle}</p>
        </div>

        {/* ELO change */}
        <div className="bg-surface border-x border-line p-6">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-sm text-text-muted mb-1">Before</p>
              <p className="text-2xl font-mono">{oldRank}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-3xl">{result === 'win' ? '→' : result === 'loss' ? '←' : '↔'}</span>
              <div className={`
                px-4 py-2 rounded-lg font-bold
                ${result === 'win' ? 'bg-card-green/20 text-card-green' : ''}
                ${result === 'loss' ? 'bg-danger/20 text-danger' : ''}
                ${result === 'draw' ? 'bg-card-silver/20 text-card-silver' : ''}
              `}>
                {result === 'win' ? '+' : ''}{eloChange}
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-text-muted mb-1">After</p>
              <p className="text-2xl font-mono font-bold">
                <span className={result === 'win' ? 'text-card-green' : result === 'loss' ? 'text-danger' : 'text-card-silver'}>
                  {newRank}
                </span>
              </p>
            </div>
          </div>

          {/* Star badge for win */}
          {result === 'win' && (
            <div className="flex justify-center mt-4">
              <Badge variant="gold" className="px-4 py-2 text-sm">
                <Star className="w-4 h-4 mr-1" />
                Rating increased!
              </Badge>
            </div>
          )}

          {/* Saving indicator */}
          {isSaving && (
            <p className="text-center text-xs text-text-muted mt-2">
              Saving to your profile...
            </p>
          )}
        </div>

        {/* Match stats */}
        <div className="bg-surface border-x border-line p-6">
          <h3 className="text-sm font-semibold text-text-muted mb-4 text-center">
            Match Statistics
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-mono">{formatDuration(duration)}</p>
              <p className="text-xs text-text-muted">Duration</p>
            </div>
            <div>
              <p className="text-2xl font-mono">{moveCount}</p>
              <p className="text-xs text-text-muted">Moves</p>
            </div>
            <div>
              <p className="text-2xl font-mono">{cardsUsed}/{totalCards}</p>
              <p className="text-xs text-text-muted">Cards Used</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="bg-surface border border-line rounded-b-2xl p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              className="h-12"
              onClick={() => {
                alert('Replay feature coming soon!');
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              Review
            </Button>
            <Button
              variant="secondary"
              className="h-12"
              onClick={() => setScreen('matchmaking')}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Rematch
            </Button>
          </div>
          <Button
            className="w-full h-12 text-lg"
            onClick={() => setScreen('lobby')}
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Lobby
          </Button>
        </div>

        {/* Footer tips */}
        <p className="text-center text-xs text-text-muted mt-6">
          Tip: Practice your openings in the card collection!
        </p>
      </div>
    </div>
  );
}

// Wrapper that gets data from Firebase profile
export function ResultScreenWrapper() {
  const { profile } = useAuth();

  // Get current rank from profile
  const currentRank = profile?.rankCard || profile?.rankClassic || 1200;
  const eloChange = 15;
  const newRank = currentRank + eloChange;

  // Mock data - in real app this would come from match result
  const mockResult = {
    result: 'win' as const,
    eloChange,
    oldRank: currentRank,
    newRank,
    duration: 272,
    moveCount: 24,
    cardsUsed: 2,
    totalCards: 3,
    gameMode: 'card' as const,
  };

  return <ResultScreen {...mockResult} />;
}
