import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function toDateStr(d) {
  return d.toISOString().split('T')[0];
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
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!userId) return;
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
          profileRes,
          nutritionTodayRes,
          workoutTodayRes,
          coachRes,
          biometricsRes,
          nutritionWeekRes,
          workoutsWeekRes,
          workoutsStreakRes,
          biometricsWeekRes,
          recentWorkoutsRes,
        ] = await Promise.all([
          // 1. Profile — targets + display info
          supabase.from('profiles')
            .select('display_name, subscription_tier, current_macros, goal, goal_weight_kg')
            .eq('id', userId)
            .single(),

          // 2. Nutrition today — consumed macros + activity feed
          supabase.from('nutrition_logs')
            .select('kcal, protein_g, carbs_g, fat_g, meal_name, logged_at')
            .eq('user_id', userId)
            .gte('logged_at', todayStr)
            .lt('logged_at', tomorrowStr)
            .order('logged_at', { ascending: true }),

          // 3. Today's workout — match by created_at so Logger workouts (no scheduled_date) appear
          supabase.from('workouts')
            .select('id, name, created_at, completed_at, workout_exercises(id, exercises(name), sets(id, reps))')
            .eq('user_id', userId)
            .gte('created_at', todayStr)
            .lt('created_at', tomorrowStr)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

          // 4. Latest unapplied coach recommendation
          supabase.from('coach_recommendations')
            .select('id, decision, narrative')
            .eq('user_id', userId)
            .eq('applied', false)
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

          // 5. Biometrics last 14 days — sparkline + current weight
          supabase.from('biometric_entries')
            .select('weight_kg, logged_at')
            .eq('user_id', userId)
            .gte('logged_at', fourteenDaysAgoStr)
            .lte('logged_at', todayStr)
            .order('logged_at', { ascending: true }),

          // 6. Nutrition this week — avg kcal / protein
          supabase.from('nutrition_logs')
            .select('kcal, protein_g, logged_at')
            .eq('user_id', userId)
            .gte('logged_at', weekStart)
            .lte('logged_at', weekEnd),

          // 7. Workouts this week — adherence + set count
          supabase.from('workouts')
            .select('id, scheduled_date, completed_at, workout_exercises(id, sets(id))')
            .eq('user_id', userId)
            .gte('scheduled_date', weekStart)
            .lte('scheduled_date', weekEnd),

          // 8. Completed workouts last 60 days — streak (use completed_at, not scheduled_date)
          supabase.from('workouts')
            .select('completed_at')
            .eq('user_id', userId)
            .not('completed_at', 'is', null)
            .gte('completed_at', sixtyDaysAgoStr),

          // 9. Biometrics this week — adherence weight column
          supabase.from('biometric_entries')
            .select('logged_at')
            .eq('user_id', userId)
            .gte('logged_at', weekStart)
            .lte('logged_at', weekEnd),

          // 10. Recent completed workouts — last 3
          supabase.from('workouts')
            .select('id, name, completed_at, workout_exercises(id)')
            .eq('user_id', userId)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(3),
        ]);

        if (cancelled) return;

        const firstErr = [
          profileRes, nutritionTodayRes, workoutTodayRes, coachRes,
          biometricsRes, nutritionWeekRes, workoutsWeekRes, workoutsStreakRes,
          biometricsWeekRes, recentWorkoutsRes,
        ].find(r => r.error)?.error;
        if (firstErr) throw new Error(firstErr.message);

        // ── Profile ──
        const profile = profileRes.data;
        const targets = profile?.current_macros ?? { kcal: 2000, protein: 150, carbs: 200, fat: 65 };

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
        const allWeSets = (workoutRaw?.workout_exercises ?? []).flatMap(we => we.sets ?? []);
        const workout = workoutRaw ? {
          id:           workoutRaw.id,
          name:         workoutRaw.name,
          completed:    !!workoutRaw.completed_at,
          exercises:    (workoutRaw.workout_exercises ?? []).map(we => ({
            name: we.exercises?.name ?? 'Exercise',
            sets: (we.sets ?? []).length,
          })),
          exerciseCount: workoutRaw.workout_exercises?.length ?? 0,
          setCount:      allWeSets.length,
          totalReps:     allWeSets.reduce((s, set) => s + (set.reps ?? 0), 0),
          duration:      workoutRaw.completed_at
            ? `${Math.round((new Date(workoutRaw.completed_at) - new Date(workoutRaw.created_at)) / 60000)} min`
            : null,
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
  }, [userId]);

  return { data, loading, error };
}
