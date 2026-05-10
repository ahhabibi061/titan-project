import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Recovery window in hours per muscle key (matches SVG path keys in LoggerPage)
// "shoulders" spec → front_delts / side_delts / rear_delts (48 hr)
// "back"      spec → lats / lower_back (72 hr)
// "obliques"  not in spec → same window as abs (24 hr)
const RECOVERY_HOURS = {
  chest:       72,
  lats:        72, lower_back:  72,
  quads:       72, hamstrings:  72, glutes:      72,
  front_delts: 48, side_delts:  48, rear_delts:  48,
  triceps:     48, biceps:      48,
  traps:       36, calves:      36,
  abs:         24, obliques:    24, forearms:    24,
};

// Compute volume (weight_kg × reps) per primary muscle from DB workout_exercises rows.
// primary_muscle in the exercises table is stored as a single string ('chest', 'lats', …).
function dbMuscleVolume(workoutExercises) {
  const vol = {};
  for (const we of (workoutExercises ?? [])) {
    const raw = we.exercises?.primary_muscle;
    if (!raw) continue;
    const muscles = Array.isArray(raw) ? raw : [raw];
    for (const m of muscles) {
      const key = String(m).toLowerCase().trim();
      const weVol = (we.sets ?? []).reduce(
        (sum, s) => sum + ((s.weight_kg ?? 0) * (s.reps ?? 0)), 0
      );
      vol[key] = (vol[key] ?? 0) + weVol;
    }
  }
  return vol;
}

// Compute volume from the live in-progress exercises (client-side representation).
// Sets use 'weight' (not 'weight_kg') after adaptSet normalisation in useLogger.
function liveMuscleVolume(exercises) {
  const vol = {};
  for (const we of (exercises ?? [])) {
    const muscles = we._ex?.primary ?? [];
    for (const m of muscles) {
      const weVol = (we.sets ?? []).reduce(
        (sum, s) => sum + ((Number(s.weight) || 0) * (Number(s.reps) || 0)), 0
      );
      vol[m] = (vol[m] ?? 0) + weVol;
    }
  }
  return vol;
}

export function useBodyMap(userId, currentExercises) {
  const [mode, setMode] = useState('recovery'); // 'recovery' | 'growth'
  const [pastWorkouts, setPastWorkouts] = useState([]);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('workouts')
      .select(`
        id, completed_at,
        workout_exercises(
          id, exercise_id,
          exercises(primary_muscle),
          sets(weight_kg, reps)
        )
      `)
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(10);
    if (error) { console.error('[useBodyMap] history fetch error:', error); return; }
    setPastWorkouts(data ?? []);
  }, [userId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Recovery map ─────────────────────────────────────────────────────────
  const recoveryMap = useMemo(() => {
    const now = Date.now();
    const result = {};
    for (const muscle of Object.keys(RECOVERY_HOURS)) {
      // pastWorkouts is already ordered desc — first match = most recent session
      let lastWorkout = null;
      let lastVol = 0;
      for (const w of pastWorkouts) {
        const volMap = dbMuscleVolume(w.workout_exercises);
        if ((volMap[muscle] ?? 0) > 0) {
          lastWorkout = w;
          lastVol = volMap[muscle];
          break;
        }
      }
      if (!lastWorkout) {
        result[muscle] = { pct: null, hoursRemaining: null, status: 'no_data' };
        continue;
      }
      let windowHrs = RECOVERY_HOURS[muscle];
      if (lastVol > 8000) windowHrs += 24; // high-volume session extends recovery
      const hoursSince = (now - new Date(lastWorkout.completed_at).getTime()) / 3_600_000;
      const pct = Math.min(100, (hoursSince / windowHrs) * 100);
      const hoursRemaining = Math.max(0, Math.round(windowHrs - hoursSince));
      const status = pct >= 100 ? 'ready'
        : pct >= 67 ? 'almost'
        : pct >= 34 ? 'partial'
        : 'resting';
      result[muscle] = { pct: Math.round(pct), hoursRemaining, status };
    }
    return result;
  }, [pastWorkouts]);

  // ── Current session volumes (recomputes every time a set is logged) ──────
  const curVols = useMemo(() => liveMuscleVolume(currentExercises), [currentExercises]);

  // ── Growth map ────────────────────────────────────────────────────────────
  const growthMap = useMemo(() => {
    const result = {};
    for (const [muscle, currentVol] of Object.entries(curVols)) {
      if (currentVol === 0) continue;
      // Find most recent prior completed session that trained this muscle
      let prevVol = null;
      for (const w of pastWorkouts) {
        const volMap = dbMuscleVolume(w.workout_exercises);
        if ((volMap[muscle] ?? 0) > 0) {
          prevVol = volMap[muscle];
          break;
        }
      }
      if (prevVol === null) {
        result[muscle] = { currentVol: Math.round(currentVol), prevVol: null, growthPct: null, status: 'first' };
        continue;
      }
      const growthPct = prevVol > 0 ? ((currentVol - prevVol) / prevVol) * 100 : null;
      const status = growthPct === null ? 'first'
        : growthPct > 10  ? 'pr'
        : growthPct >= 0  ? 'improved'
        : growthPct >= -10 ? 'regressed'
        : 'dropped';
      result[muscle] = {
        currentVol: Math.round(currentVol),
        prevVol:    Math.round(prevVol),
        growthPct:  growthPct !== null ? Math.round(growthPct) : null,
        status,
      };
    }
    return result;
  }, [curVols, pastWorkouts]);

  return { mode, setMode, recoveryMap, growthMap };
}
