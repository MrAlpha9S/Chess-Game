import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Dialog';
import { useAuth } from '../../contexts/AuthContext';
import { useGameStore } from '../../stores/gameStore';
import {
  Crown,
  Sword,
  Trophy,
  Bot,
  Layers,
  Clock,
  LogOut,
  User,
  Plus,
  ArrowRight,
  Users,
} from 'lucide-react';

export function LobbyScreen() {
  const { user, profile, signOutUser } = useAuth();
  const { selectedTimeControl } = useGameStore();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/login');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  // Create room
  const handleCreateRoom = () => {
    if (!user || !profile) {
      navigate('/login');
      return;
    }
    navigate('/create-room');
  };

  // Join room
  const handleJoinRoom = () => {
    navigate('/join-room');
  };

  // Get display name
  const displayName = profile?.displayName || user?.displayName || 'Guest';
  const isGuest = !user;

  // Get rank to display
  const currentRank = profile?.rankCard || profile?.rankClassic || 1200;

  // Get cards count
  const totalCards = 41;
  const ownedCards = profile?.cardsOwned?.length || totalCards;

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-line">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-card-gold" />
            <span className="font-semibold">Welcome, {displayName}</span>
          </div>

          {/* User section */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-raised transition-colors"
            >
              {/* Avatar */}
              {profile?.photoURL || user?.photoURL ? (
                <img
                  src={profile?.photoURL || user?.photoURL || ''}
                  alt={displayName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center">
                  <User className="w-4 h-4 text-text-muted" />
                </div>
              )}

              {/* Name and rank */}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{displayName}</p>
                {!isGuest && (
                  <p className="text-xs text-text-muted">
                    ⭐ {currentRank}
                  </p>
                )}
              </div>
            </button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-line rounded-lg shadow-xl py-2 z-50">
                {isGuest ? (
                  <>
                    <div className="px-4 py-2 border-b border-line">
                      <p className="text-sm text-text-muted">Playing as Guest</p>
                      <p className="text-xs text-text-muted mt-1">Sign in to save progress</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/login');
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-surface-raised flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-4 py-2 border-b border-line">
                      <p className="text-sm font-medium truncate">{profile?.email}</p>
                      <p className="text-xs text-text-muted">⭐ {currentRank} ELO</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleSignOut();
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-surface-raised text-danger flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Quick Play Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sword className="w-5 h-5 text-danger" />
            Play with Friend
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Create Room */}
            <Card
              hoverable
              onClick={handleCreateRoom}
              className="p-6 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-lg bg-card-green/20">
                  <Plus className="w-8 h-8 text-card-green" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Create Room</h3>
                  <p className="text-sm text-text-muted">Create a private room and share the code</p>
                </div>
                <ArrowRight className="w-5 h-5 text-text-muted" />
              </div>
            </Card>

            {/* Join Room */}
            <Card
              hoverable
              onClick={handleJoinRoom}
              className="p-6 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-lg bg-card-blue/20">
                  <Users className="w-8 h-8 text-card-blue" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Join Room</h3>
                  <p className="text-sm text-text-muted">Enter a room code to join</p>
                </div>
                <ArrowRight className="w-5 h-5 text-text-muted" />
              </div>
            </Card>
          </div>
        </section>

        {/* Disabled Game Modes */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sword className="w-5 h-5 text-text-muted" />
            Online Matchmaking
            <Badge variant="default">Coming Soon</Badge>
          </h2>
          <div className="grid gap-4">
            <Card className="p-6 opacity-50">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-surface-raised">
                  <Layers className="w-6 h-6 text-text-muted" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-text">Card Casual</h3>
                    <Badge variant="default">DISABLED</Badge>
                  </div>
                  <p className="text-sm text-text-muted">Play with cards in a relaxed environment. No rating change.</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 opacity-50">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-surface-raised">
                  <Trophy className="w-6 h-6 text-text-muted" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-text">Card Ranked</h3>
                    <Badge variant="default">DISABLED</Badge>
                  </div>
                  <p className="text-sm text-text-muted">Competitive card chess. Your rating is at stake!</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 opacity-50">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-surface-raised">
                  <Bot className="w-6 h-6 text-text-muted" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-text">vs Bot</h3>
                    <Badge variant="default">DISABLED</Badge>
                  </div>
                  <p className="text-sm text-text-muted">Practice against AI.</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Time Controls */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-card-blue" />
            Time Control
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { label: '5+0', value: 300 },
              { label: '10+0', value: 600 },
              { label: '15+10', value: 900 },
              { label: '30+0', value: 1800 },
            ].map((tc) => (
              <button
                key={tc.value}
                className={`
                  px-4 py-2 rounded-lg border transition-all
                  ${selectedTimeControl === tc.value
                    ? 'bg-card-blue/20 border-card-blue text-card-blue'
                    : 'bg-surface border-line text-text hover:bg-surface-raised'
                  }
                `}
              >
                <span className="font-mono">{tc.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* User Stats Card */}
        {!isGuest && profile && (
          <section className="mb-8">
            <div className="bg-surface border border-line rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Your Stats</h2>
                <Badge variant="blue">{ownedCards}/{totalCards} Cards</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-surface-raised rounded-lg">
                  <p className="text-2xl font-bold text-card-gold">⭐ {profile.rankClassic}</p>
                  <p className="text-xs text-text-muted">Classic ELO</p>
                </div>
                <div className="text-center p-3 bg-surface-raised rounded-lg">
                  <p className="text-2xl font-bold text-card-purple">⭐ {profile.rankCard}</p>
                  <p className="text-xs text-text-muted">Card ELO</p>
                </div>
                <div className="text-center p-3 bg-surface-raised rounded-lg">
                  <p className="text-2xl font-bold">{profile.decks?.length || 0}</p>
                  <p className="text-xs text-text-muted">Saved Decks</p>
                </div>
                <div className="text-center p-3 bg-surface-raised rounded-lg">
                  <p className="text-2xl font-bold text-card-green">{ownedCards}</p>
                  <p className="text-xs text-text-muted">Cards Owned</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
