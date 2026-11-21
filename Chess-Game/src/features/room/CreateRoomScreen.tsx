import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/useAuth';
import { useGameStore } from '../../stores/useGameStore';
import { roomService } from '../../services/roomService';
import type { RoomMode } from '../../types/room';
import { ArrowLeft, Clock, Sparkles, Sword } from 'lucide-react';

export function CreateRoomScreen() {
  const { user, profile } = useAuth();
  const { selectedTimeControlMs, selectedIncrementMs } = useGameStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<RoomMode>('classic');

  const handleCreate = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const roomId = await roomService.createRoom(
        {
          uid: user.uid,
          displayName: profile?.displayName || user.displayName || 'Player',
          photoURL: profile?.photoURL ?? user.photoURL ?? null,
          rank: profile?.rankClassic ?? 1200,
        },
        { initialMs: selectedTimeControlMs, incrementMs: selectedIncrementMs },
        mode,
      );

      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the room.');
    } finally {
      setLoading(false);
    }
  };

  const minutes = Math.round(selectedTimeControlMs / 60000);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="bg-surface border border-line rounded-xl p-8 w-full max-w-md">
        <button
          onClick={() => navigate('/lobby')}
          className="flex items-center gap-2 text-text-muted hover:text-text mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lobby
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-card-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sword className="w-8 h-8 text-card-green" />
          </div>
          <h1 className="text-2xl font-bold">Create Room</h1>
          <p className="text-text-muted mt-2">Create a private room and invite a friend</p>
        </div>

        {/* Game Mode */}
        <div className="bg-surface-raised rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-text-muted">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">Game Mode</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('classic')}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                mode === 'classic'
                  ? 'bg-card-blue/20 border-card-blue text-card-blue'
                  : 'border-line text-text-muted hover:bg-surface-raised'
              }`}
            >
              Classic
            </button>
            <button
              onClick={() => setMode('card')}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                mode === 'card'
                  ? 'bg-card-purple/20 border-card-purple text-card-purple'
                  : 'border-line text-text-muted hover:bg-surface-raised'
              }`}
            >
              Card Chess
            </button>
          </div>
          {mode === 'card' && (
            <p className="text-xs text-text-muted mt-3">
              Each player picks up to 3 cards before the game (30 seconds).
            </p>
          )}
        </div>

        {/* Time Control */}
        <div className="bg-surface-raised rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-muted">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Time Control</span>
            </div>
            <span className="font-mono font-semibold">
              {minutes}+{Math.round(selectedIncrementMs / 1000)}
            </span>
          </div>
        </div>

        {error && <p className="text-danger text-sm text-center mb-4">{error}</p>}

        {/* Create Button */}
        <Button
          onClick={handleCreate}
          disabled={loading}
          className="w-full h-12 bg-card-green hover:bg-card-green/80"
        >
          {loading ? 'Creating...' : 'Create Room'}
        </Button>
      </div>
    </div>
  );
}
