import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useProfileStore } from '../../store/useProfileStore';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US');
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ─── Mini Calorie Ring ───────────────────────────────────────────────────────
function MiniCalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={88} height={88} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="miniGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#fbbf24" />
            <Stop offset="100%" stopColor="#ff5a2a" />
          </LinearGradient>
        </Defs>
        <Circle cx={44} cy={44} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={6} fill="none" />
        <Circle cx={44} cy={44} r={r} stroke="url(#miniGrad)" strokeWidth={6} fill="none"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 18, color: '#e7e5e4', lineHeight: 20 }}>{fmt0(consumed)}</Text>
        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e' }}>/{fmt0(target)}</Text>
      </View>
    </View>
  );
}

// ─── Mini Sparkline ──────────────────────────────────────────────────────────
function MiniSparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 120, H = 36;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - 4 - ((v - min) / range) * (H - 8);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x},${y}`).join(' ');
  return (
    <Svg width={W} height={H}>
      <Path d={path} stroke="#ed7a2a" strokeWidth={1.5} fill="none" />
      <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill="#ed7a2a" />
    </Svg>
  );
}

// ─── Weekly Adherence Grid ───────────────────────────────────────────────────
function WeeklyGrid({ days }: { days: any[] }) {
  const rows = [
    { key: 'workout', label: 'Workout', getter: (d: any) => d.future ? 'future' : d.rest ? 'rest' : d.workout === true ? 'done' : d.workout === false && !d.today ? 'missed' : 'future' },
    { key: 'meals',   label: 'Nutrition', getter: (d: any) => d.future ? 'future' : d.meals ? 'done' : 'missed' },
    { key: 'weight',  label: 'Weight',  getter: (d: any) => d.future ? 'future' : d.weight ? 'done' : 'missed' },
  ];
  const cellColor = (status: string) => ({
    done:   '#ed7a2a',
    missed: 'rgba(248,113,113,0.2)',
    rest:   '#292524',
    future: 'rgba(28,25,23,0.4)',
  }[status] ?? '#1c1917');

  return (
    <View>
      {/* Day labels */}
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {days.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: d.today ? '#fb923c' : '#57534e', textTransform: 'uppercase' }}>{d.day}</Text>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: d.today ? '#ed7a2a' : '#44403c', marginTop: 2 }}>{d.label?.split(' ')[1]}</Text>
          </View>
        ))}
      </View>
      {/* Rows */}
      {rows.map(row => (
        <View key={row.key} style={{ marginBottom: 8 }}>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>{row.label}</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {days.map((d, i) => (
              <View key={i} style={{ flex: 1, height: 6, backgroundColor: cellColor(row.getter(d)) }} />
            ))}
          </View>
        </View>
      ))}
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.6)' }}>
        {[['#ed7a2a','Done'],['rgba(248,113,113,0.5)','Missed'],['#292524','Rest']].map(([c, l]) => (
          <View key={l as string} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 6, backgroundColor: c as string }} />
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase' }}>{l as string}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Muscle Status Section (FIX 4) ───────────────────────────────────────────
const MOCK_RECOVERY_MAP: Record<string, { pct: number; hoursRemaining: number; status: 'ready' | 'almost' | 'partial' | 'resting' }> = {
  quads:      { pct: 28, hoursRemaining: 36, status: 'resting' },
  hamstrings: { pct: 55, hoursRemaining: 18, status: 'partial' },
  glutes:     { pct: 62, hoursRemaining: 12, status: 'partial' },
  chest:      { pct: 80, hoursRemaining: 6,  status: 'almost' },
  triceps:    { pct: 76, hoursRemaining: 8,  status: 'almost' },
  front_delts:{ pct: 72, hoursRemaining: 10, status: 'almost' },
  lats:       { pct: 100,hoursRemaining: 0,  status: 'ready' },
  biceps:     { pct: 100,hoursRemaining: 0,  status: 'ready' },
  lower_back: { pct: 58, hoursRemaining: 14, status: 'partial' },
  calves:     { pct: 100,hoursRemaining: 0,  status: 'ready' },
  abs:        { pct: 100,hoursRemaining: 0,  status: 'ready' },
  side_delts: { pct: 100,hoursRemaining: 0,  status: 'ready' },
};

const MOCK_GROWTH_MAP: Record<string, { growthPct: number }> = {
  chest:      { growthPct: 2.1 },
  front_delts:{ growthPct: 0.8 },
  side_delts: { growthPct: 3.2 },
  triceps:    { growthPct: 1.5 },
  lats:       { growthPct: 6.4 },
  biceps:     { growthPct: 0.5 },
  quads:      { growthPct: 0.0 },
  hamstrings: { growthPct: 1.2 },
  glutes:     { growthPct: 2.8 },
  calves:     { growthPct: 4.1 },
  lower_back: { growthPct: 0.3 },
  abs:        { growthPct: 0.0 },
};

const MUSCLE_LABEL_MAP: Record<string, string> = {
  quads: 'Quadriceps', hamstrings: 'Hamstrings', glutes: 'Glutes', chest: 'Chest',
  triceps: 'Triceps', front_delts: 'Front Delts', lats: 'Lats', biceps: 'Biceps',
  rear_delts: 'Rear Delts', calves: 'Calves', lower_back: 'Lower Back',
  traps: 'Traps', side_delts: 'Side Delts', abs: 'Abs', obliques: 'Obliques',
};

function MuscleVolumeSection({ mode }: { mode: 'recovery' | 'growth' }) {
  const recoveryStatusColors: Record<string, string> = {
    ready: '#4ade80', almost: '#a3e635', partial: '#fb923c', resting: '#f87171',
  };

  // Summary items
  const summaryItems = mode === 'recovery'
    ? Object.entries(MOCK_RECOVERY_MAP)
        .filter(([, v]) => v.status !== 'ready')
        .sort(([, a], [, b]) => a.pct - b.pct)
        .slice(0, 3)
        .map(([k, v]) => ({
          key: k,
          label: MUSCLE_LABEL_MAP[k] ?? k,
          value: `${v.pct}%`,
          sub: v.hoursRemaining > 0 ? `${v.hoursRemaining}h left` : null,
          color: recoveryStatusColors[v.status] ?? '#57534e',
        }))
    : Object.entries(MOCK_GROWTH_MAP)
        .filter(([, v]) => v.growthPct > 0)
        .sort(([, a], [, b]) => b.growthPct - a.growthPct)
        .slice(0, 3)
        .map(([k, v]) => ({
          key: k,
          label: MUSCLE_LABEL_MAP[k] ?? k,
          value: `+${v.growthPct.toFixed(1)}%`,
          sub: null,
          color: v.growthPct > 5 ? '#4ade80' : v.growthPct > 1 ? '#a3e635' : '#fb923c',
        }));

  // Bar rows
  const muscles = mode === 'recovery'
    ? Object.entries(MOCK_RECOVERY_MAP).map(([muscle, r]) => ({
        muscle,
        color: recoveryStatusColors[r.status] ?? '#57534e',
        label: r.pct >= 100 ? 'READY' : `${r.pct}% · ${r.hoursRemaining}h`,
        pct: r.pct,
      }))
    : Object.entries(MOCK_GROWTH_MAP).map(([muscle, g]) => {
        const p = g.growthPct;
        const color = p > 5 ? '#4ade80' : p > 1 ? '#a3e635' : p > 0 ? '#fb923c' : '#57534e';
        return {
          muscle,
          color,
          label: p === 0 ? 'NONE' : `+${p.toFixed(1)}%`,
          pct: Math.min(p * 10, 100),
        };
      });

  const recoveryLegend: [string, string][] = [
    ['#4ade80','READY'],['#a3e635','ALMOST'],['#fb923c','PARTIAL'],['#f87171','RESTING'],
  ];
  const growthLegend: [string, string][] = [
    ['#4ade80','HIGH'],['#a3e635','MODERATE'],['#fb923c','LOW'],['#78716c','NONE'],
  ];
  const legend = mode === 'recovery' ? recoveryLegend : growthLegend;

  return (
    <View>
      {/* Bar rows */}
      {muscles.map(({ muscle, color, label, pct }) => (
        <View key={muscle} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#78716c', textTransform: 'uppercase', letterSpacing: 1 }}>
              {MUSCLE_LABEL_MAP[muscle] ?? muscle.replace(/_/g, ' ')}
            </Text>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: color }}>{label}</Text>
          </View>
          <View style={{ height: 4, backgroundColor: '#1c1917' }}>
            <View style={{ height: '100%', width: `${pct}%` as any, backgroundColor: color, opacity: 0.75 }} />
          </View>
        </View>
      ))}

      {/* Legend */}
      <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {legend.map(([c, l]) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase' }}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: 'rgba(41,37,36,0.6)', marginTop: 16, marginBottom: 12 }} />

      {/* Summary */}
      <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
        {mode === 'recovery' ? 'MOST FATIGUED' : 'TOP GAINS'}
      </Text>
      {summaryItems.map(item => (
        <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color }} />
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#a8a29e' }}>{item.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#d6d3d1' }}>{item.value}</Text>
            {item.sub && <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e' }}>{item.sub}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
interface DashData {
  consumed: { kcal: number; protein: number; carbs: number; fat: number; mealsLogged: number };
  targets:  { kcal: number; protein: number; carbs: number; fat: number };
  weight:   number | null;
  weightWeekAgo: number | null;
  sparkline: number[];
  goalWeight: number | null;
  streak:   number;
  workout: { id: string; name: string; completed: boolean; exercises: { name: string; sets: number }[] } | null;
  weeklyStats: { totalSets: number; avgKcal: number; avgProtein: number };
  activityFeed: { time: string; type: string; text: string }[];
  weeklyAdherence: { day: string; label: string; today: boolean; rest: boolean; future: boolean; workout: boolean | null; meals: boolean; weight: boolean }[];
}

export default function DashboardScreen() {
  const profile = useProfileStore(s => s.profile);
  const setProfile = useProfileStore(s => s.setProfile);
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bodyMode, setBodyMode] = useState<'recovery' | 'growth'>('growth');

  async function fetchDash() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowMidnight = new Date(midnight); tomorrowMidnight.setDate(midnight.getDate() + 1);
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);

    const [nlRes, workoutRes, bioRes, profileRes, weekWorkoutsRes] = await Promise.all([
      supabase.from('nutrition_logs')
        .select('kcal,protein_g,carbs_g,fat_g,food_name,logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', midnight.toISOString())
        .lt('logged_at', tomorrowMidnight.toISOString()),
      supabase.from('workouts')
        .select('id,name,completed_at')
        .eq('user_id', user.id)
        .eq('scheduled_date', todayStr)
        .limit(1)
        .maybeSingle(),
      supabase.from('biometric_entries')
        .select('weight_kg,logged_at')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(31),
      supabase.from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.from('workouts')
        .select('scheduled_date,completed_at')
        .eq('user_id', user.id)
        .gte('scheduled_date', weekAgo.toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true }),
    ]);

    if (profileRes.data) setProfile(profileRes.data);

    const nl = nlRes.data ?? [];
    const bio = bioRes.data ?? [];
    const targets = profileRes.data?.current_macros ?? { kcal: 2000, protein: 150, carbs: 200, fat: 65 };

    const consumed = {
      kcal:    nl.reduce((s, r) => s + (r.kcal ?? 0), 0),
      protein: nl.reduce((s, r) => s + (r.protein_g ?? 0), 0),
      carbs:   nl.reduce((s, r) => s + (r.carbs_g ?? 0), 0),
      fat:     nl.reduce((s, r) => s + (r.fat_g ?? 0), 0),
      mealsLogged: nl.length,
    };

    const latestWeight = bio[0]?.weight_kg ?? null;
    const weekAgoWeight = bio.find(b => {
      const d = new Date(b.logged_at);
      return (today.getTime() - d.getTime()) >= 6 * 24 * 60 * 60 * 1000;
    })?.weight_kg ?? null;
    const sparkline = bio.slice(0, 14).reverse().map(b => b.weight_kg).filter(Boolean) as number[];

    // Weekly adherence (7 days Mon–today)
    const weeklyAdherence = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - (6 - i));
      const dStr = d.toISOString().split('T')[0];
      const isFuture = d > today;
      const isToday = dStr === todayStr;
      const dayWorkouts = weekWorkoutsRes.data?.filter(w => w.scheduled_date === dStr) ?? [];
      const hasMeals = isToday ? nl.length > 0 : false;
      const hasWeight = bio.some(b => b.logged_at.startsWith(dStr));
      return {
        day: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        today: isToday,
        rest: dayWorkouts.length === 0,
        future: isFuture,
        workout: dayWorkouts.length > 0 ? dayWorkouts.some(w => !!w.completed_at) : null,
        meals: hasMeals,
        weight: hasWeight,
      };
    });

    // Activity feed
    const activityFeed = nl.slice(0, 6).map(l => ({
      time: new Date(l.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      type: 'meal',
      text: `${l.food_name} · ${l.kcal} kcal`,
    }));
    if (workoutRes.data?.completed_at) {
      activityFeed.unshift({ time: new Date(workoutRes.data.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), type: 'workout', text: `Completed ${workoutRes.data.name}` });
    }
    if (bio[0]) {
      activityFeed.unshift({ time: new Date(bio[0].logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), type: 'weight', text: `Logged weight: ${bio[0].weight_kg} kg` });
    }

    // Weekly stats
    const weekNl = await supabase.from('nutrition_logs')
      .select('kcal,protein_g')
      .eq('user_id', user.id)
      .gte('logged_at', weekAgo.toISOString());
    const weekNlData = weekNl.data ?? [];
    const daysWithData = new Set(weekNlData.map((l: any) => l.logged_at.split('T')[0])).size;
    const avgKcal = daysWithData > 0 ? weekNlData.reduce((a: number, l: any) => a + l.kcal, 0) / daysWithData : 0;
    const avgProtein = daysWithData > 0 ? weekNlData.reduce((a: number, l: any) => a + l.protein_g, 0) / daysWithData : 0;

    const streak = profileRes.data?.current_streak ?? 0;

    setData({
      consumed, targets,
      weight: latestWeight,
      weightWeekAgo: weekAgoWeight,
      sparkline,
      goalWeight: profileRes.data?.goal_weight_kg ?? null,
      streak,
      workout: workoutRes.data ? {
        id: workoutRes.data.id,
        name: workoutRes.data.name ?? 'Workout',
        completed: !!workoutRes.data.completed_at,
        exercises: [],
      } : null,
      weeklyStats: { totalSets: 0, avgKcal: Math.round(avgKcal), avgProtein: Math.round(avgProtein) },
      activityFeed: activityFeed.slice(0, 8),
      weeklyAdherence,
    });
  }

  useEffect(() => { fetchDash().finally(() => setLoading(false)); }, []);
  async function onRefresh() { setRefreshing(true); await fetchDash(); setRefreshing(false); }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  const displayName = profile?.display_name || 'Athlete';
  const tier = profile?.subscription_tier ?? 'basic';
  const goalLabel = profile?.goal ? `goal: ${profile.goal}` : '';
  const remaining = data ? data.targets.kcal - data.consumed.kcal : 0;
  const weightDelta = data?.weight != null && data?.weightWeekAgo != null ? data.weight - data.weightWeekAgo : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0908' }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ed7a2a" />}
      >
        {/* ── Top Nav ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.8)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 18, color: '#ed7a2a' }}>▲</Text>
            <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 18, color: '#e7e5e4' }}>IRONLAB</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {data?.streak != null && data.streak > 0 && (
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: data.streak >= 7 ? '#fbbf24' : '#57534e' }}>
                🔥 {data.streak}d
              </Text>
            )}
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(237,122,42,0.15)', borderWidth: 1, borderColor: 'rgba(237,122,42,0.3)' }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#fb923c', textTransform: 'uppercase' }}>{tier}</Text>
            </View>
            <TouchableOpacity onPress={signOut}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase' }}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>

          {/* ── Greeting ── */}
          <View style={{ paddingVertical: 24 }}>
            <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 32, color: '#e7e5e4', lineHeight: 34 }}>
              {greeting()},{' '}
              <Text style={{ color: '#ed7a2a' }}>{displayName}</Text>.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#57534e' }}>{fmtDate(new Date())}</Text>
              {goalLabel ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(237,122,42,0.15)', borderWidth: 1, borderColor: 'rgba(237,122,42,0.3)' }}>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#fb923c', textTransform: 'uppercase' }}>{goalLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── 4-Stat Strip ── */}
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 20 }}>
            {/* Weight */}
            <TouchableOpacity onPress={() => router.push('/(tabs)/vault' as any)} style={{ flex: 1, padding: 14, borderRightWidth: 1, borderRightColor: 'rgba(41,37,36,0.6)' }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Weight</Text>
              {loading ? <View style={{ height: 28, backgroundColor: '#1c1917', marginBottom: 4 }} /> : (
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 24, color: '#e7e5e4', lineHeight: 26 }}>
                  {data?.weight ?? '—'}<Text style={{ fontSize: 14, color: '#57534e' }}> kg</Text>
                </Text>
              )}
              {weightDelta != null && (
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#fb923c', marginTop: 2 }}>
                  {weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta).toFixed(1)} kg/7d
                </Text>
              )}
            </TouchableOpacity>

            {/* Calories Left */}
            <TouchableOpacity onPress={() => router.push('/(tabs)/sentinel' as any)} style={{ flex: 1, padding: 14, borderRightWidth: 1, borderRightColor: 'rgba(41,37,36,0.6)' }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Calories Left</Text>
              {loading ? <View style={{ height: 28, backgroundColor: '#1c1917', marginBottom: 4 }} /> : (
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 24, color: data?.consumed.mealsLogged === 0 ? '#57534e' : '#fb923c', lineHeight: 26 }}>
                  {fmt0(Math.max(remaining, 0))}
                </Text>
              )}
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c', marginTop: 2 }}>
                {loading ? '' : `${fmt0(data?.consumed.kcal ?? 0)} / ${fmt0(data?.targets.kcal ?? 0)}`}
              </Text>
            </TouchableOpacity>

            {/* Workout */}
            <TouchableOpacity onPress={() => router.push('/(tabs)/forge' as any)} style={{ flex: 1, padding: 14, borderRightWidth: 1, borderRightColor: 'rgba(41,37,36,0.6)' }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Workout</Text>
              {loading ? <View style={{ height: 28, backgroundColor: '#1c1917', marginBottom: 4 }} /> : data?.workout ? (
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 16, color: '#e7e5e4', lineHeight: 18 }} numberOfLines={2}>{data.workout.name.toUpperCase()}</Text>
              ) : (
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 20, color: '#44403c' }}>REST</Text>
              )}
              {data?.workout && (
                <View style={{ marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, alignSelf: 'flex-start', borderColor: data.workout.completed ? 'rgba(74,222,128,0.3)' : 'rgba(237,122,42,0.3)', backgroundColor: data.workout.completed ? 'rgba(74,222,128,0.1)' : 'rgba(237,122,42,0.1)' }}>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: data.workout.completed ? '#4ade80' : '#ed7a2a', textTransform: 'uppercase' }}>{data.workout.completed ? '✓ Done' : 'Scheduled'}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Streak */}
            <TouchableOpacity onPress={() => router.push('/(tabs)/vault' as any)} style={{ flex: 1, padding: 14 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Streak</Text>
              {loading ? <View style={{ height: 28, backgroundColor: '#1c1917', marginBottom: 4 }} /> : (
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 24, color: (data?.streak ?? 0) >= 7 ? '#fbbf24' : '#e7e5e4', lineHeight: 26 }}>
                  🔥 {data?.streak ?? 0}
                </Text>
              )}
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c', marginTop: 2 }}>days</Text>
            </TouchableOpacity>
          </View>

          {/* ── Today's Workout Card ── */}
          <View style={{ borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2 }}>Today's Workout</Text>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c' }}>FORGE</Text>
            </View>
            {loading ? <ActivityIndicator color="#ed7a2a" /> : data?.workout ? (
              <>
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 32, color: '#e7e5e4', lineHeight: 34, marginBottom: 8 }}>{data.workout.name.toUpperCase()}</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (data.workout.completed) {
                      router.push({ pathname: '/forge-review', params: { workoutId: data.workout.id } } as any);
                    } else {
                      router.push('/(tabs)/forge' as any);
                    }
                  }}
                  style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: '#ed7a2a', marginTop: 8 }}
                >
                  <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 14, color: '#0a0908', letterSpacing: 2 }}>
                    {data.workout.completed ? 'VIEW WORKOUT →' : 'START WORKOUT →'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 32, color: '#292524', marginBottom: 8 }}>REST DAY</Text>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#44403c', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>No workout scheduled today</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/forge' as any)} style={{ paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: '#292524' }}>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#57534e', textTransform: 'uppercase' }}>Schedule a workout →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Today's Macros Card ── */}
          <TouchableOpacity onPress={() => router.push('/(tabs)/sentinel' as any)} style={{ borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2 }}>Today's Macros</Text>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c' }}>→ sentinel</Text>
            </View>
            {loading ? <ActivityIndicator color="#ed7a2a" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <MiniCalorieRing consumed={data?.consumed.kcal ?? 0} target={data?.targets.kcal ?? 2000} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 26, color: '#fb923c', lineHeight: 28, marginBottom: 12 }}>
                    {fmt0(Math.max(remaining, 0))}<Text style={{ fontSize: 14, color: '#57534e' }}> kcal left</Text>
                  </Text>
                  {[
                    { l: 'Protein', c: data?.consumed.protein ?? 0, t: data?.targets.protein ?? 150, color: '#ed7a2a' },
                    { l: 'Carbs',   c: data?.consumed.carbs ?? 0,   t: data?.targets.carbs ?? 200,   color: '#7eb6ff' },
                    { l: 'Fat',     c: data?.consumed.fat ?? 0,     t: data?.targets.fat ?? 65,     color: '#fbbf24' },
                  ].map(m => (
                    <View key={m.l} style={{ marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase' }}>{m.l}</Text>
                        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#78716c' }}>{Math.round(m.c)}/{m.t}g</Text>
                      </View>
                      <View style={{ height: 3, backgroundColor: '#1c1917' }}>
                        <View style={{ height: '100%', width: `${Math.min((m.c / Math.max(m.t, 1)) * 100, 100)}%` as any, backgroundColor: m.color }} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {!loading && data?.consumed.mealsLogged === 0 && (
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#44403c', textAlign: 'center', marginTop: 12, textTransform: 'uppercase' }}>No meals logged yet · Tap to open Sentinel</Text>
            )}
          </TouchableOpacity>

          {/* ── Body Comp Card ── */}
          <TouchableOpacity onPress={() => router.push('/(tabs)/vault' as any)} style={{ borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2 }}>Body Comp</Text>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c' }}>→ vault</Text>
            </View>
            {loading ? <ActivityIndicator color="#ed7a2a" /> : data?.weight == null ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#44403c', textTransform: 'uppercase', marginBottom: 8 }}>No weight data yet</Text>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#57534e' }}>Log today's weight →</Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 40, color: '#e7e5e4', lineHeight: 42 }}>{data.weight}</Text>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 16, color: '#57534e' }}>kg</Text>
                  {weightDelta != null && (
                    <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: '#fb923c' }}>
                      {weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta).toFixed(1)} kg/7d
                    </Text>
                  )}
                </View>
                {data.sparkline.length > 1 && <MiniSparkline values={data.sparkline} />}
                {data.goalWeight != null && (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.6)', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase' }}>Goal</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 18, color: '#fb923c' }}>{data.goalWeight} kg</Text>
                      <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#57534e' }}>{Math.abs(data.weight - data.goalWeight).toFixed(1)} to go</Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>

          {/* ── This Week ── */}
          <View style={{ borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 22, color: '#e7e5e4' }}>THIS WEEK</Text>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c' }}>vault →</Text>
            </View>
            {loading ? <ActivityIndicator color="#ed7a2a" /> : data?.weeklyAdherence ? (
              <WeeklyGrid days={data.weeklyAdherence} />
            ) : null}
            <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.6)', gap: 0 }}>
              {[
                { label: 'Avg Calories', value: data?.weeklyStats.avgKcal ? `${data.weeklyStats.avgKcal}` : '—', sub: 'kcal/day' },
                { label: 'Avg Protein',  value: data?.weeklyStats.avgProtein ? `${data.weeklyStats.avgProtein}g` : '—', sub: 'per day' },
              ].map((s, i) => (
                <View key={s.label} style={{ flex: 1, paddingRight: i === 0 ? 16 : 0, borderRightWidth: i === 0 ? 1 : 0, borderRightColor: 'rgba(41,37,36,0.6)', paddingLeft: i > 0 ? 16 : 0 }}>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</Text>
                  <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 22, color: '#e7e5e4' }}>{loading ? '—' : s.value}</Text>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c' }}>{s.sub}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Activity Feed ── */}
          <View style={{ borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 22, color: '#e7e5e4' }}>TODAY'S ACTIVITY</Text>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c' }}>{data?.activityFeed.length ?? 0} events</Text>
            </View>
            {loading ? <ActivityIndicator color="#ed7a2a" /> : !data?.activityFeed.length ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#44403c', textTransform: 'uppercase', letterSpacing: 2 }}>No activity logged today yet.</Text>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#292524', marginTop: 4 }}>Log a meal or start a workout.</Text>
              </View>
            ) : (
              data.activityFeed.map((a, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < data.activityFeed.length - 1 ? 1 : 0, borderBottomColor: 'rgba(41,37,36,0.4)' }}>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#44403c', width: 42 }}>{a.time}</Text>
                  <View style={{ width: 28, height: 28, borderWidth: 1, borderColor: a.type === 'workout' ? 'rgba(237,122,42,0.3)' : '#292524', backgroundColor: a.type === 'workout' ? 'rgba(237,122,42,0.08)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12 }}>{a.type === 'meal' ? '🍽' : a.type === 'workout' ? '🏋️' : '⚖️'}</Text>
                  </View>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: '#a8a29e', flex: 1 }} numberOfLines={1}>{a.text}</Text>
                </View>
              ))
            )}
          </View>

          {/* ── Muscle Status ── */}
          <View style={{ borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 22, color: '#e7e5e4' }}>Muscle Status</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['recovery', 'growth'] as const).map(m => (
                  <TouchableOpacity key={m} onPress={() => setBodyMode(m)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: bodyMode === m ? 'rgba(237,122,42,0.6)' : '#292524', backgroundColor: bodyMode === m ? 'rgba(237,122,42,0.1)' : 'transparent' }}>
                    <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: bodyMode === m ? '#fb923c' : '#57534e', textTransform: 'uppercase' }}>{m === 'recovery' ? 'RECOVERY' : 'GROWTH'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <MuscleVolumeSection mode={bodyMode} />
          </View>

          {/* ── Module Tiles ── */}
          <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 20, color: '#e7e5e4', marginBottom: 12 }}>MODULES</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {[
              { name: 'FORGE',    sub: 'Workout',   color: '#ed7a2a', tab: 'forge' },
              { name: 'SENTINEL', sub: 'Nutrition', color: '#fbbf24', tab: 'sentinel' },
              { name: 'VAULT',    sub: 'Biometrics',color: '#f87171', tab: 'vault' },
              { name: 'ORACLE',   sub: 'AI Coach',  color: '#fb923c', tab: 'oracle' },
            ].map(m => (
              <TouchableOpacity key={m.tab} onPress={() => router.push(`/(tabs)/${m.tab}` as any)} style={{ width: '48%', borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', padding: 16 }}>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{m.sub}</Text>
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 22, color: m.color }}>{m.name}</Text>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c', position: 'absolute', top: 12, right: 12 }}>↗</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Footer */}
          <View style={{ paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.6)', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#292524', textTransform: 'uppercase' }}>IRONLAB v0.4 · Daily snapshot</Text>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#292524', textTransform: 'uppercase' }}>5 modules</Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
