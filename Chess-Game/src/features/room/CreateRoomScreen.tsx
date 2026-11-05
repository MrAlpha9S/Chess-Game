import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useGameStore } from '../../stores/gameStore';
import { roomService } from '../../services/room';
import { ArrowLeft, Clock, Sword } from 'lucide-react';

export function CreateRoomScreen() {
  const { user, profile } = useAuth();
  const { selectedTimeControl } = useGameStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user || !profile) {
      navigate('/login');
      return;
    }

    setLoading(true);

    try {
      const room = await roomService.createRoom(
        user,
        profile.displayName,
        profile.photoURL,
        profile.rankCard,
        'card-casual',
        selectedTimeControl
      );

      if (room) {
        // Navigate to waiting room with the room code
        navigate('/room', { state: { roomCode: room.id } });
      } else {
        alert('Failed to create room');
      }
    } catch (err) {
      console.error('Create room error:', err);
      alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

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

        {/* Time Control */}
        <div className="bg-surface-raised rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-muted">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Time Control</span>
            </div>
            <span className="font-mono font-semibold">{selectedTimeControl / 60}+0</span>
          </div>
        </div>

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
