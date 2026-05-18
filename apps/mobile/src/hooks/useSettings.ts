import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export interface Profile {
  id: string;
  display_name: string | null;
  subscription_tier: 'basic' | 'pro' | 'elite';
  goal: string | null;
  goal_weight_kg: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  sex: string | null;
  activity_level: string | null;
  current_macros: { kcal: number; protein: number; carbs: number; fat: number } | null;
  settings: Record<string, any> | null;
  created_at: string | null;
}

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const userId = await getUserId();
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  return { updateProfile: mutation.mutateAsync, isLoading: mutation.isPending, error: mutation.error };
}

export function useUpdateMacros() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (macros: { kcal: number; protein: number; carbs: number; fat: number; mode: 'auto' | 'custom' }) => {
      const userId = await getUserId();
      const { mode, ...macroValues } = macros;
      const { data: profile } = await supabase.from('profiles').select('settings').eq('id', userId).single();
      const settings = { ...(profile?.settings ?? {}), macro_mode: mode };
      const { error } = await supabase.from('profiles')
        .update({ current_macros: macroValues, settings })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  return { updateMacros: mutation.mutateAsync, isLoading: mutation.isPending, error: mutation.error };
}
