import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProfileStore } from '../store/useProfileStore';

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeStreak(completedDateStrings) {
  if (!completedDateStrings.length) return 0;
  const doneSet = new Set(completedDateStrings);
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = toDateStr(d);
    if (doneSet.has(ds)) {
      streak++;
    } else if (i === 0) {
      // today not yet completed — skip, start counting from yesterday
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export function useDashboard(userId) {
  const storeProfile = useProfileStore((s) => s.profile);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Expose a manual refetch so callers can trigger it after mutations
  const refetch = useCallback(() => setRefreshTick(t => t + 1), []);

  // Re-fetch whenever the browser tab becomes visible again
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setRefreshTick(t => t + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (!userId || !storeProfile) return;
    let cancelled = false;

    async function fetchAll() {
      try {
        setLoading(true);

        const today   = new Date();
        const todayStr    = toDateStr(today);
        const tomorrow    = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = toDateStr(tomorrow);

        const monday  = getMondayOfWeek(today);
        const sunday  = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const weekStart = toDateStr(monday);
        const weekEnd   = toDateStr(sunday);

        const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 13);
        const fourteenDaysAgoStr = toDateStr(fourteenDaysAgo);

        const sixtyDaysAgo = new Date(today); sixtyDaysAgo.setDate(today.getDate() - 59);
        const sixtyDaysAgoStr = toDateStr(sixtyDaysAgo);

        const [
          nutritionTodayRes,
          workoutTodayRes,
          coachRes,
          biometricsRes,
          nutritionWeekRes,
          workoutsWeekRes,
          workoutsStreakRes,
          biometricsWeekRes,
          recentWorkoutsRes,
          eatBackRes,
          burnRes,
        ] = await Promise.all([
          // 1. Nutrition today — consumed macros + activity feed
          supabase.from('nutrition_logs')
            .select('kcal, protein_g, carbs_g, fat_g, meal_name, logged_at')
            .eq('user_id', userId)
            .gte('logged_at', todayStr)
            .lt('logged_at', tomorrowStr)
            .order('logged_at', { ascending: true }),

          // 2. Today's workout — query by scheduled_date (avoids needing created_at column)
          supabase.from('workouts')
            .select('id, name, completed_at, calories_burned, workout_exercises(id, exercises(name), sets(id, reps))')
            .eq('user_id', userId)
            .eq('scheduled_date', todayStr)
            .order('completed_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle(),

          // 3. Latest unapplied coach recommendation
          supabase.from('coach_recommendations')
            .select('id, decision, narrative')
            .eq('user_id', userId)
            .eq('applied', false)
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

          // 4. Biometrics last 14 days — sparkline + current weight
          supabase.from('biometric_entries')
            .select('weight_kg, logged_at')
            .eq('user_id', userId)
            .gte('logged_at', fourteenDaysAgoStr)
            .lte('logged_at', todayStr)
            .order('logged_at', { ascending: true }),

          // 5. Nutrition this week — avg kcal / protein
          supabase.from('nutrition_logs')
            .select('kcal, protein_g, logged_at')
            .eq('user_id', userId)
            .gte('logged_at', weekStart)
            .lte('logged_at', weekEnd),

          // 6. Workouts this week — adherence + set count
          supabase.from('workouts')
            .select('id, scheduled_date, completed_at, workout_exercises(id, sets(id))')
            .eq('user_id', userId)
            .gte('scheduled_date', weekStart)
            .lte('scheduled_date', weekEnd),

          // 7. Completed workouts last 60 days — streak (use completed_at, not scheduled_date)
          supabase.from('workouts')
            .select('completed_at')
            .eq('user_id', userId)
            .not('completed_at', 'is', null)
            .gte('completed_at', sixtyDaysAgoStr),

          // 8. Biometrics this week — adherence weight column
          supabase.from('biometric_entries')
            .select('logged_at')
            .eq('user_id', userId)
            .gte('logged_at', weekStart)
            .lte('logged_at', weekEnd),

          // 9. Recent completed workouts — last 3
          supabase.from('workouts')
            .select('id, name, completed_at, workout_exercises(id)')
            .eq('user_id', userId)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(3),

          // 10. eat_back_calories from the settings table (confirmed schema)
          supabase.from('settings')
            .select('eat_back_calories')
            .eq('user_id', userId)
            .maybeSingle(),

          // 11. Today's calories burned — filter by completed_at so workouts
          //     started yesterday but finished today are captured correctly
          supabase.from('workouts')
            .select('calories_burned')
            .eq('user_id', userId)
            .not('completed_at', 'is', null)
            .gte('completed_at', todayStr)
            .lt('completed_at', tomorrowStr)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const firstErr = [
          nutritionTodayRes, workoutTodayRes, coachRes,
          biometricsRes, nutritionWeekRes, workoutsWeekRes, workoutsStreakRes,
          biometricsWeekRes, recentWorkoutsRes,
        ].find(r => r.error)?.error;
        if (firstErr) throw new Error(firstErr.message);

        // ── Profile (from Zustand store, fetched once at app boot) ──
        const profile = storeProfile;
        const targets = profile?.current_macros ?? { kcal: 2000, protein: 150, carbs: 200, fat: 65 };

        // eat_back_calories — read from settings table (not Zustand cache, not profiles).
        const eatBackCalories = (!eatBackRes.error && eatBackRes.data?.eat_back_calories) || false;

        // ── Nutrition today ──
        const nlToday = nutritionTodayRes.data ?? [];
        const consumed = {
          kcal:       nlToday.reduce((s, r) => s + (r.kcal      ?? 0), 0),
          protein:    nlToday.reduce((s, r) => s + (r.protein_g ?? 0), 0),
          carbs:      nlToday.reduce((s, r) => s + (r.carbs_g   ?? 0), 0),
          fat:        nlToday.reduce((s, r) => s + (r.fat_g     ?? 0), 0),
          mealsLogged: nlToday.length,
        };

        // ── Activity feed (today's meals + completed workout) ──
        const activityFeed = nlToday.map(r => ({
          time: new Date(r.logged_at).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false,
          }),
          type: 'meal',
          text: `${r.meal_name || 'Meal'} · ${r.kcal ?? 0} kcal`,
        }));
        const workoutRaw = workoutTodayRes.data;
        if (workoutRaw?.completed_at) {
          activityFeed.unshift({
            time: new Date(workoutRaw.completed_at).toLocaleTimeString('en-US', {
              hour: '2-digit', minute: '2-digit', hour12: false,
            }),
            type: 'workout',
            text: `${workoutRaw.name || 'Workout'} · ${workoutRaw.workout_exercises?.length ?? 0} exercises completed`,
          });
        }

        // ── Workout today ──
        const allWeSets   = (workoutRaw?.workout_exercises ?? []).flatMap(we => we.sets ?? []);
        const exCount     = workoutRaw?.workout_exercises?.length ?? 0;
        // calories_burned: use the explicit completed_at query (burnRes) as primary source.
        // Falls back to workoutRaw.calories_burned for the same-day created+completed case.
        const calsBurned = burnRes.data?.calories_burned != null
          ? burnRes.data.calories_burned
          : (workoutRaw?.completed_at ? (workoutRaw?.calories_burned ?? null) : null);
        const adjustedKcal = eatBackCalories && calsBurned
          ? targets.kcal + Math.round(calsBurned)
          : targets.kcal;
        const adjustedTargets = { ...targets, kcal: adjustedKcal };

        const workout = workoutRaw ? {
          id:               workoutRaw.id,
          name:             workoutRaw.name,
          completed:        !!workoutRaw.completed_at,
          exercises:        (workoutRaw.workout_exercises ?? []).map(we => ({
            name: we.exercises?.name ?? 'Exercise',
            sets: (we.sets ?? []).length,
          })),
          exerciseCount:    exCount,
          setCount:         allWeSets.length,
          totalReps:        allWeSets.reduce((s, set) => s + (set.reps ?? 0), 0),
          estimatedMinutes: exCount * 12,
          duration:         null,
        } : null;

        // ── Coach recommendation ──
        const coachRaw = coachRes.data;
        const coach = coachRaw ? {
          id:      coachRaw.id,
          headline: coachRaw.decision?.kcalDelta != null
            ? `${coachRaw.decision.kcalDelta > 0 ? '+' : ''}${coachRaw.decision.kcalDelta} kcal`
            : (coachRaw.decision?.label ?? 'New recommendation'),
          summary: coachRaw.narrative ?? '',
          deload:  coachRaw.decision?.deload ?? false,
        } : null;

        // ── Biometrics ──
        const bioEntries = biometricsRes.data ?? [];
        const latestBio  = bioEntries.length > 0 ? bioEntries[bioEntries.length - 1] : null;
        const weekAgoBio = bioEntries.length > 1
          ? bioEntries[Math.max(0, bioEntries.length - 8)]
          : null;
        const sparkline = bioEntries.map(e => e.weight_kg).filter(Boolean);

        // ── Weekly nutrition stats ──
        const nlWeek = nutritionWeekRes.data ?? [];
        const kcalByDay    = {};
        const proteinByDay = {};
        nlWeek.forEach(r => {
          const d = r.logged_at.split('T')[0];
          kcalByDay[d]    = (kcalByDay[d]    ?? 0) + (r.kcal      ?? 0);
          proteinByDay[d] = (proteinByDay[d] ?? 0) + (r.protein_g ?? 0);
        });
        const daysWithNutrition = Object.keys(kcalByDay);
        const avgKcal    = daysWithNutrition.length
          ? Math.round(Object.values(kcalByDay).reduce((s, v) => s + v, 0) / daysWithNutrition.length)
          : 0;
        const avgProtein = daysWithNutrition.length
          ? Math.round(Object.values(proteinByDay).reduce((s, v) => s + v, 0) / daysWithNutrition.length)
          : 0;

        // ── Total sets this week ──
        const workoutsWeek = workoutsWeekRes.data ?? [];
        const totalSets = workoutsWeek
          .flatMap(w => w.workout_exercises ?? [])
          .flatMap(we => we.sets ?? [])
          .length;

        // ── Streak — dedupe by date (multiple workouts same day count once) ──
        const completedDates = [
          ...new Set(
            (workoutsStreakRes.data ?? [])
              .map(w => w.completed_at?.split('T')[0])
              .filter(Boolean)
          ),
        ];
        const streak = computeStreak(completedDates);

        // ── Weekly adherence grid ──
        const completedWorkoutDates = new Set(
          workoutsWeek.filter(w => !!w.completed_at).map(w => w.scheduled_date),
        );
        const scheduledWorkoutDates = new Set(workoutsWeek.map(w => w.scheduled_date));
        const nutritionDates        = new Set(daysWithNutrition);
        const biometricWeekDates    = new Set(
          (biometricsWeekRes.data ?? []).map(b => b.logged_at),
        );

        const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const weeklyAdherence = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const ds      = toDateStr(d);
          const isToday = ds === todayStr;
          const isFuture = d > today && !isToday;
          const hasWorkout = scheduledWorkoutDates.has(ds);
          return {
            day:     DAY_LABELS[d.getDay()],
            label:   d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            workout: isFuture ? false : !hasWorkout ? null : completedWorkoutDates.has(ds),
            meals:   isFuture ? false : nutritionDates.has(ds),
            weight:  isFuture ? false : biometricWeekDates.has(ds),
            today:   isToday,
            future:  isFuture,
            rest:    !hasWorkout,
          };
        });

        if (!cancelled) {
          const recentWorkouts = (recentWorkoutsRes.data ?? []).map(w => ({
            id:            w.id,
            name:          w.name || 'Workout',
            completedAt:   w.completed_at,
            exerciseCount: w.workout_exercises?.length ?? 0,
          }));

          setData({
            profile,
            targets,
            adjustedTargets,
            calsBurned,
            eatBackCalories,
            consumed,
            workout,
            coach,
            biometrics: {
              current: latestBio?.weight_kg  ?? null,
              weekAgo: weekAgoBio?.weight_kg ?? null,
              goal:    profile?.goal_weight_kg ?? null,
              sparkline,
            },
            weeklyStats: { totalSets, avgKcal, avgProtein, streak },
            weeklyAdherence,
            activityFeed,
            recentWorkouts,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [userId, storeProfile, refreshTick]);

  return { data, loading, error, refetch };
}
