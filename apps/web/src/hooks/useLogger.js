import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── DB → UI adapters ──────────────────────────────────────────────────────

// Sets table columns: id, user_id, workout_exercise_id, set_number,
//                     weight_kg, reps, rir, logged_at
function adaptSet(s, prevSets = [], idx = 0) {
  return {
    id:          s.id,
    _setNumber:  s.set_number,
    _loggedAt:   s.logged_at,
    reps:        s.reps      ?? 8,
    weight:      s.weight_kg ?? 0,
    done:        !!s.logged_at,           // logged_at set = set is "done"
    prevReps:    prevSets[idx]?.reps   ?? 0,
    prevWeight:  prevSets[idx]?.weight ?? 0,
    rir:         s.rir ?? null,
  };
}

function adaptExercise(we, prevSets = []) {
  const ex   = we.exercises;
  const sets = (we.sets ?? [])
    .sort((a, b) => a.set_number - b.set_number)
    .map((s, i) => adaptSet(s, prevSets, i));

  return {
    id:         we.id,
    exerciseId: we.exercise_id,
    _order:     we.order ?? 0,
    _ex: ex ? {
      id:        ex.id,
      name:      ex.name,
      primary:   Array.isArray(ex.primary_muscle)     ? ex.primary_muscle     : [ex.primary_muscle].filter(Boolean),
      secondary: Array.isArray(ex.secondary_muscles)  ? ex.secondary_muscles  : [],
    } : null,
    sets,
  };
}

// ─── Previous-session sets for overload badges ─────────────────────────────

async function fetchPrevSets(exerciseId) {
  try {
    // Get all workout_exercises for this exercise that belong to a completed workout
    const { data } = await supabase
      .from('workout_exercises')
      .select('id, sets(set_number, weight_kg, reps), workouts!inner(completed_at)')
      .eq('exercise_id', exerciseId)
      .not('workouts.completed_at', 'is', null);

    if (!data?.length) return [];

    // Sort by completed_at desc in JS (Supabase JS v2 can't order by joined columns)
    const sorted = data
      .filter(we => we.workouts?.completed_at)
      .sort((a, b) => new Date(b.workouts.completed_at) - new Date(a.workouts.completed_at));

    if (!sorted.length || !sorted[0].sets?.length) return [];
    return sorted[0].sets
      .sort((a, b) => a.set_number - b.set_number)
      .map(s => ({ reps: s.reps ?? 0, weight: s.weight_kg ?? 0 }));
  } catch (e) {
    console.error('[useLogger] fetchPrevSets error:', e);
    return [];
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useLogger(userId) {
  const [workout,      setWorkout]      = useState(null);
  const [exercises,    setExercises]    = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [completed,    setCompleted]    = useState(false);

  const timers     = useRef({});
  const workoutRef = useRef(null);
  const userIdRef  = useRef(null);

  useEffect(() => { workoutRef.current = workout; },  [workout]);
  useEffect(() => { userIdRef.current  = userId;  },  [userId]);

  // userId === undefined  → session still resolving; stay loading
  // userId === null       → confirmed no session
  // userId === 'uuid'     → authenticated
  useEffect(() => {
    if (userId === undefined) return;
    if (!userId) { setLoading(false); return; }

    async function init() {
      setLoading(true);
      await Promise.all([loadAllExercises(), loadTodayWorkout()]);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Loaders ──────────────────────────────────────────────────────────────

  async function loadAllExercises() {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, primary_muscle, secondary_muscles')
      .order('name');
    if (error) { console.error('[useLogger] loadAllExercises error:', error); return; }
    if (data?.length) {
      setAllExercises(data.map(e => ({
        id:        e.id,
        name:      e.name,
        primary:   Array.isArray(e.primary_muscle)    ? e.primary_muscle    : [e.primary_muscle].filter(Boolean),
        secondary: Array.isArray(e.secondary_muscles) ? e.secondary_muscles : [],
      })));
    }
  }

  async function loadTodayWorkout() {
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { data: w, error } = await supabase
      .from('workouts')
      .select('id, name, created_at, completed_at')
      .eq('user_id', userId)
      .gte('created_at', today)
      .lt('created_at', tomorrow)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) { console.error('[useLogger] loadTodayWorkout error:', error); return; }
    if (!w) { console.log('[useLogger] no in-progress workout found today'); return; }

    console.log('[useLogger] resuming workout:', w.id, w.name);
    setWorkout(w);
    workoutRef.current = w;
    await loadExercises(w.id);
  }

  async function loadExercises(workoutId) {
    const { data, error } = await supabase
      .from('workout_exercises')
      .select(`
        id, exercise_id, order,
        exercises(id, name, primary_muscle, secondary_muscles),
        sets(id, set_number, weight_kg, reps, rir, logged_at)
      `)
      .eq('workout_id', workoutId)
      .order('order', { ascending: true });

    if (error) { console.error('[useLogger] loadExercises error:', error); return; }
    if (!data) return;

    const adapted = await Promise.all(
      data.map(async we => {
        const prev = await fetchPrevSets(we.exercise_id);
        return adaptExercise(we, prev);
      })
    );
    setExercises(adapted);
    console.log('[useLogger] loaded', adapted.length, 'exercises');
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const startWorkout = useCallback(async (name = 'New Workout') => {
    const uid = userIdRef.current;
    console.log('[useLogger] startWorkout → userId:', uid);
    if (!uid) { console.error('[useLogger] startWorkout: no userId'); return; }

    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: uid, name })
      .select('id, name, created_at, completed_at')
      .single();

    if (error) { console.error('[useLogger] workouts insert error:', error); return; }
    console.log('[useLogger] workout created:', data.id);
    setWorkout(data);
    workoutRef.current = data;
    setExercises([]);
  }, []);

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
    const workoutId = workoutRef.current?.id;
    const uid       = userIdRef.current;
    if (!workoutId) { console.error('[useLogger] addExercise: no active workout'); return; }

    console.log('[useLogger] addExercise:', ex.name, '→ workout:', workoutId);

    const nextOrder = exercises.length;
    const tempId    = `opt-we-${Date.now()}`;
    const ts        = Date.now();

    const optimistic = {
      id: tempId,
      exerciseId: ex.id,
      _order: nextOrder,
      _ex: { id: ex.id, name: ex.name, primary: ex.primary, secondary: ex.secondary },
      sets: [1, 2, 3].map(n => ({
        id: `opt-s-${ts}-${n}`, _setNumber: n, _loggedAt: null,
        reps: 8, weight: 0, done: false, prevReps: 0, prevWeight: 0,
      })),
    };
    setExercises(prev => [...prev, optimistic]);

    // Only write to DB if exercise has a real UUID (not EXERCISE_LIBRARY fallback IDs)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ex.id);
    if (!isUUID) {
      console.warn('[useLogger] addExercise: non-UUID exercise id — local only:', ex.id);
      return;
    }

    // 1. Insert workout_exercise
    const { data: weData, error: weErr } = await supabase
      .from('workout_exercises')
      .insert({ workout_id: workoutId, exercise_id: ex.id, order: nextOrder })
      .select('id')
      .single();

    if (weErr) {
      console.error('[useLogger] workout_exercises insert error:', weErr);
      setExercises(prev => prev.filter(e => e.id !== tempId));
      return;
    }
    console.log('[useLogger] workout_exercise created:', weData.id);

    // 2. Insert 3 default sets with user_id (required for RLS)
    const { data: setsData, error: setsErr } = await supabase
      .from('sets')
      .insert([1, 2, 3].map(n => ({
        user_id:             uid,
        workout_exercise_id: weData.id,
        set_number:          n,
        weight_kg:           0,
        reps:                8,
      })))
      .select('id, set_number, weight_kg, reps, rir, logged_at');

    if (setsErr) {
      console.error('[useLogger] sets insert error:', setsErr);
      // Don't rollback exercise — it exists in DB, just sets failed
    } else {
      console.log('[useLogger] sets created:', setsData?.length);
    }

    const prev     = await fetchPrevSets(ex.id);
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
      const { error } = await supabase.from('workout_exercises').delete().eq('id', weId);
      if (error) console.error('[useLogger] removeExercise error:', error);
    }
  }, []);

  // Optimistic update + debounced DB write per set (500 ms)
  const logSet = useCallback((weId, setId, updates) => {
    console.log('[useLogger] logSet:', setId, updates);

    // Optimistic UI update immediately
    setExercises(prev => prev.map(we =>
      we.id !== weId ? we : {
        ...we,
        sets: we.sets.map(s => s.id !== setId ? s : { ...s, ...updates }),
      }
    ));

    if (/^opt-/.test(setId)) {
      console.log('[useLogger] logSet: temp ID, skipping DB write');
      return;
    }

    clearTimeout(timers.current[setId]);
    timers.current[setId] = setTimeout(async () => {
      const db = {};
      if ('reps'   in updates) db.reps      = updates.reps;
      if ('weight' in updates) db.weight_kg = updates.weight;
      if ('done'   in updates) db.logged_at = updates.done ? new Date().toISOString() : null;

      console.log('[useLogger] logSet DB write → set:', setId, db);
      const { error } = await supabase.from('sets').update(db).eq('id', setId);
      if (error) console.error('[useLogger] logSet update error:', error, 'set:', setId);
    }, 500);
  }, []);

  const addSetToExercise = useCallback(async (weId) => {
    const uid = userIdRef.current;
    setExercises(prev => {
      const we = prev.find(e => e.id === weId);
      if (!we) return prev;
      const last    = we.sets[we.sets.length - 1];
      const nextNum = we.sets.length + 1;
      const tempId  = `opt-s-${Date.now()}`;

      const newSet = {
        id: tempId, _setNumber: nextNum, _loggedAt: null,
        reps:       last?.reps    || 8,
        weight:     last?.weight  || 0,
        done:       false,
        prevReps:   last?.prevReps   || 0,
        prevWeight: last?.prevWeight || 0,
      };

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(weId);
      if (isUUID) {
        supabase
          .from('sets')
          .insert({
            user_id:             uid,
            workout_exercise_id: weId,
            set_number:          nextNum,
            weight_kg:           last?.weight || 0,
            reps:                last?.reps   || 8,
          })
          .select('id, set_number, weight_kg, reps, logged_at')
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error('[useLogger] addSetToExercise insert error:', error);
              setExercises(ex => ex.map(e =>
                e.id !== weId ? e : { ...e, sets: e.sets.filter(s => s.id !== tempId) }
              ));
            } else if (data) {
              console.log('[useLogger] addSetToExercise set created:', data.id);
              setExercises(ex => ex.map(e =>
                e.id !== weId ? e : {
                  ...e,
                  sets: e.sets.map(s => s.id === tempId ? { ...s, id: data.id } : s),
                }
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
      const { error } = await supabase.from('sets').delete().eq('id', setId);
      if (error) console.error('[useLogger] removeSetFromExercise error:', error);
    }
  }, []);

  const completeWorkout = useCallback(async () => {
    const now = new Date().toISOString();
    setWorkout(w => w ? { ...w, completed_at: now } : w);
    setCompleted(true);
    if (workoutRef.current?.id) {
      const { error } = await supabase
        .from('workouts')
        .update({ completed_at: now })
        .eq('id', workoutRef.current.id);
      if (error) console.error('[useLogger] completeWorkout error:', error);
      else console.log('[useLogger] workout completed:', workoutRef.current.id);
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
