import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useWorkoutTemplates(userId) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('workout_templates')
      .select('id, name, split_type, exercises, times_used, created_at')
      .eq('user_id', userId)
      .order('times_used', { ascending: false })
      .order('created_at', { ascending: false });
    setTemplates(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const saveTemplate = useCallback(async ({ name, splitType, exercises }) => {
    if (!userId) return { error: 'Not authenticated' };
    const payload = exercises.map(we => ({
      exercise_id: we.exerciseId,
      name: we._ex?.name ?? '',
      sets_target: we.sets.length,
    }));
    const { data, error } = await supabase
      .from('workout_templates')
      .insert({ user_id: userId, name: name.trim(), split_type: splitType, exercises: payload })
      .select('id, name, split_type, exercises, times_used, created_at')
      .single();
    if (error) return { error: error.message };
    setTemplates(prev => [data, ...prev]);
    return { success: true };
  }, [userId]);

  const useTemplate = useCallback(async (templateId) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return null;
    const newCount = (tmpl.times_used || 0) + 1;
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, times_used: newCount } : t));
    await supabase.from('workout_templates').update({ times_used: newCount }).eq('id', templateId);
    return tmpl;
  }, [templates]);

  const deleteTemplate = useCallback(async (id) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    await supabase.from('workout_templates').delete().eq('id', id).eq('user_id', userId);
  }, [userId]);

  return { templates, loading, saveTemplate, useTemplate, deleteTemplate };
}
