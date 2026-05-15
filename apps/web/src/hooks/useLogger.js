import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── Schema reference ──────────────────────────────────────────────────────
// exercises:         id TEXT pk, name, primary_muscle, secondary_muscles text[]
// workouts:          id uuid pk, user_id, name, completed_at, calories_burned
// workout_exercises: id uuid pk, workout_id, exercise_id TEXT fk, order_index int
// sets:              id uuid pk, workout_exercise_id uuid fk, set_number,
//                    weight_kg, reps, rir, logged_at timestamptz
//   RLS on sets: via join workout_exercises → workouts where w.user_id = auth.uid()
//   (NO user_id column on sets — do NOT include it in inserts)

// ─── DB → UI adapters ──────────────────────────────────────────────────────

function adaptSet(s, prevSets = [], idx = 0) {
  return {
    id:         s.id,
    _setNumber: s.set_number,
    _loggedAt:  s.logged_at,
    reps:       s.reps      ?? 8,
    weight:     s.weight_kg ?? 0,
    done:       s.completed ?? false,   // persisted from DB
    prevReps:   prevSets[idx]?.reps   ?? 0,
    prevWeight: prevSets[idx]?.weight ?? 0,
    rir:        s.rir ?? null,
  };
}

const EMPTY_PREV = { sets: [], count: 0, bestWeight: 0, bestReps: 0 };

function adaptExercise(we, prevData = EMPTY_PREV) {
  // prevData is now { sets, count, bestWeight, bestReps } — keep backward compat with bare []
  const prevSets = Array.isArray(prevData) ? prevData : (prevData.sets ?? []);
  const ex   = we.exercises;
  const sets = (we.sets ?? [])
    .sort((a, b) => a.set_number - b.set_number)
    .map((s, i) => adaptSet(s, prevSets, i));

  return {
    id:             we.id,
    exerciseId:     we.exercise_id,
    _order:         we.order_index ?? 0,
    _ex: ex ? {
      id:        ex.id,
      name:      ex.name,
      primary:   Array.isArray(ex.primary_muscle)    ? ex.primary_muscle    : [ex.primary_muscle].filter(Boolean),
      secondary: Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : [],
    } : null,
    sets,
    prevCount:      Array.isArray(prevData) ? prevSets.length        : (prevData.count       ?? 0),
    prevBestWeight: Array.isArray(prevData) ? 0                      : (prevData.bestWeight  ?? 0),
    prevBestReps:   Array.isArray(prevData) ? 0                      : (prevData.bestReps    ?? 0),
  };
}

// ─── Previous-session sets for overload badges ─────────────────────────────

async function fetchPrevSets(exerciseId) {
  try {
    const { data } = await supabase
      .from('workout_exercises')
      .select('id, sets(set_number, weight_kg, reps), workouts!inner(completed_at)')
      .eq('exercise_id', exerciseId)
      .not('workouts.completed_at', 'is', null);

    if (!data?.length) return EMPTY_PREV;

    // Sort desc by completed_at in JS (Supabase JS v2 can't order by joined columns)
    const sorted = data
      .filter(we => we.workouts?.completed_at)
      .sort((a, b) => new Date(b.workouts.completed_at) - new Date(a.workouts.completed_at));

    if (!sorted.length || !sorted[0].sets?.length) return EMPTY_PREV;

    const sets = sorted[0].sets
      .sort((a, b) => a.set_number - b.set_number)
      .map(s => ({ reps: s.reps ?? 0, weight: s.weight_kg ?? 0 }));

    const best = sets.reduce((b, s) => s.weight > b.weight ? s : b, { weight: 0, reps: 0 });
    return { sets, count: sets.length, bestWeight: best.weight, bestReps: best.reps };
  } catch (e) {
    console.error('[useLogger] fetchPrevSets error:', e);
    return EMPTY_PREV;
  }
}

// ─── Calorie recalculation ─────────────────────────────────────────────────
// Calls the calculate_workout_calories RPC which counts sets server-side via
// a JOIN (bypasses RLS nested-select issues) and writes calories_burned.

async function recalcCalories(workoutId, weightKg) {
  const { data, error } = await supabase.rpc('calculate_workout_calories', {
    p_workout_id: workoutId,
    p_weight_kg:  weightKg ?? 80,
  });
  if (error) { console.error('[calories] RPC error:', error); return null; }
  console.log('[calories] sets-based result from DB:', data);
  return data;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
// workoutId (optional): if provided, loads that specific workout by ID
// (including completed ones — used when navigating from dashboard "View Workout")

export function useLogger(userId, workoutId = null, userWeightKg = 80) {
  const [workout,      setWorkout]      = useState(null);
  const [exercises,    setExercises]    = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [completed,    setCompleted]    = useState(false);
  const [savedAt,      setSavedAt]      = useState(null);
  const [error,        setError]        = useState(null);

  const timers            = useRef({});
  const pendingSetWrites  = useRef({});
  const workoutRef        = useRef(null);
  const userIdRef         = useRef(null);
  const weightKgRef       = useRef(userWeightKg);
  const exercisesRef      = useRef([]);

  useEffect(() => { workoutRef.current  = workout;      }, [workout]);
  useEffect(() => { userIdRef.current   = userId;       }, [userId]);
  useEffect(() => { weightKgRef.current = userWeightKg; }, [userWeightKg]);
  useEffect(() => { exercisesRef.current = exercises;   }, [exercises]);

  // userId === undefined  → session still resolving; stay loading
  // userId === null       → confirmed no session
  // userId === 'uuid'     → authenticated; fetch from DB
  useEffect(() => {
    if (userId === undefined) return;
    if (!userId) { setLoading(false); return; }

    async function init() {
      setLoading(true);
      if (workoutId) {
        await Promise.all([loadAllExercises(), loadWorkoutById(workoutId)]);
      } else {
        await Promise.all([loadAllExercises(), loadTodayWorkout()]);
      }
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, workoutId]);

  // ── Loaders ──────────────────────────────────────────────────────────────

  async function loadAllExercises() {
    const { data, error: err } = await supabase
      .from('exercises')
      .select('id, name, primary_muscle, secondary_muscles')
      .order('name');
    if (err) { console.error('[useLogger] loadAllExercises error:', err); return; }
    if (data?.length) {
      setAllExercises(data.map(e => ({
        id:        e.id,
        name:      e.name,
        primary:   Array.isArray(e.primary_muscle)    ? e.primary_muscle    : [e.primary_muscle].filter(Boolean),
        secondary: Array.isArray(e.secondary_muscles) ? e.secondary_muscles : [],
      })));
      console.log('[useLogger] loaded', data.length, 'exercises from catalog');
    } else {
      console.warn('[useLogger] exercises catalog is empty — run 004_seed_exercises.sql');
    }
  }

  async function loadTodayWorkout() {
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { data: w, error: err } = await supabase
      .from('workouts')
      .select('id, name, created_at, completed_at, calories_burned')
      .eq('user_id', userId)
      .gte('created_at', today)
      .lt('created_at', tomorrow)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) { console.error('[useLogger] loadTodayWorkout error:', err); return; }
    if (!w)  { console.log('[useLogger] no in-progress workout today'); return; }

    console.log('[useLogger] resuming workout:', w.id, w.name);
    setWorkout(w);
    workoutRef.current = w;
    await loadExercises(w.id);
  }

  // Load a specific workout by ID — used when navigating from dashboard
  async function loadWorkoutById(id) {
    const { data: w, error: err } = await supabase
      .from('workouts')
      .select('id, name, created_at, completed_at, calories_burned')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (err) { console.error('[useLogger] loadWorkoutById error:', err); return; }
    if (!w)  { console.warn('[useLogger] workout not found:', id); return; }

    console.log('[useLogger] loaded workout by ID:', w.id, w.name, w.completed_at ? '(completed)' : '(in-progress)');
    setWorkout(w);
    workoutRef.current = w;
    await loadExercises(w.id);
  }

  async function loadExercises(workoutId) {
    const { data, error: err } = await supabase
      .from('workout_exercises')
      .select(`
        id, exercise_id, order_index,
        exercises(id, name, primary_muscle, secondary_muscles),
        sets(id, set_number, weight_kg, reps, rir, logged_at, completed)
      `)
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: true });

    if (err) { console.error('[useLogger] loadExercises error:', err); return; }
    if (!data) return;

    const adapted = await Promise.all(
      data.map(async we => {
        const prev = await fetchPrevSets(we.exercise_id);
        return adaptExercise(we, prev);
      })
    );
    setExercises(adapted);
    console.log('[useLogger] loaded', adapted.length, 'exercises for workout');
  }

  // ── Plateau Detection ─────────────────────────────────────────────────────

  async function runPlateauDetection(workoutId) {
    const exList = exercisesRef.current;
    const plateaued = [];
    for (const we of exList) {
      const { exerciseId } = we;
      const currentBest = Math.max(0, ...we.sets.map(s => (Number(s.reps)||0) * (Number(s.weight)||0)));
      if (currentBest === 0) continue;
      try {
        const { data } = await supabase
          .from('workout_exercises')
          .select('id, sets(weight_kg, reps), workouts!inner(completed_at, id)')
          .eq('exercise_id', exerciseId)
          .not('workouts.completed_at', 'is', null);
        const prev = (data ?? [])
          .filter(pw => pw.workouts?.id !== workoutId && pw.workouts?.completed_at)
          .sort((a, b) => new Date(b.workouts.completed_at) - new Date(a.workouts.completed_at))
          .slice(0, 3);
        if (prev.length < 3) continue;
        const prevBests = prev.map(pw => Math.max(0, ...(pw.sets ?? []).map(s => (s.reps ?? 0) * (s.weight_kg ?? 0))));
        if (prevBests.every(pb => currentBest <= pb)) {
          await supabase.from('workout_exercises').update({ plateaued: true }).eq('id', we.id);
          plateaued.push({ exerciseId, exerciseName: we._ex?.name ?? exerciseId });
        }
      } catch (e) {
        console.error('[useLogger] plateau detection error for', exerciseId, e);
      }
    }
    return plateaued;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const startWorkout = useCallback(async (name = 'New Workout') => {
    const uid = userIdRef.current;
    console.log('[useLogger] startWorkout → userId:', uid);
    if (!uid) { console.error('[useLogger] startWorkout: no userId'); return; }

    const { data, error: err } = await supabase
      .from('workouts')
      .insert({ user_id: uid, name, scheduled_date: new Date().toISOString().split('T')[0] })
      .select('id, name, created_at, completed_at, calories_burned')
      .single();

    if (err) { console.error('[useLogger] workouts insert error:', err); setError('Failed to start workout.'); return; }
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
    if (!workoutId) { console.error('[useLogger] addExercise: no active workout'); return; }

    console.log('[useLogger] addExercise:', ex.name, '(id:', ex.id, ')');

    const nextOrder = exercises.length;
    const tempWeId  = `opt-we-${Date.now()}`;
    const ts        = Date.now();

    // Optimistic: show exercise immediately with temp IDs
    setExercises(prev => [...prev, {
      id: tempWeId,
      exerciseId: ex.id,
      _order: nextOrder,
      _ex:    { id: ex.id, name: ex.name, primary: ex.primary, secondary: ex.secondary },
      sets:   [1, 2, 3].map(n => ({
        id: `opt-s-${ts}-${n}`, _setNumber: n, _loggedAt: null,
        reps: 8, weight: 0, done: false, prevReps: 0, prevWeight: 0,
      })),
      prevCount: 0, prevBestWeight: 0, prevBestReps: 0,
    }]);

    const { data: weData, error: weErr } = await supabase
      .from('workout_exercises')
      .insert({ workout_id: workoutId, exercise_id: ex.id, order_index: nextOrder })
      .select('id')
      .single();

    if (weErr) {
      console.error('[useLogger] workout_exercises insert error:', weErr);
      setExercises(prev => prev.filter(e => e.id !== tempWeId));
      setError(`Could not add "${ex.name}". ${weErr.message}`);
      return;
    }
    console.log('[useLogger] workout_exercise created:', weData.id);

    const { data: setsData, error: setsErr } = await supabase
      .from('sets')
      .insert([1, 2, 3].map(n => ({
        workout_exercise_id: weData.id,
        set_number:          n,
        weight_kg:           0,
        reps:                8,
      })))
      .select('id, set_number, weight_kg, reps, rir, logged_at');

    if (setsErr) {
      console.error('[useLogger] sets insert error:', setsErr);
      setError(`Exercise added but sets failed to save. ${setsErr.message}`);
    } else {
      console.log('[useLogger] sets created:', setsData?.length);
    }

    const prev     = await fetchPrevSets(ex.id);
    const realSets = (setsData ?? [])
      .sort((a, b) => a.set_number - b.set_number)
      .map((s, i) => adaptSet(s, prev.sets, i));

    // Replace temp IDs with real DB IDs — also populate prev-session summary
    setExercises(prevEx => prevEx.map(e =>
      e.id === tempWeId ? {
        ...e,
        id:             weData.id,
        sets:           realSets,
        prevCount:      prev.count,
        prevBestWeight: prev.bestWeight,
        prevBestReps:   prev.bestReps,
      } : e
    ));
  }, [exercises.length]);

  const removeExercise = useCallback(async (weId) => {
    setExercises(prev => prev.filter(e => e.id !== weId));
    if (!weId.startsWith('opt-')) {
      const { error: err } = await supabase.from('workout_exercises').delete().eq('id', weId);
      if (err) console.error('[useLogger] removeExercise error:', err);
    }
  }, []);

  // Optimistic update + debounced DB write per set (500 ms)
  const logSet = useCallback((weId, setId, updates) => {
    // Optimistic UI update immediately
    setExercises(prev => prev.map(we =>
      we.id !== weId ? we : {
        ...we,
        sets: we.sets.map(s => s.id !== setId ? s : { ...s, ...updates }),
      }
    ));

    // Skip DB write if either the set ID or the workout_exercise ID is still a temp
    if (setId.startsWith('opt-') || weId.startsWith('opt-')) {
      console.log('[useLogger] logSet: skipping DB write — temp ID (setId:', setId, 'weId:', weId, ')');
      return;
    }

    const db = { logged_at: new Date().toISOString() };
    if ('reps'   in updates) db.reps      = updates.reps;
    if ('weight' in updates) db.weight_kg = (updates.weight === '' ? null : updates.weight);
    if ('done'   in updates) db.completed = updates.done ?? false;

    // Track the latest payload so completeWorkout can flush immediately
    pendingSetWrites.current[setId] = db;

    clearTimeout(timers.current[setId]);
    timers.current[setId] = setTimeout(async () => {
      delete pendingSetWrites.current[setId];
      console.log('[useLogger] logSet DB write → set:', setId, db);
      const { error: err } = await supabase.from('sets').update(db).eq('id', setId);
      if (err) { console.error('[useLogger] logSet update error:', err, 'set:', setId); return; }
      setSavedAt(Date.now());
      // Recalculate calories from real DB set count
      const wId = workoutRef.current?.id;
      if (wId) {
        try {
          await recalcCalories(wId, weightKgRef.current);
        } catch (e) {
          console.error('[useLogger] recalc error after logSet:', e);
        }
      }
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
        id: tempId, _setNumber: nextNum, _loggedAt: null,
        reps:       last?.reps    || 8,
        weight:     last?.weight  || 0,
        done:       false,
        prevReps:   last?.prevReps   || 0,
        prevWeight: last?.prevWeight || 0,
      };

      if (!weId.startsWith('opt-')) {
        supabase
          .from('sets')
          .insert({
            workout_exercise_id: weId,
            set_number:          nextNum,
            weight_kg:           last?.weight || 0,
            reps:                last?.reps   || 8,
          })
          .select('id, set_number, weight_kg, reps, logged_at')
          .single()
          .then(({ data, error: err }) => {
            if (err) {
              console.error('[useLogger] addSetToExercise insert error:', err);
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
              const wId = workoutRef.current?.id;
              if (wId) recalcCalories(wId, weightKgRef.current).catch(() => {});
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
    if (!setId.startsWith('opt-')) {
      const { error: err } = await supabase.from('sets').delete().eq('id', setId);
      if (err) { console.error('[useLogger] removeSetFromExercise error:', err); return; }
      const wId = workoutRef.current?.id;
      if (wId) recalcCalories(wId, weightKgRef.current).catch(() => {});
    }
  }, []);

  // Returns { success: true, calsBurned } on success, false on failure
  const completeWorkout = useCallback(async () => {
    if (!workoutRef.current?.id) {
      console.error('[useLogger] completeWorkout: no active workout');
      return false;
    }

    // 1. Flush all debounced set writes immediately before completing
    const pending = Object.entries(pendingSetWrites.current);
    if (pending.length) {
      console.log('[useLogger] flushing', pending.length, 'pending set write(s) before completing');
      pending.forEach(([id]) => clearTimeout(timers.current[id]));
      pendingSetWrites.current = {};
      await Promise.all(pending.map(([setId, db]) =>
        supabase.from('sets').update(db).eq('id', setId).then(({ error: err }) => {
          if (err) console.error('[useLogger] flush error for set', setId, err);
          else     console.log('[useLogger] flushed set', setId, db);
        })
      ));
    }

    // 2. Mark workout complete first (sets the completed_at timestamp)
    const now = new Date().toISOString();
    const wId = workoutRef.current.id;
    console.log('[useLogger] completing workout:', wId);
    const { data, error: err } = await supabase
      .from('workouts')
      .update({ completed_at: now })
      .eq('id', wId)
      .select('id, completed_at')
      .single();

    console.log('[useLogger] completeWorkout response →', { data, err });

    if (err) {
      console.error('[useLogger] completeWorkout failed:', err);
      setError('Failed to save workout. Please try again.');
      return false;
    }

    // 3. Calculate calories from real DB set count and write back
    const calsBurned = await recalcCalories(wId, weightKgRef.current) ?? 0;

    // 4. Update local state and trigger redirect
    console.log('[useLogger] workout saved ✓ calsBurned:', calsBurned);
    setWorkout(w => w ? { ...w, completed_at: now, calories_burned: calsBurned } : w);
    setCompleted(true);

    const plateaus = await runPlateauDetection(wId);
    return { success: true, calsBurned, plateaus };
  }, []);

  // ── Reset timer (FIX: resets only created_at, never touches sets) ─────────
  const resetTimer = useCallback(async () => {
    const wId = workoutRef.current?.id;
    if (!wId) return false;
    const now = new Date().toISOString();
    const { error: err } = await supabase
      .from('workouts')
      .update({ created_at: now })
      .eq('id', wId);
    if (err) { console.error('[useLogger] resetTimer error:', err); return false; }
    // Update local state so the timer effect re-fires with the new start time
    setWorkout(w => w ? { ...w, created_at: now } : w);
    workoutRef.current = { ...workoutRef.current, created_at: now };
    console.log('[useLogger] timer reset → new created_at:', now);
    return true;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    workout,
    exercises,
    allExercises,
    loading,
    completed,
    savedAt,
    error,
    clearError,
    startWorkout,
    updateWorkoutName,
    addExercise,
    removeExercise,
    logSet,
    addSetToExercise,
    removeSetFromExercise,
    completeWorkout,
    resetTimer,
  };
}
