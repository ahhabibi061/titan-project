// FORGE — Workout Logger · Pass 2
import React, {
  useState, useMemo, useRef, useEffect, useCallback,
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '../constants/theme';
import { MUSCLES, EXERCISE_LIBRARY } from '../constants/exercises';
import {
  useStartWorkout, useAddWorkoutExercise, useLogSet, useFinishWorkout, useWorkoutHistory,
} from '../hooks/useWorkout';

// ─── Domain ──────────────────────────────────────────────────────────────────
const CARDIO_IDS  = new Set(['rowing_machine', 'assault_bike', 'sled_push']);
const KB_IDS      = new Set(['kb_swing', 'kb_clean', 'kb_turkish_getup', 'farmers_carry', 'kb_goblet_squat', 'kb_lunge', 'kb_deadlift', 'kb_row', 'kb_press']);
const MACHINE_IDS = new Set(['chest_press', 'hack_squat', 'leg_press', 'adductor_machine', 'leg_curl', 'lat_pulldown', 'cable_row', 'cable_lateral', 'cable_fly', 'cable_curl', 'cable_woodchop', 'tricep_pushdown', 'preacher_curl', 'machine_pullover', 'smith_ohp', 'cable_pull_through', 'seated_calf']);

const FILTER_CATS: { key: string; label: string; muscles: string[] | null; ids: Set<string> | null }[] = [
  { key: 'all',        label: 'All',        muscles: null,                                               ids: null        },
  { key: 'chest',      label: 'Chest',      muscles: ['chest'],                                          ids: null        },
  { key: 'back',       label: 'Back',       muscles: ['lats', 'traps', 'lower_back'],                    ids: null        },
  { key: 'shoulders',  label: 'Shoulders',  muscles: ['front_delts', 'side_delts', 'rear_delts'],        ids: null        },
  { key: 'arms',       label: 'Arms',       muscles: ['biceps', 'triceps', 'forearms'],                  ids: null        },
  { key: 'legs',       label: 'Legs',       muscles: ['quads', 'hamstrings', 'glutes', 'calves'],        ids: null        },
  { key: 'core',       label: 'Core',       muscles: ['abs', 'obliques'],                                ids: null        },
  { key: 'cardio',     label: 'Cardio',     muscles: null,                                               ids: CARDIO_IDS  },
  { key: 'kettlebell', label: 'Kettlebell', muscles: null,                                               ids: KB_IDS      },
  { key: 'machine',    label: 'Machine',    muscles: null,                                               ids: MACHINE_IDS },
];
const FILTER_ROW1 = ['all', 'chest', 'back', 'shoulders', 'arms'];
const FILTER_ROW2 = ['legs', 'core', 'cardio', 'kettlebell', 'machine'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface SetData {
  id: string;
  weight: number | string;
  reps:   number | string;
}
interface WorkoutEntry { id: string; exerciseId: string; sets: SetData[]; }
interface LastSessionExercise {
  sets:     Array<{ weight: number; reps: number }>;
  totalVol: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US');

function setVolume(s: SetData) { return (Number(s.reps) || 0) * (Number(s.weight) || 0); }

function exerciseVolume(we: WorkoutEntry) {
  return we.sets.reduce((acc, s) => acc + setVolume(s), 0);
}

function muscleVolumes(workout: WorkoutEntry[]) {
  const v: Record<string, number> = {};
  for (const we of workout) {
    const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
    if (!ex) continue;
    const vol = exerciseVolume(we);
    if (vol === 0) continue;
    ex.primary.forEach(m   => { v[m] = (v[m] || 0) + vol; });
    ex.secondary.forEach(m => { v[m] = (v[m] || 0) + vol * 0.5; });
  }
  return v;
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

function fmtRestTime(secs: number) {
  const m = String(Math.floor(Math.max(0, secs) / 60)).padStart(2, '0');
  const s = String(Math.max(0, secs) % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function fmtPreset(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── SVG Muscle Paths (viewBox 220×460) ──────────────────────────────────────
const FRONT_PATHS: Record<string, string> = {
  chest:       'M 76,96 Q 90,88 108,90 L 108,138 Q 96,144 84,140 Q 76,134 74,124 Z M 144,96 Q 130,88 112,90 L 112,138 Q 124,144 136,140 Q 144,134 146,124 Z',
  front_delts: 'M 64,86 Q 56,88 52,102 Q 50,116 56,124 Q 66,124 74,118 Q 76,104 74,94 Q 70,86 64,86 Z M 156,86 Q 164,88 168,102 Q 170,116 164,124 Q 154,124 146,118 Q 144,104 146,94 Q 150,86 156,86 Z',
  side_delts:  'M 50,100 Q 42,104 40,118 Q 40,128 46,134 Q 52,132 56,124 Q 50,116 52,102 Z M 170,100 Q 178,104 180,118 Q 180,128 174,134 Q 168,132 164,124 Q 170,116 168,102 Z',
  traps:       'M 102,68 Q 98,76 100,84 Q 106,86 110,84 L 110,68 Z M 118,68 Q 122,76 120,84 Q 114,86 110,84 L 110,68 Z',
  biceps:      'M 46,128 Q 38,134 38,158 Q 42,176 50,178 Q 56,176 56,156 Q 56,138 52,130 Z M 174,128 Q 182,134 182,158 Q 178,176 170,178 Q 164,176 164,156 Q 164,138 168,130 Z',
  forearms:    'M 38,182 Q 32,196 32,222 Q 36,238 44,236 Q 50,234 52,218 Q 52,200 50,184 Z M 182,182 Q 188,196 188,222 Q 184,238 176,236 Q 170,234 168,218 Q 168,200 170,184 Z',
  abs:         'M 96,144 L 124,144 L 124,160 L 96,160 Z M 96,164 L 124,164 L 124,180 L 96,180 Z M 96,184 L 124,184 L 124,200 L 96,200 Z M 96,204 L 124,204 L 124,220 L 96,220 Z M 96,224 L 124,224 L 124,238 L 96,238 Z',
  obliques:    'M 78,150 Q 76,180 86,224 L 96,222 L 96,148 Q 86,146 78,150 Z M 142,150 Q 144,180 134,224 L 124,222 L 124,148 Q 134,146 142,150 Z',
  quads:       'M 78,250 Q 70,290 76,348 L 104,348 L 104,250 Q 90,246 78,250 Z M 142,250 Q 150,290 144,348 L 116,348 L 116,250 Q 130,246 142,250 Z',
  calves:      'M 84,388 Q 80,408 84,438 L 102,438 L 102,388 Z M 136,388 Q 140,408 136,438 L 118,438 L 118,388 Z',
};
const BACK_PATHS: Record<string, string> = {
  traps:       'M 110,72 L 90,86 Q 84,108 92,124 L 110,118 L 128,124 Q 136,108 130,86 Z',
  rear_delts:  'M 64,90 Q 56,96 52,110 Q 52,124 60,128 Q 70,126 76,118 Q 78,104 74,94 Z M 156,90 Q 164,96 168,110 Q 168,124 160,128 Q 150,126 144,118 Q 142,104 146,94 Z',
  triceps:     'M 46,132 Q 40,144 40,166 Q 44,180 52,180 Q 58,178 58,158 Q 58,140 52,132 Z M 174,132 Q 180,144 180,166 Q 176,180 168,180 Q 162,178 162,158 Q 162,140 168,132 Z',
  forearms:    'M 38,184 Q 32,200 32,224 Q 36,238 44,236 Q 50,234 52,218 Q 52,200 50,186 Z M 182,184 Q 188,200 188,224 Q 184,238 176,236 Q 170,234 168,218 Q 168,200 170,186 Z',
  lats:        'M 76,118 Q 60,150 64,200 L 102,206 L 102,134 Q 88,124 76,118 Z M 144,118 Q 160,150 156,200 L 118,206 L 118,134 Q 132,124 144,118 Z',
  lower_back:  'M 100,206 L 120,206 L 122,244 Q 110,248 98,244 Z',
  glutes:      'M 86,250 Q 76,272 88,300 Q 102,304 108,294 L 108,254 Q 96,248 86,250 Z M 134,250 Q 144,272 132,300 Q 118,304 112,294 L 112,254 Q 124,248 134,250 Z',
  hamstrings:  'M 80,300 Q 72,340 78,386 L 104,386 L 104,300 Q 92,296 80,300 Z M 140,300 Q 148,340 142,386 L 116,386 L 116,300 Q 128,296 140,300 Z',
  calves:      'M 76,388 Q 72,416 80,442 L 104,442 L 104,388 Z M 144,388 Q 148,416 140,442 L 116,442 L 116,388 Z',
};

// ─── Muscle Heatmap ───────────────────────────────────────────────────────────
function MuscleHeatmap({ volumes, max }: { volumes: Record<string,number>; max: number }) {
  const [selected, setSelected] = useState<{ key: string; vol: number } | null>(null);

  function renderPaths(paths: Record<string, string>) {
    return Object.entries(paths).map(([key, d]) => (
      <Path key={key} d={d}
        fill={volumeToFill(volumes[key] || 0, max)}
        stroke="rgba(255,255,255,0.05)" strokeWidth={0.5}
        onPress={() => setSelected(s => s?.key === key ? null : { key, vol: volumes[key] || 0 })}
      />
    ));
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[{ label: 'ANTERIOR', paths: FRONT_PATHS }, { label: 'POSTERIOR', paths: BACK_PATHS }].map(side => (
          <View key={side.label} style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 4 }}>{side.label}</Text>
            <Svg viewBox="0 0 220 460" style={{ width: '100%', aspectRatio: 220 / 460 }}>
              <Circle cx={110} cy={44} r={22} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
              <Rect x={100} y={62} width={20} height={14} fill="rgba(255,255,255,0.04)" />
              {renderPaths(side.paths)}
            </Svg>
          </View>
        ))}
      </View>
      {selected && (
        <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: COLORS.bg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 }}>{MUSCLES[selected.key]}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.orange400, lineHeight: 24, paddingTop: 2 }}>{fmt0(selected.vol)}</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600 }}>kg·reps</Text>
          </View>
        </View>
      )}
      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600 }}>Volume</Text>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600 }}>0 → {fmt0(max)}</Text>
        </View>
        <View style={{ height: 6, flexDirection: 'row' }}>
          {(['rgba(44,36,30,0.8)', 'rgb(98,42,18)', 'rgb(186,74,28)', 'rgb(240,110,38)'] as const).map((c, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: c }} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Set Row ──────────────────────────────────────────────────────────────────
function SetRow({ set, idx, lastSet, onUpdate, onDelete, isLast }: {
  set: SetData; idx: number;
  lastSet?: { weight: number; reps: number };
  onUpdate: (patch: Partial<SetData>) => void;
  onDelete: () => void;
  isLast: boolean;
}) {
  function getRef(): { text: string; color: string } {
    if (!lastSet) return { text: 'NEW', color: COLORS.text700 };
    const lastStr = `${lastSet.weight}×${lastSet.reps}`;
    const curW = Number(set.weight);
    const curR = Number(set.reps);
    if (!curW || !curR) return { text: `● ${lastStr}`, color: COLORS.text600 };
    const curVol  = curW * curR;
    const lastVol = lastSet.weight * lastSet.reps;
    if (curVol > lastVol) return { text: `↑ ${lastStr}`, color: '#4ade80' };
    if (curVol < lastVol) return { text: `↓ ${lastStr}`, color: '#f87171' };
    return { text: `● ${lastStr}`, color: COLORS.text500 };
  }

  const ref = getRef();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, paddingVertical: 4, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.borderLight }}>
      {/* Set # */}
      <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text600, width: 24, textAlign: 'center' }}>
        {idx + 1}
      </Text>

      {/* Last session reference */}
      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: ref.color, width: 64 }} numberOfLines={1}>
        {ref.text}
      </Text>

      {/* KG Input */}
      <TextInput
        style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, height: 38, width: 62, textAlign: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, lineHeight: 20, paddingTop: 2 }}
        value={String(set.weight)}
        onChangeText={v => onUpdate({ weight: v === '' ? '' : Number(v) })}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={COLORS.text700}
      />

      {/* Reps Input */}
      <TextInput
        style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, height: 38, width: 62, textAlign: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, lineHeight: 20, paddingTop: 2 }}
        value={String(set.reps)}
        onChangeText={v => onUpdate({ reps: v === '' ? '' : Number(v) })}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={COLORS.text700}
      />

      {/* × Remove */}
      <TouchableOpacity
        onPress={() => { if (!isLast) onDelete(); }}
        style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', opacity: isLast ? 0.2 : 1 }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 16, color: '#f87171', lineHeight: 20 }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────
function ExerciseCard({ we, index, lastSession, onUpdate, onRemove, onAddSet }: {
  we: WorkoutEntry; index: number;
  lastSession?: LastSessionExercise;
  onUpdate: (u: WorkoutEntry) => void; onRemove: () => void;
  onAddSet: () => void;
}) {
  const ex  = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
  if (!ex) return null;
  const vol = exerciseVolume(we);

  function getProgression(): { label: string; color: string } | null {
    if (!lastSession || lastSession.totalVol === 0) return { label: 'NEW', color: COLORS.text600 };
    if (vol === 0) return null;
    const ratio = vol / lastSession.totalVol;
    if (ratio > 1.03) return { label: '↑ Progressing', color: '#4ade80' };
    if (ratio < 0.97) return { label: '↓ Down',        color: '#f87171' };
    return                     { label: '→ Holding',   color: COLORS.text500 };
  }
  const progression = getProgression();

  return (
    <View style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 12 }}>
      {/* Exercise header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, marginBottom: 2 }}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 24, paddingTop: 2 }}>{ex.name.toUpperCase()}</Text>
            {progression && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: `${progression.color}55`, backgroundColor: `${progression.color}18` }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: progression.color, letterSpacing: 0.5 }}>{progression.label}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {ex.primary.map(m => (
              <View key={m} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: COLORS.accentMuted, borderWidth: 1, borderColor: COLORS.accentBorder }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.orange400, textTransform: 'uppercase', letterSpacing: 0.8 }}>{MUSCLES[m]}</Text>
              </View>
            ))}
            {ex.secondary.map(m => (
              <View key={m} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(41,37,36,0.5)', borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 0.8 }}>{MUSCLES[m]}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <TouchableOpacity onPress={onRemove} style={{ padding: 4 }}>
            <Text style={{ color: COLORS.text600, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>{we.sets.length} sets</Text>
          <Text style={{ fontFamily: FONTS.anton, fontSize: 14, color: COLORS.orange400, lineHeight: 18, paddingTop: 2 }}>{fmt0(vol)}</Text>
        </View>
      </View>

      {/* Column headers */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(28,25,23,0.5)', gap: 8 }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, width: 24, textAlign: 'center', textTransform: 'uppercase' }}>SET</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, width: 64, textTransform: 'uppercase' }}>LAST</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, width: 62, textAlign: 'center', textTransform: 'uppercase' }}>KG</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, width: 62, textAlign: 'center', textTransform: 'uppercase' }}>REPS</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, width: 24, textAlign: 'center' }}>×</Text>
      </View>

      {we.sets.map((s, idx) => (
        <SetRow key={s.id} set={s} idx={idx} isLast={we.sets.length === 1}
          lastSet={lastSession?.sets[idx]}
          onUpdate={patch => onUpdate({ ...we, sets: we.sets.map(x => x.id === s.id ? { ...x, ...patch } : x) })}
          onDelete={() => onUpdate({ ...we, sets: we.sets.filter(x => x.id !== s.id) })}
        />
      ))}

      <TouchableOpacity onPress={onAddSet} style={{ paddingVertical: 11, borderTopWidth: 1, borderTopColor: COLORS.borderLight, alignItems: 'center' }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2 }}>+ ADD SET</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Exercise Sheet ───────────────────────────────────────────────────────
function AddExerciseSheet({ visible, onClose, onAdd, usedIds }: {
  visible: boolean; onClose: () => void; onAdd: (id: string) => void; usedIds: Set<string>;
}) {
  const [query, setQuery]         = useState('');
  const [filterKey, setFilterKey] = useState('all');
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) setTimeout(() => searchRef.current?.focus(), 300);
    else { setQuery(''); setFilterKey('all'); }
  }, [visible]);

  const cat = FILTER_CATS.find(c => c.key === filterKey)!;
  const filtered = EXERCISE_LIBRARY.filter(e => {
    if (usedIds.has(e.id)) return false;
    if (query && !e.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filterKey === 'all') return true;
    if (cat.ids)     return cat.ids.has(e.id);
    if (cat.muscles) return e.primary.some(m => cat.muscles!.includes(m)) || e.secondary.some(m => cat.muscles!.includes(m));
    return true;
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: '#292524', maxHeight: '90%' }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, lineHeight: 28, paddingTop: 2 }}>ADD EXERCISE</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>CLOSE</Text>
                </TouchableOpacity>
              </View>
              <TextInput ref={searchRef}
                style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text100, borderWidth: 1, borderColor: '#292524', backgroundColor: '#1c1917', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 }}
                placeholder="Search exercises…" placeholderTextColor={COLORS.text700}
                value={query} onChangeText={setQuery} />
              {[FILTER_ROW1, FILTER_ROW2].map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                  {row.map(key => {
                    const fc = FILTER_CATS.find(c => c.key === key)!;
                    const active = filterKey === key;
                    return (
                      <TouchableOpacity key={key}
                        onPress={() => setFilterKey(active ? 'all' : key)}
                        style={{ flex: 1, height: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
                          borderColor: active ? COLORS.accent : COLORS.border,
                          backgroundColor: active ? COLORS.accent : 'transparent' }}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: active ? COLORS.bg : COLORS.text500, textTransform: 'uppercase', letterSpacing: 0.3 }} numberOfLines={1}>
                          {fc.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: 8 }} />
            </View>
            <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
              {filtered.length === 0
                ? <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, textTransform: 'uppercase' }}>No exercises found.</Text>
                  </View>
                : filtered.map(ex => (
                    <TouchableOpacity key={ex.id} onPress={() => { onAdd(ex.id); onClose(); }}
                      style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1c1917', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text100 }}>{ex.name}</Text>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {ex.primary.map(m => MUSCLES[m]).join(', ')}
                      </Text>
                    </TouchableOpacity>
                  ))
              }
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Finish Confirm Sheet ─────────────────────────────────────────────────────
function FinishConfirmSheet({ visible, onConfirm, onDiscard, onClose, totalVolume, totalSets, elapsed, volumes, saving, calories }: {
  visible: boolean; onConfirm: () => void; onDiscard: () => void; onClose: () => void;
  totalVolume: number; totalSets: number; elapsed: number;
  volumes: Record<string, number>; saving: boolean; calories: number;
}) {
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  const topMuscles = Object.entries(volumes).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]).slice(0, 5);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: '#292524', padding: 20 }}>
          <Text style={{ fontFamily: FONTS.anton, fontSize: 24, color: COLORS.text100, lineHeight: 30, paddingTop: 2, marginBottom: 4 }}>FINISH WORKOUT?</Text>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 }}>Review and confirm</Text>

          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 }}>
            {[
              { label: 'Volume', value: fmt0(totalVolume), sub: 'kg·reps' },
              { label: 'Sets',   value: String(totalSets),  sub: 'logged' },
              { label: 'Time',   value: `${mins}:${secs}`,  sub: 'elapsed' },
              { label: 'Kcal',   value: `~${calories}`,     sub: 'est. burned' },
            ].map((s, i) => (
              <View key={s.label} style={{ flex: 1, padding: 10, borderRightWidth: i < 3 ? 1 : 0, borderRightColor: COLORS.border, alignItems: 'center' }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</Text>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>{s.value}</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700 }}>{s.sub}</Text>
              </View>
            ))}
          </View>

          {topMuscles.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Muscles Trained</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {topMuscles.map(([m]) => (
                  <View key={m} style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted }}>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange400, textTransform: 'uppercase' }}>{MUSCLES[m]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity onPress={onConfirm} disabled={saving}
            style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.accent, marginBottom: 8, opacity: saving ? 0.7 : 1 }}>
            {saving
              ? <ActivityIndicator color={COLORS.bg} />
              : <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, letterSpacing: 2 }}>CONFIRM FINISH</Text>}
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

// ─── Rest Timer Sheet ─────────────────────────────────────────────────────────
function RestTimerSheet({ visible, onClose, running, display, duration, onStart, onStop, onSetDuration }: {
  visible: boolean; onClose: () => void;
  running: boolean; display: string; duration: number;
  onStart: (secs: number) => void; onStop: () => void;
  onSetDuration: (secs: number) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' }}>
        <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: '#292524', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 44 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, lineHeight: 26, paddingTop: 2 }}>REST TIMER</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>CLOSE</Text>
            </TouchableOpacity>
          </View>

          {/* Countdown */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 64, color: running ? COLORS.accent : COLORS.text400, lineHeight: 72, paddingTop: 4 }}>
              {display}
            </Text>
          </View>

          {/* Preset buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[60, 90, 120, 180].map(opt => {
              const active = duration === opt && !running;
              return (
                <TouchableOpacity key={opt} onPress={() => onSetDuration(opt)}
                  style={{ flex: 1, paddingVertical: 10, borderWidth: 1, alignItems: 'center',
                    borderColor: duration === opt ? COLORS.accent : COLORS.border,
                    backgroundColor: duration === opt ? COLORS.accentMuted : 'transparent' }}>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: duration === opt ? COLORS.accent : COLORS.text600 }}>
                    {fmtPreset(opt)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* START / STOP */}
          <TouchableOpacity
            onPress={() => running ? onStop() : onStart(duration)}
            style={{ paddingVertical: 16, alignItems: 'center',
              backgroundColor: running ? 'rgba(41,37,36,0.8)' : COLORS.accent,
              borderWidth: running ? 1 : 0, borderColor: COLORS.accent }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: running ? COLORS.accent : COLORS.bg, letterSpacing: 2 }}>
              {running ? 'STOP' : 'START'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message }: { message: string }) {
  return (
    <View style={{ position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: '#1c1917', borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 12, zIndex: 999 }}>
      <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text300 }}>{message}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ForgeScreen() {
  const navigation = useNavigation<any>();

  const [workout, setWorkout]             = useState<WorkoutEntry[]>([]);
  const [elapsed, setElapsed]             = useState(0);
  const [sessionStarted, setStarted]      = useState(false);
  const [workoutId, setWorkoutId]         = useState<string | null>(null);
  const [weIdMap, setWeIdMap]             = useState<Map<string, string>>(new Map());
  const [showAddSheet, setShowAddSheet]   = useState(false);
  const [showFinishSheet, setFinishSheet] = useState(false);
  const [showRestSheet, setShowRestSheet] = useState(false);
  const [restRunning, setRestRunning]     = useState(false);
  const [restDisplay, setRestDisplay]     = useState('01:30');
  const [restDuration, setRestDuration]   = useState(90);
  const [toast, setToast]                 = useState<string | null>(null);

  const restRemainingRef = useRef(90);
  const restIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const { mutateAsync: startWorkout,  isPending: starting  } = useStartWorkout();
  const { mutateAsync: addWeToDb }                           = useAddWorkoutExercise();
  const { mutateAsync: logSet }                              = useLogSet();
  const { mutateAsync: finishWorkout, isPending: finishing  } = useFinishWorkout();
  const { data: historyData }                                = useWorkoutHistory();

  // Build last-session map: exercise name (lower) → { sets, totalVol }
  const lastSessionMap = useMemo(() => {
    const map = new Map<string, LastSessionExercise>();
    if (!historyData) return map;
    for (const w of historyData) {
      for (const we of (w as any).workout_exercises ?? []) {
        const name = ((we.notes as string) ?? '').toLowerCase().trim();
        if (map.has(name)) continue;
        const sortedSets: Array<{ weight: number; reps: number }> = ((we.sets ?? []) as any[])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((s: any) => ({ weight: s.weight_kg ?? 0, reps: s.reps ?? 0 }));
        const totalVol = sortedSets.reduce((a, s) => a + s.weight * s.reps, 0);
        map.set(name, { sets: sortedSets, totalVol });
      }
    }
    return map;
  }, [historyData]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Session elapsed timer
  useEffect(() => {
    if (!sessionStarted) return;
    const i = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(i);
  }, [sessionStarted]);

  // Clean up rest timer on unmount
  useEffect(() => {
    return () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); };
  }, []);

  // Rest timer controls
  function stopRestTimer() {
    if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
    setRestRunning(false);
  }

  function startRestTimer(secs: number) {
    if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
    restRemainingRef.current = secs;
    setRestDisplay(fmtRestTime(secs));
    setRestRunning(true);
    restIntervalRef.current = setInterval(() => {
      restRemainingRef.current -= 1;
      setRestDisplay(fmtRestTime(restRemainingRef.current));
      if (restRemainingRef.current <= 0) {
        if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
        setRestRunning(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    }, 1000);
  }

  function handleSetRestDuration(secs: number) {
    setRestDuration(secs);
    if (restRunning) {
      startRestTimer(secs);
    } else {
      restRemainingRef.current = secs;
      setRestDisplay(fmtRestTime(secs));
    }
  }

  const volumes     = useMemo(() => muscleVolumes(workout), [workout]);
  const maxVol      = useMemo(() => Math.max(800, ...Object.values(volumes)), [volumes]);
  const totalSets   = useMemo(() => workout.reduce((a, we) => a + we.sets.length, 0), [workout]);
  const doneSets    = useMemo(() => workout.reduce((a, we) => a + we.sets.filter(s => Number(s.weight) > 0 && Number(s.reps) > 0).length, 0), [workout]);
  const totalVolume = useMemo(() => workout.reduce((a, we) => a + exerciseVolume(we), 0), [workout]);
  const usedIds     = useMemo(() => new Set(workout.map(we => we.exerciseId)), [workout]);
  const progressPct = totalSets > 0 ? doneSets / totalSets : 0;
  const mm          = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss          = String(elapsed % 60).padStart(2, '0');
  const todayLabel  = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const updateExercise = useCallback((id: string, updated: WorkoutEntry) =>
    setWorkout(w => w.map(we => we.id === id ? updated : we)), []);

  const addSet = useCallback((weId: string) =>
    setWorkout(w => w.map(we => {
      if (we.id !== weId) return we;
      const last = we.sets[we.sets.length - 1];
      return { ...we, sets: [...we.sets, { id: `s-${Date.now()}`, reps: last?.reps ?? 8, weight: last?.weight ?? 0 }] };
    })), []);

  const addExercise = useCallback(async (exerciseId: string) => {
    const newId = `we-${Date.now()}`;
    const newWe: WorkoutEntry = {
      id: newId, exerciseId,
      sets: [{ id: `s-${Date.now()}-1`, reps: 8, weight: 0 }],
    };
    setWorkout(w => [...w, newWe]);

    if (workoutId) {
      const ex = EXERCISE_LIBRARY.find(e => e.id === exerciseId);
      try {
        const supabaseWeId = await addWeToDb({
          workoutId,
          exerciseName: ex?.name ?? exerciseId,
          position:     workout.length,
          setsTarget:   1,
        });
        setWeIdMap(m => new Map(m).set(newId, supabaseWeId));
      } catch {
        showToast('Exercise added locally — will sync on next session start.');
      }
    }
  }, [workoutId, workout.length, addWeToDb]);

  async function handleStartSession() {
    try {
      const result = await startWorkout({
        name:      'Workout',
        exercises: workout.map((we, idx) => {
          const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
          return { exerciseName: ex?.name ?? we.exerciseId, setsTarget: we.sets.length, position: idx };
        }),
      });
      const map = new Map<string, string>();
      workout.forEach((we, idx) => {
        if (result.workoutExerciseIds[idx]) map.set(we.id, result.workoutExerciseIds[idx]);
      });
      setWorkoutId(result.workoutId);
      setWeIdMap(map);
      setStarted(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      showToast(`Failed to start session: ${e?.message ?? 'Unknown error'}. Tap again to retry.`);
    }
  }

  async function handleFinishTap() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setFinishSheet(true);
  }

  function resetSession() {
    stopRestTimer();
    setWorkout([]);
    setElapsed(0);
    setStarted(false);
    setWorkoutId(null);
    setWeIdMap(new Map());
  }

  async function handleConfirmFinish() {
    if (!workoutId) {
      resetSession();
      setFinishSheet(false);
      return;
    }
    try {
      // Log all sets to Supabase
      for (const we of workout) {
        const supabaseWeId = weIdMap.get(we.id);
        if (!supabaseWeId) continue;
        for (let idx = 0; idx < we.sets.length; idx++) {
          const s = we.sets[idx];
          const w = Number(s.weight);
          const r = Number(s.reps);
          if (!w && !r) continue;
          try {
            await logSet({ workoutExerciseId: supabaseWeId, setNumber: idx + 1, weightKg: w, reps: r, rir: 0 });
          } catch {}
        }
      }

      const caloriesBurned = Math.round((elapsed / 60) * 7);
      await finishWorkout({
        workoutId,
        durationSeconds: elapsed,
        totalVolumeKg:   totalVolume,
        workoutName:     'Workout',
        doneSets:        totalSets,
        caloriesBurned,
      });

      setFinishSheet(false);
      resetSession();
      navigation.navigate('Home');
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message ?? 'Unknown error. Keep this sheet open and try again.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top','left','right']}>

        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 28, color: COLORS.text100, lineHeight: 36, paddingTop: 2 }}>FORGE</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: sessionStarted ? COLORS.accent : COLORS.text500 }}>
              {sessionStarted ? 'SESSION LIVE' : todayLabel}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700 }}>{mm}:{ss} elapsed</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange400 }}>{fmt0(totalVolume)} kg·reps</Text>
          </View>
        </View>

        {/* Summary Bar */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.6)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 20 }}>
              <View>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Sets</Text>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>
                  {doneSets}<Text style={{ color: COLORS.text700 }}>/{totalSets}</Text>
                </Text>
              </View>
              <View>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Volume</Text>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.orange400, lineHeight: 20, paddingTop: 2 }}>{fmt0(totalVolume)}</Text>
              </View>
              <View>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Time</Text>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>{mm}:{ss}</Text>
              </View>
            </View>

            {/* REST TIMER button */}
            <TouchableOpacity
              onPress={() => setShowRestSheet(true)}
              style={{ paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1,
                borderColor: restRunning ? COLORS.accent : COLORS.border,
                backgroundColor: restRunning ? COLORS.accentMuted : 'transparent' }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: restRunning ? COLORS.accent : COLORS.text600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {restRunning ? `REST ${restDisplay}` : 'REST TIMER'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 3, backgroundColor: '#1c1917' }}>
            <View style={{ height: '100%', width: `${progressPct * 100}%` as any, backgroundColor: COLORS.accent }} />
          </View>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, marginTop: 4 }}>{Math.round(progressPct * 100)}% with values</Text>
        </View>

        {/* Exercise list */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
          {workout.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 48, paddingBottom: 24 }}>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>No exercises yet</Text>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text700, textAlign: 'center' }}>Tap + ADD EXERCISE below to build your session</Text>
            </View>
          )}

          {workout.map((we, idx) => {
            const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
            const lastSession = ex ? lastSessionMap.get(ex.name.toLowerCase().trim()) : undefined;
            return (
              <ExerciseCard key={we.id} we={we} index={idx}
                lastSession={lastSession}
                onUpdate={updated => updateExercise(we.id, updated)}
                onRemove={() => setWorkout(w => w.filter(x => x.id !== we.id))}
                onAddSet={() => addSet(we.id)}
              />
            );
          })}

          {/* Muscle Heatmap */}
          {workout.length > 0 && (
            <View style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', padding: 14, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>MUSCLE MAP</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700 }}>live · tap to detail</Text>
              </View>
              <MuscleHeatmap volumes={volumes} max={maxVol} />
            </View>
          )}
        </ScrollView>

        {/* Bottom buttons */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 }}>
          {sessionStarted && (
            <TouchableOpacity onPress={() => setShowAddSheet(true)}
              style={{ paddingVertical: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(87,83,78,0.5)', alignItems: 'center' }}>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 14, color: COLORS.text600, letterSpacing: 1 }}>+ ADD EXERCISE</Text>
            </TouchableOpacity>
          )}

          {sessionStarted ? (
            <TouchableOpacity onPress={handleFinishTap}
              style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.accent }}>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, letterSpacing: 2 }}>FINISH WORKOUT</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleStartSession} disabled={starting}
              style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.accent, opacity: starting ? 0.7 : 1 }}>
              {starting
                ? <ActivityIndicator color={COLORS.bg} />
                : <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, letterSpacing: 2 }}>START SESSION</Text>}
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>

      {toast && <Toast message={toast} />}

      <AddExerciseSheet visible={showAddSheet} onClose={() => setShowAddSheet(false)} onAdd={addExercise} usedIds={usedIds} />

      <FinishConfirmSheet
        visible={showFinishSheet}
        onConfirm={handleConfirmFinish}
        onDiscard={() => { resetSession(); setFinishSheet(false); }}
        onClose={() => setFinishSheet(false)}
        totalVolume={totalVolume} totalSets={totalSets} elapsed={elapsed} volumes={volumes}
        saving={finishing} calories={Math.round((elapsed / 60) * 7)}
      />

      <RestTimerSheet
        visible={showRestSheet}
        onClose={() => setShowRestSheet(false)}
        running={restRunning}
        display={restDisplay}
        duration={restDuration}
        onStart={startRestTimer}
        onStop={stopRestTimer}
        onSetDuration={handleSetRestDuration}
      />
    </View>
  );
}
