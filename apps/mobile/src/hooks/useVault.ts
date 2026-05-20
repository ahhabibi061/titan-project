import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ── useBiometricEntries ────────────────────────────────────────────────────────
export interface BiometricEntry {
  id: string;
  weight_kg: number;
  body_fat_pct: number | null;
  notes: string | null;
  logged_at: string; // 'YYYY-MM-DD'
  waist_cm: number | null;
  neck_cm: number | null;
  hip_cm: number | null;
}

export function useBiometricEntries() {
  return useQuery({
    queryKey: ['biometric-entries'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('biometric_entries')
        .select('id, weight_kg, body_fat_pct, notes, logged_at, waist_cm, neck_cm, hip_cm')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BiometricEntry[];
    },
    staleTime: 30_000,
  });
}

// ── useLogWeight ───────────────────────────────────────────────────────────────
export function useLogWeight() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (params: {
      date: string;
      weight_kg: number;
      body_fat_pct?: number;
      waist_cm?: number;
      neck_cm?: number;
      hip_cm?: number;
    }) => {
      const userId = await getUserId();
      const { error } = await supabase
        .from('biometric_entries')
        .upsert(
          {
            user_id:      userId,
            logged_at:    params.date,
            weight_kg:    params.weight_kg,
            body_fat_pct: params.body_fat_pct ?? null,
            waist_cm:     params.waist_cm ?? null,
            neck_cm:      params.neck_cm ?? null,
            hip_cm:       params.hip_cm ?? null,
          },
          { onConflict: 'user_id,logged_at' }
        );
      if (error) throw error;

      // activity feed entry
      await supabase.from('activity_feed').insert({
        user_id:    userId,
        event_type: 'weight',
        payload:    { text: `${params.weight_kg}kg logged` },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['biometric-entries'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['this-week'] });
    },
  });
  return {
    logWeight: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error:     mutation.error,
  };
}

// ── useDeleteEntry ─────────────────────────────────────────────────────────────
export function useDeleteEntry() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('biometric_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['biometric-entries'] });
    },
  });
  return {
    deleteEntry: mutation.mutateAsync,
    isDeleting:  mutation.isPending,
  };
}

// ── useProgressPhotos ──────────────────────────────────────────────────────────
export interface ProgressPhoto {
  id: string;
  storage_path: string;
  taken_at: string;
  angle: string;   // derived from path: {userId}/{date}/{angle}.jpg
  signedUrl: string | null;
}

export function useProgressPhotos() {
  return useQuery({
    queryKey: ['progress-photos'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('progress_photos')
        .select('id, storage_path, taken_at')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      const withUrls = await Promise.all(
        rows.map(async (r) => {
          const { data: signed } = await supabase
            .storage
            .from('progress-photos')
            .createSignedUrl(r.storage_path, 3600);
          const parts = r.storage_path.split('/');
          const angle = parts[parts.length - 1]?.replace('.jpg', '') ?? 'front';
          return {
            id:          r.id,
            storage_path: r.storage_path,
            taken_at:    r.taken_at,
            angle,
            signedUrl:   signed?.signedUrl ?? null,
          } as ProgressPhoto;
        })
      );
      return withUrls;
    },
    staleTime: 60_000,
  });
}

// ── useUploadPhoto ─────────────────────────────────────────────────────────────
export function useUploadPhoto() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (params: { base64: string; angle: string; date: string }) => {
      const userId = await getUserId();
      const path   = `${userId}/${params.date}/${params.angle}.jpg`;

      const raw      = atob(params.base64);
      const bytes    = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      const { error: upErr } = await supabase.storage
        .from('progress-photos')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from('progress_photos')
        .upsert(
          { user_id: userId, storage_path: path, taken_at: params.date },
          { onConflict: 'user_id,taken_at' }
        );
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress-photos'] });
    },
  });
  return {
    uploadPhoto: mutation.mutateAsync,
    isLoading:   mutation.isPending,
    error:       mutation.error,
  };
}

// ── getMondayISO ───────────────────────────────────────────────────────────────
function getMondayISO(): string {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── useWeeklyCheckin ───────────────────────────────────────────────────────────
export interface WeeklyCheckin {
  mood:          number | null;
  energy:        number | null;
  sleep_quality: number | null;
  notes:         string | null;
}

export function useWeeklyCheckin() {
  const qc = useQueryClient();
  const mondayISO = useMemo(() => getMondayISO(), []);

  const query = useQuery({
    queryKey: ['weekly-checkin', mondayISO],
    queryFn: async () => {
      const userId = await getUserId();
      const { data } = await supabase
        .from('weekly_checkins')
        .select('mood, energy, sleep_quality, notes')
        .eq('user_id', userId)
        .eq('checkin_date', mondayISO)
        .maybeSingle();
      return (data ?? null) as WeeklyCheckin | null;
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (params: {
      mood:          number;
      energy:        number;
      sleep_quality: number;
      notes:         string;
    }) => {
      const userId = await getUserId();
      const { error } = await supabase
        .from('weekly_checkins')
        .upsert(
          {
            user_id:       userId,
            checkin_date:  mondayISO,
            mood:          params.mood,
            energy:        params.energy,
            sleep_quality: params.sleep_quality,
            notes:         params.notes || null,
          },
          { onConflict: 'user_id,checkin_date' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weekly-checkin', mondayISO] });
    },
  });

  return {
    checkin:      query.data ?? null,
    isLoading:    query.isLoading,
    submit:       mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    error:        mutation.error,
  };
}
