import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useProfileStore } from '../store/useProfileStore';

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

export const MICRO_TARGETS = {
  fiber:        25,
  sugar:        50,
  sodium:       2300,
  potassium:    3500,
  cholesterol:  300,
  saturatedFat: 20,
  vitaminA:     900,
  vitaminC:     90,
  calcium:      1000,
  iron:         18,
};

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
    setEatBackCalories(false);
  }, [storeProfile]);

  useEffect(() => {
    if (!userId) return;
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

  const fetchMeals = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const dateStr = toDateStr(selectedDate);
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextStr = toDateStr(nextDay);

    const { data } = await supabase
      .from('nutrition_logs')
      .select(`
        id, logged_at, meal_name, kcal, protein_g, carbs_g, fat_g, source, meal_type,
        serving_amount, serving_unit,
        fiber_g, sugar_g, sodium_mg, potassium_mg, cholesterol_mg, saturated_fat_g,
        vitamin_a_iu, vitamin_c_mg, calcium_mg, iron_mg
      `)
      .eq('user_id', userId)
      .gte('logged_at', dateStr)
      .lt('logged_at', nextStr)
      .order('logged_at', { ascending: true });

    setMeals((data ?? []).map(m => ({ ...m, name: m.meal_name })));
    setLoading(false);
  }, [userId, selectedDate]);

  useEffect(() => { fetchMeals(); }, [fetchMeals]);

  // Sections grouped by meal_type
  const sections = useMemo(() => {
    const result = {};
    for (const type of ['breakfast', 'lunch', 'dinner', 'snacks', 'uncategorized']) {
      const typeMeals = meals.filter(m => (m.meal_type ?? 'uncategorized') === type);
      result[type] = {
        meals: typeMeals,
        totals: typeMeals.reduce((acc, m) => ({
          kcal:    acc.kcal    + (m.kcal      ?? 0),
          protein: acc.protein + (m.protein_g ?? 0),
          carbs:   acc.carbs   + (m.carbs_g   ?? 0),
          fat:     acc.fat     + (m.fat_g     ?? 0),
        }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }),
      };
    }
    return result;
  }, [meals]);

  // Daily totals including micros
  const dailyTotals = useMemo(() => meals.reduce((acc, m) => ({
    kcal:         acc.kcal         + (m.kcal            ?? 0),
    protein:      acc.protein      + (m.protein_g       ?? 0),
    carbs:        acc.carbs        + (m.carbs_g         ?? 0),
    fat:          acc.fat          + (m.fat_g           ?? 0),
    fiber:        acc.fiber        + (m.fiber_g         ?? 0),
    sugar:        acc.sugar        + (m.sugar_g         ?? 0),
    sodium:       acc.sodium       + (m.sodium_mg       ?? 0),
    potassium:    acc.potassium    + (m.potassium_mg    ?? 0),
    cholesterol:  acc.cholesterol  + (m.cholesterol_mg  ?? 0),
    saturatedFat: acc.saturatedFat + (m.saturated_fat_g ?? 0),
    vitaminA:     acc.vitaminA     + (m.vitamin_a_iu    ?? 0),
    vitaminC:     acc.vitaminC     + (m.vitamin_c_mg    ?? 0),
    calcium:      acc.calcium      + (m.calcium_mg      ?? 0),
    iron:         acc.iron         + (m.iron_mg         ?? 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0, cholesterol: 0, saturatedFat: 0, vitaminA: 0, vitaminC: 0, calcium: 0, iron: 0 }), [meals]);

  // Flat totals (backward compat with dashboard)
  const totals = {
    kcal:    dailyTotals.kcal,
    protein: dailyTotals.protein,
    carbs:   dailyTotals.carbs,
    fat:     dailyTotals.fat,
  };

  const addMeal = async ({
    name, kcal, protein_g, carbs_g, fat_g,
    source = 'manual',
    meal_type = 'uncategorized',
    serving_amount, serving_unit,
    fiber_g, sugar_g, sodium_mg, potassium_mg, cholesterol_mg,
    saturated_fat_g, vitamin_a_iu, vitamin_c_mg, calcium_mg, iron_mg,
  }) => {
    const safeName    = name?.trim() || 'Unknown Food';
    const safeKcal    = isNaN(Number(kcal))      ? 0 : Math.round(Number(kcal));
    const safeProtein = isNaN(Number(protein_g)) ? 0 : Math.round(Number(protein_g));
    const safeCarbs   = isNaN(Number(carbs_g))   ? 0 : Math.round(Number(carbs_g));
    const safeFat     = isNaN(Number(fat_g))     ? 0 : Math.round(Number(fat_g));

    const tempId = `opt-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic = {
      id: tempId, user_id: userId, logged_at: now, name: safeName, meal_name: safeName,
      kcal: safeKcal, protein_g: safeProtein, carbs_g: safeCarbs, fat_g: safeFat,
      source, meal_type: meal_type ?? 'uncategorized',
    };
    setMeals(prev => [...prev, optimistic]);

    const payload = {
      user_id: userId, logged_at: now, meal_name: safeName,
      kcal: safeKcal, protein_g: safeProtein, carbs_g: safeCarbs, fat_g: safeFat,
      source, confidence: 100,
      meal_type: meal_type ?? 'uncategorized',
      serving_amount: serving_amount ?? null,
      serving_unit:   serving_unit   ?? null,
      fiber_g:         fiber_g         ?? null,
      sugar_g:         sugar_g         ?? null,
      sodium_mg:       sodium_mg       ?? null,
      potassium_mg:    potassium_mg    ?? null,
      cholesterol_mg:  cholesterol_mg  ?? null,
      saturated_fat_g: saturated_fat_g ?? null,
      vitamin_a_iu:    vitamin_a_iu    ?? null,
      vitamin_c_mg:    vitamin_c_mg    ?? null,
      calcium_mg:      calcium_mg      ?? null,
      iron_mg:         iron_mg         ?? null,
    };
    console.log('[useSentinel] addMeal insert:', payload);

    const { data, error } = await supabase
      .from('nutrition_logs')
      .insert(payload)
      .select(`
        id, logged_at, meal_name, kcal, protein_g, carbs_g, fat_g, source, meal_type,
        serving_amount, serving_unit,
        fiber_g, sugar_g, sodium_mg, potassium_mg, cholesterol_mg, saturated_fat_g,
        vitamin_a_iu, vitamin_c_mg, calcium_mg, iron_mg
      `)
      .single();

    if (error) {
      console.error('[useSentinel] addMeal error:', error);
      setMeals(prev => prev.filter(m => m.id !== tempId));
    } else {
      setMeals(prev => prev.map(m => m.id === tempId ? { ...data, name: data.meal_name } : m));
    }
  };

  const deleteMeal = async (id) => {
    setMeals(prev => prev.filter(m => m.id !== id));
    await supabase.from('nutrition_logs').delete().eq('id', id);
  };

  return {
    meals, totals, targets, loading, addMeal, deleteMeal,
    selectedDate, setSelectedDate, calsBurned, eatBackCalories,
    sections, dailyTotals, microTargets: MICRO_TARGETS,
  };
}
