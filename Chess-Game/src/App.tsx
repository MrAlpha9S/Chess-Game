import './styles/theme.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { LoginScreen } from './features/auth/LoginScreen';
import { LobbyScreen } from './features/lobby/LobbyScreen';
import { MatchScreen } from './features/match/MatchScreen';
import { ResultScreen } from './features/result/ResultScreen';
import { CreateRoomScreen } from './features/room/CreateRoomScreen';
import { JoinRoomScreen } from './features/room/JoinRoomScreen';
import { WaitingRoomScreen } from './features/room/WaitingRoomScreen';
import { Loader2 } from 'lucide-react';

/** Shown while the auth state is being restored. */
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

/** A route that requires a signed-in player. */
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

/** A route that only makes sense while signed out. */
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

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={<AuthRoute><LoginScreen /></AuthRoute>} />

      {/* Rooms */}
      <Route path="/create-room" element={<ProtectedRoute><CreateRoomScreen /></ProtectedRoute>} />
      <Route path="/join-room" element={<ProtectedRoute><JoinRoomScreen /></ProtectedRoute>} />
      <Route path="/room/:roomId" element={<ProtectedRoute><WaitingRoomScreen /></ProtectedRoute>} />

      {/* Game */}
      <Route path="/match/:roomId" element={<ProtectedRoute><MatchScreen /></ProtectedRoute>} />
      <Route path="/result" element={<ProtectedRoute><ResultScreen /></ProtectedRoute>} />

      {/* Lobby */}
      <Route path="/lobby" element={<ProtectedRoute><LobbyScreen /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/lobby" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/lobby" replace />} />
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
