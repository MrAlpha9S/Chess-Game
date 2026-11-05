import './styles/theme.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useGameStore } from './stores/gameStore';
import { LoginScreen } from './features/auth/LoginScreen';
import { LobbyScreen } from './features/lobby/LobbyScreen';
import { CardCollectionScreen } from './features/cards/CardCollectionScreen';
import { MatchmakingScreen } from './features/matchmaking/MatchmakingScreen';
import { PreparationScreen } from './features/preparation/PreparationScreen';
import { MatchScreen } from './features/match/MatchScreen';
import { ResultScreenWrapper } from './features/result/ResultScreen';
import { CreateRoomScreen } from './features/room/CreateRoomScreen';
import { JoinRoomScreen } from './features/room/JoinRoomScreen';
import { WaitingRoomScreen } from './features/room/WaitingRoomScreen';
import { RoomMatchScreen } from './features/room/RoomMatchScreen';
import { Loader2 } from 'lucide-react';

// Loading screen component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-card-gold animate-spin mx-auto mb-4" />
        <p className="text-text-muted">Loading...</p>
      </div>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Auth route - redirect to lobby if already logged in
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/lobby" replace />;
  }

  return <>{children}</>;
}

// Screen router using URL params
function ScreenRouter() {
  const { currentScreen } = useGameStore();

  // Sync URL with game state for backward compatibility
  const getPath = () => {
    switch (currentScreen) {
      case 'lobby': return '/lobby';
      case 'card-collection': return '/cards';
      case 'matchmaking': return '/matchmaking';
      case 'preparation': return '/preparation';
      case 'match': return '/match';
      case 'result': return '/result';
      default: return '/login';
    }
  };

  return (
    <Navigate to={getPath()} replace />
  );
}

// Main routes component
function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<AuthRoute><LoginScreen /></AuthRoute>} />
      <Route path="/" element={<ScreenRouter />} />

      {/* Protected routes */}
      <Route path="/lobby" element={<ProtectedRoute><LobbyScreen /></ProtectedRoute>} />
      <Route path="/cards" element={<ProtectedRoute><CardCollectionScreen /></ProtectedRoute>} />
      <Route path="/matchmaking" element={<ProtectedRoute><MatchmakingScreen /></ProtectedRoute>} />
      <Route path="/preparation" element={<ProtectedRoute><PreparationScreen /></ProtectedRoute>} />
      <Route path="/match" element={<ProtectedRoute><MatchScreen /></ProtectedRoute>} />
      <Route path="/result" element={<ProtectedRoute><ResultScreenWrapper /></ProtectedRoute>} />

      {/* Room routes */}
      <Route path="/create-room" element={<ProtectedRoute><CreateRoomScreen /></ProtectedRoute>} />
      <Route path="/join-room" element={<ProtectedRoute><JoinRoomScreen /></ProtectedRoute>} />
      <Route path="/room" element={<ProtectedRoute><WaitingRoomScreen /></ProtectedRoute>} />
      <Route path="/room/match" element={<ProtectedRoute><RoomMatchScreen /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
