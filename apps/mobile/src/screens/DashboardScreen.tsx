import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useTodayWorkout, useWeeklyWorkouts, useWeeklySets, useActivityFeed, useWeeklyMuscleVolumes } from '../hooks/useWorkout';
import { useBiometricEntries } from '../hooks/useVault';
import { useDailyNutrition, useWeeklyNutritionDays, useWeeklyWaterDays } from '../hooks/useNutrition';
import { useProfile } from '../hooks/useSettings';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { BodyMapDual } from '../components/MuscleMap';

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

const MOCK_PROFILE  = { display_name: 'Marcus', subscription_tier: 'elite', goal: 'cut' };
const MOCK_CONSUMED = { kcal: 1840, protein: 142, carbs: 187, fat: 52, mealsLogged: 3 };
const MOCK_TARGETS  = { kcal: 2400, protein: 180, carbs: 240, fat: 80 };

const MOCK_WORKOUT = {
  id: 'w1',
  name: 'Push A',
  exercises: [
    { name: 'Bench Press',        sets: 4 },
    { name: 'Incline DB Press',   sets: 3 },
    { name: 'Cable Fly',          sets: 3 },
    { name: 'Tricep Pushdown',    sets: 3 },
    { name: 'Overhead Extension', sets: 3 },
  ],
  estimatedMinutes: 55,
  completed: false,
};

const MOCK_COACH = {
  headline: 'INCREASE BENCH INTENSITY',
  summary: "You're ready for a 5% load increase on bench press based on your last 3 sessions.",
};

const MOCK_BIO = {
  current:   88.4,
  weekAgo:   89.1,
  goal:      85.0,
  sparkline: [89.8, 89.5, 89.2, 89.1, 88.8, 88.6, 88.4],
};

const MOCK_WEEKLY_STATS = { totalSets: 87, avgKcal: 2280, avgProtein: 168, streak: 12 };

const MOCK_RECOVERY_MAP: Record<string, { status: string; pct: number; hoursRemaining: number }> = {
  quads:       { status: 'resting', pct: 28,  hoursRemaining: 36 },
  hamstrings:  { status: 'partial', pct: 55,  hoursRemaining: 18 },
  glutes:      { status: 'partial', pct: 62,  hoursRemaining: 12 },
  chest:       { status: 'almost',  pct: 80,  hoursRemaining: 6  },
  triceps:     { status: 'almost',  pct: 76,  hoursRemaining: 8  },
  front_delts: { status: 'almost',  pct: 72,  hoursRemaining: 10 },
  lats:        { status: 'ready',   pct: 100, hoursRemaining: 0  },
  biceps:      { status: 'ready',   pct: 100, hoursRemaining: 0  },
  rear_delts:  { status: 'ready',   pct: 100, hoursRemaining: 0  },
  calves:      { status: 'ready',   pct: 100, hoursRemaining: 0  },
  lower_back:  { status: 'partial', pct: 58,  hoursRemaining: 14 },
};

const MUSCLE_DATA = {
  weeklyVolume: {
    chest: 4200, front_delts: 1800, side_delts: 900,  triceps: 2100,
    lats: 3800,  biceps: 1600,      rear_delts: 800,  traps: 600,
    quads: 8400, hamstrings: 4200,  glutes: 3100,     calves: 1200,
    abs: 900,    lower_back: 1400,  forearms: 600,
  } as Record<string, number>,
  progression: {
    chest: -8.2, front_delts: -3.1, side_delts: 2.4, triceps: 1.5,
    lats: 4.2,   biceps: 0.5,       rear_delts: 1.8, traps: -1.2,
    quads: -5.4, hamstrings: -1.8,  glutes: 2.1,     calves: 3.0,
    abs: 0,      lower_back: -2.0,  forearms: 0,
  } as Record<string, number>,
};

// Computed like the web version — includes currentVol/prevVol for tooltip and summary
const MOCK_GROWTH_MAP: Record<string, { status: string; growthPct: number; currentVol: number; prevVol: number }> = (() => {
  const m: Record<string, any> = {};
  for (const [key, vol] of Object.entries(MUSCLE_DATA.weeklyVolume)) {
    const pct = MUSCLE_DATA.progression[key] ?? 0;
    if (pct === 0) continue;
    const status = pct > 10 ? 'pr' : pct > 0 ? 'improved' : pct > -10 ? 'regressed' : 'dropped';
    m[key] = { status, growthPct: Math.round(pct * 10) / 10, currentVol: Math.round(vol), prevVol: Math.round(vol / (1 + pct / 100)) };
  }
  return m;
})();


// ─── WEEKLY ADHERENCE DATA ───────────────────────────────────────────────────

interface DayAdherence {
  day: string; label: string; today: boolean; future: boolean; rest: boolean;
  workout: boolean; meals: boolean; weight: boolean; water: boolean;
  workoutId?: string;
}
interface ActivityItem { time: string; type: string; text: string; }

const MOCK_WEEKLY: DayAdherence[] = [
  { day: 'MON', label: 'May 11', today: false, future: false, rest: false, workout: true,  meals: true,  weight: true  },
  { day: 'TUE', label: 'May 12', today: false, future: false, rest: false, workout: true,  meals: true,  weight: true  },
  { day: 'WED', label: 'May 13', today: false, future: false, rest: true,  workout: false, meals: true,  weight: true  },
  { day: 'THU', label: 'May 14', today: false, future: false, rest: false, workout: true,  meals: false, weight: true  },
  { day: 'FRI', label: 'May 15', today: false, future: false, rest: false, workout: true,  meals: true,  weight: true  },
  { day: 'SAT', label: 'May 16', today: true,  future: false, rest: false, workout: false, meals: true,  weight: true  },
  { day: 'SUN', label: 'May 17', today: false, future: true,  rest: false, workout: false, meals: false, weight: false },
];

const MOCK_ACTIVITY: ActivityItem[] = [
  { time: '07:14', type: 'weight',  text: 'Logged 88.4 kg'                           },
  { time: '08:30', type: 'meal',    text: 'Breakfast — 624 kcal, 48g protein'         },
  { time: '10:00', type: 'coach',   text: 'Oracle: Bench intensity increased'         },
  { time: '12:45', type: 'meal',    text: 'Lunch — 720 kcal, 58g protein'             },
  { time: '14:10', type: 'water',   text: 'Water — 500ml (2.1L total)'                },
  { time: '16:00', type: 'meal',    text: 'Pre-workout shake — 496 kcal, 36g protein' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US');

// ─── ACTIVITY ICON ───────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  const color = type === 'coach' ? COLORS.orange300 : type === 'water' ? COLORS.blue400 : COLORS.text400;
  switch (type) {
    case 'meal':    return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"><Path d="M3 3v8M3 7h2M11 3v8M11 7c-1.5 0-2-1-2-2V3" /></Svg>;
    case 'weight':  return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5}><Path d="M2 4h10v7H2z" /><Path d="M5 4V3h4v1" /><Path d="M5 7h4" /></Svg>;
    case 'workout': return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"><Path d="M2 7h2M10 7h2M4 5v4M10 5v4M5 6h4v2H5z" /></Svg>;
    case 'coach':   return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5}><Circle cx="7" cy="7" r="5" /><Path d="M7 4v3l2 1" /></Svg>;
    case 'water':   return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5}><Path d="M7 2L4 7a3 3 0 006 0L7 2z" /></Svg>;
    default:        return <Svg width={14} height={14} viewBox="0 0 14 14"><Circle cx="7" cy="7" r="2" fill={color} /></Svg>;
  }
}

// ─── CALORIE RING ─────────────────────────────────────────────────────────────

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const pct = Math.min(consumed / (target || 1), 1);
  const r = 36, c = 2 * Math.PI * r;
  return (
    <View style={s.ringWrap}>
      <Svg width={96} height={96} viewBox="0 0 88 88" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%"   stopColor="#fbbf24" />
            <Stop offset="100%" stopColor="#ff5a2a" />
          </LinearGradient>
        </Defs>
        <Circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <Circle cx="44" cy="44" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={6}
          strokeLinecap="round" strokeDasharray={`${(pct * c).toFixed(1)} ${c.toFixed(1)}`} />
      </Svg>
      <View style={[StyleSheet.absoluteFillObject, s.ringLabel]}>
        <Text style={s.ringNum}>{fmt0(consumed)}</Text>
        <Text style={s.ringSub}>/{fmt0(target)}</Text>
      </View>
    </View>
  );
}

// ─── MINI SPARKLINE ──────────────────────────────────────────────────────────

function MiniSparkline({ values, bfValues }: { values: number[]; bfValues?: (number | null)[] }) {
  if (!values || values.length < 2) return null;
  const W = 120, H = 30;
  const n = values.length;

  // Weight line (orange)
  const wMin = Math.min(...values), wMax = Math.max(...values), wRange = wMax - wMin || 1;
  const wPts = values.map((v, i) => ({ x: (i / (n - 1)) * W, y: H - 2 - ((v - wMin) / wRange) * (H - 4) }));
  const wPath = wPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const wLast = wPts[n - 1];

  // BF% line (yellow) — dual Y axis, independent scale
  const bfValid = (bfValues ?? []).filter((v): v is number => v != null);
  const showBf = bfValid.length >= 2;
  let bfPath = '';
  const bfDots: { x: number; y: number }[] = [];

  if (showBf && bfValues) {
    const bfMin = Math.min(...bfValid), bfMax = Math.max(...bfValid), bfRange = bfMax - bfMin || 1;
    let segmentStarted = false;
    bfValues.forEach((v, i) => {
      const x = (i / (n - 1)) * W;
      if (v == null) { segmentStarted = false; return; }
      const y = H - 2 - ((v - bfMin) / bfRange) * (H - 4);
      bfDots.push({ x, y });
      bfPath += segmentStarted ? `L ${x.toFixed(1)},${y.toFixed(1)} ` : `M ${x.toFixed(1)},${y.toFixed(1)} `;
      segmentStarted = true;
    });
  }

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Path d={wPath} stroke={COLORS.accent} strokeWidth={1.5} fill="none" />
      <Circle cx={wLast.x} cy={wLast.y} r={2} fill={COLORS.accent} />
      {showBf && bfPath ? (
        <>
          <Path d={bfPath.trim()} stroke="#facc15" strokeWidth={1.5} fill="none" />
          {bfDots.map((dot, i) => <Circle key={i} cx={dot.x} cy={dot.y} r={2} fill="#facc15" />)}
        </>
      ) : null}
    </Svg>
  );
}

// ─── WEEKLY GRID ─────────────────────────────────────────────────────────────

function cellColor(status: string) {
  if (status === 'done')   return COLORS.accent;
  if (status === 'missed') return 'rgba(239,68,68,0.2)';
  if (status === 'rest')   return '#292524';
  return 'transparent';
}

function getCellStatus(d: DayAdherence, key: 'workout' | 'meals' | 'weight' | 'water') {
  if (d.future) return 'future';
  if (key === 'workout') { if (d.rest) return 'rest'; return d.workout ? 'done' : (d.today ? 'future' : 'missed'); }
  return d[key] ? 'done' : (d.today || d.future ? 'future' : 'missed');
}

function WeeklyGrid({ days, navigation }: { days: DayAdherence[]; navigation: any }) {
  const rows: { key: 'workout' | 'meals' | 'weight' | 'water'; label: string }[] = [
    { key: 'workout', label: 'Workout'   },
    { key: 'meals',   label: 'Nutrition' },
    { key: 'weight',  label: 'Weight'    },
    { key: 'water',   label: 'Water'     },
  ];
  return (
    <View>
      <View style={s.gridRow}>
        {days.map((d, i) => (
          <View key={i} style={s.gridCol}>
            <Text style={[s.gridDayLabel, d.today && { color: COLORS.orange300 }]}>{d.day}</Text>
            <Text style={[s.gridDateLabel, d.today && { color: COLORS.orange400 }]}>{d.label.split(' ')[1]}</Text>
          </View>
        ))}
      </View>
      {rows.map(row => (
        <View key={row.key} style={s.gridSection}>
          <Text style={s.gridRowLabel}>{row.label}</Text>
          <View style={s.gridRow}>
            {days.map((d, i) => {
              const status = getCellStatus(d, row.key);
              const tappable = row.key === 'workout' && status === 'done' && d.workoutId;
              return (
                <TouchableOpacity
                  key={i}
                  style={s.gridCol}
                  activeOpacity={tappable ? 0.6 : 1}
                  onPress={tappable ? () => navigation.navigate('SessionReview', { workoutId: d.workoutId }) : undefined}
                >
                  <View style={[
                    s.gridCell,
                    status === 'future'
                      ? { backgroundColor: 'rgba(12,10,9,0.4)', borderWidth: 1, borderColor: 'rgba(41,37,36,0.4)' }
                      : { backgroundColor: cellColor(status) },
                    tappable && { borderWidth: 1, borderColor: 'rgba(237,122,42,0.4)' },
                  ]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      <View style={s.legendRow}>
        {([
          [COLORS.accent,           'Done'  ],
          ['rgba(248,113,113,0.2)', 'Missed'],
          ['#292524',               'Rest'  ],
        ] as [string, string][]).map(([color, label]) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}


// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [mapMode, setMapMode] = useState<'recovery' | 'growth'>('recovery');
  const [displayName, setDisplayName] = useState('');
  const [tier, setTier]               = useState('BASIC');
  const [bio, setBio]                 = useState({ current: 0, weekAgo: 0, goal: 0, sparkline: [] as number[] });
  const [weekly, setWeekly]           = useState({ totalSets: 0, avgKcal: 0, avgProtein: 0, streak: 0 });
  const [feedExpanded, setFeedExpanded] = useState(false);
  // Real-time hooks
  const { data: todayWorkout }      = useTodayWorkout();
  const { data: weeklyWorkouts }    = useWeeklyWorkouts();
  const { data: weeklySets }        = useWeeklySets();
  const { data: activityFeed }      = useActivityFeed();
  const { data: muscleVolumes }     = useWeeklyMuscleVolumes();
  const { data: biometricEntries = [] } = useBiometricEntries();
  const { data: weeklyNutritionDays }   = useWeeklyNutritionDays();
  const { data: weeklyWaterDays }       = useWeeklyWaterDays();
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local tz
  const { data: nutritionDay }      = useDailyNutrition(todayStr);
  const { data: profile }           = useProfile();
  const consumed = nutritionDay?.totals
    ? { ...nutritionDay.totals, mealsLogged: nutritionDay.logs.length }
    : { kcal: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0 };
  const targets  = profile?.current_macros
    ? { kcal: profile.current_macros.kcal, protein: profile.current_macros.protein, carbs: profile.current_macros.carbs, fat: profile.current_macros.fat }
    : { kcal: 2000, protein: 150, carbs: 200, fat: 65 };
  const qc = useQueryClient();

  // Derive bio values from biometric-entries query (auto-refreshes when Vault logs weight)
  const bioCurrent   = biometricEntries[0]?.weight_kg ?? 0;
  const bioWeekAgo   = biometricEntries.length > 1 ? biometricEntries[biometricEntries.length - 1].weight_kg : (biometricEntries[0]?.weight_kg ?? 0);
  const bfEntries    = [...biometricEntries].reverse().slice(-8);
  const bioSparkline = bfEntries.map(r => r.weight_kg);
  const bfSparkline  = bfEntries.map(r => r.body_fat_pct ?? null);

  const muscleVolumesData = muscleVolumes ?? {} as Record<string, number>;
  const muscleMaxVol = Math.max(1, ...Object.values(muscleVolumesData));

  // Refetch all dashboard queries whenever this tab gains focus
  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['today-workout'] });
    qc.invalidateQueries({ queryKey: ['weekly-workouts'] });
    qc.invalidateQueries({ queryKey: ['weekly-sets'] });
    qc.invalidateQueries({ queryKey: ['activity-feed'] });
    qc.invalidateQueries({ queryKey: ['muscle-volumes'] });
    qc.invalidateQueries({ queryKey: ['biometric-entries'] });
    qc.invalidateQueries({ queryKey: ['this-week'] });
  }, [qc]));

  // Real-time activity feed subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel('dashboard-activity')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'activity_feed',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          // useActivityFeed will re-fetch on next focus; for instant update just refetch
        })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // Compute weekly adherence grid from real data
  const days = useCallback((): DayAdherence[] => {
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    sunday.setHours(0, 0, 0, 0);

    // Biometric entries indexed by YYYY-MM-DD (logged_at is already 'YYYY-MM-DD')
    const weightDays = new Set(biometricEntries.map(e => e.logged_at));

    const LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return LABELS.map((day, i) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const isToday  = isoDate === todayStr;
      const isFuture = date > now && !isToday;
      const completedW = (weeklyWorkouts ?? []).find(w => w.started_at?.startsWith(isoDate) && w.completed);
      const mealKcal = weeklyNutritionDays?.[isoDate] ?? 0;
      const waterMl  = weeklyWaterDays?.[isoDate] ?? 0;
      return {
        day, label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        today: isToday, future: isFuture, rest: false,
        workout: !!completedW,
        meals:   mealKcal >= (targets.kcal * 0.5),
        weight:  weightDays.has(isoDate),
        water:   waterMl >= 500,
        workoutId: completedW?.id,
      };
    });
  }, [weeklyWorkouts, biometricEntries, weeklyNutritionDays, weeklyWaterDays, targets.kcal, todayStr])();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];

      // Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, subscription_tier, current_streak')
        .eq('id', user.id)
        .single();
      setDisplayName(profile?.display_name || user.email?.split('@')[0] || 'Athlete');
      if (profile?.subscription_tier) setTier(profile.subscription_tier.toUpperCase());
      if (profile?.current_streak != null) setWeekly(w => ({ ...w, streak: profile.current_streak }));

      // Nutrition is now handled by useDailyNutrition hook above

      // Weekly sets count is handled by useWeeklySets() hook above
    })();
  }, []);

  const coach = null; // populated once Oracle module is wired up

  const remaining   = targets.kcal - consumed.kcal;
  const weightDelta = bioCurrent && bioWeekAgo ? bioCurrent - bioWeekAgo : 0;
  const initials    = getInitials(displayName || 'A');

  return (
    // FIX 1: SafeAreaView handles the top notch/status-bar gap
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── 1. HEADER ROW ──────────────────────────────────────────── */}
        <View style={s.headerRow}>
          {/* FIX 3: Triangle logo to the left of wordmark */}
          <View style={s.wordmarkRow}>
            <Svg width={28} height={24} viewBox="0 0 28 24">
              <Path d="M14 0L28 24H0Z" fill={COLORS.accent} />
            </Svg>
            <Text style={s.wordmark}>IRONLAB</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: 6 }}
            >
              <Text style={{ fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text500 }}>⚙</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.avatar} onPress={() => supabase.auth.signOut()}>
              <Text style={s.avatarText}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.greeting}>{getGreeting()}, {displayName}.</Text>

        <View style={s.metaRow}>
          <View style={s.tierBadge}><Text style={s.tierText}>{tier}</Text></View>
          <Text style={s.metaDot}>·</Text>
          <Text style={s.metaText}>WEEK 1</Text>
          <Text style={s.metaDot}>·</Text>
          <Text style={[s.metaText, weekly.streak >= 7 && { color: '#fbbf24' }]}>🔥 {weekly.streak}D STREAK</Text>
        </View>

        {/* ── 2. STAT BAR — FIX 4: 2×2 grid, no scrolling ──────────── */}
        <View style={s.statGrid}>
          {/* Body Weight — top-left */}
          <View style={[s.statCard, s.statCardTL]}>
            <Text style={s.statLabel}>Weight</Text>
            <Text style={s.statValue}>{bioCurrent || '—'}<Text style={s.statUnit}> kg</Text></Text>
            <Text style={s.statSub}>{weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta).toFixed(1)} kg / 7d</Text>
          </View>

          {/* Calories Left — top-right */}
          <View style={[s.statCard, s.statCardTR]}>
            <Text style={s.statLabel}>Cal Left</Text>
            <Text style={[s.statValue, { color: COLORS.orange300 }]}>{fmt0(remaining)}</Text>
            <Text style={s.statSub}>{fmt0(consumed.kcal)} / {fmt0(targets.kcal)} kcal</Text>
          </View>

          {/* Today's Workout — bottom-left */}
          <View style={[s.statCard, s.statCardBL]}>
            <Text style={s.statLabel}>Workout</Text>
            <Text style={[s.statValue, { fontSize: 16 }]} numberOfLines={1}>{todayWorkout ? todayWorkout.name : '—'}</Text>
            <Text style={s.statSub}>{todayWorkout ? `${(todayWorkout.workout_exercises ?? []).length} ex${todayWorkout.completed ? ' · done' : ' · live'}` : 'None logged'}</Text>
          </View>

          {/* Streak — bottom-right */}
          <View style={[s.statCard, s.statCardBR]}>
            <Text style={s.statLabel}>Streak</Text>
            <Text style={[s.statValue, weekly.streak >= 7 && { color: '#fbbf24' }]}>
              🔥 {weekly.streak}<Text style={s.statUnit}> d</Text>
            </Text>
            <Text style={s.statSub}>keep going</Text>
          </View>
        </View>

        {/* ── 3. COACH ALERT BANNER ──────────────────────────────────── */}
        {coach && (
          <View style={s.coachBanner}>
            <View style={s.coachIcon}>
              <Svg width={18} height={18} viewBox="0 0 14 14" fill="none" stroke={COLORS.accent} strokeWidth={1.5}>
                <Circle cx="7" cy="7" r="5" /><Path d="M7 4v3l2 1" />
              </Svg>
            </View>
            <View style={s.coachBody}>
              <Text style={s.coachFrom}>New from Oracle</Text>
              <Text style={s.coachHeadline}>{coach.headline}</Text>
              <Text style={s.coachSummary}>{coach.summary}</Text>
            </View>
            <TouchableOpacity style={s.coachBtn}>
              <Text style={s.coachBtnText}>Review →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 5. TODAY'S MACROS CARD ─────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardLabel}>Today's Macros</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Sentinel')}>
              <Text style={s.cardTag}>→ SENTINEL</Text>
            </TouchableOpacity>
          </View>
          <View style={s.macrosTop}>
            <CalorieRing consumed={consumed.kcal} target={targets.kcal} />
            <View style={s.macrosSide}>
              <Text style={[s.statValue, { color: COLORS.orange300, fontSize: 28, lineHeight: 38, paddingTop: 6 }]}>{fmt0(remaining)}</Text>
              <Text style={s.statLabel}>KCAL REMAINING</Text>
              <Text style={[s.statSub, { marginTop: 4 }]}>{consumed.mealsLogged} meals logged</Text>
            </View>
          </View>
          <View style={s.macrosBars}>
            {([
              { l: 'Protein', c: consumed.protein, t: targets.protein, color: COLORS.accent  },
              { l: 'Carbs',   c: consumed.carbs,   t: targets.carbs,   color: COLORS.blue400 },
              { l: 'Fat',     c: consumed.fat,      t: targets.fat,    color: '#fbbf24'       },
            ]).map(m => (
              <View key={m.l} style={s.macroRow}>
                <View style={s.macroLabelRow}>
                  <Text style={s.macroLabel}>{m.l}</Text>
                  <Text style={s.macroValue}><Text style={{ color: COLORS.text300 }}>{m.c}</Text><Text style={{ color: COLORS.text600 }}> / {m.t}g</Text></Text>
                </View>
                <View style={s.macroBarBg}>
                  <View style={[s.macroBarFill, { width: `${Math.min((m.c / (m.t || 1)) * 100, 100)}%` as any, backgroundColor: m.color }]} />
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => navigation.navigate('Sentinel')}>
            <Text style={s.secondaryBtnText}>Scan Meal</Text>
          </TouchableOpacity>
        </View>

        {/* ── MUSCLE MAP ─────────────────────────────────────────────── */}
        <View style={{ marginBottom: SPACING.xl }}>
          <BodyMapDual
            recoveryMap={MOCK_RECOVERY_MAP}
            growthMap={MOCK_GROWTH_MAP}
            mode={mapMode}
            setMode={setMapMode}
            onExercisePress={(id) => navigation.navigate('Forge', { preAddExerciseId: id })}
          />
        </View>

        {/* ── 4. TODAY'S WORKOUT CARD ────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardLabel}>Today's Workout</Text>
            <Text style={s.cardTag}>FORGE</Text>
          </View>
          {todayWorkout ? (
            <>
              <Text style={s.workoutName}>{todayWorkout.name}</Text>
              <Text style={s.workoutMeta}>
                {(todayWorkout.workout_exercises ?? []).length} exercises
                {todayWorkout.completed && todayWorkout.duration_seconds
                  ? ` · ${Math.round(todayWorkout.duration_seconds / 60)}m · completed`
                  : todayWorkout.completed ? ' · completed' : ' · in progress'}
              </Text>
              <View style={s.exerciseList}>
                {(todayWorkout.workout_exercises ?? [])
                  .sort((a: any, b: any) => a.position - b.position)
                  .map((we: any, i: number) => (
                    <View key={we.id} style={s.exerciseRow}>
                      <Text style={s.exerciseNum}>{String(i + 1).padStart(2, '0')}</Text>
                      <Text style={s.exerciseName}>{we.notes}</Text>
                      <Text style={s.exerciseSets}>{(we.sets ?? []).length} × sets</Text>
                    </View>
                  ))}
              </View>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => {
                  if (todayWorkout.completed) {
                    navigation.navigate('SessionReview', { workoutId: todayWorkout.id });
                  } else {
                    navigation.navigate('Forge');
                  }
                }}>
                <Text style={s.primaryBtnText}>{todayWorkout.completed ? 'View Workout →' : 'In Progress →'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[s.workoutMeta, { color: COLORS.text600, marginTop: 8 }]}>No workout logged today. Head to Forge to start one.</Text>
          )}
        </View>

        {/* ── 7. THIS WEEK GRID ──────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.sectionTitle}>This Week</Text>
            <Text style={s.cardTag}>VAULT →</Text>
          </View>
          <WeeklyGrid days={days} navigation={navigation} />
          <View style={[s.divider, { marginTop: SPACING.lg }]} />
          <View style={s.weekStatsGrid}>
            {([
              { label: 'Total Sets',  value: `${weeklySets ?? 0}`, unit: 'sets' },
              { label: 'Avg Daily',   value: `${fmt0(weekly.avgKcal)}`, unit: 'kcal' },
              { label: 'Avg Protein', value: `${weekly.avgProtein}`,    unit: 'g'    },
              { label: 'Streak',      value: `${weekly.streak}`,        unit: 'd'    },
            ]).map(item => (
              <View key={item.label} style={s.weekStat}>
                <Text style={s.weekStatLabel}>{item.label}</Text>
                <Text style={s.weekStatValue}>{item.value}<Text style={s.statUnit}> {item.unit}</Text></Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── 6. WEIGHT TREND CARD ───────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardLabel}>Body Comp</Text>
            <Text style={s.cardTag}>→ VAULT</Text>
          </View>
          <Text style={s.bigWeight}>{bioCurrent || '—'}<Text style={[s.statUnit, { fontSize: 22 }]}> kg</Text></Text>
          <View style={s.weightDeltaRow}>
            <Text style={[s.metaText, { color: COLORS.orange300 }]}>{weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta).toFixed(1)} kg</Text>
            <Text style={[s.metaText, { marginLeft: SPACING.sm }]}>last 7d</Text>
          </View>
          <View style={{ height: 30, marginVertical: SPACING.md }}>
            <MiniSparkline values={bioSparkline} bfValues={bfSparkline} />
          </View>
          {/* Chart legend */}
          {bioSparkline.length >= 2 && (
            <View style={{ flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent }} />
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>Weight</Text>
              </View>
              {bfSparkline.filter(v => v != null).length >= 2 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#facc15' }} />
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>Body Fat %</Text>
                </View>
              )}
            </View>
          )}
          <View style={s.divider} />
          <View style={s.weightGoalRow}>
            <Text style={s.goalLabel}>Goal</Text>
            <Text style={[s.metaText, { color: COLORS.orange300 }]}>{bio.goal ? `${bio.goal} kg` : '—'}</Text>
            {bio.goal && bioCurrent ? <Text style={s.goalSub}>{Math.abs(bioCurrent - bio.goal).toFixed(1)} to go</Text> : null}
          </View>
        </View>

        {/* ── 8. TODAY'S ACTIVITY FEED ───────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.sectionTitle}>Today's Activity</Text>
            <Text style={s.cardTag}>{(activityFeed ?? []).length} events</Text>
          </View>
          {(activityFeed ?? []).length === 0 ? (
            <Text style={[s.metaText, { color: COLORS.text600, marginTop: 8 }]}>No activity logged today.</Text>
          ) : (() => {
            const feed = activityFeed ?? [];
            const visible = feedExpanded ? feed : feed.slice(0, 5);
            return (
              <>
                {visible.map((a: any, i: number) => {
                  const time = new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                  const type = a.event_type === 'workout_complete' ? 'workout' : a.event_type;
                  const text = a.event_type === 'workout_complete'
                    ? `${a.payload?.workout_name ?? 'Workout'} — ${Math.round((a.payload?.volume_kg ?? 0))} kg·reps`
                    : a.payload?.text ?? a.event_type;
                  return (
                    <View key={a.id} style={[s.feedRow, i === visible.length - 1 && feed.length <= 5 && { borderBottomWidth: 0 }]}>
                      <Text style={s.feedTime}>{time}</Text>
                      <View style={[s.feedIconBox, type === 'coach' && { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted }]}>
                        <ActivityIcon type={type} />
                      </View>
                      <Text style={s.feedText} numberOfLines={1}>{text}</Text>
                    </View>
                  );
                })}
                {feed.length > 5 && (
                  <TouchableOpacity onPress={() => setFeedExpanded(v => !v)} style={{ paddingTop: 10, alignItems: 'center' }}>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>
                      {feedExpanded ? 'Show less ↑' : `View all ${feed.length} →`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            );
          })()}
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window');

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },

  // Header
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.sm },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  wordmark:    { fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, textTransform: 'uppercase', letterSpacing: 1 },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontFamily: FONTS.anton, fontSize: 13, color: COLORS.bg },
  greeting:    { fontFamily: FONTS.anton, fontSize: 34, color: COLORS.text100, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 43, paddingTop: 2, marginBottom: SPACING.sm },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xl, flexWrap: 'wrap' },
  tierBadge:   { paddingHorizontal: SPACING.sm, paddingVertical: 3, backgroundColor: COLORS.accentMuted, borderWidth: 1, borderColor: COLORS.accentBorder },
  tierText:    { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange300, textTransform: 'uppercase', letterSpacing: 1.5 },
  metaDot:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700 },
  metaText:    { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.2 },

  // FIX 4: 2×2 stat grid
  statGrid:   { borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.xl },
  statCard:   { width: '50%', paddingHorizontal: SPACING.md, paddingVertical: 7, backgroundColor: COLORS.bgCard },
  statCardTL: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  statCardTR: { borderBottomWidth: 1, borderColor: COLORS.border },
  statCardBL: { borderRightWidth: 1, borderColor: COLORS.border },
  statCardBR: {},
  statLabel:  { fontFamily: FONTS.mono, fontSize: 6, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 3 },
  statValue:  { fontFamily: FONTS.anton, fontSize: 17, color: COLORS.text100, lineHeight: 21, paddingTop: 1 },
  statUnit:   { fontFamily: FONTS.anton, fontSize: 7, color: COLORS.text500 },
  statSub:    { fontFamily: FONTS.mono, fontSize: 6, color: COLORS.orange300, marginTop: 1 },

  // Coach banner
  coachBanner:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: 'rgba(237,122,42,0.07)', padding: SPACING.md, marginBottom: SPACING.xl },
  coachIcon:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accentMuted, borderWidth: 1, borderColor: COLORS.accentBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  coachBody:     { flex: 1 },
  coachFrom:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange400, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  coachHeadline: { fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, textTransform: 'uppercase', lineHeight: 20 },
  coachSummary:  { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.text400, marginTop: 2 },
  coachBtn:      { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.accent, flexShrink: 0 },
  coachBtnText:  { fontFamily: FONTS.anton, fontSize: 12, color: COLORS.bg, textTransform: 'uppercase' },

  // Cards
  card:        { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, padding: SPACING.lg, marginBottom: SPACING.lg },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACING.md },
  cardLabel:   { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 2 },
  cardTag:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.2 },
  sectionTitle:{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, textTransform: 'uppercase' },

  // Workout
  workoutName: { fontFamily: FONTS.anton, fontSize: 38, color: COLORS.text100, textTransform: 'uppercase', lineHeight: 48, paddingTop: 2, marginBottom: SPACING.xs },
  workoutMeta: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.md },
  exerciseList:{ marginBottom: SPACING.lg },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(41,37,36,0.4)' },
  exerciseNum: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, width: 28 },
  exerciseName:{ flex: 1, fontFamily: FONTS.sansMed, fontSize: 14, color: COLORS.text300 },
  exerciseSets:{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 },

  // Buttons
  primaryBtn:      { paddingVertical: SPACING.md, backgroundColor: COLORS.accent, alignItems: 'center' },
  primaryBtnText:  { fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, textTransform: 'uppercase', letterSpacing: 1 },
  secondaryBtn:    { paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  secondaryBtnText:{ fontFamily: FONTS.anton, fontSize: 14, color: COLORS.text300, textTransform: 'uppercase', letterSpacing: 1 },

  // Macros
  macrosTop:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginBottom: SPACING.lg },
  macrosSide:   { flex: 1 },
  macrosBars:   { gap: SPACING.md, marginBottom: SPACING.lg },
  macroRow:     {},
  macroLabelRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel:   { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5 },
  macroValue:   { fontFamily: FONTS.mono, fontSize: 10 },
  macroBarBg:   { height: 4, backgroundColor: '#1c1917' },
  macroBarFill: { height: 4, position: 'absolute', top: 0, left: 0 },

  // Calorie ring
  ringWrap:  { width: 96, height: 96 },
  ringLabel: { alignItems: 'center', justifyContent: 'center' },
  ringNum:   { fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, lineHeight: 24 },
  ringSub:   { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text500, marginTop: 2 },

  // Weight card
  bigWeight:     { fontFamily: FONTS.anton, fontSize: 52, color: COLORS.text100, lineHeight: 65, paddingTop: 2 },
  weightDeltaRow:{ flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.xs },
  weightGoalRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.md, marginTop: SPACING.sm },
  goalLabel:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5 },
  goalSub:       { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, marginLeft: 'auto' as any },

  // Weekly grid
  gridRow:      { flexDirection: 'row', marginBottom: SPACING.xs },
  gridCol:      { flex: 1, alignItems: 'center' },
  gridDayLabel: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
  gridDateLabel:{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, marginTop: 2 },
  gridSection:  { marginTop: SPACING.md },
  gridRowLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.xs },
  gridCell:     { height: 8, alignSelf: 'stretch', marginHorizontal: 2 },
  legendRow:    { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight, flexWrap: 'wrap' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:    { width: 10, height: 6 },
  legendLabel:  { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },

  // Muscle map
  mapToggle:         { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  mapToggleBtn:      { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  mapToggleBtnActive:{ borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  mapToggleText:     { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5 },
  mapToggleTextActive:{ color: COLORS.orange300 },
  mapBodies:         { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
  mapBodyCol:        { alignItems: 'center' },
  mapBodyLabel:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: SPACING.xs },

  // Muscle info card
  muscleInfoCard: { marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: 'rgba(237,122,42,0.07)', padding: SPACING.md },
  muscleInfoRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  muscleInfoName: { fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, textTransform: 'uppercase' },
  muscleInfoVol:  { fontFamily: FONTS.mono, fontSize: 18, color: COLORS.orange300, letterSpacing: 0.5, marginBottom: 2 },
  muscleInfoSub:  { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.text400 },
  musclePill:     { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderWidth: 1 },
  musclePillText: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1 },

  // Week stats
  weekStatsGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg, marginTop: SPACING.lg },
  weekStat:     { minWidth: (SW - 32 * 2 - SPACING.lg * 2) / 2 - SPACING.sm },
  weekStatLabel:{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  weekStatValue:{ fontFamily: FONTS.anton, fontSize: 24, color: COLORS.text100, lineHeight: 30, paddingTop: 2 },

  // Activity feed
  feedRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  feedTime:   { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, width: 38, flexShrink: 0 },
  feedIconBox:{ width: 28, height: 28, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  feedText:   { flex: 1, fontFamily: FONTS.sansMed, fontSize: 13, color: COLORS.text300 },

  // Divider
  divider: { height: 1, backgroundColor: COLORS.borderLight },
});
