import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProfileStore } from '../store/useProfileStore';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function useWaterTracker(userId) {
  const [logs, setLogs]       = useState([]);
  const [totalMl, setTotalMl] = useState(0);
  const [loading, setLoading] = useState(true);
  const profile       = useProfileStore(s => s.profile);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const targetMl      = profile?.water_target_ml ?? 2500;
  const today         = todayStr();

  const fetchLogs = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('water_logs')
      .select('id, amount_ml, logged_at')
      .eq('user_id', userId)
      .eq('log_date', today)
      .order('logged_at', { ascending: true });
    const entries = data ?? [];
    setLogs(entries);
    setTotalMl(entries.reduce((acc, r) => acc + (r.amount_ml ?? 0), 0));
    setLoading(false);
  }, [userId, today]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const addWater = useCallback(async (amountMl) => {
    if (!userId) return;
    const now = new Date().toISOString();
    const tempId = `opt-${Date.now()}`;
    setLogs(prev => [...prev, { id: tempId, amount_ml: amountMl, logged_at: now }]);
    setTotalMl(prev => prev + amountMl);

    const { data, error } = await supabase
      .from('water_logs')
      .insert({ user_id: userId, amount_ml: amountMl, log_date: today, logged_at: now })
      .select('id, amount_ml, logged_at')
      .single();

    if (error) {
      console.error('[useWaterTracker] addWater error:', error);
      setLogs(prev => prev.filter(l => l.id !== tempId));
      setTotalMl(prev => prev - amountMl);
    } else {
      setLogs(prev => prev.map(l => l.id === tempId ? data : l));
    }
  }, [userId, today]);

  const updateWater = useCallback(async (id, newAmountMl) => {
    if (!userId) return;
    // Optimistic: update in-place, adjust total by delta
    setLogs(prev => {
      const old = prev.find(l => l.id === id);
      if (!old) return prev;
      setTotalMl(t => t - (old.amount_ml ?? 0) + newAmountMl);
      return prev.map(l => l.id === id ? { ...l, amount_ml: newAmountMl } : l);
    });

    const { error } = await supabase
      .from('water_logs')
      .update({ amount_ml: newAmountMl })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[useWaterTracker] updateWater error:', error);
      fetchLogs(); // re-fetch to recover accurate state
    }
  }, [userId, fetchLogs]);

  const deleteWater = useCallback(async (id) => {
    if (!userId) return;
    // Optimistic: remove entry and subtract its amount from total
    setLogs(prev => {
      const old = prev.find(l => l.id === id);
      if (old) setTotalMl(t => t - (old.amount_ml ?? 0));
      return prev.filter(l => l.id !== id);
    });

    const { error } = await supabase
      .from('water_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[useWaterTracker] deleteWater error:', error);
      fetchLogs(); // re-fetch to recover
    }
  }, [userId, fetchLogs]);

  // Replace all of today's entries with a single entry totalling `ml`
  const setTotal = useCallback(async (ml) => {
    if (!userId) return;
    const clamped = Math.max(0, Math.round(ml));
    const now = new Date().toISOString();
    const tempId = `opt-${Date.now()}`;

    setLogs(clamped > 0 ? [{ id: tempId, amount_ml: clamped, logged_at: now }] : []);
    setTotalMl(clamped);

    await supabase.from('water_logs').delete().eq('user_id', userId).eq('log_date', today);

    if (clamped > 0) {
      const { data, error } = await supabase
        .from('water_logs')
        .insert({ user_id: userId, amount_ml: clamped, log_date: today, logged_at: now })
        .select('id, amount_ml, logged_at')
        .single();

      if (error) {
        console.error('[useWaterTracker] setTotal error:', error);
        fetchLogs();
      } else {
        setLogs([data]);
      }
    }
  }, [userId, today, fetchLogs]);

  const setTarget = useCallback(async (ml) => {
    const clamped = Math.max(500, Math.min(10000, Math.round(ml)));
    updateProfile({ water_target_ml: clamped });
    await supabase.from('profiles').update({ water_target_ml: clamped }).eq('id', userId);
  }, [userId, updateProfile]);

  return { logs, totalMl, targetMl, loading, addWater, updateWater, deleteWater, setTotal, setTarget };
}
