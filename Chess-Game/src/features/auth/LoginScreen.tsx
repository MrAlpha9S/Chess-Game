import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { Crown, AlertCircle, Loader2 } from 'lucide-react';

export function LoginScreen() {
  const { signInWithGoogle, signInWithFacebook, loading, error, user } = useAuth();
  const navigate = useNavigate();
  const [isSigningIn, setIsSigningIn] = useState<'google' | 'facebook' | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/lobby', { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn('google');
      await signInWithGoogle();
      navigate('/lobby');
    } catch (err) {
      console.error('Sign in failed:', err);
    } finally {
      setIsSigningIn(null);
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      setIsSigningIn('facebook');
      await signInWithFacebook();
      navigate('/lobby');
    } catch (err) {
      console.error('Sign in failed:', err);
    } finally {
      setIsSigningIn(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      {/* Logo and Title */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Crown className="w-12 h-12 text-card-gold" strokeWidth={1.5} />
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-card-gold">CHESS</span>
            <span className="text-text"> CARD</span>
          </h1>
        </div>
        <p className="text-text-muted text-sm">Strategic Chess with Card Abilities</p>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md p-8">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-2 text-danger text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Google Sign In */}
          <Button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn !== null || loading}
            className="w-full h-12 text-lg"
          >
            {isSigningIn === 'google' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          {/* Facebook Sign In */}
          <Button
            onClick={handleFacebookSignIn}
            disabled={isSigningIn !== null || loading}
            className="w-full h-12 text-lg bg-[#1877F2] hover:bg-[#166FE5] border-none"
          >
            {isSigningIn === 'facebook' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                  />
                </svg>
                Continue with Facebook
              </>
            )}
          </Button>
        </div>

        {/* Terms */}
        <p className="mt-6 text-center text-xs text-text-muted">
          By continuing, you agree to our{' '}
          <a href="#" className="text-text hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-text hover:underline">Privacy Policy</a>
        </p>
      </Card>

      {/* Version info */}
      <p className="mt-8 text-xs text-text-muted">
        Version 0.1.0 Alpha
      </p>
    </div>
  );
}
