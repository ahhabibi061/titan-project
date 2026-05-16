import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from './useSession';
import { useProfileStore } from '../store/useProfileStore';

// Key stored in localStorage before a Stripe redirect so the app knows
// which tier to wait for after the user returns from checkout.
export const PENDING_TIER_KEY = 'ironlab_pending_tier';

const PROFILE_COLS = 'display_name, subscription_tier, current_macros, goal, goal_weight_kg, weight_kg, height_cm, age, sex, activity_level, created_at, onboarding_complete';

// Polls Supabase every 3 s until subscription_tier matches pendingTier
// (i.e. the Stripe webhook has landed), then updates the store and clears localStorage.
// Runs as a plain async loop — not tied to any component lifecycle.
function watchPendingUpgrade(userId, currentTier, setProfile, attempt = 0) {
  const pendingTier = localStorage.getItem(PENDING_TIER_KEY);
  if (!pendingTier) return;

  // Already at the target tier (or giving up after 20 attempts ≈ 60 s)
  if (currentTier === pendingTier || attempt >= 20) {
    localStorage.removeItem(PENDING_TIER_KEY);
    return;
  }

  setTimeout(async () => {
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', userId)
      .single();

    if (data?.subscription_tier === pendingTier) {
      setProfile(data);                          // full store refresh
      localStorage.removeItem(PENDING_TIER_KEY);
    } else {
      watchPendingUpgrade(userId, data?.subscription_tier ?? currentTier, setProfile, attempt + 1);
    }
  }, 3000);
}

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
      .select(PROFILE_COLS)
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) { console.error('[useProfile] fetch error:', error); return; }
        if (data) {
          console.log('[useProfile] profile loaded for', userId);
          setProfile(data);
          // If there's a pending tier upgrade (set before Stripe redirect),
          // poll until the webhook has updated the DB, then sync the store.
          watchPendingUpgrade(userId, data.subscription_tier, setProfile);
        }
      });
  }, [userId, setProfile]);
}
