import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Dialog';
import { useAuth } from '../../contexts/AuthContext';
import { useGameStore } from '../../stores/gameStore';
import { matchmakingService, type MatchEntry, type MatchPlayerInfo } from '../../services/matchmaking';
import { X, Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface MatchInfo {
  matchId: string;
  opponent: MatchPlayerInfo;
  myPlayer: MatchPlayerInfo;
}

export function MatchmakingScreen() {
  const { user, profile } = useAuth();
  const { selectedMode, selectedTimeControl } = useGameStore();
  const navigate = useNavigate();

  const [searchProgress, setSearchProgress] = useState(0);
  const [searchWaitingTime, setSearchWaitingTime] = useState(0);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [match, setMatch] = useState<MatchEntry | null>(null);

  const unsubscribeQueueRef = useRef<(() => void) | null>(null);
  const unsubscribeMatchesRef = useRef<(() => void) | null>(null);
  const unsubscribeMatchRef = useRef<(() => void) | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const findIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedMatchmaking = useRef(false);
  const isActiveRef = useRef(true);
  const timeoutCheckedRef = useRef<Set<string>>(new Set());

  // Timer effect - runs during search
  useEffect(() => {
    if (matchInfo) return;

    timerIntervalRef.current = setInterval(() => {
      setSearchWaitingTime(prev => prev + 1);
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [matchInfo]);

  // Progress animation effect
  useEffect(() => {
    if (matchInfo) return;

    progressIntervalRef.current = setInterval(() => {
      setSearchProgress(prev => {
        const increment = prev > 80 ? 0.5 : 1;
        return Math.min(prev + increment, 99);
      });
    }, 100);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [matchInfo]);

  // Handle browser/tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (matchInfo?.matchId) return;
      e.preventDefault();
      e.returnValue = 'You are searching for a match. Are you sure you want to leave?';
      matchmakingService.leaveQueue();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [matchInfo?.matchId]);

  // Handle match found
  const handleMatchFound = useCallback((matchId: string, opponent: MatchPlayerInfo, myPlayer: MatchPlayerInfo) => {
    console.log('MatchmakingScreen: Match found!', matchId);

    // Clear all intervals and listeners
    if (findIntervalRef.current) {
      clearInterval(findIntervalRef.current);
      findIntervalRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (unsubscribeQueueRef.current) {
      unsubscribeQueueRef.current();
      unsubscribeQueueRef.current = null;
    }
    if (unsubscribeMatchesRef.current) {
      unsubscribeMatchesRef.current();
      unsubscribeMatchesRef.current = null;
    }

    setSearchProgress(100);

    setMatchInfo({
      matchId,
      opponent,
      myPlayer,
    });

    // Subscribe to this specific match
    unsubscribeMatchRef.current = matchmakingService.onMatchUpdate(matchId, (updatedMatch) => {
      if (!isActiveRef.current) return;
      setMatch(updatedMatch);

      if (updatedMatch?.status === 'playing') {
        console.log('MatchmakingScreen: Both ready! Starting game...');
        navigate('/match', { state: { matchId } });
      } else if (updatedMatch?.status === 'cancelled') {
        console.log('MatchmakingScreen: Match cancelled');
        alert('Match cancelled');
        navigate('/lobby');
      }
    });
  }, [navigate]);

  // Start matchmaking on mount
  useEffect(() => {
    if (!user || !profile) {
      console.log('MatchmakingScreen: No user or profile');
      return;
    }

    const startMatchmaking = async () => {
      if (hasStartedMatchmaking.current || !isActiveRef.current) {
        console.log('MatchmakingScreen: Already started or inactive, skipping');
        return;
      }

      try {
        console.log('MatchmakingScreen: Starting matchmaking...');

        await matchmakingService.joinQueue(
          user,
          profile.displayName,
          profile.photoURL,
          profile.rankCard,
          selectedMode,
          selectedTimeControl
        );

        hasStartedMatchmaking.current = true;

        if (!isActiveRef.current) {
          console.log('MatchmakingScreen: EXIT - isActive is false after join');
          return;
        }

        // Check immediately
        console.log('MatchmakingScreen: Calling findOpponent...');
        const result = await matchmakingService.findOpponent(user.uid, selectedMode, selectedTimeControl);
        console.log('MatchmakingScreen: findOpponent result:', result);

        if (result && isActiveRef.current) {
          const matchData = await matchmakingService.getMatch(result.matchId);
          if (matchData) {
            const myPlayer = matchData.players.find(p => p.userId === user.uid)!;
            const opponent = matchData.players.find(p => p.userId !== user.uid)!;
            handleMatchFound(result.matchId, opponent, myPlayer);
          }
          return;
        }

        // Listen to ALL matches for detection
        console.log('MatchmakingScreen: Setting up matches listener');

        unsubscribeMatchesRef.current = matchmakingService.onMatchesUpdate((matches) => {
          if (!isActiveRef.current || !matches) return;

          for (const [matchId, m] of Object.entries(matches) as [string, MatchEntry][]) {
            if (m.status !== 'waiting') continue;

            const myPlayer = m.players.find(p => p.userId === user.uid);
            if (myPlayer) {
              const opponent = m.players.find(p => p.userId !== user.uid)!;
              console.log('MatchmakingScreen: Found myself in match via listener!', matchId);
              handleMatchFound(matchId, opponent, myPlayer);
              return;
            }
          }
        });

        // Also check periodically
        findIntervalRef.current = setInterval(async () => {
          if (!isActiveRef.current) return;

          const result = await matchmakingService.findOpponent(user.uid, selectedMode, selectedTimeControl);
          if (result && isActiveRef.current) {
            const matchData = await matchmakingService.getMatch(result.matchId);
            if (matchData) {
              const myPlayer = matchData.players.find(p => p.userId === user.uid)!;
              const opponent = matchData.players.find(p => p.userId !== user.uid)!;
              handleMatchFound(result.matchId, opponent, myPlayer);
            }
          }
        }, 500);
      } catch (err: any) {
        console.error('Matchmaking error:', err);
      }
    };

    startMatchmaking();

    return () => {
      console.log('MatchmakingScreen: Cleanup');
      isActiveRef.current = false;
      unsubscribeQueueRef.current?.();
      unsubscribeMatchesRef.current?.();
      unsubscribeMatchRef.current?.();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (findIntervalRef.current) clearInterval(findIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [user, profile, selectedMode, selectedTimeControl, handleMatchFound]);

  // Handle Ready button
  const handleReady = useCallback(async () => {
    if (!matchInfo?.matchId || !user) return;
    try {
      await matchmakingService.setReady(matchInfo.matchId, user.uid);
      setMatchInfo(prev => prev ? { ...prev, myPlayer: { ...prev.myPlayer, ready: true } } : null);
    } catch (err) {
      console.error('Ready error:', err);
    }
  }, [matchInfo, user]);

  // Handle Cancel button
  const handleCancel = useCallback(async () => {
    console.log('MatchmakingScreen: handleCancel called');

    // Clear all intervals
    if (findIntervalRef.current) {
      clearInterval(findIntervalRef.current);
      findIntervalRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      // Cancel match if exists, leave queue if not
      if (matchInfo?.matchId) {
        console.log('MatchmakingScreen: Cancelling match:', matchInfo.matchId);
        await matchmakingService.cancelMatch(matchInfo.matchId);
      }

      await matchmakingService.leaveQueue();
    } catch (err) {
      console.error('Cancel error:', err);
    }

    navigate('/lobby');
  }, [matchInfo, navigate]);

  // Calculate time left
  const getTimeLeft = () => {
    if (!match) return 10;
    const elapsed = Math.floor((Date.now() - match.readyStartedAt) / 1000);
    return Math.max(0, match.readyDuration - elapsed);
  };

  // Auto-timeout effect
  useEffect(() => {
    if (!match || match.status !== 'waiting' || !user) return;

    const interval = setInterval(() => {
      const timeLeft = getTimeLeft();

      if (timeLeft <= 0) {
        console.log('MatchmakingScreen: Time is up, checking timeout...');

        for (const player of match.players) {
          if (!player.timeout && !player.ready && !timeoutCheckedRef.current.has(player.userId)) {
            timeoutCheckedRef.current.add(player.userId);

            if (player.userId !== user.uid) {
              console.log('MatchmakingScreen: Marking opponent as timeout');
              matchmakingService.setTimeout(match.id, player.userId);
            } else {
              console.log('MatchmakingScreen: Marking myself as timeout');
              matchmakingService.setTimeout(match.id, user.uid);
            }
          }
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [match, user]);

  // ========== RENDER ==========

  // Get ready status
  const isMyReady = match?.players.find(p => p.userId === user?.uid)?.ready || matchInfo?.myPlayer.ready || false;

  const getOpponentReady = () => {
    if (!match || !user) return false;
    return match.players.find(p => p.userId !== user.uid)?.ready || false;
  };

  // Show Ready Screen when match is found
  if (matchInfo && match) {
    const timeLeft = getTimeLeft();
    const oppReady = getOpponentReady();
    const isReadyPhase = match.status === 'waiting';

    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
        <div className="bg-surface border border-line rounded-xl p-8 w-full max-w-md mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Match Found!</h2>
            <p className="text-text-muted">Get ready to play</p>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="text-center flex-1">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${isMyReady ? 'bg-card-green/20' : 'bg-surface-raised'}`}>
                {isMyReady ? <CheckCircle className="w-8 h-8 text-card-green" /> : <Users className="w-8 h-8 text-text-muted" />}
              </div>
              <p className="font-medium">You</p>
              <p className="text-xs text-text-muted">{isMyReady ? 'Ready!' : 'Waiting...'}</p>
            </div>

            <div className="text-text-muted text-2xl font-bold px-4">VS</div>

            <div className="text-center flex-1">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 overflow-hidden ${oppReady ? 'bg-card-green/20' : 'bg-surface-raised'}`}>
                {matchInfo.opponent.photoURL ? (
                  <img src={matchInfo.opponent.photoURL} alt={matchInfo.opponent.displayName} className="w-full h-full object-cover" />
                ) : (
                  oppReady ? <CheckCircle className="w-8 h-8 text-card-green" /> : <Users className="w-8 h-8 text-text-muted" />
                )}
              </div>
              <p className="font-medium">{matchInfo.opponent.displayName}</p>
              <p className="text-xs text-text-muted">{oppReady ? 'Ready!' : 'Waiting...'}</p>
            </div>
          </div>

          {isReadyPhase && (
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className={`w-6 h-6 ${timeLeft <= 5 ? 'text-danger animate-pulse' : 'text-text-muted'}`} />
                <span className={`text-5xl font-mono font-bold ${timeLeft <= 5 ? 'text-danger animate-pulse' : 'text-text'}`}>{timeLeft}</span>
              </div>
              <Progress value={(timeLeft / match.readyDuration) * 100} className={`h-3 ${timeLeft <= 3 ? '[&>div]:bg-danger' : ''}`} />
              <p className="text-sm text-text-muted mt-2">seconds remaining</p>
            </div>
          )}

          <div className="space-y-3">
            <Button onClick={handleReady} disabled={isMyReady} className={`w-full h-14 text-lg ${isMyReady ? 'bg-card-green hover:bg-card-green' : ''}`}>
              {isMyReady ? <><CheckCircle className="w-5 h-5 mr-2" />Ready!</> : 'Ready'}
            </Button>
            <Button variant="secondary" onClick={handleCancel} className="w-full">
              <X className="w-4 h-4 mr-2" />Cancel
            </Button>
          </div>
        </div>

        {isReadyPhase && (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Not ready = Match cancelled</span>
          </div>
        )}
      </div>
    );
  }

  // ========== SEARCHING UI ==========

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90">
            <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-raised" />
            <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={351.86} strokeDashoffset={351.86 * (1 - searchProgress / 100)} strokeLinecap="round" className="text-card-gold transition-all duration-100" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="w-12 h-12 text-card-gold" />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">Finding Opponent</h2>
        <p className="text-text-muted mb-4">
          {selectedMode === 'card-casual' ? 'Card Casual' : 'Classic'} • {selectedTimeControl / 60}+{selectedTimeControl % 60 !== 0 ? `.${(selectedTimeControl % 60) / 60}` : ''} min
        </p>
        <p className="text-sm text-text-muted">
          Waiting time: {Math.floor(searchWaitingTime / 60)}:{(searchWaitingTime % 60).toString().padStart(2, '0')}
        </p>
      </div>

      <Button variant="secondary" onClick={handleCancel}>
        <X className="w-4 h-4 mr-2" />Cancel
      </Button>
    </div>
  );
}
