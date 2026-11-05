import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// This screen is deprecated - ready phase is now handled in MatchmakingScreen
// Redirect to lobby
export function PreparationScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to lobby immediately
    navigate('/lobby', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-text-muted">Redirecting...</p>
    </div>
  );
}
