import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// DB → UI adapter for a single set
function adaptSet(s, prevSets = [], idx = 0) {
  return {
    id: s.id,
    _setNumber: s.set_number,
    _completedAt: s.completed_at,
    reps: s.reps ?? 8,
    weight: s.weight_kg ?? 0,
    done: !!s.completed_at,
    prevReps: prevSets[idx]?.reps ?? 0,
    prevWeight: prevSets[idx]?.weight ?? 0,
    rir: s.rir ?? null,
  };
}

// DB → UI adapter for a workout_exercise row
function adaptExercise(we, prevSets = []) {
  const ex = we.exercises;
  const sets = (we.sets ?? [])
    .sort((a, b) => a.set_number - b.set_number)
    .map((s, i) => adaptSet(s, prevSets, i));

  return {
    id: we.id,
    exerciseId: we.exercise_id,
    _order: we.order ?? 0,
    _ex: ex ? {
      id: ex.id,
      name: ex.name,
      primary: Array.isArray(ex.primary_muscle) ? ex.primary_muscle : [ex.primary_muscle].filter(Boolean),
      secondary: Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : [],
    } : null,
    sets,
  };
}

async function fetchPrevSets(exerciseId, currentWorkoutId) {
  try {
    const { data } = await supabase
      .from('workout_exercises')
      .select('id, sets(set_number, weight_kg, reps), workouts!inner(completed_at)')
      .eq('exercise_id', exerciseId)
      .not('workouts.completed_at', 'is', null)
      .order('workouts(completed_at)', { ascending: false })
      .limit(1);

    if (!data?.[0]?.sets?.length) return [];
    return data[0].sets
      .sort((a, b) => a.set_number - b.set_number)
      .map(s => ({ reps: s.reps ?? 0, weight: s.weight_kg ?? 0 }));
  } catch {
    return [];
  }
}

export function useLogger(userId) {
  const [workout, setWorkout]         = useState(null);
  const [exercises, setExercises]     = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [completed, setCompleted]     = useState(false);
  const timers   = useRef({});
  const workoutRef = useRef(null);

  useEffect(() => { workoutRef.current = workout; }, [workout]);

  // Load exercises catalog + today's in-progress workout
  // userId === undefined  → session still resolving; stay in loading state
  // userId === null       → confirmed no session; not loading
  // userId === 'uuid'     → authenticated; fetch from DB
  useEffect(() => {
    if (userId === undefined) return;          // wait for session
    if (!userId) { setLoading(false); return; } // null/empty = no session

    async function init() {
      setLoading(true);
      await Promise.all([loadAllExercises(), loadTodayWorkout()]);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function loadAllExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, primary_muscle, secondary_muscles')
      .order('name');
    if (data?.length) {
      setAllExercises(data.map(e => ({
        id: e.id,
        name: e.name,
        primary: Array.isArray(e.primary_muscle) ? e.primary_muscle : [e.primary_muscle].filter(Boolean),
        secondary: Array.isArray(e.secondary_muscles) ? e.secondary_muscles : [],
      })));
    }
  }

  async function loadTodayWorkout() {
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { data: w } = await supabase
      .from('workouts')
      .select('id, name, created_at, completed_at')
      .eq('user_id', userId)
      .gte('created_at', today)
      .lt('created_at', tomorrow)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!w) return;
    setWorkout(w);
    workoutRef.current = w;
    await loadExercises(w.id);
  }

  async function loadExercises(workoutId) {
    const { data } = await supabase
      .from('workout_exercises')
      .select('id, exercise_id, order, exercises(id, name, primary_muscle, secondary_muscles), sets(id, set_number, weight_kg, reps, rir, completed_at)')
      .eq('workout_id', workoutId)
      .order('order', { ascending: true });

    if (!data) return;

    const adapted = await Promise.all(
      data.map(async we => {
        const prev = await fetchPrevSets(we.exercise_id, workoutId);
        return adaptExercise(we, prev);
      })
    );
    setExercises(adapted);
  }

  const startWorkout = useCallback(async (name = 'New Workout') => {
    console.log('[useLogger] startWorkout → userId:', userId);
    if (!userId) {
      console.error('[useLogger] startWorkout: no userId — session not ready');
      return;
    }
    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, name })
      .select('id, name, created_at, completed_at')
      .single();
    if (error) {
      console.error('[useLogger] workouts insert error:', error);
      return;
    }
    if (data) {
      setWorkout(data);
      workoutRef.current = data;
      setExercises([]);
    }
  }, [userId]);

  const updateWorkoutName = useCallback((name) => {
    setWorkout(w => w ? { ...w, name } : w);
    clearTimeout(timers.current._name);
    timers.current._name = setTimeout(() => {
      if (workoutRef.current?.id) {
        supabase.from('workouts').update({ name }).eq('id', workoutRef.current.id);
      }
    }, 600);
  }, []);

  const addExercise = useCallback(async (ex) => {
    if (!workoutRef.current?.id) return;
    const nextOrder = exercises.length;
    const tempId    = `opt-we-${Date.now()}`;

    const optimistic = {
      id: tempId,
      exerciseId: ex.id,
      _order: nextOrder,
      _ex: { id: ex.id, name: ex.name, primary: ex.primary, secondary: ex.secondary },
      sets: [1, 2, 3].map(n => ({
        id: `opt-s-${Date.now()}-${n}`,
        _setNumber: n, _completedAt: null,
        reps: 8, weight: 0, done: false, prevReps: 0, prevWeight: 0,
      })),
    };
    setExercises(prev => [...prev, optimistic]);

    // Only write to DB if exercise has a real UUID
    const isUUID = /^[0-9a-f-]{36}$/.test(ex.id);
    if (!isUUID) return; // local-only for EXERCISE_LIBRARY fallback entries

    const { data: weData, error: weErr } = await supabase
      .from('workout_exercises')
      .insert({ workout_id: workoutRef.current.id, exercise_id: ex.id, order: nextOrder })
      .select('id')
      .single();

    if (weErr) { setExercises(prev => prev.filter(e => e.id !== tempId)); return; }

    const { data: setsData } = await supabase
      .from('sets')
      .insert([1, 2, 3].map(n => ({ workout_exercise_id: weData.id, set_number: n, weight_kg: 0, reps: 8 })))
      .select('id, set_number, weight_kg, reps, rir, completed_at');

    const prev = await fetchPrevSets(ex.id, workoutRef.current.id);
    const realSets = (setsData ?? [])
      .sort((a, b) => a.set_number - b.set_number)
      .map((s, i) => adaptSet(s, prev, i));

    setExercises(prevEx => prevEx.map(e =>
      e.id === tempId ? { ...e, id: weData.id, sets: realSets } : e
    ));
  }, [exercises.length]);

  const removeExercise = useCallback(async (weId) => {
    setExercises(prev => prev.filter(e => e.id !== weId));
    if (!/^opt-/.test(weId)) {
      await supabase.from('workout_exercises').delete().eq('id', weId);
    }
  }, []);

  // Optimistic update + debounced DB write per set
  const logSet = useCallback((weId, setId, updates) => {
    setExercises(prev => prev.map(we =>
      we.id !== weId ? we : {
        ...we,
        sets: we.sets.map(s => s.id !== setId ? s : { ...s, ...updates }),
      }
    ));

    if (/^opt-/.test(setId)) return; // temp ID — not yet in DB

    clearTimeout(timers.current[setId]);
    timers.current[setId] = setTimeout(async () => {
      const db = {};
      if ('reps'   in updates) db.reps       = updates.reps;
      if ('weight' in updates) db.weight_kg  = updates.weight;
      if ('done'   in updates) db.completed_at = updates.done ? new Date().toISOString() : null;
      await supabase.from('sets').update(db).eq('id', setId);
    }, 500);
  }, []);

  const addSetToExercise = useCallback(async (weId) => {
    setExercises(prev => {
      const we = prev.find(e => e.id === weId);
      if (!we) return prev;
      const last    = we.sets[we.sets.length - 1];
      const nextNum = we.sets.length + 1;
      const tempId  = `opt-s-${Date.now()}`;

      const newSet = {
        id: tempId, _setNumber: nextNum, _completedAt: null,
        reps: last?.reps || 8, weight: last?.weight || 0, done: false,
        prevReps: last?.prevReps || 0, prevWeight: last?.prevWeight || 0,
      };

      // DB insert (fire-and-forget with ID replacement)
      const isUUID = /^[0-9a-f-]{36}$/.test(weId);
      if (isUUID) {
        supabase
          .from('sets')
          .insert({ workout_exercise_id: weId, set_number: nextNum, weight_kg: last?.weight || 0, reps: last?.reps || 8 })
          .select('id, set_number, weight_kg, reps, completed_at')
          .single()
          .then(({ data, error }) => {
            if (error) {
              setExercises(ex => ex.map(e =>
                e.id !== weId ? e : { ...e, sets: e.sets.filter(s => s.id !== tempId) }
              ));
            } else if (data) {
              setExercises(ex => ex.map(e =>
                e.id !== weId ? e : { ...e, sets: e.sets.map(s => s.id === tempId ? { ...s, id: data.id } : s) }
              ));
            }
          });
      }

      return prev.map(e => e.id !== weId ? e : { ...e, sets: [...e.sets, newSet] });
    });
  }, []);

  const removeSetFromExercise = useCallback(async (weId, setId) => {
    setExercises(prev => prev.map(e =>
      e.id !== weId ? e : { ...e, sets: e.sets.filter(s => s.id !== setId) }
    ));
    if (!/^opt-/.test(setId)) {
      await supabase.from('sets').delete().eq('id', setId);
    }
  }, []);

  const completeWorkout = useCallback(async () => {
    const now = new Date().toISOString();
    setWorkout(w => w ? { ...w, completed_at: now } : w);
    setCompleted(true);
    if (workoutRef.current?.id) {
      await supabase.from('workouts').update({ completed_at: now }).eq('id', workoutRef.current.id);
    }
  }, []);

  return {
    workout,
    exercises,
    allExercises,
    loading,
    completed,
    startWorkout,
    updateWorkoutName,
    addExercise,
    removeExercise,
    logSet,
    addSetToExercise,
    removeSetFromExercise,
    completeWorkout,
  };
}
