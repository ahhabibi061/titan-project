// FORGE — Workout Logger · Phase 2
// Full port from titan_logger.jsx with mobile-native adaptations
import React, {
  useState, useMemo, useRef, useEffect, useCallback,
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  Animated, PanResponder, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

// ─── Domain ─────────────────────────────────────────────────────────────────
const MUSCLES: Record<string, string> = {
  chest: 'Chest', front_delts: 'Front Delts', side_delts: 'Side Delts',
  rear_delts: 'Rear Delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  lats: 'Lats', lower_back: 'Lower Back', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', calves: 'Calves',
};

const MUSCLE_GROUPS = Object.keys(MUSCLES);

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

// ─── Logic ───────────────────────────────────────────────────────────────────
interface SetData {
  id: string; reps: number | string; weight: number | string;
  rir: number; done: boolean; prevReps: number; prevWeight: number;
}
interface WorkoutEntry { id: string; exerciseId: string; sets: SetData[]; }

const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US');

function setVolume(s: SetData) { return (Number(s.reps) || 0) * (Number(s.weight) || 0); }
function prevVolume(s: SetData) { return (s.prevReps || 0) * (s.prevWeight || 0); }

function exerciseVolume(we: WorkoutEntry, completedOnly = true) {
  return we.sets
    .filter(s => !completedOnly || s.done)
    .reduce((acc, s) => acc + setVolume(s), 0);
}

function muscleVolumes(workout: WorkoutEntry[]) {
  const v: Record<string, number> = {};
  for (const we of workout) {
    const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
    if (!ex) continue;
    const vol = exerciseVolume(we, true);
    if (vol === 0) continue;
    ex.primary.forEach(m   => { v[m] = (v[m] || 0) + vol; });
    ex.secondary.forEach(m => { v[m] = (v[m] || 0) + vol * 0.5; });
  }
  return v;
}

function overloadStatus(s: SetData) {
  const cur = setVolume(s), prev = prevVolume(s);
  if (prev === 0) return { kind: 'new',   label: 'NEW', color: '#fbbf24' };
  if (cur >  prev) return { kind: 'pr',   label: 'PR',  color: '#ed7a2a' };
  if (cur === prev) return { kind: 'ok',  label: '=',   color: '#78716c' };
  return               { kind: 'dn',      label: '▼',   color: '#f87171' };
}

function volumeToFill(volume: number, max: number) {
  if (!volume || volume <= 0) return 'rgba(255,255,255,0.025)';
  const t = Math.min(volume / Math.max(max, 1), 1);
  const stops = [
    { t: 0.00, c: [44, 36, 30] },
    { t: 0.18, c: [98, 42, 18] },
    { t: 0.45, c: [186, 74, 28] },
    { t: 0.72, c: [240, 110, 38] },
    { t: 1.00, c: [255, 78, 38] },
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t <= stops[i + 1].t) {
      const local = (t - stops[i].t) / (stops[i + 1].t - stops[i].t || 1);
      const r = Math.round(stops[i].c[0] + (stops[i + 1].c[0] - stops[i].c[0]) * local);
      const g = Math.round(stops[i].c[1] + (stops[i + 1].c[1] - stops[i].c[1]) * local);
      const b = Math.round(stops[i].c[2] + (stops[i + 1].c[2] - stops[i].c[2]) * local);
      return `rgb(${r},${g},${b})`;
    }
  }
  const last = stops[stops.length - 1].c;
  return `rgb(${last[0]},${last[1]},${last[2]})`;
}

// ─── SVG Muscle Paths (from web reference, viewBox 220×460) ─────────────────
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

// ─── Muscle Heatmap ──────────────────────────────────────────────────────────
function MuscleHeatmap({ volumes, max }: { volumes: Record<string,number>; max: number }) {
  const [selected, setSelected] = useState<{ key: string; vol: number } | null>(null);

  function handlePress(key: string) {
    setSelected(s => s?.key === key ? null : { key, vol: volumes[key] || 0 });
  }

  function renderPaths(paths: Record<string, string>) {
    return Object.entries(paths).map(([key, d]) => (
      <Path
        key={key}
        d={d}
        fill={volumeToFill(volumes[key] || 0, max)}
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={0.5}
        onPress={() => handlePress(key)}
      />
    ));
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 4 }}>ANTERIOR</Text>
          <Svg viewBox="0 0 220 460" style={{ width: '100%', aspectRatio: 220 / 460 }}>
            <Circle cx={110} cy={44} r={22} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <Rect x={100} y={62} width={20} height={14} fill="rgba(255,255,255,0.04)" />
            {renderPaths(FRONT_PATHS)}
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 4 }}>POSTERIOR</Text>
          <Svg viewBox="0 0 220 460" style={{ width: '100%', aspectRatio: 220 / 460 }}>
            <Circle cx={110} cy={44} r={22} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <Rect x={100} y={62} width={20} height={14} fill="rgba(255,255,255,0.04)" />
            {renderPaths(BACK_PATHS)}
          </Svg>
        </View>
      </View>
      {selected && (
        <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(237,122,42,0.3)', backgroundColor: 'rgba(12,10,8,0.9)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#78716c', textTransform: 'uppercase', letterSpacing: 1 }}>{MUSCLES[selected.key]}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 18, color: '#fb923c', lineHeight: 20, paddingTop: 2 }}>{fmt0(selected.vol)}</Text>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e' }}>kg·reps</Text>
          </View>
        </View>
      )}
      {/* Legend gradient */}
      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.6)' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e' }}>Volume</Text>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e' }}>0 → {fmt0(max)}</Text>
        </View>
        <View style={{ height: 6, backgroundColor: '#1c1917' }}>
          <View style={{ position: 'absolute', inset: 0, borderRadius: 0 }}>
            {/* approximate gradient with stacked views */}
            {[0,1,2,3].map(i => (
              <View key={i} style={{ position: 'absolute', left: `${i * 25}%` as any, width: '25%', height: '100%', backgroundColor: ['rgba(44,36,30,0.8)','rgb(98,42,18)','rgb(186,74,28)','rgb(240,110,38)'][i] }} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── RIR Selector ────────────────────────────────────────────────────────────
function RIRSelector({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[0, 1, 2, 3, 4].map(n => (
        <TouchableOpacity
          key={n}
          disabled={disabled}
          onPress={() => onChange(n)}
          style={{
            width: 22, height: 22,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1,
            borderColor: value === n ? '#ed7a2a' : 'rgba(41,37,36,0.6)',
            backgroundColor: value === n ? 'rgba(237,122,42,0.15)' : 'transparent',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: value === n ? '#ed7a2a' : '#57534e' }}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Swipeable Set Row ───────────────────────────────────────────────────────
function SwipeableSetRow({
  set, idx, onUpdate, onToggle, onDelete, isLast, onSetComplete,
}: {
  set: SetData; idx: number;
  onUpdate: (patch: Partial<SetData>) => void;
  onToggle: () => void;
  onDelete: () => void;
  isLast: boolean;
  onSetComplete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6,
    onPanResponderMove: (_, { dx }) => {
      if (dx < 0) translateX.setValue(Math.max(dx, -72));
      else if (revealed) translateX.setValue(Math.min(dx - 72, 0));
    },
    onPanResponderRelease: (_, { dx }) => {
      if ((!revealed && dx < -36) || (revealed && dx < 0)) {
        Animated.spring(translateX, { toValue: -72, useNativeDriver: true }).start();
        setRevealed(true);
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        setRevealed(false);
      }
    },
  })).current;

  const ol = overloadStatus(set);

  function handleToggle() {
    if (!set.done) onSetComplete();
    onToggle();
  }

  function step(field: 'weight' | 'reps', delta: number) {
    if (set.done) return;
    const current = Number(set[field]) || 0;
    const increment = field === 'weight' ? 2.5 : 1;
    const next = Math.max(0, current + delta * increment);
    onUpdate({ [field]: next });
  }

  return (
    <View style={{ position: 'relative', overflow: 'hidden', opacity: set.done ? 0.6 : 1 }}>
      {/* delete button revealed on swipe */}
      <TouchableOpacity
        onPress={() => { if (!isLast) onDelete(); }}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 72,
          backgroundColor: isLast ? '#1c1917' : '#7f1d1d',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: isLast ? '#57534e' : '#fca5a5', textTransform: 'uppercase', letterSpacing: 1 }}>DELETE</Text>
      </TouchableOpacity>

      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: set.done ? 'rgba(237,122,42,0.06)' : '#0a0908' }}
        {...panResponder.panHandlers}
      >
        {/* row content */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.3)' }}>
          {/* set number */}
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#57534e', width: 24, paddingTop: 2 }}>
            {String(idx + 1).padStart(2, '0')}
          </Text>

          {/* weight stepper */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 }}>
            <TouchableOpacity onPress={() => step('weight', -1)} disabled={set.done} style={{ padding: 3, opacity: set.done ? 0.4 : 1 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 14, color: '#57534e' }}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: '#e7e5e4', borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: '#111110', paddingVertical: 5, paddingHorizontal: 6, flex: 1, textAlign: 'center', minWidth: 44 }}
              value={String(set.weight)}
              onChangeText={v => onUpdate({ weight: v === '' ? '' : Number(v) })}
              keyboardType="decimal-pad"
              editable={!set.done}
            />
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#44403c' }}>kg</Text>
            <TouchableOpacity onPress={() => step('weight', 1)} disabled={set.done} style={{ padding: 3, opacity: set.done ? 0.4 : 1 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 14, color: '#57534e' }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* reps stepper */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1, marginHorizontal: 4 }}>
            <TouchableOpacity onPress={() => step('reps', -1)} disabled={set.done} style={{ padding: 3, opacity: set.done ? 0.4 : 1 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 14, color: '#57534e' }}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: '#e7e5e4', borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: '#111110', paddingVertical: 5, paddingHorizontal: 6, flex: 1, textAlign: 'center', minWidth: 36 }}
              value={String(set.reps)}
              onChangeText={v => onUpdate({ reps: v === '' ? '' : Number(v) })}
              keyboardType="number-pad"
              editable={!set.done}
            />
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#44403c' }}>rep</Text>
            <TouchableOpacity onPress={() => step('reps', 1)} disabled={set.done} style={{ padding: 3, opacity: set.done ? 0.4 : 1 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 14, color: '#57534e' }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* RIR */}
          <RIRSelector value={set.rir} onChange={v => onUpdate({ rir: v })} disabled={set.done} />

          {/* status badge */}
          <View style={{ width: 30, marginHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: `${ol.color}50`, backgroundColor: `${ol.color}18`, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: ol.color }}>{ol.label}</Text>
          </View>

          {/* done checkbox */}
          <TouchableOpacity onPress={handleToggle} style={{ width: 26, height: 26, borderWidth: 1, borderColor: set.done ? '#ed7a2a' : 'rgba(87,83,78,0.6)', backgroundColor: set.done ? '#ed7a2a' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {set.done && <Text style={{ color: '#0a0908', fontSize: 13, fontWeight: '700' }}>✓</Text>}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Exercise Card ───────────────────────────────────────────────────────────
function ExerciseCard({
  we, index, onUpdate, onRemove, onAddSet, onSetComplete,
}: {
  we: WorkoutEntry; index: number;
  onUpdate: (updated: WorkoutEntry) => void;
  onRemove: () => void;
  onAddSet: () => void;
  onSetComplete: () => void;
}) {
  const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
  if (!ex) return null;
  const completedSets = we.sets.filter(s => s.done).length;
  const doneVol = exerciseVolume(we, true);

  return (
    <View style={{ borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 12 }}>
      {/* Exercise header */}
      <TouchableOpacity
        onLongPress={() => { /* reorder stub */ }}
        activeOpacity={1}
        style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(41,37,36,0.6)' }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', marginBottom: 2 }}>{String(index + 1).padStart(2, '0')}</Text>
          <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 18, color: '#e7e5e4', lineHeight: Math.round(18 * 1.3), paddingTop: 2 }}>{ex.name.toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {ex.primary.map(m => (
              <View key={m} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(237,122,42,0.15)', borderWidth: 1, borderColor: 'rgba(237,122,42,0.25)' }}>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#fb923c', textTransform: 'uppercase', letterSpacing: 0.8 }}>{MUSCLES[m]}</Text>
              </View>
            ))}
            {ex.secondary.map(m => (
              <View key={m} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(41,37,36,0.5)', borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)' }}>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#78716c', textTransform: 'uppercase', letterSpacing: 0.8 }}>{MUSCLES[m]}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <TouchableOpacity onPress={onRemove} style={{ padding: 4 }}>
            <Text style={{ color: '#57534e', fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e' }}>{completedSets}/{we.sets.length} sets</Text>
          <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 14, color: '#fb923c', lineHeight: Math.round(14 * 1.3), paddingTop: 2 }}>{fmt0(doneVol)}</Text>
        </View>
      </TouchableOpacity>

      {/* Column labels */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(28,25,23,0.5)' }}>
        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 7, color: '#44403c', width: 24, textTransform: 'uppercase' }}>#</Text>
        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 7, color: '#44403c', flex: 1, textTransform: 'uppercase' }}>KG</Text>
        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 7, color: '#44403c', flex: 1, marginHorizontal: 4, textTransform: 'uppercase' }}>REPS</Text>
        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 7, color: '#44403c', width: 113, textTransform: 'uppercase' }}>RIR</Text>
        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 7, color: '#44403c', width: 30, textTransform: 'uppercase', textAlign: 'center' }}>OL</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Set rows */}
      {we.sets.map((s, idx) => (
        <SwipeableSetRow
          key={s.id}
          set={s}
          idx={idx}
          isLast={we.sets.length === 1}
          onUpdate={patch => onUpdate({ ...we, sets: we.sets.map(x => x.id === s.id ? { ...x, ...patch } : x) })}
          onToggle={() => onUpdate({ ...we, sets: we.sets.map(x => x.id === s.id ? { ...x, done: !x.done } : x) })}
          onDelete={() => onUpdate({ ...we, sets: we.sets.filter(x => x.id !== s.id) })}
          onSetComplete={onSetComplete}
        />
      ))}

      {/* Add set */}
      <TouchableOpacity onPress={onAddSet} style={{ paddingVertical: 11, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.4)', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2 }}>+ ADD SET</Text>
      </TouchableOpacity>
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
          <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: '#292524', maxHeight: '88%' }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 22, color: '#e7e5e4', lineHeight: Math.round(22 * 1.3), paddingTop: 2 }}>ADD EXERCISE</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#57534e', textTransform: 'uppercase' }}>CLOSE</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                ref={searchRef}
                style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: '#e7e5e4', borderWidth: 1, borderColor: '#292524', backgroundColor: '#1c1917', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 }}
                placeholder="Search exercises…"
                placeholderTextColor="#44403c"
                value={query}
                onChangeText={setQuery}
              />
            </View>

            {/* Muscle group filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }} contentContainerStyle={{ gap: 6, paddingRight: 16 }}>
              <TouchableOpacity
                onPress={() => setFilterMuscle(null)}
                style={{ paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: !filterMuscle ? '#ed7a2a' : '#292524', backgroundColor: !filterMuscle ? 'rgba(237,122,42,0.15)' : 'transparent' }}
              >
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: !filterMuscle ? '#ed7a2a' : '#57534e', textTransform: 'uppercase' }}>ALL</Text>
              </TouchableOpacity>
              {MUSCLE_GROUPS.map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setFilterMuscle(filterMuscle === m ? null : m)}
                  style={{ paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: filterMuscle === m ? '#ed7a2a' : '#292524', backgroundColor: filterMuscle === m ? 'rgba(237,122,42,0.15)' : 'transparent' }}
                >
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: filterMuscle === m ? '#ed7a2a' : '#57534e', textTransform: 'uppercase' }}>{MUSCLES[m]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#44403c', textTransform: 'uppercase' }}>No exercises found.</Text>
                </View>
              ) : filtered.map(ex => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => { onAdd(ex.id); onClose(); }}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1c1917', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: '#e7e5e4' }}>{ex.name}</Text>
                  <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 1 }}>
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
        <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: '#292524', padding: 20 }}>
          <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 24, color: '#e7e5e4', lineHeight: Math.round(24 * 1.3), paddingTop: 2, marginBottom: 4 }}>FINISH WORKOUT?</Text>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 }}>Review and confirm</Text>

          {/* Summary stats */}
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 16 }}>
            {[
              { label: 'Volume', value: fmt0(totalVolume), sub: 'kg·reps' },
              { label: 'Sets', value: `${doneSets}/${totalSets}`, sub: 'completed' },
              { label: 'Duration', value: `${mins}:${secs}`, sub: 'elapsed' },
            ].map((s, i) => (
              <View key={s.label} style={{ flex: 1, padding: 12, borderRightWidth: i < 2 ? 1 : 0, borderRightColor: 'rgba(41,37,36,0.6)', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</Text>
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 18, color: '#e7e5e4', lineHeight: Math.round(18 * 1.3), paddingTop: 2 }}>{s.value}</Text>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#44403c' }}>{s.sub}</Text>
              </View>
            ))}
          </View>

          {/* Muscles trained */}
          {muscles.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Muscles Trained</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {muscles.map(([m]) => (
                  <View key={m} style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(237,122,42,0.3)', backgroundColor: 'rgba(237,122,42,0.1)' }}>
                    <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#fb923c', textTransform: 'uppercase' }}>{MUSCLES[m]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity onPress={onConfirm} style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: '#ed7a2a', marginBottom: 8 }}>
            <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 16, color: '#0a0908', letterSpacing: 2 }}>CONFIRM FINISH</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDiscard} style={{ paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#7f1d1d', backgroundColor: 'rgba(127,29,29,0.1)', marginBottom: 8 }}>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: '#f87171', textTransform: 'uppercase', letterSpacing: 1 }}>Discard Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: '#57534e', textTransform: 'uppercase' }}>Keep Going</Text>
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
  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');
  const finished = remaining <= 0;

  return (
    <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, transform: [{ translateY: slideY }] }}>
      <TouchableOpacity activeOpacity={0.97} onPress={dismiss}>
        <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: finished ? 'rgba(237,122,42,0.6)' : '#292524', paddingHorizontal: 16, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {/* Circular ring */}
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 88, height: 88 }}>
              <Svg width={88} height={88} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={44} cy={44} r={r} stroke="rgba(41,37,36,0.8)" strokeWidth={5} fill="none" />
                <Circle
                  cx={44} cy={44} r={r}
                  stroke={finished ? '#4ade80' : '#ed7a2a'}
                  strokeWidth={5} fill="none"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeLinecap="square"
                />
              </Svg>
              <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 20, color: finished ? '#4ade80' : '#e7e5e4', lineHeight: Math.round(20 * 1.3), paddingTop: 2 }}>
                {finished ? 'GO' : `${mins}:${secs}`}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#57534e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Rest Timer · Tap to dismiss</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {REST_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => changeDuration(opt)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: selected === opt ? '#ed7a2a' : '#292524', backgroundColor: selected === opt ? 'rgba(237,122,42,0.15)' : 'transparent' }}
                  >
                    <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: selected === opt ? '#ed7a2a' : '#57534e' }}>{opt}s</Text>
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
  const [showRestTimer, setShowRestTimer] = useState(false);

  // Session timer
  useEffect(() => {
    const i = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const volumes = useMemo(() => muscleVolumes(workout), [workout]);
  const maxVol = useMemo(() => Math.max(800, ...Object.values(volumes)), [volumes]);

  const doneSets = useMemo(() => workout.reduce((a, we) => a + we.sets.filter(s => s.done).length, 0), [workout]);
  const totalSets = useMemo(() => workout.reduce((a, we) => a + we.sets.length, 0), [workout]);
  const totalVolume = useMemo(() => workout.reduce((a, we) => a + exerciseVolume(we, true), 0), [workout]);

  const usedIds = useMemo(() => new Set(workout.map(we => we.exerciseId)), [workout]);

  const progressPct = totalSets > 0 ? doneSets / totalSets : 0;
  const elapsedMins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const elapsedSecs = String(elapsed % 60).padStart(2, '0');

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
          prevReps: last?.prevReps ?? 0,
          prevWeight: last?.prevWeight ?? 0,
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

  function handleSetComplete() {
    setShowRestTimer(true);
  }

  function handleFinishConfirm() {
    setShowFinishSheet(false);
    // In production: persist to Supabase here
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
    <View style={{ flex: 1, backgroundColor: '#0a0908' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(41,37,36,0.6)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 28, color: '#e7e5e4', lineHeight: Math.round(28 * 1.3), paddingTop: 2 }}>FORGE</Text>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: '#78716c' }} numberOfLines={1}>{workoutName}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c' }}>{todayLabel}</Text>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#44403c' }}>{elapsedMins}:{elapsedSecs} elapsed</Text>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: '#fb923c' }}>{fmt0(totalVolume)} kg·reps</Text>
          </View>
        </View>

        {/* ── Summary Bar ── */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.6)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Sets</Text>
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 16, color: '#e7e5e4', lineHeight: Math.round(16 * 1.3), paddingTop: 2 }}>{doneSets}<Text style={{ color: '#44403c' }}>/{totalSets}</Text></Text>
              </View>
              <View>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Volume</Text>
                <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 16, color: '#fb923c', lineHeight: Math.round(16 * 1.3), paddingTop: 2 }}>{fmt0(totalVolume)}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#57534e', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Time</Text>
              <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 16, color: '#e7e5e4', lineHeight: Math.round(16 * 1.3), paddingTop: 2 }}>{elapsedMins}:{elapsedSecs}</Text>
            </View>
          </View>
          {/* Progress bar */}
          <View style={{ height: 3, backgroundColor: '#1c1917' }}>
            <View style={{ height: '100%', width: `${progressPct * 100}%` as any, backgroundColor: '#ed7a2a' }} />
          </View>
          <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#44403c', marginTop: 4 }}>
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
              onSetComplete={handleSetComplete}
            />
          ))}

          {/* Muscle Heatmap */}
          <View style={{ borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,10,8,0.4)', padding: 14, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 16, color: '#e7e5e4', lineHeight: Math.round(16 * 1.3), paddingTop: 2 }}>MUSCLE MAP</Text>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: '#44403c' }}>live · tap to detail</Text>
            </View>
            <MuscleHeatmap volumes={volumes} max={maxVol} />
          </View>
        </ScrollView>

        {/* ── Bottom Buttons ── */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.6)', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setShowAddSheet(true)}
            style={{ paddingVertical: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(87,83,78,0.5)', alignItems: 'center' }}
          >
            <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 14, color: '#57534e', letterSpacing: 1 }}>+ ADD EXERCISE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleFinishTap}
            style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: '#ed7a2a' }}
          >
            <Text style={{ fontFamily: 'Anton_400Regular', fontSize: 16, color: '#0a0908', letterSpacing: 2 }}>FINISH WORKOUT</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      {/* ── Rest Timer Banner (absolute, slides up from bottom) ── */}
      {showRestTimer && (
        <RestTimerBanner onDismiss={() => setShowRestTimer(false)} />
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
    </View>
  );
}
