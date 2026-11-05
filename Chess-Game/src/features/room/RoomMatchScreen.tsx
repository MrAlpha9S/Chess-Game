import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { roomService, type Room } from '../../services/room';
import { BoardGrid } from '../board/components/BoardGrid';
import { Flag, Users } from 'lucide-react';

export function RoomMatchScreen() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const roomCode = location.state?.roomCode as string;
  const [room, setRoom] = useState<Room | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Redirect if no roomCode
  useEffect(() => {
    if (!roomCode || !user) {
      console.log('RoomMatchScreen: Missing room info, redirecting to lobby');
      navigate('/lobby');
    }
  }, [roomCode, user, navigate]);

  // Subscribe to room updates
  useEffect(() => {
    if (!roomCode) return;

    console.log('RoomMatchScreen: Subscribing to room:', roomCode);

    const unsubscribe = roomService.subscribeToRoom(roomCode, (updatedRoom) => {
      if (!updatedRoom) {
        console.log('RoomMatchScreen: Room deleted');
        navigate('/lobby');
        return;
      }

      setRoom(updatedRoom);

      // If game cancelled, go back to lobby
      if (updatedRoom.status === 'cancelled') {
        alert('Game cancelled');
        navigate('/lobby');
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribeRef.current?.();
    };
  }, [roomCode, navigate]);

  // Get my color
  const getMyColor = useCallback((): 'white' | 'black' | null => {
    if (!room || !user) return null;
    const myPlayer = room.players.find(p => p && p.userId === user.uid);
    return myPlayer?.color || null;
  }, [room, user]);

  const myColor = getMyColor();
  const myPlayer = room?.players.find(p => p && p.userId === user?.uid);
  const oppPlayer = room?.players.find(p => p && p.userId !== user?.uid);
  const isMyTurn = room?.currentTurn === myColor;
  const board = room?.board || [];

  const handleCellClick = (row: number, col: number) => {
    console.log('Cell clicked:', row, col);
    // TODO: implement move logic
  };

  const handleResign = async () => {
    if (!user || !roomCode) return;

    if (confirm('Are you sure you want to resign?')) {
      await roomService.leaveRoom(roomCode, user.uid);
      navigate('/lobby');
    }
  };

  if (!room || room.status !== 'playing') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-muted">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-surface border-b border-line p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded ${myColor === 'white' ? 'bg-white text-black' : 'bg-gray-900 text-white'}`}>
              <span className="font-semibold">
                {myPlayer?.displayName || 'You'}
              </span>
            </div>
            <span className="text-text-muted">vs</span>
            <div className={`px-3 py-1 rounded ${oppPlayer?.color === 'white' ? 'bg-white text-black' : 'bg-gray-900 text-white'}`}>
              <span className="font-semibold">
                {oppPlayer?.displayName || 'Opponent'}
              </span>
            </div>
          </div>
          <div className="text-card-gold font-mono">
            {room.timeControl / 60}:00
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 flex flex-col p-4">
        <div className="flex-1 min-h-0 max-w-4xl w-full mx-auto flex flex-col">
          {/* Turn indicator */}
          <div className={`shrink-0 text-center mb-3 p-2 rounded-lg ${isMyTurn ? 'bg-card-green/20 text-card-green' : 'bg-surface text-text-muted'}`}>
            {isMyTurn ? 'Your turn!' : "Opponent's turn"}
          </div>

          {/* Board - sized to the space left between header and bottom bar */}
          <div className="flex-1 min-h-0">
            <BoardGrid
              board={board}
              onCellClick={handleCellClick}
              selectedCell={null}
              validMoves={[]}
            />
          </div>
        </div>
      </main>

      {/* Bottom bar */}
      <div className="shrink-0 bg-surface border-t border-line p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="danger" onClick={handleResign}>
            <Flag className="w-4 h-4 mr-2" />
            Resign
          </Button>

          <Button variant="ghost" disabled>
            <Users className="w-4 h-4 mr-2" />
            Draw
          </Button>
        </div>
      </div>
    </div>
  );
}
