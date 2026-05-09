import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

export function useSentinel(userId) {
  const [meals, setMeals]           = useState([]);
  const [targets, setTargets]       = useState({ kcal: 2200, protein: 180, carbs: 220, fat: 70 });
  const [loading, setLoading]       = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Fetch profile targets once on mount
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('current_macros')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.current_macros) setTargets(data.current_macros);
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

  return { meals, totals, targets, loading, addMeal, deleteMeal, selectedDate, setSelectedDate };
}
