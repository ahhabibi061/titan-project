import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from './useSession';
import { useProfileStore } from '../store/useProfileStore';

// Fetches the full profile ONCE when the session is known and writes it to
// the global Zustand store. Call this from a single place at app boot — all
// other components read from the store, no redundant Supabase queries.
export function useProfile() {
  const { session, loading } = useSession();
  const setProfile = useProfileStore((s) => s.setProfile);
  const userId = loading ? undefined : (session?.user?.id ?? null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('display_name, subscription_tier, current_macros, goal, goal_weight_kg, weight_kg, height_cm, age, sex, activity_level, created_at, onboarding_complete')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) { console.error('[useProfile] fetch error:', error); return; }
        if (data)  { console.log('[useProfile] profile loaded for', userId); setProfile(data); }
      });
  }, [userId, setProfile]);
}
