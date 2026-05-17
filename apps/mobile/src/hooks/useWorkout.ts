import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────────
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface StartWorkoutParams {
  name: string;
  exercises: Array<{ exerciseName: string; setsTarget: number; position: number }>;
}

export interface LogSetParams {
  workoutExerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: number;
}

export interface FinishWorkoutParams {
  workoutId: string;
  durationSeconds: number;
  totalVolumeKg: number;
  workoutName: string;
  doneSets: number;
}

// ── useStartWorkout ────────────────────────────────────────────────────────────
export function useStartWorkout() {
  return useMutation({
    mutationFn: async (params: StartWorkoutParams) => {
      const userId = await getUserId();

      // Create workout row
      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({
          user_id:    userId,
          name:       params.name,
          started_at: new Date().toISOString(),
          completed:  false,
        })
        .select('id')
        .single();
      if (wErr) throw wErr;

      // Look up exercise UUIDs by name (best-effort; null if not found)
      const { data: dbExercises } = await supabase
        .from('exercises')
        .select('id, name');
      const nameToId = new Map<string, string>();
      dbExercises?.forEach(e => nameToId.set(e.name.toLowerCase().trim(), e.id));

      // Insert workout_exercise rows
      const rows = params.exercises.map(ex => ({
        workout_id:  workout.id,
        exercise_id: nameToId.get(ex.exerciseName.toLowerCase().trim()) ?? null,
        sets_target: ex.setsTarget,
        notes:       ex.exerciseName,
      }));

      const { data: weData, error: weErr } = await supabase
        .from('workout_exercises')
        .insert(rows)
        .select('id');
      if (weErr) throw weErr;

      return {
        workoutId:          workout.id,
        workoutExerciseIds: (weData ?? []).map(r => r.id),
      };
    },
  });
}

// ── useAddWorkoutExercise ──────────────────────────────────────────────────────
export function useAddWorkoutExercise() {
  return useMutation({
    mutationFn: async (params: {
      workoutId: string; exerciseName: string; position: number; setsTarget: number;
    }) => {
      const { data: exercises } = await supabase
        .from('exercises')
        .select('id')
        .ilike('name', params.exerciseName)
        .limit(1);

      const { data, error } = await supabase
        .from('workout_exercises')
        .insert({
          workout_id:  params.workoutId,
          exercise_id: exercises?.[0]?.id ?? null,
          sets_target: params.setsTarget,
          notes:       params.exerciseName,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
  });
}

// ── useLogSet ──────────────────────────────────────────────────────────────────
export function useLogSet() {
  return useMutation({
    mutationFn: async (params: LogSetParams) => {
      const userId = await getUserId();
      const { error } = await supabase.from('sets').insert({
        workout_exercise_id: params.workoutExerciseId,
        user_id:             userId,
        set_number:          params.setNumber,
        weight_kg:           params.weightKg,
        reps:                params.reps,
        rir:                 params.rir,
        completed:           true,
        completed_at:        new Date().toISOString(),
        created_at:          new Date().toISOString(),
      });
      if (error) throw error;
    },
  });
}

// ── useFinishWorkout ───────────────────────────────────────────────────────────
export function useFinishWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: FinishWorkoutParams) => {
      const userId = await getUserId();
      const now    = new Date().toISOString();
      const today  = todayISO();

      // Mark workout complete
      const { error: wErr } = await supabase
        .from('workouts')
        .update({
          completed:        true,
          finished_at:      now,
          duration_seconds: params.durationSeconds,
          total_volume_kg:  params.totalVolumeKg,
          updated_at:       now,
        })
        .eq('id', params.workoutId);
      if (wErr) throw wErr;

      // Update streak (fire-and-forget — don't block on failure)
      try { await supabase.rpc('update_streak', { p_user_id: userId, p_date: today }); } catch {}

      // Write activity feed entry
      await supabase.from('activity_feed').insert({
        user_id:    userId,
        event_type: 'workout_complete',
        payload: {
          workout_id:       params.workoutId,
          workout_name:     params.workoutName,
          volume_kg:        params.totalVolumeKg,
          sets_completed:   params.doneSets,
          duration_seconds: params.durationSeconds,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-workout'] });
      qc.invalidateQueries({ queryKey: ['workout-history'] });
      qc.invalidateQueries({ queryKey: ['weekly-workouts'] });
      qc.invalidateQueries({ queryKey: ['weekly-sets'] });
      qc.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });
}

// ── useWorkoutHistory ──────────────────────────────────────────────────────────
export function useWorkoutHistory() {
  return useQuery({
    queryKey: ['workout-history'],
    queryFn:  async () => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id, name, completed, started_at, finished_at,
          duration_seconds, total_volume_kg,
          workout_exercises (
            id, position, notes,
            sets (set_number, weight_kg, reps, rir, completed)
          )
        `)
        .eq('user_id', userId)
        .eq('completed', true)
        .order('finished_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

// ── useTodayWorkout ────────────────────────────────────────────────────────────
export function useTodayWorkout() {
  return useQuery({
    queryKey: ['today-workout'],
    queryFn:  async () => {
      const userId       = await getUserId();
      // Use local midnight so workouts started in evening aren't missed due to UTC offset
      const localMidnight = new Date();
      localMidnight.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id, name, completed, started_at, finished_at,
          duration_seconds, total_volume_kg,
          workout_exercises (
            id, notes,
            sets (set_number, weight_kg, reps, completed)
          )
        `)
        .eq('user_id', userId)
        .gte('started_at', localMidnight.toISOString())
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });
}

// ── useWeeklySets ─────────────────────────────────────────────────────────────
export function useWeeklySets() {
  return useQuery({
    queryKey: ['weekly-sets'],
    queryFn:  async () => {
      const userId    = await getUserId();
      const now       = new Date();
      const monday    = new Date(now);
      const dow       = now.getDay();
      monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      monday.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('sets')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', monday.toISOString());
      if (error) throw error;
      return (data ?? []).length;
    },
    staleTime: 30_000,
  });
}

// ── useWeeklyWorkouts ──────────────────────────────────────────────────────────
export function useWeeklyWorkouts() {
  return useQuery({
    queryKey: ['weekly-workouts'],
    queryFn:  async () => {
      const userId    = await getUserId();
      const now       = new Date();
      const dow       = now.getDay(); // 0 = Sun
      const monday    = new Date(now);
      monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('workouts')
        .select('id, started_at, completed')
        .eq('user_id', userId)
        .gte('started_at', monday.toISOString())
        .lte('started_at', sunday.toISOString());
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ── useActivityFeed ────────────────────────────────────────────────────────────
export function useActivityFeed() {
  return useQuery({
    queryKey: ['activity-feed'],
    queryFn:  async () => {
      const userId = await getUserId();
      const today  = todayISO();
      const { data, error } = await supabase
        .from('activity_feed')
        .select('id, event_type, payload, created_at')
        .eq('user_id', userId)
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });
}
