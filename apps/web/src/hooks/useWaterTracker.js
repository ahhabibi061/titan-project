import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProfileStore } from '../store/useProfileStore';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function useWaterTracker(userId) {
  const [totalMl, setTotalMl] = useState(0);
  const [loading, setLoading] = useState(true);
  const profile       = useProfileStore(s => s.profile);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const targetMl      = profile?.water_target_ml ?? 2500;
  const today         = todayStr();

  const fetchTotal = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('water_logs')
      .select('amount_ml')
      .eq('user_id', userId)
      .eq('log_date', today);
    setTotalMl((data ?? []).reduce((acc, r) => acc + (r.amount_ml ?? 0), 0));
    setLoading(false);
  }, [userId, today]);

  useEffect(() => { fetchTotal(); }, [fetchTotal]);

  const addWater = useCallback(async (amountMl) => {
    if (!userId) return;
    setTotalMl(prev => prev + amountMl);
    const { error } = await supabase
      .from('water_logs')
      .insert({ user_id: userId, amount_ml: amountMl, log_date: today });
    if (error) setTotalMl(prev => prev - amountMl);
  }, [userId, today]);

  const setTarget = useCallback(async (ml) => {
    const clamped = Math.max(500, Math.min(10000, Math.round(ml)));
    updateProfile({ water_target_ml: clamped });
    await supabase.from('profiles').update({ water_target_ml: clamped }).eq('id', userId);
  }, [userId, updateProfile]);

  return { totalMl, targetMl, loading, addWater, setTarget };
}
