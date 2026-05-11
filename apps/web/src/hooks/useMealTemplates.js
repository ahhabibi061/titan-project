import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useMealTemplates(userId) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('meal_templates')
      .select('id, name, kcal, protein_g, carbs_g, fat_g, items, times_used')
      .eq('user_id', userId)
      .order('times_used', { ascending: false })
      .order('created_at', { ascending: false });
    setTemplates((data ?? []).map(t => ({ ...t, items: t.items ?? [] })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Save a new bundle template
  const saveTemplate = useCallback(async ({ name, items = [], kcal, protein_g, carbs_g, fat_g }) => {
    if (!userId) return { error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('meal_templates')
      .insert({ user_id: userId, name: name.trim(), items, kcal, protein_g, carbs_g, fat_g })
      .select('id, name, kcal, protein_g, carbs_g, fat_g, items, times_used')
      .single();
    if (error) return { error: error.message };
    setTemplates(prev => [{ ...data, items: data.items ?? [] }, ...prev]);
    return { success: true };
  }, [userId]);

  const updateTemplate = useCallback(async (id, { name, items = [], kcal, protein_g, carbs_g, fat_g }) => {
    if (!userId) return { error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('meal_templates')
      .update({ name: name.trim(), items, kcal, protein_g, carbs_g, fat_g })
      .eq('id', id).eq('user_id', userId)
      .select('id, name, kcal, protein_g, carbs_g, fat_g, items, times_used')
      .single();
    if (error) return { error: error.message };
    setTemplates(prev => prev.map(t => t.id === id ? { ...data, items: data.items ?? [] } : t));
    return { success: true };
  }, [userId]);

  // Log every item in the bundle as a separate nutrition_logs row
  const logFromTemplate = useCallback(async (template, addMeal) => {
    if (!userId) return { error: 'Not authenticated' };
    const items = template.items ?? [];
    for (const item of items) {
      await addMeal({
        name:      item.name,
        kcal:      item.kcal,
        protein_g: item.protein_g,
        carbs_g:   item.carbs_g,
        fat_g:     item.fat_g,
        source:    'manual',
      });
    }
    const newCount = (template.times_used || 0) + 1;
    setTemplates(prev =>
      prev.map(t => t.id === template.id ? { ...t, times_used: newCount } : t)
          .sort((a, b) => b.times_used - a.times_used)
    );
    await supabase.from('meal_templates').update({ times_used: newCount }).eq('id', template.id);
    return { success: true };
  }, [userId]);

  const deleteTemplate = useCallback(async (id) => {
    if (!userId) return { error: 'Not authenticated' };
    setTemplates(prev => prev.filter(t => t.id !== id));
    await supabase.from('meal_templates').delete().eq('id', id).eq('user_id', userId);
    return { success: true };
  }, [userId]);

  return { templates, loading, saveTemplate, updateTemplate, logFromTemplate, deleteTemplate };
}
