import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// mode: 'signin' | 'signup' | 'forgot'
export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Check if the user has completed onboarding
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', data.user.id)
      .single();

    if (profile?.onboarding_complete) {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/onboarding', { replace: true });
    }
  };

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.session) {
      // Email confirmation disabled — session is live immediately
      navigate('/onboarding', { replace: true });
    } else {
      // Email confirmation required — tell the user to check their inbox
      setSuccessMsg('Account created! Check your email to confirm, then sign in.');
      setMode('signin');
    }
  };

  const handleForgotPassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) throw error;
    setSuccessMsg('Password reset email sent. Check your inbox.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'signin') await handleSignIn();
      else if (mode === 'signup') await handleSignUp();
      else if (mode === 'forgot') await handleForgotPassword();
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div
      style={{ fontFamily: 'Manrope, sans-serif', background: '#0a0908', minHeight: '100vh' }}
      className="flex items-center justify-center p-4"
    >
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(237,122,42,0.07) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1
            style={{ fontFamily: 'Anton, sans-serif', fontSize: 40, letterSpacing: 4, color: '#ed7a2a' }}
          >
            IRONLAB
          </h1>
          <p style={{ color: '#78716c', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2 }}>
            TRAIN. TRACK. TRANSFORM.
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-8 border"
          style={{ background: 'rgba(12,11,10,0.6)', borderColor: 'rgba(68,64,60,0.6)', backdropFilter: 'blur(12px)' }}
        >
          {/* Tab toggle — only shown for signin / signup */}
          {mode !== 'forgot' && (
            <div className="flex mb-6 rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(68,64,60,0.6)' }}>
              {['signin', 'signup'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className="flex-1 py-2.5 uppercase tracking-wider transition-colors"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    background: mode === m ? '#ed7a2a' : 'transparent',
                    color: mode === m ? '#0a0908' : '#78716c',
                  }}
                >
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {mode === 'forgot' && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="flex items-center gap-1.5 text-xs uppercase tracking-wider"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: '#78716c' }}
              >
                ← Back to Sign In
              </button>
              <p className="mt-3 text-sm" style={{ color: '#a8a29e' }}>
                Enter your email and we'll send a password reset link.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block mb-1.5" style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#78716c', letterSpacing: 1.5 }}>
                EMAIL
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{
                  background: 'rgba(28,25,23,0.8)',
                  border: '1px solid rgba(68,64,60,0.6)',
                  color: '#e7e5e4',
                  fontFamily: 'Manrope, sans-serif',
                }}
              />
            </div>

            {/* Password — hidden in forgot mode */}
            {mode !== 'forgot' && (
              <div>
                <label className="block mb-1.5" style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#78716c', letterSpacing: 1.5 }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                  style={{
                    background: 'rgba(28,25,23,0.8)',
                    border: '1px solid rgba(68,64,60,0.6)',
                    color: '#e7e5e4',
                    fontFamily: 'Manrope, sans-serif',
                  }}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}

            {/* Success */}
            {successMsg && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#86efac', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                {successMsg}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg uppercase tracking-wider transition-opacity disabled:opacity-50"
              style={{
                fontFamily: 'Anton, sans-serif',
                fontSize: 15,
                letterSpacing: 2,
                background: 'linear-gradient(135deg, #ed7a2a, #ff5a2a)',
                color: '#0a0908',
              }}
            >
              {loading
                ? '...'
                : mode === 'signin'
                ? 'SIGN IN'
                : mode === 'signup'
                ? 'CREATE ACCOUNT'
                : 'SEND RESET LINK'}
            </button>
          </form>

          {/* Forgot password link — only in signin mode */}
          {mode === 'signin' && !successMsg && (
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="mt-4 w-full text-center text-xs"
              style={{ color: '#57534e', fontFamily: 'Manrope, sans-serif' }}
            >
              Forgot password?
            </button>
          )}

          {mode === 'signup' && (
            <p className="mt-4 text-center" style={{ fontSize: 12, color: '#57534e' }}>
              14-day Pro trial included. No card required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
