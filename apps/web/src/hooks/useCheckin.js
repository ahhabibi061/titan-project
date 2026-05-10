import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProfileStore } from '../store/useProfileStore';

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useCheckin(userId) {
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const updateProfile = useProfileStore(s => s.updateProfile);

  const todayStr = localDateStr(new Date());

  const fetchCheckins = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('checkins')
      .select('id, checked_in_at, mood, energy, sleep_quality, notes')
      .eq('user_id', userId)
      .order('checked_in_at', { ascending: false })
      .limit(8);
    if (error) { console.error('[useCheckin] fetch error:', error); setLoading(false); return; }
    setCheckins(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchCheckins(); }, [fetchCheckins]);

  const todayCheckin = checkins.find(c => c.checked_in_at === todayStr) ?? null;

  const submitCheckin = useCallback(async ({ mood, energy, sleep_quality, notes }) => {
    if (!userId) return { error: 'Not authenticated' };
    setSaving(true);
    const { error } = await supabase
      .from('checkins')
      .upsert(
        { user_id: userId, checked_in_at: todayStr, mood, energy, sleep_quality, notes: notes || null },
        { onConflict: 'user_id,checked_in_at' }
      );
    if (error) { setSaving(false); return { error: error.message }; }

    // Update streak after check-in
    await supabase.rpc('update_streak', { p_user_id: userId });
    const { data: prof } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak, last_logged_date')
      .eq('id', userId)
      .single();
    if (prof) updateProfile(prof);

    // TODO: pass mood/energy/sleep to Oracle rule gate
    // Low energy (avg < 3) + fast weight drop = deload signal

    setSaving(false);
    await fetchCheckins();
    return { success: true };
  }, [userId, todayStr, fetchCheckins, updateProfile]);

  return { checkins, loading, saving, todayCheckin, submitCheckin, refetch: fetchCheckins };
}
