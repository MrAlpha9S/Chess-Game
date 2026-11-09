import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/useAuth';
import { roomService } from '../../services/roomService';
import { ArrowLeft, Users } from 'lucide-react';

export function JoinRoomScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await roomService.joinRoom(code, {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Player',
        photoURL: profile?.photoURL ?? user.photoURL ?? null,
        rank: profile?.rankClassic ?? 1200,
      });

      navigate(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface border border-line rounded-xl p-8 w-full max-w-md">
        <button
          onClick={() => navigate('/lobby')}
          className="flex items-center gap-2 text-text-muted hover:text-text mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lobby
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-card-blue" />
          </div>
          <h1 className="text-2xl font-bold">Join Room</h1>
          <p className="text-text-muted mt-2">Enter the 6-character room code</p>
        </div>

        <div className="space-y-4">
          <Input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="XXXXXX"
            maxLength={6}
            className="text-center text-2xl font-mono tracking-widest h-14"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />

          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}

          <Button
            onClick={handleJoin}
            disabled={loading || roomCode.length !== 6}
            className="w-full h-12"
          >
            {loading ? 'Joining...' : 'Join Room'}
          </Button>
        </div>
      </div>
    </div>
  );
}
