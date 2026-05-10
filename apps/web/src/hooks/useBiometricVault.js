import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProfileStore } from '../store/useProfileStore';

function linearRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

function computeMA(values, window = 7) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

export function useBiometricVault(userId, goalWeightKg) {
  const [rawEntries, setRawEntries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [saving, setSaving]         = useState(false);
  const updateProfile = useProfileStore(s => s.updateProfile);

  const todayStr = toDateStr(new Date());

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 89);
    const { data, error } = await supabase
      .from('biometric_entries')
      .select('id, logged_at, weight_kg, body_fat_pct, notes')
      .eq('user_id', userId)
      .gte('logged_at', toDateStr(since))
      .order('logged_at', { ascending: true });
    if (error) { setError(error.message); setLoading(false); return; }
    setRawEntries(data ?? []);
    setError(null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const todayEntry = rawEntries.find(e => e.logged_at === todayStr) ?? null;

  // Normalised for chart — parse dates at noon to avoid tz-boundary shifts
  const chartData = useMemo(() => rawEntries.map((e, i) => ({
    idx:      i,
    date:     new Date(e.logged_at + 'T12:00:00'),
    weight:   e.weight_kg,
    bodyFat:  e.body_fat_pct ?? null,
    logged_at: e.logged_at,
  })), [rawEntries]);

  const weights       = useMemo(() => chartData.map(d => d.weight), [chartData]);
  const ma            = useMemo(() => computeMA(weights, 7), [weights]);
  const reg90         = useMemo(() => linearRegression(weights), [weights]);
  const slopePerWeek  = reg90.slope * 7;

  // 30-day regression for goal projection (matches spec)
  const last30Data    = useMemo(() => chartData.slice(-30), [chartData]);
  const reg30         = useMemo(() => linearRegression(last30Data.map(d => d.weight)), [last30Data]);
  const slope30PerWeek = reg30.slope * 7;

  // Goal projection from 30-day slope
  const projection = useMemo(() => {
    if (!goalWeightKg || chartData.length < 2) return null;
    const last = chartData[chartData.length - 1];
    if (last.weight <= goalWeightKg) return { reached: true };
    if (reg30.slope >= -0.005) return { unreachable: true };
    const daysToGoal = Math.ceil((last.weight - goalWeightKg) / -reg30.slope);
    const projected  = new Date(last.date);
    projected.setDate(last.date.getDate() + daysToGoal);
    return { date: projected, daysToGoal, slopePerWeek: slope30PerWeek };
  }, [chartData, goalWeightKg, reg30, slope30PerWeek]);

  // Entries that have body_fat_pct for composition section
  const compEntries = useMemo(() => chartData.filter(d => d.bodyFat != null), [chartData]);

  // Pace status pill — based on 7-day slope vs goal direction
  const paceStatus = useMemo(() => {
    if (chartData.length < 7 || !goalWeightKg) return null;
    const firstW    = chartData[0]?.weight ?? 1;
    const pctPerWeek = (slopePerWeek / firstW) * 100;
    const isCut     = (chartData[chartData.length - 1]?.weight ?? 0) > goalWeightKg;
    if (isCut) {
      if (pctPerWeek < -0.7)  return { label: 'TOO FAST', color: 'text-red-400' };
      if (pctPerWeek <= -0.3) return { label: 'OPTIMAL',  color: 'text-green-400' };
      return                         { label: 'TOO SLOW', color: 'text-amber-400' };
    }
    // bulk
    if (pctPerWeek >= 0.1 && pctPerWeek <= 0.25) return { label: 'OPTIMAL',  color: 'text-green-400' };
    if (pctPerWeek > 0.25)                       return { label: 'TOO FAST', color: 'text-red-400' };
    return                                              { label: 'TOO SLOW', color: 'text-amber-400' };
  }, [chartData, slopePerWeek, goalWeightKg]);

  // UPSERT — unique constraint on (user_id, logged_at).
  // logged_at defaults to today; pass a different date for past-day / chart-edit cases.
  const logEntry = useCallback(async ({ logged_at, weight_kg, body_fat_pct, notes }) => {
    if (!userId) return { error: 'Not authenticated' };
    setSaving(true);
    const { error } = await supabase
      .from('biometric_entries')
      .upsert(
        {
          user_id:      userId,
          logged_at:    logged_at ?? todayStr,
          weight_kg,
          body_fat_pct: body_fat_pct != null && body_fat_pct !== '' ? Number(body_fat_pct) : null,
          notes:        notes || null,
        },
        { onConflict: 'user_id,logged_at' }
      );
    setSaving(false);
    if (error) return { error: error.message };
    await fetchEntries();
    // Increment streak for today's log
    await supabase.rpc('update_streak', { p_user_id: userId });
    const { data: prof } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak, last_logged_date')
      .eq('id', userId)
      .single();
    if (prof) updateProfile(prof);
    return { success: true };
  }, [userId, todayStr, fetchEntries, updateProfile]);

  return {
    rawEntries,
    chartData,
    loading,
    error,
    saving,
    todayEntry,
    ma,
    reg: reg90,
    slopePerWeek,
    slope30PerWeek,
    projection,
    compEntries,
    paceStatus,
    logEntry,
    refetch: fetchEntries,
  };
}
