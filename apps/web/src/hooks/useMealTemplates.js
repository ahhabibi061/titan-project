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
      .select('id, name, kcal, protein_g, carbs_g, fat_g, notes, times_used')
      .eq('user_id', userId)
      .order('times_used', { ascending: false })
      .order('created_at', { ascending: false });
    setTemplates(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Returns { success } | { exists, existingId } | { error }
  const saveTemplate = useCallback(async ({ name, kcal, protein_g, carbs_g, fat_g, notes }) => {
    if (!userId) return { error: 'Not authenticated' };
    const existing = templates.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return { exists: true, existingId: existing.id };
    const { data, error } = await supabase
      .from('meal_templates')
      .insert({ user_id: userId, name: name.trim(), kcal, protein_g, carbs_g, fat_g, notes: notes || null })
      .select('id, name, kcal, protein_g, carbs_g, fat_g, notes, times_used')
      .single();
    if (error) return { error: error.message };
    setTemplates(prev => [data, ...prev]);
    return { success: true };
  }, [userId, templates]);

  const updateTemplate = useCallback(async (id, { name, kcal, protein_g, carbs_g, fat_g, notes }) => {
    if (!userId) return { error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('meal_templates')
      .update({ name: name.trim(), kcal, protein_g, carbs_g, fat_g, notes: notes || null })
      .eq('id', id).eq('user_id', userId)
      .select('id, name, kcal, protein_g, carbs_g, fat_g, notes, times_used')
      .single();
    if (error) return { error: error.message };
    setTemplates(prev => prev.map(t => t.id === id ? data : t));
    return { success: true };
  }, [userId]);

  const logFromTemplate = useCallback(async (template, addMeal) => {
    if (!userId) return { error: 'Not authenticated' };
    await addMeal({ name: template.name, kcal: template.kcal, protein_g: template.protein_g, carbs_g: template.carbs_g, fat_g: template.fat_g });
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
