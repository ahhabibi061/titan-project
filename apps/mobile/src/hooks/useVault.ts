import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ── useBiometricEntries ────────────────────────────────────────────────────────
export function useBiometricEntries() {
  return useQuery({
    queryKey: ['biometric-entries'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('biometric_entries')
        .select('id, weight_kg, body_fat_pct, notes, logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BiometricEntry[];
    },
    staleTime: 30_000,
  });
}

export interface BiometricEntry {
  id: string;
  weight_kg: number;
  body_fat_pct: number | null;
  notes: string | null;
  logged_at: string; // 'YYYY-MM-DD'
}

// ── useLogWeight ───────────────────────────────────────────────────────────────
export function useLogWeight() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (params: { date: string; weight_kg: number; body_fat_pct?: number }) => {
      const userId = await getUserId();
      const { error } = await supabase
        .from('biometric_entries')
        .upsert(
          {
            user_id:      userId,
            logged_at:    params.date,
            weight_kg:    params.weight_kg,
            body_fat_pct: params.body_fat_pct ?? null,
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
          // derive angle from path: userId/date/angle.jpg
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
// Accepts base64 string (from expo-image-picker with base64:true option)
export function useUploadPhoto() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (params: { base64: string; angle: string; date: string }) => {
      const userId = await getUserId();
      const path   = `${userId}/${params.date}/${params.angle}.jpg`;

      // decode base64 → Uint8Array
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
