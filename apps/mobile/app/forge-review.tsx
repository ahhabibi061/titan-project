// FORGE REVIEW — View & edit a completed workout session
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  Animated, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

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

// ─── Domain ──────────────────────────────────────────────────────────────────
const MUSCLES: Record<string, string> = {
  chest: 'Chest', front_delts: 'Front Delts', side_delts: 'Side Delts',
  rear_delts: 'Rear Delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  lats: 'Lats', lower_back: 'Lower Back', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', calves: 'Calves',
};

const MUSCLE_RECOVERY_HOURS: Record<string, number> = {
  chest: 72, lats: 72, lower_back: 72, glutes: 72, quads: 72, hamstrings: 72,
  front_delts: 48, rear_delts: 48, side_delts: 48, biceps: 48, triceps: 48,
  calves: 36, traps: 36, forearms: 36, abs: 36, obliques: 36,
};

const EXERCISE_LIBRARY = [
  { id: 'bench',            name: 'Barbell Bench Press',       primary: ['chest'],        secondary: ['front_delts','triceps'] },
  { id: 'incline_db',       name: 'Incline DB Press',          primary: ['chest'],        secondary: ['front_delts','triceps'] },
  { id: 'cable_fly',        name: 'Cable Crossover',           primary: ['chest'],        secondary: ['front_delts'] },
  { id: 'dips',             name: 'Weighted Dips',             primary: ['chest'],        secondary: ['triceps','front_delts'] },
  { id: 'pushup',           name: 'Push-Up',                   primary: ['chest'],        secondary: ['front_delts','triceps','abs'] },
  { id: 'chest_press',      name: 'Machine Chest Press',       primary: ['chest'],        secondary: ['front_delts','triceps'] },
  { id: 'ohp',              name: 'Standing Overhead Press',   primary: ['front_delts'],  secondary: ['side_delts','triceps'] },
  { id: 'lateral_raise',    name: 'DB Lateral Raise',          primary: ['side_delts'],   secondary: [] },
  { id: 'cable_lateral',    name: 'Cable Lateral Raise',       primary: ['side_delts'],   secondary: [] },
  { id: 'rear_delt_fly',    name: 'Reverse Pec Deck',          primary: ['rear_delts'],   secondary: ['traps'] },
  { id: 'face_pull',        name: 'Cable Face Pull',           primary: ['rear_delts'],   secondary: ['traps'] },
  { id: 'pike_pushup',      name: 'Pike Push-Up',              primary: ['front_delts'],  secondary: ['triceps','traps'] },
  { id: 'smith_ohp',        name: 'Smith Machine OHP',         primary: ['front_delts'],  secondary: ['side_delts','triceps'] },
  { id: 'kb_press',         name: 'Kettlebell Overhead Press', primary: ['front_delts'],  secondary: ['side_delts','triceps','abs'] },
  { id: 'shrug',            name: 'DB Shrug',                  primary: ['traps'],        secondary: [] },
  { id: 'pullup',           name: 'Pull-Up',                   primary: ['lats'],         secondary: ['biceps','rear_delts'] },
  { id: 'chin_up',          name: 'Chin-Up',                   primary: ['biceps'],       secondary: ['lats','rear_delts'] },
  { id: 'row',              name: 'Barbell Row',               primary: ['lats'],         secondary: ['biceps','rear_delts','traps'] },
  { id: 'lat_pulldown',     name: 'Lat Pulldown',              primary: ['lats'],         secondary: ['biceps'] },
  { id: 'tbar_row',         name: 'T-Bar Row',                 primary: ['lats'],         secondary: ['biceps','traps'] },
  { id: 'cable_row',        name: 'Seated Cable Row',          primary: ['lats'],         secondary: ['biceps','rear_delts','traps'] },
  { id: 'inverted_row',     name: 'Inverted Row',              primary: ['lats'],         secondary: ['biceps','rear_delts','traps'] },
  { id: 'kb_row',           name: 'Kettlebell Single-Arm Row', primary: ['lats'],         secondary: ['biceps','rear_delts'] },
  { id: 'machine_pullover', name: 'Machine Pullover',          primary: ['lats'],         secondary: ['chest','abs'] },
  { id: 'curl',             name: 'Barbell Curl',              primary: ['biceps'],       secondary: ['forearms'] },
  { id: 'hammer_curl',      name: 'Hammer Curl',               primary: ['biceps'],       secondary: ['forearms'] },
  { id: 'preacher_curl',    name: 'Preacher Curl',             primary: ['biceps'],       secondary: [] },
  { id: 'cable_curl',       name: 'Cable Curl',                primary: ['biceps'],       secondary: ['forearms'] },
  { id: 'tricep_pushdown',  name: 'Cable Tricep Pushdown',     primary: ['triceps'],      secondary: [] },
  { id: 'skullcrusher',     name: 'Skullcrusher',              primary: ['triceps'],      secondary: [] },
  { id: 'dip_bw',           name: 'Bodyweight Dip',            primary: ['triceps'],      secondary: ['chest','front_delts'] },
  { id: 'diamond_pushup',   name: 'Diamond Push-Up',           primary: ['triceps'],      secondary: ['chest','front_delts'] },
  { id: 'squat',            name: 'Back Squat',                primary: ['quads'],        secondary: ['glutes','hamstrings'] },
  { id: 'front_squat',      name: 'Front Squat',               primary: ['quads'],        secondary: ['glutes','abs'] },
  { id: 'leg_press',        name: 'Leg Press',                 primary: ['quads'],        secondary: ['glutes','hamstrings'] },
  { id: 'hack_squat',       name: 'Hack Squat Machine',        primary: ['quads'],        secondary: ['glutes','hamstrings'] },
  { id: 'bodyweight_squat', name: 'Bodyweight Squat',          primary: ['quads'],        secondary: ['glutes','hamstrings'] },
  { id: 'lunge',            name: 'Walking Lunge',             primary: ['quads'],        secondary: ['glutes','hamstrings'] },
  { id: 'rdl',              name: 'Romanian Deadlift',         primary: ['hamstrings'],   secondary: ['glutes','lower_back'] },
  { id: 'deadlift',         name: 'Conventional Deadlift',     primary: ['hamstrings'],   secondary: ['glutes','lower_back','traps'] },
  { id: 'leg_curl',         name: 'Lying Leg Curl',            primary: ['hamstrings'],   secondary: [] },
  { id: 'hip_thrust',       name: 'Barbell Hip Thrust',        primary: ['glutes'],       secondary: ['hamstrings'] },
  { id: 'calf_raise',       name: 'Standing Calf Raise',       primary: ['calves'],       secondary: [] },
  { id: 'plank',            name: 'Plank',                     primary: ['abs'],          secondary: ['obliques'] },
  { id: 'crunch',           name: 'Cable Crunch',              primary: ['abs'],          secondary: [] },
];

// ─── Types ───────────────────────────────────────────────────────────────────
interface SetData {
  id: string;
  reps: number | string;
  weight: number | string;
  rir: number;
  done: boolean;
  prevReps: number;
  prevWeight: number;
}

interface WorkoutEntry {
  id: string;
  exerciseId: string;
  exerciseName?: string; // fallback if not in EXERCISE_LIBRARY
  sets: SetData[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US');

function exerciseVol(we: WorkoutEntry) {
  return we.sets.reduce((acc, s) => acc + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);
}

function muscleVolumes(workout: WorkoutEntry[]) {
  const v: Record<string, number> = {};
  for (const we of workout) {
    const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
    if (!ex) continue;
    const vol = exerciseVol(we);
    if (vol === 0) continue;
    ex.primary.forEach(m   => { v[m] = (v[m] || 0) + vol; });
    ex.secondary.forEach(m => { v[m] = (v[m] || 0) + vol * 0.5; });
  }
  return v;
}

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

// ─── SVG paths ───────────────────────────────────────────────────────────────
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

// ─── ForgeBodyMap ─────────────────────────────────────────────────────────────
function ForgeBodyMap({ volumes, maxVol }: { volumes: Record<string, number>; maxVol: number }) {
  const [mode, setMode] = useState<'recovery' | 'growth'>('recovery');

  function renderPaths(paths: Record<string, string>, colorFn: (vol: number, max: number) => string | null) {
    return Object.entries(paths).map(([key, d]) => {
      const color = colorFn(volumes[key] || 0, maxVol);
      return (
        <Path key={key} d={d} fill={color ?? 'rgba(255,255,255,0.025)'} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
      );
    });
  }

  const colorFn = mode === 'recovery' ? volumeToRecovery : volumeToGrowth;

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
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: mode === m ? COLORS.accent : COLORS.text600 }}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

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

      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {legend.map(([color, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
            <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase' }}>{label}</Text>
          </View>
        ))}
      </View>

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

// ─── SetRow ───────────────────────────────────────────────────────────────────
function SetRow({
  set, idx, onUpdate, onDelete, isLast,
}: {
  set: SetData; idx: number;
  onUpdate: (patch: Partial<SetData>) => void;
  onDelete: () => void;
  isLast: boolean;
}) {
  const curVol = (Number(set.reps) || 0) * (Number(set.weight) || 0);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.2)' }}>
      <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, width: 20, textAlign: 'center' }}>{idx + 1}</Text>

      {/* Reps input */}
      <TextInput
        style={{ height: 36, width: 72, fontSize: 15, fontFamily: FONTS.anton, textAlign: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text100 }}
        value={String(set.reps)}
        onChangeText={v => onUpdate({ reps: v })}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={COLORS.text700}
      />

      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>×</Text>

      {/* Weight input */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <TextInput
          style={{ height: 36, width: 72, fontSize: 15, fontFamily: FONTS.anton, textAlign: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text100 }}
          value={String(set.weight)}
          onChangeText={v => onUpdate({ weight: v })}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={COLORS.text700}
        />
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>kg</Text>
      </View>

      {/* Volume */}
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400 }}>{curVol > 0 ? fmt0(curVol) : '—'}</Text>
      </View>

      {/* Delete */}
      <TouchableOpacity
        onPress={() => { if (!isLast) onDelete(); }}
        disabled={isLast}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ width: 28, height: 44, alignItems: 'center', justifyContent: 'center', opacity: isLast ? 0.2 : 1 }}
      >
        <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: '#f87171' }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── ExerciseCard ─────────────────────────────────────────────────────────────
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
  const displayName = ex?.name ?? we.exerciseName ?? we.exerciseId.toUpperCase();
  const totalVol = we.sets.reduce((acc, s) => acc + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);

  return (
    <View style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, marginBottom: 12 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>
              {String(index + 1).padStart(2, '0')}
            </Text>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, lineHeight: 24, paddingTop: 2 }}>
              {displayName.toUpperCase()}
            </Text>
          </View>
          {ex && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
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
          )}
        </View>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(28,25,23,0.5)', borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, gap: 4 }}>
        {[
          { label: '#',      width: 20 },
          { label: 'REPS',   width: 72 },
          { label: '',       width: 12 },
          { label: 'WEIGHT', width: 75 },
          { label: 'VOL',    width: 0, flex: 1 },
        ].map((col, i) => (
          <Text key={i} style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, textTransform: 'uppercase', width: col.width || undefined, flex: col.flex }}>
            {col.label}
          </Text>
        ))}
      </View>

      {/* Set rows */}
      {we.sets.map((s, idx) => (
        <SetRow
          key={s.id}
          set={s}
          idx={idx}
          onUpdate={patch => onUpdate({ ...we, sets: we.sets.map(x => x.id === s.id ? { ...x, ...patch } : x) })}
          onDelete={() => onUpdate({ ...we, sets: we.sets.filter(x => x.id !== s.id) })}
          isLast={we.sets.length === 1}
        />
      ))}

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
          {fmt0(totalVol)} KG·REPS
        </Text>
      </View>
    </View>
  );
}

// ─── RestTimerBanner ──────────────────────────────────────────────────────────
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
    if (remaining <= 0) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); return; }
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
                <Circle cx={44} cy={44} r={r} stroke={finished ? '#4ade80' : COLORS.accent} strokeWidth={5} fill="none" strokeDasharray={`${dash} ${circ}`} strokeLinecap="square" />
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

// ─── AddExerciseSheet ─────────────────────────────────────────────────────────
function AddExerciseSheet({
  visible, onClose, onAdd, usedIds,
}: {
  visible: boolean; onClose: () => void;
  onAdd: (id: string) => void; usedIds: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const [filterMuscle, setFilterMuscle] = useState<string | null>(null);

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
                style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#1c1917', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 }}
                placeholder="Search exercises…"
                placeholderTextColor={COLORS.text700}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }} contentContainerStyle={{ gap: 6, paddingRight: 16 }}>
              <TouchableOpacity
                onPress={() => setFilterMuscle(null)}
                style={{ paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: !filterMuscle ? COLORS.accent : COLORS.border, backgroundColor: !filterMuscle ? COLORS.accentMuted : 'transparent' }}
              >
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: !filterMuscle ? COLORS.accent : COLORS.text600, textTransform: 'uppercase' }}>ALL</Text>
              </TouchableOpacity>
              {Object.keys(MUSCLES).map(m => (
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ForgeReviewScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [workout, setWorkout] = useState<WorkoutEntry[]>([]);
  const [originalSetIds, setOriginalSetIds] = useState<Set<string>>(new Set());
  const [showRestSheet, setShowRestSheet] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);

  // Fetch full workout from Supabase
  useEffect(() => {
    if (!workoutId) { setLoading(false); return; }

    async function fetchWorkout() {
      try {
        const { data, error } = await supabase
          .from('workouts')
          .select(`
            id, name, started_at,
            workout_exercises (
              id, position, exercise_id, exercise_name,
              sets ( id, set_number, weight_kg, reps )
            )
          `)
          .eq('id', workoutId)
          .single();

        if (error || !data) {
          console.warn('ForgeReview fetch error:', error);
          setLoading(false);
          return;
        }

        const d = data as any;
        setWorkoutName(d.name ?? 'Workout');

        if (d.started_at) {
          const dt = new Date(d.started_at);
          setSessionDate(dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
        }

        const allSetIds = new Set<string>();
        const entries: WorkoutEntry[] = (d.workout_exercises ?? [])
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
          .map((we: any) => {
            const sets: SetData[] = (we.sets ?? [])
              .sort((a: any, b: any) => (a.set_number ?? 0) - (b.set_number ?? 0))
              .map((s: any) => {
                allSetIds.add(s.id);
                return {
                  id: s.id,
                  reps: s.reps ?? 0,
                  weight: s.weight_kg ?? 0,
                  rir: 2,
                  done: true,
                  prevReps: 0,
                  prevWeight: 0,
                };
              });

            if (sets.length === 0) {
              sets.push({ id: `new-${Date.now()}-init`, reps: 0, weight: 0, rir: 2, done: true, prevReps: 0, prevWeight: 0 });
            }

            return {
              id: we.id,
              exerciseId: we.exercise_id ?? '',
              exerciseName: we.exercise_name ?? undefined,
              sets,
            };
          });

        setOriginalSetIds(allSetIds);
        setWorkout(entries);
      } catch (e) {
        console.warn('ForgeReview unexpected error:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkout();
  }, [workoutId]);

  const volumes = useMemo(() => muscleVolumes(workout), [workout]);
  const maxVol  = useMemo(() => Math.max(800, ...Object.values(volumes)), [volumes]);
  const totalVolume = useMemo(() => workout.reduce((a, we) => a + exerciseVol(we), 0), [workout]);
  const totalSets = useMemo(() => workout.reduce((a, we) => a + we.sets.length, 0), [workout]);

  const volumeBarRows = useMemo(() => {
    const entries = Object.entries(volumes).filter(([, v]) => v > 0);
    if (entries.length === 0) return [];
    const maxMuscleVol = Math.max(...entries.map(([, v]) => v));
    return entries.sort((a, b) => b[1] - a[1]).map(([muscle, vol]) => ({ muscle, vol, pct: (vol / maxMuscleVol) * 100 }));
  }, [volumes]);

  const usedIds = useMemo(() => new Set(workout.map(we => we.exerciseId)), [workout]);

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
          id: `new-${Date.now()}`,
          reps: last?.reps ?? 8,
          weight: last?.weight ?? 0,
          rir: 2,
          done: true,
          prevReps: 0,
          prevWeight: 0,
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
      sets: [{ id: `new-${Date.now()}-1`, reps: 8, weight: 0, rir: 2, done: true, prevReps: 0, prevWeight: 0 }],
    }]);
  }, []);

  // ─── Save logic ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!workoutId) return;
    setSaving(true);
    try {
      const currentSetIds = new Set<string>();

      for (const [weIdx, we] of workout.entries()) {
        for (const [sIdx, s] of we.sets.entries()) {
          const isNew = String(s.id).startsWith('new-');

          if (isNew) {
            // INSERT new set
            await supabase.from('sets').insert({
              workout_exercise_id: we.id,
              set_number: sIdx + 1,
              reps: Number(s.reps) || 0,
              weight_kg: Number(s.weight) || 0,
            });
          } else {
            // UPDATE existing set
            await supabase.from('sets').update({
              reps: Number(s.reps) || 0,
              weight_kg: Number(s.weight) || 0,
              set_number: sIdx + 1,
            }).eq('id', s.id);
            currentSetIds.add(s.id);
          }
        }
      }

      // DELETE sets that were removed (in original but not current)
      const removedIds = [...originalSetIds].filter(id => !currentSetIds.has(id));
      if (removedIds.length > 0) {
        await supabase.from('sets').delete().in('id', removedIds);
      }

      // Recalculate and update workout totals
      const newTotal = workout.reduce((a, we) => a + exerciseVol(we), 0);
      await supabase.from('workouts').update({ total_volume_kg: newTotal }).eq('id', workoutId);

      setSaved(true);
      setTimeout(() => router.back(), 1800);
    } catch (e) {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, marginTop: 12, textTransform: 'uppercase', letterSpacing: 2 }}>Loading session…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 28, color: COLORS.text100, lineHeight: 34, paddingTop: 2 }}>
              REVIEW SESSION
            </Text>
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase' }}>← BACK</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
            {workoutName ? <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange400 }}>{workoutName.toUpperCase()}</Text> : null}
            {sessionDate ? <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500 }}>{sessionDate}</Text> : null}
          </View>
        </View>

        {/* ── Summary Bar ── */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: 'rgba(12,10,8,0.6)' }}>
          <View style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
            <View>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Exercises</Text>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 22, paddingTop: 2 }}>{workout.length}</Text>
            </View>
            <View>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Sets</Text>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 22, paddingTop: 2 }}>{totalSets}</Text>
            </View>
            <View>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Volume</Text>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.orange400, lineHeight: 22, paddingTop: 2 }}>{fmt0(totalVolume)}</Text>
            </View>
          </View>
        </View>

        {/* ── Exercise List ── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">

          {workout.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text700 }}>NO DATA</Text>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Session may not have been logged</Text>
            </View>
          ) : workout.map((we, idx) => (
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

          {/* Muscle Map */}
          {totalVolume > 0 && (
            <View style={{ borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.bgCard, padding: 14, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>MUSCLE MAP</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700 }}>this session</Text>
              </View>
              <ForgeBodyMap volumes={volumes} maxVol={maxVol} />
            </View>
          )}

          {/* Volume Breakdown */}
          {volumeBarRows.length > 0 && (
            <View style={{ borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.bgCard, marginBottom: 16 }}>
              <View style={{ padding: 14 }}>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, lineHeight: 28, marginBottom: 16 }}>VOLUME BREAKDOWN</Text>
                {volumeBarRows.map(({ muscle, vol, pct }) => (
                  <View key={muscle} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, textTransform: 'uppercase' }}>{MUSCLES[muscle] ?? muscle}</Text>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>{fmt0(vol)}</Text>
                    </View>
                    <View style={{ height: 3, backgroundColor: 'rgba(41,37,36,0.5)' }}>
                      <View style={{ height: 3, width: `${pct}%` as any, backgroundColor: COLORS.accent }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Bottom Buttons ── */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: 8 }}>
          <TouchableOpacity
            onPress={() => setShowAddSheet(true)}
            style={{ paddingVertical: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(87,83,78,0.5)', alignItems: 'center' }}
          >
            <Text style={{ fontFamily: FONTS.anton, fontSize: 13, color: COLORS.text600, letterSpacing: 1 }}>+ ADD EXERCISE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || saved}
            style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: saved ? '#4ade80' : COLORS.accent, opacity: saving ? 0.7 : 1 }}
          >
            <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, letterSpacing: 2 }}>
              {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE CHANGES'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            disabled={saving}
            style={{ paddingVertical: 10, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 }}>
              DISCARD CHANGES
            </Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      {/* Rest Timer */}
      {showRestSheet && <RestTimerBanner onDismiss={() => setShowRestSheet(false)} />}

      {/* Add Exercise Sheet */}
      <AddExerciseSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onAdd={addExercise}
        usedIds={usedIds}
      />
    </View>
  );
}
