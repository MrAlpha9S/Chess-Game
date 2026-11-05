import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { roomService, type Room } from '../../services/room';
import { Copy, CheckCircle, Users, Clock } from 'lucide-react';

export function WaitingRoomScreen() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Get room code from state (navigate) hoặc URL params (refresh)
  const stateRoomCode = location.state?.roomCode as string | undefined;
  const urlParams = new URLSearchParams(location.search);
  const urlRoomCode = urlParams.get('code') || undefined;
  const roomCode = stateRoomCode || urlRoomCode || '';

  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Determine if current user is host
  useEffect(() => {
    if (room && user) {
      setIsHost(room.hostId === user.uid);
    }
  }, [room, user]);

  // Subscribe to room updates
  useEffect(() => {
    if (!roomCode) {
      navigate('/lobby');
      return;
    }

    console.log('WaitingRoom: Subscribing to room:', roomCode);

    const unsubscribe = roomService.subscribeToRoom(roomCode, (updatedRoom) => {
      if (!updatedRoom) {
        console.log('WaitingRoom: Room deleted');
        alert('Room no longer exists');
        navigate('/lobby');
        return;
      }

      setRoom(updatedRoom);

      // If game started, navigate to match
      if (updatedRoom.status === 'playing') {
        console.log('WaitingRoom: Game started, navigating to room/match');
        navigate('/room/match', { state: { roomCode } });
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribeRef.current?.();
    };
  }, [roomCode, navigate]);

  // Handle copy room code
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomCode]);

  // Handle leave room
  const handleLeave = useCallback(async () => {
    if (user) {
      await roomService.leaveRoom(roomCode, user.uid);
    }
    navigate('/lobby');
  }, [roomCode, user, navigate]);

  // Handle ready
  const handleReady = useCallback(async () => {
    if (!user) return;
    await roomService.setReady(roomCode, user.uid, true);
  }, [roomCode, user]);

  // Get my player info
  const myPlayer = room?.players.find(p => p && p.userId === user?.uid);
  const opponent = room?.players.find(p => p && p.userId !== user?.uid);

  // Get ready status
  const myReady = myPlayer?.ready || false;
  const oppReady = opponent?.ready || false;

  if (!room) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-muted">Loading room...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="bg-surface border border-line rounded-xl p-8 w-full max-w-md">
        {/* Room Code */}
        <div className="text-center mb-8">
          <p className="text-text-muted text-sm mb-2">
            {isHost ? 'Share this code with your friend' : 'Waiting for host to start...'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-mono font-bold tracking-widest">{roomCode}</span>
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
          {/* Host */}
          <div className="text-center flex-1">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${myPlayer?.color === 'white' ? 'bg-white' : 'bg-gray-900'} ${myReady ? 'ring-4 ring-card-green' : ''}`}>
              {room.players[0]?.photoURL ? (
                <img src={room.players[0].photoURL!} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <Users className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <p className="font-medium text-sm">{room.players[0]?.displayName || 'Waiting...'}</p>
            <p className="text-xs text-text-muted">{myPlayer?.color === 'white' ? 'White' : 'Black'}</p>
            {myReady && <p className="text-xs text-card-green mt-1">Ready!</p>}
          </div>

          <div className="text-text-muted text-xl font-bold px-4">VS</div>

          {/* Guest */}
          <div className="text-center flex-1">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${opponent?.color === 'white' ? 'bg-white' : 'bg-gray-900'} ${oppReady ? 'ring-4 ring-card-green' : ''}`}>
              {opponent?.photoURL ? (
                <img src={opponent.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <Users className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <p className="font-medium text-sm">{opponent?.displayName || 'Waiting for player...'}</p>
            <p className="text-xs text-text-muted">{opponent?.color === 'white' ? 'White' : 'Black'}</p>
            {oppReady && <p className="text-xs text-card-green mt-1">Ready!</p>}
          </div>
        </div>

        {/* Time Control */}
        <div className="flex items-center justify-center gap-2 text-text-muted mb-6">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{room.timeControl / 60}+0</span>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!myReady && room.players[1] && (
            <Button onClick={handleReady} className="w-full h-12">
              <CheckCircle className="w-5 h-5 mr-2" />
              Ready
            </Button>
          )}

          {myReady && (
            <div className="text-center text-card-green font-medium">
              Waiting for opponent...
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
