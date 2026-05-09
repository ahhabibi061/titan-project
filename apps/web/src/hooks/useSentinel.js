import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProfileStore } from '../store/useProfileStore';

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

export function useSentinel(userId) {
  const storeProfile = useProfileStore((s) => s.profile);
  const [meals, setMeals]                   = useState([]);
  const [targets, setTargets]               = useState({ kcal: 2200, protein: 180, carbs: 220, fat: 70 });
  const [loading, setLoading]               = useState(true);
  const [selectedDate, setSelectedDate]     = useState(new Date());
  const [calsBurned, setCalsBurned]         = useState(null);
  const [eatBackCalories, setEatBackCalories] = useState(false);

  // Sync macro targets + eat-back preference from the global profile store
  useEffect(() => {
    if (!storeProfile) return;
    if (storeProfile.current_macros) setTargets(storeProfile.current_macros);
    setEatBackCalories(storeProfile.settings?.eat_back_calories ?? false);
  }, [storeProfile]);

  useEffect(() => {
    if (!userId) return;
    // Fetch today's completed workout calories_burned
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    supabase
      .from('workouts')
      .select('calories_burned')
      .eq('user_id', userId)
      .gte('created_at', today)
      .lt('created_at', tomorrow)
      .not('completed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.calories_burned != null) setCalsBurned(Number(data.calories_burned));
      });
  }, [userId]);

  // Fetch meals when userId or selectedDate changes
  const fetchMeals = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const dateStr = toDateStr(selectedDate);
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextStr = toDateStr(nextDay);

    const { data } = await supabase
      .from('nutrition_logs')
      .select('id, logged_at, name, kcal, protein_g, carbs_g, fat_g, source')
      .eq('user_id', userId)
      .gte('logged_at', dateStr)
      .lt('logged_at', nextStr)
      .order('logged_at', { ascending: true });

    setMeals(data ?? []);
    setLoading(false);
  }, [userId, selectedDate]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const totals = meals.reduce(
    (acc, m) => ({
      kcal:    acc.kcal    + (m.kcal      ?? 0),
      protein: acc.protein + (m.protein_g ?? 0),
      carbs:   acc.carbs   + (m.carbs_g   ?? 0),
      fat:     acc.fat     + (m.fat_g     ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const addMeal = async ({ name, kcal, protein_g, carbs_g, fat_g }) => {
    const tempId = `opt-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic = { id: tempId, user_id: userId, logged_at: now, name, kcal, protein_g, carbs_g, fat_g, source: 'manual' };
    setMeals(prev => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('nutrition_logs')
      .insert({ user_id: userId, logged_at: now, name, kcal, protein_g, carbs_g, fat_g, source: 'manual' })
      .select('id, logged_at, name, kcal, protein_g, carbs_g, fat_g, source')
      .single();

    if (error) {
      setMeals(prev => prev.filter(m => m.id !== tempId));
    } else {
      setMeals(prev => prev.map(m => m.id === tempId ? data : m));
    }
  };

  const deleteMeal = async (id) => {
    setMeals(prev => prev.filter(m => m.id !== id));
    await supabase.from('nutrition_logs').delete().eq('id', id);
  };

  return { meals, totals, targets, loading, addMeal, deleteMeal, selectedDate, setSelectedDate, calsBurned, eatBackCalories };
}
