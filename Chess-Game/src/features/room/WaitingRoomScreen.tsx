import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { LoadingAnimation } from '../../components/common/LoadingAnimation';
import { useAuth } from '../../contexts/useAuth';
import { roomService } from '../../services/roomService';
import type { Room } from '../../types/room';
import { CheckCircle, Copy, Users, Clock, Play } from 'lucide-react';

/**
 * The waiting room.
 *
 * The host shares a code, the second player joins with it, and the host
 * starts the game once both are seated.
 */
export function WaitingRoomScreen() {
  const { roomId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Subscribe to the room.
  useEffect(() => {
    if (!roomId) {
      navigate('/lobby');
      return;
    }

    const unsubscribe = roomService.subscribeToRoom(roomId, (updated) => {
      if (!updated) {
        navigate('/lobby');
        return;
      }
      setRoom(updated);

      // The game has started: move on to the board.
      if (updated.metadata.status === 'in_progress') {
        navigate(`/match/${roomId}`);
      }
    });

    return () => unsubscribe();
  }, [roomId, navigate]);

  const myColor = useMemo(() => {
    if (!room || !user) return null;
    return roomService.getPlayerColor(room, user.uid);
  }, [room, user]);

  const isHost = myColor === 'white';

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  const handleStart = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      await roomService.startGame(roomId, user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the game.');
    }
  }, [roomId, user]);

  const handleLeave = useCallback(() => {
    navigate('/lobby');
  }, [navigate]);

  if (!room) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingAnimation variant="matchmaking" label="Waiting for the room..." />
      </div>
    );
  }

  const white = room.players.white;
  const black = room.players.black;
  const timeControl = room.metadata.timeControl;
  const minutes = Math.round(timeControl.initialMs / 60000);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="bg-surface border border-line rounded-xl p-8 w-full max-w-md">
        {/* Room Code */}
        <div className="text-center mb-8">
          <p className="text-text-muted text-sm mb-2">
            {isHost ? 'Share this code with your friend' : 'Waiting for the host to start...'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-mono font-bold tracking-widest">{roomId}</span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-surface-raised transition-colors"
              title="Copy code"
            >
              {copied ? (
                <CheckCircle className="w-5 h-5 text-card-green" />
              ) : (
                <Copy className="w-5 h-5 text-text-muted" />
              )}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-2 overflow-hidden">
              {white?.photoURL ? (
                <img src={white.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-8 h-8 text-gray-500" />
              )}
            </div>
            <p className="font-medium text-sm truncate">
              {white?.displayName ?? 'Waiting...'}
            </p>
            <p className="text-xs text-text-muted">White</p>
          </div>

          <div className="text-text-muted text-xl font-bold px-4">VS</div>

          <div className="text-center flex-1">
            <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-2 overflow-hidden">
              {black?.photoURL ? (
                <img src={black.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-8 h-8 text-gray-500" />
              )}
            </div>
            <p className="font-medium text-sm truncate">
              {black?.displayName ?? 'Waiting for player...'}
            </p>
            <p className="text-xs text-text-muted">Black</p>
          </div>
        </div>

        {/* Time Control */}
        <div className="flex items-center justify-center gap-2 text-text-muted mb-6">
          <Clock className="w-4 h-4" />
          <span className="text-sm">
            {minutes}+{Math.round(timeControl.incrementMs / 1000)}
          </span>
        </div>

        {error && <p className="text-danger text-sm text-center mb-4">{error}</p>}

        {/* Actions */}
        <div className="space-y-3">
          {isHost ? (
            <Button
              onClick={handleStart}
              disabled={!black}
              className="w-full h-12"
            >
              <Play className="w-5 h-5 mr-2" />
              {black ? 'Start Game' : 'Waiting for a second player...'}
            </Button>
          ) : (
            <div className="text-center text-card-green font-medium py-3">
              {black ? 'Ready — waiting for the host to start' : 'Waiting for the host...'}
            </div>
          )}

          <Button variant="secondary" onClick={handleLeave} className="w-full">
            Leave Room
          </Button>
        </div>
      </div>
    </div>
  );
}
