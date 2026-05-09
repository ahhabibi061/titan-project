import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Listens to Supabase auth state and returns the current session.
 * `loading` is true until the initial session check resolves.
 * Components should gate rendering on `!loading` to avoid flash-of-redirect.
 */
export function useSession() {
  // undefined = not yet resolved; null = no session; object = active session
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    // Hydrate from existing cookie/token on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });

    // Keep in sync with sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    session,
    loading: session === undefined,
    user: session?.user ?? null,
  };
}
