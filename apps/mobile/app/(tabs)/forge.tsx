// FORGE — Workout Logger · Pass 4 visual accuracy rewrite
// Implements: SetRow redesign, ExerciseCard redesign, Volume Breakdown bar graph,
//             ForgeBodyMap with Recovery/Growth toggle, My Splits tab + CreateSplitSheet
import React, {
  useState, useMemo, useRef, useEffect, useCallback,
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  Animated, PanResponder, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';

// ─── Design tokens ───────────────────────────────────────────────────────────
const COLORS = {
  bg:          '#0a0908',
  bgCard:      'rgba(12,10,8,0.4)',
  border:      '#292524',
  borderLight: 'rgba(41,37,36,0.6)',
  accent:      '#ed7a2a',
  accentMuted: 'rgba(237,122,42,0.12)',
  accentBorder:'rgba(237,122,42,0.3)',
  text100:     '#f5f5f4',
  text300:     '#d6d3d1',
  text400:     '#a8a29e',
  text500:     '#78716c',
  text600:     '#57534e',
  text700:     '#44403c',
  orange300:   '#fca570',
  orange400:   '#fb923c',
  accentHot:   '#ff5a2a',
  red400:      '#f87171',
};
const FONTS = {
  anton: 'Anton_400Regular',
  mono:  'JetBrainsMono_400Regular',
};

// ─── Domain ─────────────────────────────────────────────────────────────────
const MUSCLES: Record<string, string> = {
  chest: 'Chest', front_delts: 'Front Delts', side_delts: 'Side Delts',
  rear_delts: 'Rear Delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  lats: 'Lats', lower_back: 'Lower Back', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', calves: 'Calves',
};

const MUSCLE_GROUPS = Object.keys(MUSCLES);

const MUSCLE_RECOVERY_HOURS: Record<string, number> = {
  chest: 72, lats: 72, lower_back: 72, glutes: 72, quads: 72, hamstrings: 72,
  front_delts: 48, rear_delts: 48, side_delts: 48, biceps: 48, triceps: 48,
  calves: 36, traps: 36, forearms: 36, abs: 36, obliques: 36,
};

const EXERCISE_LIBRARY = [
  // CHEST
  { id: 'bench',               name: 'Barbell Bench Press',        primary: ['chest'],         secondary: ['front_delts','triceps'] },
  { id: 'incline_db',          name: 'Incline DB Press',           primary: ['chest'],         secondary: ['front_delts','triceps'] },
  { id: 'cable_fly',           name: 'Cable Crossover',            primary: ['chest'],         secondary: ['front_delts'] },
  { id: 'dips',                name: 'Weighted Dips',              primary: ['chest'],         secondary: ['triceps','front_delts'] },
  { id: 'pushup',              name: 'Push-Up',                    primary: ['chest'],         secondary: ['front_delts','triceps','abs'] },
  { id: 'chest_press',         name: 'Machine Chest Press',        primary: ['chest'],         secondary: ['front_delts','triceps'] },
  // SHOULDERS
  { id: 'ohp',                 name: 'Standing Overhead Press',    primary: ['front_delts'],   secondary: ['side_delts','triceps'] },
  { id: 'lateral_raise',       name: 'DB Lateral Raise',           primary: ['side_delts'],    secondary: [] },
  { id: 'cable_lateral',       name: 'Cable Lateral Raise',        primary: ['side_delts'],    secondary: [] },
  { id: 'rear_delt_fly',       name: 'Reverse Pec Deck',           primary: ['rear_delts'],    secondary: ['traps'] },
  { id: 'face_pull',           name: 'Cable Face Pull',            primary: ['rear_delts'],    secondary: ['traps'] },
  { id: 'pike_pushup',         name: 'Pike Push-Up',               primary: ['front_delts'],   secondary: ['triceps','traps'] },
  { id: 'smith_ohp',           name: 'Smith Machine OHP',          primary: ['front_delts'],   secondary: ['side_delts','triceps'] },
  { id: 'kb_press',            name: 'Kettlebell Overhead Press',  primary: ['front_delts'],   secondary: ['side_delts','triceps','abs'] },
  { id: 'shrug',               name: 'DB Shrug',                   primary: ['traps'],         secondary: [] },
  // BACK
  { id: 'pullup',              name: 'Pull-Up',                    primary: ['lats'],          secondary: ['biceps','rear_delts'] },
  { id: 'chin_up',             name: 'Chin-Up',                    primary: ['biceps'],        secondary: ['lats','rear_delts'] },
  { id: 'row',                 name: 'Barbell Row',                primary: ['lats'],          secondary: ['biceps','rear_delts','traps'] },
  { id: 'lat_pulldown',        name: 'Lat Pulldown',               primary: ['lats'],          secondary: ['biceps'] },
  { id: 'tbar_row',            name: 'T-Bar Row',                  primary: ['lats'],          secondary: ['biceps','traps'] },
  { id: 'cable_row',           name: 'Seated Cable Row',           primary: ['lats'],          secondary: ['biceps','rear_delts','traps'] },
  { id: 'inverted_row',        name: 'Inverted Row',               primary: ['lats'],          secondary: ['biceps','rear_delts','traps'] },
  { id: 'kb_row',              name: 'Kettlebell Single-Arm Row',  primary: ['lats'],          secondary: ['biceps','rear_delts'] },
  { id: 'machine_pullover',    name: 'Machine Pullover',           primary: ['lats'],          secondary: ['chest','abs'] },
  // ARMS
  { id: 'curl',                name: 'Barbell Curl',               primary: ['biceps'],        secondary: ['forearms'] },
  { id: 'hammer_curl',         name: 'Hammer Curl',                primary: ['biceps'],        secondary: ['forearms'] },
  { id: 'preacher_curl',       name: 'Preacher Curl',              primary: ['biceps'],        secondary: [] },
  { id: 'cable_curl',          name: 'Cable Curl',                 primary: ['biceps'],        secondary: ['forearms'] },
  { id: 'tricep_pushdown',     name: 'Cable Tricep Pushdown',      primary: ['triceps'],       secondary: [] },
  { id: 'skullcrusher',        name: 'Skullcrusher',               primary: ['triceps'],       secondary: [] },
  { id: 'dip_bw',              name: 'Bodyweight Dip',             primary: ['triceps'],       secondary: ['chest','front_delts'] },
  { id: 'diamond_pushup',      name: 'Diamond Push-Up',            primary: ['triceps'],       secondary: ['chest','front_delts'] },
  // LEGS
  { id: 'squat',               name: 'Back Squat',                 primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'front_squat',         name: 'Front Squat',                primary: ['quads'],         secondary: ['glutes','abs'] },
  { id: 'leg_press',           name: 'Leg Press',                  primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'hack_squat',          name: 'Hack Squat Machine',         primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'bodyweight_squat',    name: 'Bodyweight Squat',           primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'pistol_squat',        name: 'Pistol Squat',               primary: ['quads'],         secondary: ['glutes','abs'] },
  { id: 'bulgarian',           name: 'Bulgarian Split Squat',      primary: ['quads'],         secondary: ['glutes'] },
  { id: 'kb_goblet_squat',     name: 'Kettlebell Goblet Squat',    primary: ['quads'],         secondary: ['glutes','abs'] },
  { id: 'kb_lunge',            name: 'Kettlebell Lunge',           primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'rdl',                 name: 'Romanian Deadlift',          primary: ['hamstrings'],    secondary: ['glutes','lower_back'] },
  { id: 'deadlift',            name: 'Conventional Deadlift',      primary: ['hamstrings'],    secondary: ['glutes','lower_back','traps'] },
  { id: 'leg_curl',            name: 'Lying Leg Curl',             primary: ['hamstrings'],    secondary: [] },
  { id: 'nordic_curl',         name: 'Nordic Hamstring Curl',      primary: ['hamstrings'],    secondary: ['glutes','calves'] },
  { id: 'kb_deadlift',         name: 'Kettlebell Deadlift',        primary: ['hamstrings'],    secondary: ['glutes','lower_back','traps'] },
  { id: 'hip_thrust',          name: 'Barbell Hip Thrust',         primary: ['glutes'],        secondary: ['hamstrings'] },
  { id: 'glute_bridge',        name: 'Glute Bridge',               primary: ['glutes'],        secondary: ['hamstrings','lower_back'] },
  { id: 'adductor_machine',    name: 'Hip Adduction Machine',      primary: ['glutes'],        secondary: ['hamstrings'] },
  { id: 'cable_pull_through',  name: 'Cable Pull-Through',         primary: ['glutes'],        secondary: ['hamstrings','lower_back'] },
  { id: 'calf_raise',          name: 'Standing Calf Raise',        primary: ['calves'],        secondary: [] },
  { id: 'seated_calf',         name: 'Seated Calf Raise',          primary: ['calves'],        secondary: [] },
  // CORE
  { id: 'crunch',              name: 'Cable Crunch',               primary: ['abs'],           secondary: [] },
  { id: 'plank',               name: 'Plank',                      primary: ['abs'],           secondary: ['obliques'] },
  { id: 'leg_raise',           name: 'Hanging Leg Raise',          primary: ['abs'],           secondary: ['obliques'] },
  { id: 'situp',               name: 'Sit-Up',                     primary: ['abs'],           secondary: ['obliques'] },
  { id: 'ab_wheel',            name: 'Ab Wheel Rollout',           primary: ['abs'],           secondary: ['obliques','lats','lower_back'] },
  { id: 'dead_bug',            name: 'Dead Bug',                   primary: ['abs'],           secondary: ['obliques'] },
  { id: 'dragon_flag',         name: 'Dragon Flag',                primary: ['abs'],           secondary: ['obliques','lower_back'] },
  { id: 'pallof_press',        name: 'Pallof Press',               primary: ['abs'],           secondary: ['obliques'] },
  { id: 'cable_woodchop',      name: 'Cable Woodchop',             primary: ['obliques'],      secondary: ['abs','front_delts'] },
  { id: 'russian_twist',       name: 'Russian Twist',              primary: ['obliques'],      secondary: ['abs'] },
  // KETTLEBELL / CARRIES
  { id: 'kb_swing',            name: 'Kettlebell Swing',           primary: ['glutes'],        secondary: ['hamstrings','lower_back','traps'] },
  { id: 'kb_clean',            name: 'Kettlebell Clean',           primary: ['glutes'],        secondary: ['traps','hamstrings','forearms'] },
  { id: 'kb_turkish_getup',    name: 'Turkish Get-Up',             primary: ['abs'],           secondary: ['front_delts','glutes','traps'] },
  { id: 'farmers_carry',       name: "Farmer's Carry",             primary: ['traps'],         secondary: ['forearms','abs','glutes','calves'] },
  // CARDIO / CONDITIONING
  { id: 'rowing_machine',      name: 'Rowing Machine',             primary: ['lats'],          secondary: ['hamstrings','glutes','biceps','abs'] },
  { id: 'assault_bike',        name: 'Assault Bike',               primary: ['quads'],         secondary: ['glutes','hamstrings','chest','lats'] },
  { id: 'sled_push',           name: 'Sled Push',                  primary: ['quads'],         secondary: ['glutes','hamstrings','calves','abs'] },
];

// ─── Hardcoded template splits ───────────────────────────────────────────────
const HARDCODED_TEMPLATES = [
  { id: 'tpl_push', name: 'Push Day', exercises: [
    { exerciseId: 'bench', setsTarget: 4 },
    { exerciseId: 'incline_db', setsTarget: 3 },
    { exerciseId: 'ohp', setsTarget: 3 },
    { exerciseId: 'lateral_raise', setsTarget: 3 },
    { exerciseId: 'tricep_pushdown', setsTarget: 3 },
  ]},
  { id: 'tpl_pull', name: 'Pull Day', exercises: [
    { exerciseId: 'pullup', setsTarget: 4 },
    { exerciseId: 'row', setsTarget: 4 },
    { exerciseId: 'lat_pulldown', setsTarget: 3 },
    { exerciseId: 'curl', setsTarget: 3 },
    { exerciseId: 'face_pull', setsTarget: 3 },
  ]},
  { id: 'tpl_legs', name: 'Leg Day', exercises: [
    { exerciseId: 'squat', setsTarget: 4 },
    { exerciseId: 'rdl', setsTarget: 3 },
    { exerciseId: 'leg_press', setsTarget: 3 },
    { exerciseId: 'leg_curl', setsTarget: 3 },
    { exerciseId: 'calf_raise', setsTarget: 4 },
  ]},
];

// Push day mock — starts pre-populated per web reference
const INITIAL_WORKOUT = [
  { id: 'we1', exerciseId: 'bench', sets: [
    { id: 's11', reps: 10, weight: 60,   rir: 2, done: false, prevReps: 10, prevWeight: 57.5 },
    { id: 's12', reps: 10, weight: 60,   rir: 2, done: false, prevReps: 9,  prevWeight: 57.5 },
    { id: 's13', reps: 8,  weight: 60,   rir: 2, done: false, prevReps: 8,  prevWeight: 57.5 },
  ]},
  { id: 'we2', exerciseId: 'incline_db', sets: [
    { id: 's21', reps: 10, weight: 22.5, rir: 2, done: false, prevReps: 10, prevWeight: 22.5 },
    { id: 's22', reps: 10, weight: 22.5, rir: 2, done: false, prevReps: 9,  prevWeight: 22.5 },
    { id: 's23', reps: 9,  weight: 22.5, rir: 2, done: false, prevReps: 8,  prevWeight: 22.5 },
  ]},
  { id: 'we3', exerciseId: 'ohp', sets: [
    { id: 's31', reps: 8,  weight: 40,   rir: 2, done: false, prevReps: 8,  prevWeight: 37.5 },
    { id: 's32', reps: 8,  weight: 40,   rir: 2, done: false, prevReps: 7,  prevWeight: 37.5 },
    { id: 's33', reps: 6,  weight: 40,   rir: 2, done: false, prevReps: 6,  prevWeight: 37.5 },
  ]},
  { id: 'we4', exerciseId: 'lateral_raise', sets: [
    { id: 's41', reps: 12, weight: 10,   rir: 2, done: false, prevReps: 12, prevWeight: 10 },
    { id: 's42', reps: 12, weight: 10,   rir: 2, done: false, prevReps: 12, prevWeight: 10 },
    { id: 's43', reps: 10, weight: 10,   rir: 2, done: false, prevReps: 10, prevWeight: 10 },
  ]},
  { id: 'we5', exerciseId: 'tricep_pushdown', sets: [
    { id: 's51', reps: 12, weight: 25,   rir: 2, done: false, prevReps: 12, prevWeight: 22.5 },
    { id: 's52', reps: 12, weight: 25,   rir: 2, done: false, prevReps: 11, prevWeight: 22.5 },
    { id: 's53', reps: 10, weight: 25,   rir: 2, done: false, prevReps: 10, prevWeight: 22.5 },
  ]},
];

// ─── Types ───────────────────────────────────────────────────────────────────
interface SetData {
  id: string; reps: number | string; weight: number | string;
  rir: number; done: boolean; prevReps: number; prevWeight: number;
}
interface WorkoutEntry { id: string; exerciseId: string; sets: SetData[]; }

interface UserSplit {
  id: string;
  name: string;
  exercises: { exerciseId: string; setsTarget: number }[];
}

const SELECTOR_TABS = ['New Session', 'My Splits', 'Templates', 'Past Session'] as const;
type SelectorTab = typeof SELECTOR_TABS[number];

// ─── Logic ───────────────────────────────────────────────────────────────────
const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US');

function setVol(reps: number | string, weight: number | string) {
  return (Number(reps) || 0) * (Number(weight) || 0);
}

function exerciseVol(we: WorkoutEntry, completedOnly = true) {
  return we.sets
    .filter(s => !completedOnly || s.done)
    .reduce((acc, s) => acc + setVol(s.reps, s.weight), 0);
}

function muscleVolumes(workout: WorkoutEntry[]) {
  const v: Record<string, number> = {};
  for (const we of workout) {
    const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
    if (!ex) continue;
    const vol = exerciseVol(we, true);
    if (vol === 0) continue;
    ex.primary.forEach(m   => { v[m] = (v[m] || 0) + vol; });
    ex.secondary.forEach(m => { v[m] = (v[m] || 0) + vol * 0.5; });
  }
  return v;
}

// ─── ForgeBodyMap color functions ────────────────────────────────────────────
function volumeToRecovery(vol: number, maxVol: number): string | null {
  if (!vol || vol <= 0) return null;
  const t = vol / Math.max(maxVol, 1);
  if (t >= 0.67) return '#f87171';
  if (t >= 0.34) return '#fb923c';
  if (t >= 0.10) return '#a3e635';
  return '#4ade80';
}

function volumeToGrowth(vol: number, maxVol: number): string | null {
  if (!vol || vol <= 0) return null;
  const t = vol / Math.max(maxVol, 1);
  if (t >= 0.67) return '#4ade80';
  if (t >= 0.34) return '#a3e635';
  return '#fb923c';
}

// ─── SVG Muscle Paths (viewBox 220×460) ─────────────────────────────────────
const FRONT_PATHS: Record<string, string> = {
  chest: 'M 76,96 Q 90,88 108,90 L 108,138 Q 96,144 84,140 Q 76,134 74,124 Z M 144,96 Q 130,88 112,90 L 112,138 Q 124,144 136,140 Q 144,134 146,124 Z',
  front_delts: 'M 64,86 Q 56,88 52,102 Q 50,116 56,124 Q 66,124 74,118 Q 76,104 74,94 Q 70,86 64,86 Z M 156,86 Q 164,88 168,102 Q 170,116 164,124 Q 154,124 146,118 Q 144,104 146,94 Q 150,86 156,86 Z',
  side_delts: 'M 50,100 Q 42,104 40,118 Q 40,128 46,134 Q 52,132 56,124 Q 50,116 52,102 Z M 170,100 Q 178,104 180,118 Q 180,128 174,134 Q 168,132 164,124 Q 170,116 168,102 Z',
  traps: 'M 102,68 Q 98,76 100,84 Q 106,86 110,84 L 110,68 Z M 118,68 Q 122,76 120,84 Q 114,86 110,84 L 110,68 Z',
  biceps: 'M 46,128 Q 38,134 38,158 Q 42,176 50,178 Q 56,176 56,156 Q 56,138 52,130 Z M 174,128 Q 182,134 182,158 Q 178,176 170,178 Q 164,176 164,156 Q 164,138 168,130 Z',
  forearms: 'M 38,182 Q 32,196 32,222 Q 36,238 44,236 Q 50,234 52,218 Q 52,200 50,184 Z M 182,182 Q 188,196 188,222 Q 184,238 176,236 Q 170,234 168,218 Q 168,200 170,184 Z',
  abs: 'M 96,144 L 124,144 L 124,160 L 96,160 Z M 96,164 L 124,164 L 124,180 L 96,180 Z M 96,184 L 124,184 L 124,200 L 96,200 Z M 96,204 L 124,204 L 124,220 L 96,220 Z M 96,224 L 124,224 L 124,238 L 96,238 Z',
  obliques: 'M 78,150 Q 76,180 86,224 L 96,222 L 96,148 Q 86,146 78,150 Z M 142,150 Q 144,180 134,224 L 124,222 L 124,148 Q 134,146 142,150 Z',
  quads: 'M 78,250 Q 70,290 76,348 L 104,348 L 104,250 Q 90,246 78,250 Z M 142,250 Q 150,290 144,348 L 116,348 L 116,250 Q 130,246 142,250 Z',
  calves: 'M 84,388 Q 80,408 84,438 L 102,438 L 102,388 Z M 136,388 Q 140,408 136,438 L 118,438 L 118,388 Z',
};
const BACK_PATHS: Record<string, string> = {
  traps: 'M 110,72 L 90,86 Q 84,108 92,124 L 110,118 L 128,124 Q 136,108 130,86 Z',
  rear_delts: 'M 64,90 Q 56,96 52,110 Q 52,124 60,128 Q 70,126 76,118 Q 78,104 74,94 Z M 156,90 Q 164,96 168,110 Q 168,124 160,128 Q 150,126 144,118 Q 142,104 146,94 Z',
  triceps: 'M 46,132 Q 40,144 40,166 Q 44,180 52,180 Q 58,178 58,158 Q 58,140 52,132 Z M 174,132 Q 180,144 180,166 Q 176,180 168,180 Q 162,178 162,158 Q 162,140 168,132 Z',
  forearms: 'M 38,184 Q 32,200 32,224 Q 36,238 44,236 Q 50,234 52,218 Q 52,200 50,186 Z M 182,184 Q 188,200 188,224 Q 184,238 176,236 Q 170,234 168,218 Q 168,200 170,186 Z',
  lats: 'M 76,118 Q 60,150 64,200 L 102,206 L 102,134 Q 88,124 76,118 Z M 144,118 Q 160,150 156,200 L 118,206 L 118,134 Q 132,124 144,118 Z',
  lower_back: 'M 100,206 L 120,206 L 122,244 Q 110,248 98,244 Z',
  glutes: 'M 86,250 Q 76,272 88,300 Q 102,304 108,294 L 108,254 Q 96,248 86,250 Z M 134,250 Q 144,272 132,300 Q 118,304 112,294 L 112,254 Q 124,248 134,250 Z',
  hamstrings: 'M 80,300 Q 72,340 78,386 L 104,386 L 104,300 Q 92,296 80,300 Z M 140,300 Q 148,340 142,386 L 116,386 L 116,300 Q 128,296 140,300 Z',
  calves: 'M 76,388 Q 72,416 80,442 L 104,442 L 104,388 Z M 144,388 Q 148,416 140,442 L 116,442 L 116,388 Z',
};

// ─── FIX 3: ForgeBodyMap — Recovery/Growth toggle ────────────────────────────
function ForgeBodyMap({ volumes, maxVol }: { volumes: Record<string, number>; maxVol: number }) {
  const [mode, setMode] = useState<'recovery' | 'growth'>('recovery');

  function renderPaths(paths: Record<string, string>, colorFn: (vol: number, max: number) => string | null) {
    return Object.entries(paths).map(([key, d]) => {
      const color = colorFn(volumes[key] || 0, maxVol);
      return (
        <Path
          key={key}
          d={d}
          fill={color ?? 'rgba(255,255,255,0.025)'}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={0.5}
        />
      );
    });
  }

  const colorFn = mode === 'recovery' ? volumeToRecovery : volumeToGrowth;

  // Top 3 muscles by volume
  const top3 = Object.entries(volumes)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const recoveryLegend: [string, string][] = [
    ['#4ade80', 'READY'], ['#a3e635', 'ALMOST'], ['#fb923c', 'PARTIAL'], ['#f87171', 'RESTING'],
  ];
  const growthLegend: [string, string][] = [
    ['#4ade80', 'HIGH'], ['#a3e635', 'MODERATE'], ['#fb923c', 'LOW'], ['#57534e', 'UNDERTRAINED'],
  ];
  const legend = mode === 'recovery' ? recoveryLegend : growthLegend;

  return (
    <View>
      {/* Toggle row */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
        {(['recovery', 'growth'] as const).map(m => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={{
              paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
              borderColor: mode === m ? COLORS.accent : COLORS.border,
              backgroundColor: mode === m ? COLORS.accentMuted : 'transparent',
            }}
          >
            <Text style={{
              fontFamily: FONTS.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1,
              color: mode === m ? COLORS.accent : COLORS.text600,
            }}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Body map side by side */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 4 }}>ANTERIOR</Text>
          <Svg viewBox="0 0 220 460" style={{ width: '100%', aspectRatio: 220 / 460 }}>
            <Circle cx={110} cy={44} r={22} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <Rect x={100} y={62} width={20} height={14} fill="rgba(255,255,255,0.04)" />
            {renderPaths(FRONT_PATHS, colorFn)}
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 4 }}>POSTERIOR</Text>
          <Svg viewBox="0 0 220 460" style={{ width: '100%', aspectRatio: 220 / 460 }}>
            <Circle cx={110} cy={44} r={22} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <Rect x={100} y={62} width={20} height={14} fill="rgba(255,255,255,0.04)" />
            {renderPaths(BACK_PATHS, colorFn)}
          </Svg>
        </View>
      </View>

      {/* Legend */}
      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {legend.map(([color, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
            <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase' }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Summary */}
      {top3.length > 0 && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
            {mode === 'recovery' ? 'MOST FATIGUED' : 'TOP GAINS'}
          </Text>
          {top3.map(([key, vol]) => {
            const color = colorFn(vol, maxVol) ?? COLORS.text600;
            const window = MUSCLE_RECOVERY_HOURS[key] ?? 48;
            const hoursLeft = Math.round(window * (vol / Math.max(maxVol, 1)));
            return (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400 }}>{MUSCLES[key] ?? key}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text300 }}>{fmt0(vol)}</Text>
                  {mode === 'recovery' ? (
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>{hoursLeft}h load</Text>
                  ) : (
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>vol</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── FIX 1+6: SetRow — full redesign ─────────────────────────────────────────
interface SetRowProps {
  set: SetData;
  idx: number;
  lastSet: { reps: number; weight: number } | null;
  onUpdate: (patch: Partial<SetData>) => void;
  onDelete: () => void;
  isLast: boolean;
}

function SetRow({ set, idx, lastSet, onUpdate, onDelete, isLast }: SetRowProps) {
  const curReps   = Number(set.reps   || 0);
  const curWeight = Number(set.weight || 0);
  const curVol    = curReps * curWeight;
  const prevVol   = lastSet ? lastSet.reps * lastSet.weight : 0;

  type PillKind = 'new' | 'up' | 'match' | 'down';
  let kind: PillKind;
  if (curVol === 0) {
    kind = 'new';
  } else if (prevVol === 0) {
    kind = 'new';
  } else if (curVol > prevVol) {
    kind = 'up';
  } else if (curVol === prevVol) {
    kind = 'match';
  } else {
    kind = 'down';
  }

  const pillStyles: Record<PillKind, { bg: string; border: string; text: string; label: string }> = {
    new:   { bg: 'rgba(237,122,42,0.15)',   border: COLORS.accentBorder,          text: COLORS.accent,   label: '+ NEW' },
    up:    { bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.35)',       text: '#4ade80',       label: '▲ UP' },
    match: { bg: 'rgba(87,83,78,0.12)',     border: 'rgba(87,83,78,0.35)',         text: COLORS.text500,  label: '= MATCH' },
    down:  { bg: 'rgba(248,113,113,0.1)',   border: 'rgba(248,113,113,0.35)',      text: '#f87171',       label: '▼ DOWN' },
  };
  const pill = pillStyles[kind];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.2)' }}>
      {/* 1. Set number */}
      <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, width: 20, textAlign: 'center' }}>
        {idx + 1}
      </Text>

      {/* 2. Last session reference */}
      <View style={{ width: 74 }}>
        {lastSet ? (
          <>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text400 }}>
              {lastSet.reps} × {lastSet.weight}kg
            </Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>
              vol {fmt0(lastSet.reps * lastSet.weight)}
            </Text>
          </>
        ) : (
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700 }}>—</Text>
        )}
      </View>

      {/* 3. Reps input */}
      <TextInput
        style={{
          height: 36, width: 52, fontSize: 15, fontFamily: FONTS.anton, textAlign: 'center',
          backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
          color: COLORS.text100,
        }}
        value={String(set.reps)}
        onChangeText={v => onUpdate({ reps: v })}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={COLORS.text700}
      />

      {/* 4. Weight input + kg label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <TextInput
          style={{
            height: 36, width: 52, fontSize: 15, fontFamily: FONTS.anton, textAlign: 'center',
            backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
            color: COLORS.text100,
          }}
          value={String(set.weight)}
          onChangeText={v => onUpdate({ weight: v })}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={COLORS.text700}
        />
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>kg</Text>
      </View>

      {/* 5. Live volume */}
      <View style={{ width: 38 }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, textAlign: 'center' }}>
          {curVol > 0 ? fmt0(curVol) : '—'}
        </Text>
      </View>

      {/* 6. Status pill */}
      <View style={{
        paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, width: 52, alignItems: 'center',
        backgroundColor: pill.bg, borderColor: pill.border,
      }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.3, color: pill.text }}>
          {pill.label}
        </Text>
      </View>

      {/* 7. × delete button */}
      <TouchableOpacity
        onPress={() => { if (!isLast) onDelete(); }}
        disabled={isLast}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ width: 24, height: 44, alignItems: 'center', justifyContent: 'center', opacity: isLast ? 0.2 : 1 }}
      >
        <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: '#f87171' }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── FIX 1+6: ExerciseCard — header + footer redesign ────────────────────────
function ExerciseCard({
  we, index, onUpdate, onRemove, onAddSet, onOpenRestTimer,
}: {
  we: WorkoutEntry; index: number;
  onUpdate: (updated: WorkoutEntry) => void;
  onRemove: () => void;
  onAddSet: () => void;
  onOpenRestTimer: () => void;
}) {
  const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
  if (!ex) return null;

  const totalVol = we.sets.reduce((acc, s) => acc + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);

  // Mock last session (in production: fetch from DB)
  const lastSession = {
    sets: [
      { reps: we.sets[0]?.prevReps ?? 0, weight: we.sets[0]?.prevWeight ?? 0 },
    ],
  };
  const hasLastSession = (lastSession.sets[0]?.weight ?? 0) > 0;

  return (
    <View style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, marginBottom: 12 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Left */}
        <View style={{ flex: 1, marginRight: 8 }}>
          {/* Row 1: index + name */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>
              {String(index + 1).padStart(2, '0')}
            </Text>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, lineHeight: 24, paddingTop: 2 }}>
              {ex.name.toUpperCase()}
            </Text>
          </View>
          {/* Row 2: muscle pills */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {ex.primary.map(m => (
              <View key={m} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: COLORS.accentMuted, borderWidth: 1, borderColor: COLORS.accentBorder }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.orange400, textTransform: 'uppercase' }}>{MUSCLES[m]}</Text>
              </View>
            ))}
            {ex.secondary.map(m => (
              <View key={m} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(41,37,36,0.5)', borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text500, textTransform: 'uppercase' }}>{MUSCLES[m]}</Text>
              </View>
            ))}
          </View>
          {/* Row 3: last session summary */}
          {hasLastSession && (
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500 }}>
              LAST: {lastSession.sets.length} SETS · {lastSession.sets[0]?.weight ?? 0}KG × {lastSession.sets[0]?.reps ?? 0}
            </Text>
          )}
        </View>
        {/* Right */}
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <TouchableOpacity onPress={onRemove} style={{ padding: 4 }}>
            <Text style={{ color: COLORS.text600, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600 }}>SETS</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text100 }}>{we.sets.length}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600 }}>VOL</Text>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 14, color: COLORS.orange400, lineHeight: 18, paddingTop: 2 }}>{fmt0(totalVol)}</Text>
          </View>
        </View>
      </View>

      {/* Column headers */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6,
        backgroundColor: 'rgba(28,25,23,0.5)', borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, gap: 4,
      }}>
        {[
          { label: 'SET',          width: 20,  align: 'center' as const },
          { label: 'LAST SESSION', width: 74,  align: 'left'   as const },
          { label: 'REPS',         width: 52,  align: 'center' as const },
          { label: 'WEIGHT',       width: 55,  align: 'center' as const },
          { label: 'VOL',          width: 38,  align: 'center' as const },
          { label: 'STATUS',       width: 52,  align: 'center' as const },
        ].map(col => (
          <Text key={col.label} style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, textTransform: 'uppercase', width: col.width, textAlign: col.align }}>
            {col.label}
          </Text>
        ))}
      </View>

      {/* Set rows */}
      {we.sets.map((s, idx) => {
        const lastSet = idx < (we.sets.length) ? { reps: s.prevReps, weight: s.prevWeight } : null;
        return (
          <SetRow
            key={s.id}
            set={s}
            idx={idx}
            lastSet={(s.prevReps > 0 || s.prevWeight > 0) ? { reps: s.prevReps, weight: s.prevWeight } : null}
            onUpdate={patch => onUpdate({ ...we, sets: we.sets.map(x => x.id === s.id ? { ...x, ...patch } : x) })}
            onDelete={() => onUpdate({ ...we, sets: we.sets.filter(x => x.id !== s.id) })}
            isLast={we.sets.length === 1}
          />
        );
      })}

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={onAddSet}
            style={{ paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border }}
          >
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase' }}>+ ADD SET</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onOpenRestTimer}
            style={{ paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border }}
          >
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase' }}>⏱ REST TIMER</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500 }}>
          TOTAL {fmt0(totalVol)} KG·REPS
        </Text>
      </View>
    </View>
  );
}

// ─── Add Exercise Sheet ───────────────────────────────────────────────────────
function AddExerciseSheet({
  visible, onClose, onAdd, usedIds,
}: {
  visible: boolean; onClose: () => void;
  onAdd: (id: string) => void; usedIds: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const [filterMuscle, setFilterMuscle] = useState<string | null>(null);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => searchRef.current?.focus(), 300);
    } else {
      setQuery('');
      setFilterMuscle(null);
    }
  }, [visible]);

  const filtered = EXERCISE_LIBRARY.filter(e => {
    if (usedIds.has(e.id)) return false;
    if (filterMuscle && !e.primary.includes(filterMuscle) && !e.secondary.includes(filterMuscle)) return false;
    if (query && !e.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: COLORS.border, maxHeight: '88%' }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, lineHeight: 28, paddingTop: 2 }}>ADD EXERCISE</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>CLOSE</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                ref={searchRef}
                style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#1c1917', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 }}
                placeholder="Search exercises…"
                placeholderTextColor={COLORS.text700}
                value={query}
                onChangeText={setQuery}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }} contentContainerStyle={{ gap: 6, paddingRight: 16 }}>
              <TouchableOpacity
                onPress={() => setFilterMuscle(null)}
                style={{ paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: !filterMuscle ? COLORS.accent : COLORS.border, backgroundColor: !filterMuscle ? COLORS.accentMuted : 'transparent' }}
              >
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: !filterMuscle ? COLORS.accent : COLORS.text600, textTransform: 'uppercase' }}>ALL</Text>
              </TouchableOpacity>
              {MUSCLE_GROUPS.map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setFilterMuscle(filterMuscle === m ? null : m)}
                  style={{ paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: filterMuscle === m ? COLORS.accent : COLORS.border, backgroundColor: filterMuscle === m ? COLORS.accentMuted : 'transparent' }}
                >
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: filterMuscle === m ? COLORS.accent : COLORS.text600, textTransform: 'uppercase' }}>{MUSCLES[m]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, textTransform: 'uppercase' }}>No exercises found.</Text>
                </View>
              ) : filtered.map(ex => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => { onAdd(ex.id); onClose(); }}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1c1917', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text100 }}>{ex.name}</Text>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {ex.primary.map(m => MUSCLES[m]).join(', ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── FIX 5: CreateSplitSheet ──────────────────────────────────────────────────
function CreateSplitSheet({
  visible, mode, onClose, onSaved,
}: {
  visible: boolean;
  mode: 'split' | 'template';
  onClose: () => void;
  onSaved: (split: UserSplit) => void;
}) {
  const [splitName, setSplitName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<{ exerciseId: string; setsTarget: number }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSplitName('');
      setSelectedExercises([]);
      setSaving(false);
    }
  }, [visible]);

  const usedPickerIds = useMemo(() => new Set(selectedExercises.map(e => e.exerciseId)), [selectedExercises]);

  function addExercise(id: string) {
    setSelectedExercises(prev => [...prev, { exerciseId: id, setsTarget: 3 }]);
  }

  function removeExercise(idx: number) {
    setSelectedExercises(prev => prev.filter((_, i) => i !== idx));
  }

  function stepSets(idx: number, delta: number) {
    setSelectedExercises(prev => prev.map((e, i) => i === idx
      ? { ...e, setsTarget: Math.min(10, Math.max(1, e.setsTarget + delta)) }
      : e
    ));
  }

  async function handleSave() {
    if (!splitName.trim()) { Alert.alert('Name required', 'Please enter a split name.'); return; }
    if (selectedExercises.length === 0) { Alert.alert('No exercises', 'Add at least one exercise.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const field = mode === 'split' ? 'my_splits' : 'my_templates';
      const { data: profileData } = await supabase.from('profiles').select(field).eq('id', user.id).single();
      const existing: UserSplit[] = (profileData as any)?.[field] ?? [];
      const newSplit: UserSplit = { id: String(Date.now()), name: splitName.trim(), exercises: selectedExercises };
      await supabase.from('profiles').upsert({ id: user.id, [field]: [...existing, newSplit] });
      onSaved(newSplit);
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'split' ? 'CREATE SPLIT' : 'CREATE TEMPLATE';
  const saveLabel = mode === 'split' ? 'SAVE SPLIT' : 'SAVE TEMPLATE';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '92%' }}>
          <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: COLORS.border }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, lineHeight: 28, paddingTop: 2 }}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>CLOSE</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
              {/* Name input */}
              <TextInput
                style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#1c1917', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 }}
                placeholder="e.g. My Push Day"
                placeholderTextColor={COLORS.text700}
                value={splitName}
                onChangeText={setSplitName}
              />

              {/* Selected exercises */}
              {selectedExercises.map((entry, idx) => {
                const ex = EXERCISE_LIBRARY.find(e => e.id === entry.exerciseId);
                return (
                  <View key={entry.exerciseId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 }}>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text300, flex: 1 }} numberOfLines={1}>{ex?.name ?? entry.exerciseId}</Text>
                    {/* Sets stepper */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity onPress={() => stepSets(idx, -1)} style={{ padding: 4 }}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text600 }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text100, width: 20, textAlign: 'center' }}>{entry.setsTarget}</Text>
                      <TouchableOpacity onPress={() => stepSets(idx, 1)} style={{ padding: 4 }}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text600 }}>+</Text>
                      </TouchableOpacity>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700 }}>sets</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeExercise(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.red400 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Add exercise button */}
              <TouchableOpacity
                onPress={() => setShowPicker(true)}
                style={{ paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, alignItems: 'center', marginTop: 12, marginBottom: 16 }}
              >
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>+ ADD EXERCISE</Text>
              </TouchableOpacity>

              {/* Save button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.accent, opacity: saving ? 0.6 : 1 }}
              >
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, letterSpacing: 2 }}>
                  {saving ? 'SAVING…' : saveLabel}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Nested exercise picker */}
      <AddExerciseSheet
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onAdd={addExercise}
        usedIds={usedPickerIds}
      />
    </Modal>
  );
}

// ─── FIX 5: SessionSelector ───────────────────────────────────────────────────
function SessionSelector({
  onStartBlank, onSelectSplit,
  userSplits, userTemplates, onSplitSaved,
  onClose,
}: {
  onStartBlank: () => void;
  onSelectSplit: (exercises: { exerciseId: string; setsTarget: number }[]) => void;
  userSplits: UserSplit[];
  userTemplates: UserSplit[];
  onSplitSaved: (split: UserSplit, mode: 'split' | 'template') => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SelectorTab>('New Session');
  const [showCreateSplit, setShowCreateSplit] = useState(false);
  const [createMode, setCreateMode] = useState<'split' | 'template'>('split');

  function openCreate(m: 'split' | 'template') {
    setCreateMode(m);
    setShowCreateSplit(true);
  }

  const allTemplates = [...HARDCODED_TEMPLATES, ...userTemplates];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: COLORS.border, maxHeight: '90%' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, lineHeight: 28, paddingTop: 2 }}>START SESSION</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>CLOSE</Text>
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
            {SELECTOR_TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: activeTab === tab ? COLORS.accent : COLORS.border, backgroundColor: activeTab === tab ? COLORS.accentMuted : 'transparent' }}
              >
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: activeTab === tab ? COLORS.accent : COLORS.text600, textTransform: 'uppercase' }}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* New Session tab */}
            {activeTab === 'New Session' && (
              <TouchableOpacity
                onPress={onStartBlank}
                style={{ paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, marginBottom: 8 }}
              >
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text500, letterSpacing: 2 }}>START TRAINING</Text>
              </TouchableOpacity>
            )}

            {/* My Splits tab */}
            {activeTab === 'My Splits' && (
              <>
                <TouchableOpacity
                  onPress={() => openCreate('split')}
                  style={{ paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent, backgroundColor: COLORS.accentMuted, marginBottom: 14 }}
                >
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, textTransform: 'uppercase' }}>+ CREATE SPLIT</Text>
                </TouchableOpacity>
                {userSplits.length === 0 ? (
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, textTransform: 'uppercase', textAlign: 'center', marginTop: 16 }}>No splits yet. Create your first.</Text>
                ) : userSplits.map(split => (
                  <TouchableOpacity
                    key={split.id}
                    onPress={() => { onSelectSplit(split.exercises); onClose(); }}
                    style={{ padding: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, marginBottom: 8 }}
                  >
                    <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20 }}>{split.name.toUpperCase()}</Text>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, marginTop: 4 }}>
                      {split.exercises.length} exercises
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Templates tab */}
            {activeTab === 'Templates' && (
              <>
                <TouchableOpacity
                  onPress={() => openCreate('template')}
                  style={{ paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent, backgroundColor: COLORS.accentMuted, marginBottom: 14 }}
                >
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, textTransform: 'uppercase' }}>+ CREATE TEMPLATE</Text>
                </TouchableOpacity>
                {allTemplates.map(tpl => (
                  <TouchableOpacity
                    key={tpl.id}
                    onPress={() => { onSelectSplit(tpl.exercises); onClose(); }}
                    style={{ padding: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, marginBottom: 8 }}
                  >
                    <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20 }}>{tpl.name.toUpperCase()}</Text>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, marginTop: 4 }}>
                      {tpl.exercises.length} exercises
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Past Session tab */}
            {activeTab === 'Past Session' && (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, textTransform: 'uppercase', textAlign: 'center' }}>Past session history coming soon.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      <CreateSplitSheet
        visible={showCreateSplit}
        mode={createMode}
        onClose={() => setShowCreateSplit(false)}
        onSaved={split => onSplitSaved(split, createMode)}
      />
    </Modal>
  );
}

// ─── Finish Confirm Sheet ─────────────────────────────────────────────────────
function FinishConfirmSheet({
  visible, onConfirm, onDiscard, onClose,
  totalVolume, doneSets, totalSets, elapsed, volumes,
}: {
  visible: boolean; onConfirm: () => void; onDiscard: () => void; onClose: () => void;
  totalVolume: number; doneSets: number; totalSets: number; elapsed: number;
  volumes: Record<string, number>;
}) {
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  const muscles = Object.entries(volumes).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: COLORS.border, padding: 20 }}>
          <Text style={{ fontFamily: FONTS.anton, fontSize: 24, color: COLORS.text100, lineHeight: 30, paddingTop: 2, marginBottom: 4 }}>FINISH WORKOUT?</Text>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 }}>Review and confirm</Text>

          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.bgCard, marginBottom: 16 }}>
            {[
              { label: 'Volume',   value: fmt0(totalVolume),       sub: 'kg·reps' },
              { label: 'Sets',     value: `${doneSets}/${totalSets}`, sub: 'completed' },
              { label: 'Duration', value: `${mins}:${secs}`,       sub: 'elapsed' },
            ].map((s, i) => (
              <View key={s.label} style={{ flex: 1, padding: 12, borderRightWidth: i < 2 ? 1 : 0, borderRightColor: COLORS.borderLight, alignItems: 'center' }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</Text>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 22, paddingTop: 2 }}>{s.value}</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700 }}>{s.sub}</Text>
              </View>
            ))}
          </View>

          {muscles.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Muscles Trained</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {muscles.map(([m]) => (
                  <View key={m} style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted }}>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange400, textTransform: 'uppercase' }}>{MUSCLES[m]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity onPress={onConfirm} style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.accent, marginBottom: 8 }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, letterSpacing: 2 }}>CONFIRM FINISH</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDiscard} style={{ paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#7f1d1d', backgroundColor: 'rgba(127,29,29,0.1)', marginBottom: 8 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.red400, textTransform: 'uppercase', letterSpacing: 1 }}>Discard Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>Keep Going</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Rest Timer Banner ────────────────────────────────────────────────────────
const REST_OPTIONS = [60, 90, 120, 180];

function RestTimerBanner({ onDismiss }: { onDismiss: () => void }) {
  const [selected, setSelected] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const slideY = useRef(new Animated.Value(140)).current;
  const pulsed10 = useRef(false);

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }
    if (remaining === 10 && !pulsed10.current) {
      pulsed10.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  function changeDuration(secs: number) {
    setSelected(secs);
    setRemaining(secs);
    pulsed10.current = false;
  }

  function dismiss() {
    Animated.timing(slideY, { toValue: 160, duration: 200, useNativeDriver: true }).start(onDismiss);
  }

  const r = 36;
  const circ = 2 * Math.PI * r;
  const pct = remaining / selected;
  const dash = pct * circ;
  const minStr = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secStr = String(remaining % 60).padStart(2, '0');
  const finished = remaining <= 0;

  return (
    <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, transform: [{ translateY: slideY }] }}>
      <TouchableOpacity activeOpacity={0.97} onPress={dismiss}>
        <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: finished ? 'rgba(237,122,42,0.6)' : COLORS.border, paddingHorizontal: 16, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 88, height: 88 }}>
              <Svg width={88} height={88} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={44} cy={44} r={r} stroke="rgba(41,37,36,0.8)" strokeWidth={5} fill="none" />
                <Circle
                  cx={44} cy={44} r={r}
                  stroke={finished ? '#4ade80' : COLORS.accent}
                  strokeWidth={5} fill="none"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeLinecap="square"
                />
              </Svg>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: finished ? '#4ade80' : COLORS.text100, lineHeight: 24, paddingTop: 2 }}>
                {finished ? 'GO' : `${minStr}:${secStr}`}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Rest Timer · Tap to dismiss</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {REST_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => changeDuration(opt)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: selected === opt ? COLORS.accent : COLORS.border, backgroundColor: selected === opt ? COLORS.accentMuted : 'transparent' }}
                  >
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: selected === opt ? COLORS.accent : COLORS.text600 }}>{opt}s</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main ForgeScreen ─────────────────────────────────────────────────────────
export default function ForgeScreen() {
  const [workout, setWorkout] = useState<WorkoutEntry[]>(INITIAL_WORKOUT as any);
  const [workoutName] = useState('Push Day · Week 4');
  const [elapsed, setElapsed] = useState(0);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showFinishSheet, setShowFinishSheet] = useState(false);
  const [showRestSheet, setShowRestSheet] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [userSplits, setUserSplits] = useState<UserSplit[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserSplit[]>([]);

  // Load user splits/templates on mount
  useEffect(() => {
    async function loadSplits() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('profiles').select('my_splits, my_templates').eq('id', user.id).single();
        if (data) {
          setUserSplits((data as any).my_splits ?? []);
          setUserTemplates((data as any).my_templates ?? []);
        }
      } catch (_) {
        // silently fail — mock data is fine in dev
      }
    }
    loadSplits();
  }, []);

  // Session timer
  useEffect(() => {
    const i = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const volumes = useMemo(() => muscleVolumes(workout), [workout]);
  const maxVol  = useMemo(() => Math.max(800, ...Object.values(volumes)), [volumes]);

  const doneSets   = useMemo(() => workout.reduce((a, we) => a + we.sets.filter(s => s.done).length, 0), [workout]);
  const totalSets  = useMemo(() => workout.reduce((a, we) => a + we.sets.length, 0), [workout]);
  const totalVolume = useMemo(() => workout.reduce((a, we) => a + exerciseVol(we, true), 0), [workout]);

  const usedIds = useMemo(() => new Set(workout.map(we => we.exerciseId)), [workout]);
  const progressPct = totalSets > 0 ? doneSets / totalSets : 0;
  const elapsedMins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const elapsedSecs = String(elapsed % 60).padStart(2, '0');

  // FIX 2: Volume breakdown bar rows
  const volumeBarRows = useMemo(() => {
    const entries = Object.entries(volumes).filter(([, v]) => v > 0);
    if (entries.length === 0) return [];
    const maxMuscleVol = Math.max(...entries.map(([, v]) => v));
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([muscle, vol]) => ({ muscle, vol, pct: (vol / maxMuscleVol) * 100 }));
  }, [volumes]);

  const updateExercise = useCallback((id: string, updated: WorkoutEntry) => {
    setWorkout(w => w.map(we => we.id === id ? updated : we));
  }, []);

  const addSet = useCallback((weId: string) => {
    setWorkout(w => w.map(we => {
      if (we.id !== weId) return we;
      const last = we.sets[we.sets.length - 1];
      return {
        ...we,
        sets: [...we.sets, {
          id: `s-${Date.now()}`,
          reps: last?.reps ?? 8,
          weight: last?.weight ?? 0,
          rir: last?.rir ?? 2,
          done: false,
          prevReps: Number(last?.reps ?? 0),
          prevWeight: Number(last?.weight ?? 0),
        }],
      };
    }));
  }, []);

  const removeExercise = useCallback((id: string) => {
    setWorkout(w => w.filter(we => we.id !== id));
  }, []);

  const addExercise = useCallback((exerciseId: string) => {
    setWorkout(w => [...w, {
      id: `we-${Date.now()}`,
      exerciseId,
      sets: [{ id: `s-${Date.now()}-1`, reps: 8, weight: 0, rir: 2, done: false, prevReps: 0, prevWeight: 0 }],
    }]);
  }, []);

  function handleSelectSplit(exercises: { exerciseId: string; setsTarget: number }[]) {
    const newWorkout: WorkoutEntry[] = exercises.map((entry, i) => ({
      id: `we-${Date.now()}-${i}`,
      exerciseId: entry.exerciseId,
      sets: Array.from({ length: entry.setsTarget }, (_, si) => ({
        id: `s-${Date.now()}-${i}-${si}`,
        reps: 8, weight: 0, rir: 2, done: false, prevReps: 0, prevWeight: 0,
      })),
    }));
    setWorkout(newWorkout);
  }

  function handleSplitSaved(split: UserSplit, mode: 'split' | 'template') {
    if (mode === 'split') setUserSplits(prev => [...prev, split]);
    else setUserTemplates(prev => [...prev, split]);
  }

  function handleSetComplete() {
    setShowRestSheet(true);
  }

  function handleFinishConfirm() {
    setShowFinishSheet(false);
  }

  function handleDiscard() {
    setWorkout(INITIAL_WORKOUT as any);
    setShowFinishSheet(false);
  }

  async function handleFinishTap() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowFinishSheet(true);
  }

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 28, color: COLORS.text100, lineHeight: 34, paddingTop: 2 }}>FORGE</Text>
            <TouchableOpacity onPress={() => setShowSelector(true)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase' }}>NEW SESSION ▼</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700 }}>{todayLabel}</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700 }}>{elapsedMins}:{elapsedSecs} elapsed</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange400 }}>{fmt0(totalVolume)} kg·reps</Text>
          </View>
        </View>

        {/* ── Summary Bar ── */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: 'rgba(12,10,8,0.6)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Sets</Text>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>{doneSets}<Text style={{ color: COLORS.text700 }}>/{totalSets}</Text></Text>
              </View>
              <View>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Volume</Text>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.orange400, lineHeight: 20, paddingTop: 2 }}>{fmt0(totalVolume)}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Time</Text>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>{elapsedMins}:{elapsedSecs}</Text>
            </View>
          </View>
          <View style={{ height: 3, backgroundColor: '#1c1917' }}>
            <View style={{ height: '100%', width: `${progressPct * 100}%` as any, backgroundColor: COLORS.accent }} />
          </View>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, marginTop: 4 }}>
            {Math.round(progressPct * 100)}% complete
          </Text>
        </View>

        {/* ── Exercise List ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {workout.map((we, idx) => (
            <ExerciseCard
              key={we.id}
              we={we}
              index={idx}
              onUpdate={updated => updateExercise(we.id, updated)}
              onRemove={() => removeExercise(we.id)}
              onAddSet={() => addSet(we.id)}
              onOpenRestTimer={() => setShowRestSheet(true)}
            />
          ))}

          {/* FIX 3: Forge Muscle Map */}
          <View style={{ borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.bgCard, padding: 14, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>MUSCLE MAP</Text>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700 }}>live · current session</Text>
            </View>
            <ForgeBodyMap volumes={volumes} maxVol={maxVol} />
          </View>

          {/* FIX 2: Volume Breakdown bar graph */}
          <View style={{ borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.bgCard, marginBottom: 16 }}>
            <View style={{ padding: 14 }}>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, lineHeight: 28, marginBottom: 16 }}>VOLUME BREAKDOWN</Text>
              {volumeBarRows.length === 0 ? (
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, textTransform: 'uppercase', textAlign: 'center' }}>Complete a set to begin</Text>
              ) : (
                volumeBarRows.map(({ muscle, vol, pct }) => (
                  <View key={muscle} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, textTransform: 'uppercase' }}>{MUSCLES[muscle] ?? muscle}</Text>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>{fmt0(vol)}</Text>
                    </View>
                    <View style={{ height: 3, backgroundColor: 'rgba(41,37,36,0.5)' }}>
                      <View style={{ height: 3, width: `${pct}%` as any, backgroundColor: COLORS.accent }} />
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>

        {/* ── Bottom Buttons ── */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: 8 }}>
          <TouchableOpacity
            onPress={() => setShowAddSheet(true)}
            style={{ paddingVertical: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(87,83,78,0.5)', alignItems: 'center' }}
          >
            <Text style={{ fontFamily: FONTS.anton, fontSize: 14, color: COLORS.text600, letterSpacing: 1 }}>+ ADD EXERCISE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleFinishTap}
            style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.accent }}
          >
            <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, letterSpacing: 2 }}>FINISH WORKOUT</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      {/* ── Rest Timer Banner ── */}
      {showRestSheet && (
        <RestTimerBanner onDismiss={() => setShowRestSheet(false)} />
      )}

      {/* ── Modals ── */}
      <AddExerciseSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onAdd={addExercise}
        usedIds={usedIds}
      />
      <FinishConfirmSheet
        visible={showFinishSheet}
        onConfirm={handleFinishConfirm}
        onDiscard={handleDiscard}
        onClose={() => setShowFinishSheet(false)}
        totalVolume={totalVolume}
        doneSets={doneSets}
        totalSets={totalSets}
        elapsed={elapsed}
        volumes={volumes}
      />
      {showSelector && (
        <SessionSelector
          onStartBlank={() => { setWorkout([]); setShowSelector(false); }}
          onSelectSplit={handleSelectSplit}
          userSplits={userSplits}
          userTemplates={userTemplates}
          onSplitSaved={handleSplitSaved}
          onClose={() => setShowSelector(false)}
        />
      )}
    </View>
  );
}
