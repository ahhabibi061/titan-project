import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle as SvgCircle,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING } from '../constants/theme';

// ─── MOCK DATA (mirrors web dashboard data shape) ───────────────────────────

const MOCK_PROFILE = { display_name: 'Marcus', subscription_tier: 'elite', goal: 'cut' };

const MOCK_CONSUMED = { kcal: 1840, protein: 142, carbs: 187, fat: 52, mealsLogged: 3 };
const MOCK_TARGETS  = { kcal: 2400, protein: 180, carbs: 240, fat: 80 };

const MOCK_WORKOUT = {
  id: 'w1',
  name: 'Push A',
  exercises: [
    { name: 'Bench Press',         sets: 4 },
    { name: 'Incline DB Press',    sets: 3 },
    { name: 'Cable Fly',           sets: 3 },
    { name: 'Tricep Pushdown',     sets: 3 },
    { name: 'Overhead Extension',  sets: 3 },
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

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface DayAdherence {
  day: string; label: string; today: boolean; future: boolean; rest: boolean;
  workout: boolean; meals: boolean; weight: boolean;
}
interface ActivityItem { time: string; type: string; text: string; }

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
    case 'meal':
      return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"><Path d="M3 3v8M3 7h2M11 3v8M11 7c-1.5 0-2-1-2-2V3" /></Svg>;
    case 'weight':
      return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5}><Path d="M2 4h10v7H2z" /><Path d="M5 4V3h4v1" /><Path d="M5 7h4" /></Svg>;
    case 'photo':
      return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5}><Path d="M2 4h10v8H2z" /><Circle cx="7" cy="8" r="2" /><Path d="M5 4l1-2h2l1 2" /></Svg>;
    case 'workout':
      return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"><Path d="M2 7h2M10 7h2M4 5v4M10 5v4M5 6h4v2H5z" /></Svg>;
    case 'coach':
      return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5}><Circle cx="7" cy="7" r="5" /><Path d="M7 4v3l2 1" /></Svg>;
    case 'water':
      return <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.5}><Path d="M7 2L4 7a3 3 0 006 0L7 2z" /></Svg>;
    default:
      return <Svg width={14} height={14} viewBox="0 0 14 14"><Circle cx="7" cy="7" r="2" fill={color} /></Svg>;
  }
}

// ─── CALORIE RING (SVG) ──────────────────────────────────────────────────────

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const pct = Math.min(consumed / (target || 1), 1);
  const r   = 36;
  const c   = 2 * Math.PI * r;
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
        <Circle
          cx="44" cy="44" r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${(pct * c).toFixed(1)} ${c.toFixed(1)}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFillObject, s.ringLabel]}>
        <Text style={s.ringNum}>{fmt0(consumed)}</Text>
        <Text style={s.ringSub}>/{fmt0(target)}</Text>
      </View>
    </View>
  );
}

// ─── MINI SPARKLINE (SVG) ────────────────────────────────────────────────────

function MiniSparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) return null;
  const min   = Math.min(...values);
  const max   = Math.max(...values);
  const range = max - min || 1;
  const W = 120; const H = 30;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - 2 - ((v - min) / range) * (H - 4),
  }));
  const d    = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Path d={d} stroke={COLORS.accent} strokeWidth={1.5} fill="none" />
      <SvgCircle cx={last.x} cy={last.y} r={2} fill={COLORS.accent} />
    </Svg>
  );
}

// ─── WEEKLY GRID ─────────────────────────────────────────────────────────────

function cellColor(status: string) {
  if (status === 'done')   return COLORS.accent;
  if (status === 'missed') return 'rgba(248,113,113,0.2)';
  if (status === 'rest')   return '#292524';
  return 'rgba(12,11,10,0.4)'; // future
}

function getCellStatus(d: DayAdherence, key: 'workout' | 'meals' | 'weight') {
  if (d.future) return 'future';
  if (key === 'workout') {
    if (d.rest) return 'rest';
    return d.workout ? 'done' : (d.today ? 'future' : 'missed');
  }
  return d[key] ? 'done' : (d.today || d.future ? 'future' : 'missed');
}

function WeeklyGrid({ days }: { days: DayAdherence[] }) {
  const rows: { key: 'workout' | 'meals' | 'weight'; label: string }[] = [
    { key: 'workout', label: 'Workout'   },
    { key: 'meals',   label: 'Nutrition' },
    { key: 'weight',  label: 'Weight'    },
  ];
  return (
    <View>
      {/* Day headers */}
      <View style={s.gridRow}>
        {days.map((d, i) => (
          <View key={i} style={s.gridCol}>
            <Text style={[s.gridDayLabel, d.today && { color: COLORS.orange300 }]}>{d.day}</Text>
            <Text style={[s.gridDateLabel, d.today && { color: COLORS.orange400 }]}>{d.label.split(' ')[1]}</Text>
          </View>
        ))}
      </View>
      {/* Data rows */}
      {rows.map(row => (
        <View key={row.key} style={s.gridSection}>
          <Text style={s.gridRowLabel}>{row.label}</Text>
          <View style={s.gridRow}>
            {days.map((d, i) => (
              <View key={i} style={s.gridCol}>
                <View style={[s.gridCell, { backgroundColor: cellColor(getCellStatus(d, row.key)) }]} />
              </View>
            ))}
          </View>
        </View>
      ))}
      {/* Legend */}
      <View style={s.legendRow}>
        {([
          [COLORS.accent,                  'Done'  ],
          ['rgba(248,113,113,0.2)', 'Missed'],
          ['#292524',                      'Rest'  ],
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
  const insets = useSafeAreaInsets();
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);

  const profile  = MOCK_PROFILE;
  const consumed = MOCK_CONSUMED;
  const targets  = MOCK_TARGETS;
  const workout  = MOCK_WORKOUT;
  const coach    = MOCK_COACH;
  const bio      = MOCK_BIO;
  const weekly   = MOCK_WEEKLY_STATS;
  const days     = MOCK_WEEKLY;
  const feed     = MOCK_ACTIVITY;

  const remaining   = targets.kcal - consumed.kcal;
  const weightDelta = bio.current - bio.weekAgo;
  const initials    = getInitials(profile.display_name);
  const tier        = profile.subscription_tier.toUpperCase();

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: SPACING.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. HEADER ROW ──────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <Text style={s.wordmark}>IRONLAB</Text>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
        </View>

        <Text style={s.greeting}>{getGreeting()}, {profile.display_name}.</Text>

        <View style={s.metaRow}>
          <View style={s.tierBadge}>
            <Text style={s.tierText}>{tier}</Text>
          </View>
          <Text style={s.metaDot}>·</Text>
          <Text style={s.metaText}>WEEK 1</Text>
          <Text style={s.metaDot}>·</Text>
          <Text style={[s.metaText, weekly.streak >= 7 && { color: '#fbbf24' }]}>
            🔥 {weekly.streak}D STREAK
          </Text>
        </View>

        {/* ── 2. STAT BAR (4 cards, horizontal scroll) ───────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.statBar}
          contentContainerStyle={s.statBarContent}
        >
          {/* Body Weight */}
          <View style={s.statCard}>
            <Text style={s.statLabel}>Weight</Text>
            <Text style={s.statValue}>{bio.current}<Text style={s.statUnit}> kg</Text></Text>
            <Text style={s.statSub}>
              {weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta).toFixed(1)} kg / 7d
            </Text>
          </View>

          {/* Calories Left */}
          <View style={s.statCard}>
            <Text style={s.statLabel}>Cal Left</Text>
            <Text style={[s.statValue, { color: COLORS.orange300 }]}>{fmt0(remaining)}</Text>
            <Text style={s.statSub}>{fmt0(consumed.kcal)} / {fmt0(targets.kcal)} kcal</Text>
          </View>

          {/* Today's Workout */}
          <View style={[s.statCard, { minWidth: 160 }]}>
            <Text style={s.statLabel}>Workout</Text>
            <Text style={[s.statValue, { fontSize: 22 }]} numberOfLines={1}>{workout.name}</Text>
            <Text style={s.statSub}>{workout.exercises.length} exercises · ~{workout.estimatedMinutes}m</Text>
          </View>

          {/* Streak */}
          <View style={[s.statCard, { borderRightWidth: 0 }]}>
            <Text style={s.statLabel}>Streak</Text>
            <Text style={[s.statValue, weekly.streak >= 7 && { color: '#fbbf24' }]}>
              🔥 {weekly.streak}<Text style={s.statUnit}> d</Text>
            </Text>
            <Text style={s.statSub}>keep going</Text>
          </View>
        </ScrollView>

        {/* ── 3. COACH ALERT BANNER ──────────────────────────────────── */}
        {coach && (
          <View style={s.coachBanner}>
            <View style={s.coachIcon}>
              <Svg width={18} height={18} viewBox="0 0 14 14" fill="none" stroke={COLORS.accent} strokeWidth={1.5}>
                <Circle cx="7" cy="7" r="5" />
                <Path d="M7 4v3l2 1" />
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

        {/* ── 4. TODAY'S WORKOUT CARD ────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardLabel}>Today's Workout</Text>
            <Text style={s.cardTag}>FORGE</Text>
          </View>

          <Text style={s.workoutName}>{workout.name}</Text>
          <Text style={s.workoutMeta}>
            {workout.exercises.length} exercises · ~{workout.estimatedMinutes} min
            {workout.completed ? ' · completed' : ''}
          </Text>

          <View style={s.exerciseList}>
            {workout.exercises.map((ex, i) => (
              <View key={i} style={s.exerciseRow}>
                <Text style={s.exerciseNum}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={s.exerciseName}>{ex.name}</Text>
                <Text style={s.exerciseSets}>{ex.sets} × sets</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => workout.completed && setWorkoutModalVisible(true)}
          >
            <Text style={s.primaryBtnText}>
              {workout.completed ? 'View Workout →' : 'Start Workout →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 5. TODAY'S MACROS CARD ─────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardLabel}>Today's Macros</Text>
            <Text style={s.cardTag}>→ SENTINEL</Text>
          </View>

          <View style={s.macrosTop}>
            <CalorieRing consumed={consumed.kcal} target={targets.kcal} />
            <View style={s.macrosSide}>
              <Text style={[s.statValue, { color: COLORS.orange300, fontSize: 28 }]}>{fmt0(remaining)}</Text>
              <Text style={s.statLabel}>KCAL REMAINING</Text>
              <Text style={[s.statSub, { marginTop: 4 }]}>{consumed.mealsLogged} meals logged</Text>
            </View>
          </View>

          <View style={s.macrosBars}>
            {([
              { l: 'Protein', c: consumed.protein, t: targets.protein, color: COLORS.accent    },
              { l: 'Carbs',   c: consumed.carbs,   t: targets.carbs,   color: COLORS.blue400   },
              { l: 'Fat',     c: consumed.fat,      t: targets.fat,    color: '#fbbf24'         },
            ]).map(m => (
              <View key={m.l} style={s.macroRow}>
                <View style={s.macroLabelRow}>
                  <Text style={s.macroLabel}>{m.l}</Text>
                  <Text style={s.macroValue}>
                    <Text style={{ color: COLORS.text300 }}>{m.c}</Text>
                    <Text style={{ color: COLORS.text600 }}> / {m.t}g</Text>
                  </Text>
                </View>
                <View style={s.macroBarBg}>
                  <View style={[s.macroBarFill, { width: `${Math.min((m.c / (m.t || 1)) * 100, 100)}%` as any, backgroundColor: m.color }]} />
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.secondaryBtn}>
            <Text style={s.secondaryBtnText}>Scan Meal</Text>
          </TouchableOpacity>
        </View>

        {/* ── 6. WEIGHT TREND CARD ───────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardLabel}>Body Comp</Text>
            <Text style={s.cardTag}>→ VAULT</Text>
          </View>

          <Text style={s.bigWeight}>
            {bio.current}<Text style={[s.statUnit, { fontSize: 22 }]}> kg</Text>
          </Text>

          <View style={s.weightDeltaRow}>
            <Text style={[s.metaText, { color: COLORS.orange300 }]}>
              {weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta).toFixed(1)} kg
            </Text>
            <Text style={[s.metaText, { marginLeft: SPACING.sm }]}>last 7d</Text>
          </View>

          <View style={{ height: 30, marginVertical: SPACING.md }}>
            <MiniSparkline values={bio.sparkline} />
          </View>

          <View style={s.divider} />
          <View style={s.weightGoalRow}>
            <Text style={s.goalLabel}>Goal</Text>
            <Text style={[s.metaText, { color: COLORS.orange300 }]}>{bio.goal} kg</Text>
            <Text style={s.goalSub}>{Math.abs(bio.current - bio.goal).toFixed(1)} to go</Text>
          </View>
        </View>

        {/* ── 7. THIS WEEK GRID ──────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.sectionTitle}>This Week</Text>
            <Text style={s.cardTag}>VAULT →</Text>
          </View>
          <WeeklyGrid days={days} />

          <View style={[s.divider, { marginTop: SPACING.lg }]} />
          <View style={s.weekStatsGrid}>
            {([
              { label: 'Total Sets',  value: `${weekly.totalSets}`, unit: 'sets' },
              { label: 'Avg Daily',   value: `${fmt0(weekly.avgKcal)}`, unit: 'kcal' },
              { label: 'Avg Protein', value: `${weekly.avgProtein}`, unit: 'g'    },
              { label: 'Streak',      value: `${weekly.streak}`, unit: 'd'   },
            ]).map(item => (
              <View key={item.label} style={s.weekStat}>
                <Text style={s.weekStatLabel}>{item.label}</Text>
                <Text style={s.weekStatValue}>
                  {item.value}<Text style={s.statUnit}> {item.unit}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── 8. TODAY'S ACTIVITY FEED ───────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.sectionTitle}>Today's Activity</Text>
            <Text style={s.cardTag}>{feed.length} events</Text>
          </View>

          {feed.map((a, i) => (
            <View key={i} style={[s.feedRow, i === feed.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.feedTime}>{a.time}</Text>
              <View style={[
                s.feedIconBox,
                a.type === 'coach' && { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
                a.type === 'water' && { borderColor: 'rgba(96,165,250,0.3)', backgroundColor: 'rgba(96,165,250,0.05)' },
              ]}>
                <ActivityIcon type={a.type} />
              </View>
              <Text style={s.feedText} numberOfLines={1}>{a.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── WORKOUT REVIEW MODAL (completed state) ──────────────────── */}
      <Modal visible={workoutModalVisible} animationType="slide" transparent onRequestClose={() => setWorkoutModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{workout.name}</Text>
            <Text style={[s.metaText, { marginBottom: SPACING.lg }]}>
              {workout.exercises.length} exercises · {workout.estimatedMinutes} min
            </Text>
            {workout.exercises.map((ex, i) => (
              <View key={i} style={s.exerciseRow}>
                <Text style={s.exerciseNum}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={s.exerciseName}>{ex.name}</Text>
                <Text style={s.exerciseSets}>{ex.sets} × sets</Text>
              </View>
            ))}
            <TouchableOpacity style={[s.secondaryBtn, { marginTop: SPACING.xl }]} onPress={() => setWorkoutModalVisible(false)}>
              <Text style={s.secondaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window');

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bg },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: SPACING.lg },

  // Header
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.sm },
  wordmark:    { fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, textTransform: 'uppercase', letterSpacing: 1 },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontFamily: FONTS.anton, fontSize: 13, color: COLORS.bg },
  greeting:    { fontFamily: FONTS.anton, fontSize: 36, color: COLORS.text100, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 42, marginBottom: SPACING.sm },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xl, flexWrap: 'wrap' },
  tierBadge:   { paddingHorizontal: SPACING.sm, paddingVertical: 3, backgroundColor: COLORS.accentMuted, borderWidth: 1, borderColor: COLORS.accentBorder },
  tierText:    { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange300, textTransform: 'uppercase', letterSpacing: 1.5 },
  metaDot:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700 },
  metaText:    { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.2 },

  // Stat bar
  statBar:        { marginBottom: SPACING.xl },
  statBarContent: { gap: 0 },
  statCard:       { minWidth: 140, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, marginRight: SPACING.sm },
  statLabel:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 4 },
  statValue:      { fontFamily: FONTS.anton, fontSize: 30, color: COLORS.text100, lineHeight: 34 },
  statUnit:       { fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text500 },
  statSub:        { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange300, marginTop: 2 },

  // Coach banner
  coachBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: 'rgba(237,122,42,0.07)', padding: SPACING.md, marginBottom: SPACING.xl },
  coachIcon:   { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accentMuted, borderWidth: 1, borderColor: COLORS.accentBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  coachBody:   { flex: 1 },
  coachFrom:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange400, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  coachHeadline:{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, textTransform: 'uppercase', lineHeight: 20 },
  coachSummary: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.text400, marginTop: 2 },
  coachBtn:    { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.accent, flexShrink: 0 },
  coachBtnText:{ fontFamily: FONTS.anton, fontSize: 12, color: COLORS.bg, textTransform: 'uppercase' },

  // Cards
  card:       { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, padding: SPACING.lg, marginBottom: SPACING.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACING.md },
  cardLabel:  { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 2 },
  cardTag:    { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.2 },
  sectionTitle:{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, textTransform: 'uppercase' },

  // Workout
  workoutName: { fontFamily: FONTS.anton, fontSize: 40, color: COLORS.text100, textTransform: 'uppercase', lineHeight: 44, marginBottom: SPACING.xs },
  workoutMeta: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.md },
  exerciseList:{ marginBottom: SPACING.lg },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(41,37,36,0.4)' },
  exerciseNum: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, width: 28 },
  exerciseName:{ flex: 1, fontFamily: FONTS.sansMed, fontSize: 14, color: COLORS.text300 },
  exerciseSets:{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 },

  // Buttons
  primaryBtn:     { paddingVertical: SPACING.md, backgroundColor: COLORS.accent, alignItems: 'center' },
  primaryBtnText: { fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, textTransform: 'uppercase', letterSpacing: 1 },
  secondaryBtn:     { paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  secondaryBtnText: { fontFamily: FONTS.anton, fontSize: 14, color: COLORS.text300, textTransform: 'uppercase', letterSpacing: 1 },

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
  bigWeight:     { fontFamily: FONTS.anton, fontSize: 52, color: COLORS.text100, lineHeight: 56 },
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
  gridCell:     { height: 8, width: '90%' },
  legendRow:    { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:    { width: 10, height: 6 },
  legendLabel:  { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },

  // Week stats
  weekStatsGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg, marginTop: SPACING.lg },
  weekStat:     { minWidth: (SW - 32 * 2 - SPACING.lg * 2) / 2 - SPACING.sm },
  weekStatLabel:{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  weekStatValue:{ fontFamily: FONTS.anton, fontSize: 24, color: COLORS.text100 },

  // Activity feed
  feedRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  feedTime:    { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, width: 38, flexShrink: 0 },
  feedIconBox: { width: 28, height: 28, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  feedText:    { flex: 1, fontFamily: FONTS.sansMed, fontSize: 13, color: COLORS.text300 },

  // Divider
  divider: { height: 1, backgroundColor: COLORS.borderLight },

  // Modal
  modalOverlay:{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet:  { backgroundColor: '#0c0b0a', borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.xl },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.text600, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle:  { fontFamily: FONTS.anton, fontSize: 32, color: COLORS.text100, textTransform: 'uppercase', marginBottom: SPACING.xs },
});
