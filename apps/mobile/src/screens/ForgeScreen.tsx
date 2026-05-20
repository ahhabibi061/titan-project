// FORGE — Workout Logger · Pass 4
import React, {
  useState, useMemo, useRef, useEffect, useCallback,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BodyMapDual } from '../components/MuscleMap';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, FONTS } from '../constants/theme';
import { MUSCLES, EXERCISE_LIBRARY } from '../constants/exercises';
import {
  useStartWorkout, useAddWorkoutExercise, useLogSet, useFinishWorkout, useWorkoutHistory, useTodayWorkout, useUpdateSet,
} from '../hooks/useWorkout';

// ─── Domain ──────────────────────────────────────────────────────────────────
const CARDIO_IDS  = new Set(['rowing_machine', 'assault_bike', 'sled_push']);
const KB_IDS      = new Set(['kb_swing', 'kb_clean', 'kb_turkish_getup', 'farmers_carry', 'kb_goblet_squat', 'kb_lunge', 'kb_deadlift', 'kb_row', 'kb_press']);
const MACHINE_IDS = new Set(['chest_press', 'hack_squat', 'leg_press', 'adductor_machine', 'abductor_machine', 'leg_curl', 'lat_pulldown', 'cable_row', 'cable_lateral', 'cable_fly', 'cable_curl', 'cable_woodchop', 'tricep_pushdown', 'preacher_curl', 'machine_pullover', 'smith_ohp', 'cable_pull_through', 'seated_calf']);

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

// ─── User Split / Template ────────────────────────────────────────────────────
interface UserSplit {
  id: string;
  name: string;
  exercises: { exerciseId: string; setsTarget: number }[];
}

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

const MUSCLE_RECOVERY_HOURS: Record<string, number> = {
  chest: 72, lats: 72, lower_back: 72, glutes: 72, quads: 72, hamstrings: 72,
  front_delts: 48, rear_delts: 48, side_delts: 48, biceps: 48, triceps: 48,
  calves: 36, traps: 36, forearms: 36, abs: 24, obliques: 24,
};

function volumesToRecoveryMap(
  vols: Record<string, number>, maxVol: number,
): Record<string, { status: string; pct: number; hoursRemaining: number }> {
  const map: Record<string, { status: string; pct: number; hoursRemaining: number }> = {};
  for (const [muscle, vol] of Object.entries(vols)) {
    if (vol <= 0) continue;
    const t = vol / Math.max(maxVol, 1);
    const status = t >= 0.67 ? 'resting' : t >= 0.34 ? 'partial' : t >= 0.10 ? 'almost' : 'ready';
    const pct    = t >= 0.67 ? 28 : t >= 0.34 ? 55 : t >= 0.10 ? 80 : 100;
    const hours  = Math.round((MUSCLE_RECOVERY_HOURS[muscle] ?? 48) * t);
    map[muscle]  = { status, pct, hoursRemaining: hours };
  }
  return map;
}

function volumesToGrowthMap(
  vols: Record<string, number>, maxVol: number,
): Record<string, { status: string; growthPct: number; currentVol: number; prevVol: number }> {
  const map: Record<string, { status: string; growthPct: number; currentVol: number; prevVol: number }> = {};
  for (const [muscle, vol] of Object.entries(vols)) {
    if (vol <= 0) continue;
    const t      = vol / Math.max(maxVol, 1);
    const status = t >= 0.67 ? 'pr' : t >= 0.34 ? 'improved' : 'first';
    map[muscle]  = { status, growthPct: Math.round(t * 100), currentVol: Math.round(vol), prevVol: 0 };
  }
  return map;
}

const STATUS_CONFIG = {
  new:   { label: '+ NEW',   color: '#ed7a2a', bg: 'rgba(237,122,42,0.15)',   border: 'rgba(237,122,42,0.30)'  },
  up:    { label: '▲ UP',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.35)'  },
  match: { label: '= MATCH', color: '#78716c', bg: 'rgba(87,83,78,0.12)',     border: 'rgba(87,83,78,0.35)'    },
  down:  { label: '▼ DOWN',  color: '#f87171', bg: 'rgba(248,113,113,0.10)',  border: 'rgba(248,113,113,0.35)' },
};

// ─── Set Row ──────────────────────────────────────────────────────────────────
function SetRow({ set, idx, lastSet, onUpdate, onDelete, isLast }: {
  set: SetData; idx: number;
  lastSet?: { weight: number; reps: number };
  onUpdate: (patch: Partial<SetData>) => void;
  onDelete: () => void;
  isLast: boolean;
}) {
  const curR   = Number(set.reps)   || 0;
  const curW   = Number(set.weight) || 0;
  const curVol = curR * curW;
  const prevVol = lastSet ? lastSet.reps * lastSet.weight : 0;

  const kind: keyof typeof STATUS_CONFIG =
    curVol === 0            ? 'new'   :
    prevVol === 0           ? 'new'   :
    curVol > prevVol        ? 'up'    :
    curVol === prevVol      ? 'match' : 'down';
  const status = STATUS_CONFIG[kind];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 8, paddingVertical: 4, gap: 4, borderTopWidth: 1, borderTopColor: COLORS.borderLight }}>
      {/* Set # */}
      <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, width: 20, textAlign: 'center' }}>
        {String(idx + 1).padStart(2, '0')}
      </Text>

      {/* Last session — 2 stacked lines */}
      <View style={{ width: 72 }}>
        {lastSet ? (
          <>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text400 }} numberOfLines={1}>
              {lastSet.reps} × {lastSet.weight}kg
            </Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>
              vol {fmt0(prevVol)}
            </Text>
          </>
        ) : (
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700 }}>—</Text>
        )}
      </View>

      {/* Reps Input */}
      <TextInput
        style={{ fontFamily: FONTS.anton, fontSize: 15, color: COLORS.text100, height: 36, width: 52, textAlign: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, paddingTop: 2 }}
        value={String(set.reps)}
        onChangeText={v => onUpdate({ reps: v === '' ? '' : Number(v) })}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={COLORS.text700}
      />

      {/* Weight Input + kg label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <TextInput
          style={{ fontFamily: FONTS.anton, fontSize: 15, color: COLORS.text100, height: 36, width: 52, textAlign: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, paddingTop: 2 }}
          value={String(set.weight)}
          onChangeText={v => onUpdate({ weight: v === '' ? '' : Number(v) })}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={COLORS.text700}
        />
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>kg</Text>
      </View>

      {/* Live volume */}
      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, width: 36, textAlign: 'center' }}>
        {curVol > 0 ? fmt0(curVol) : '—'}
      </Text>

      {/* STATUS pill */}
      <View style={{ width: 52, paddingHorizontal: 4, paddingVertical: 3, backgroundColor: status.bg, borderWidth: 1, borderColor: status.border, alignItems: 'center' }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: status.color, textTransform: 'uppercase', letterSpacing: 0.2 }} numberOfLines={1}>
          {status.label}
        </Text>
      </View>

      {/* × Remove */}
      <TouchableOpacity
        onPress={() => { if (!isLast) onDelete(); }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ width: 20, height: 44, alignItems: 'center', justifyContent: 'center', opacity: isLast ? 0.2 : 1 }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: '#f87171' }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────
function ExerciseCard({ we, index, lastSession, onUpdate, onRemove, onAddSet, onOpenRestTimer }: {
  we: WorkoutEntry; index: number;
  lastSession?: LastSessionExercise;
  onUpdate: (u: WorkoutEntry) => void; onRemove: () => void;
  onAddSet: () => void;
  onOpenRestTimer: () => void;
}) {
  const ex  = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
  if (!ex) return null;
  const vol = exerciseVolume(we);

  const lastSummary = lastSession && lastSession.sets.length > 0
    ? `LAST: ${lastSession.sets.length} SET${lastSession.sets.length !== 1 ? 'S' : ''} · ${lastSession.sets[0].weight}KG × ${lastSession.sets[0].reps}`
    : null;

  return (
    <View style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 12 }}>
      {/* Exercise header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {/* Index + Name */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 24, paddingTop: 2 }}>{ex.name.toUpperCase()}</Text>
          </View>
          {/* Muscle pills */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: lastSummary ? 6 : 0 }}>
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
          {/* LAST session summary */}
          {lastSummary && (
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500 }}>{lastSummary}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: COLORS.text600, fontSize: 14, fontFamily: FONTS.mono }}>✕</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase' }}>SETS</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text100 }}>{we.sets.length}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase' }}>VOL</Text>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 14, color: COLORS.orange400, lineHeight: 18, paddingTop: 2 }}>{fmt0(vol)}</Text>
          </View>
        </View>
      </View>

      {/* Column headers */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(28,25,23,0.5)', gap: 4, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, width: 20, textAlign: 'center', textTransform: 'uppercase' }}>SET</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, width: 72, textTransform: 'uppercase' }}>LAST SESSION</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, width: 52, textAlign: 'center', textTransform: 'uppercase' }}>REPS</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, width: 55, textAlign: 'center', textTransform: 'uppercase' }}>WEIGHT</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, width: 36, textAlign: 'center', textTransform: 'uppercase' }}>VOL</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700, width: 52, textAlign: 'center', textTransform: 'uppercase' }}>STATUS</Text>
      </View>

      {we.sets.map((s, idx) => (
        <SetRow key={s.id} set={s} idx={idx} isLast={we.sets.length === 1}
          lastSet={lastSession?.sets[idx]}
          onUpdate={patch => onUpdate({ ...we, sets: we.sets.map(x => x.id === s.id ? { ...x, ...patch } : x) })}
          onDelete={() => onUpdate({ ...we, sets: we.sets.filter(x => x.id !== s.id) })}
        />
      ))}

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={onAddSet} style={{ paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 }}>+ ADD SET</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenRestTimer} style={{ paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 0.5 }}>⏱ REST TIMER</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500 }}>
          TOTAL <Text style={{ color: COLORS.text300 }}>{fmt0(vol)}</Text> KG·REPS
        </Text>
      </View>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 24, color: COLORS.text100, lineHeight: 30, paddingTop: 2 }}>FINISH WORKOUT?</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text600 }}>×</Text>
            </TouchableOpacity>
          </View>
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

// ─── Templates ───────────────────────────────────────────────────────────────
interface Template {
  name: string;
  estimatedMins: number;
  exercises: { exerciseId: string; setsTarget: number }[];
}

const TEMPLATES: Template[] = [
  {
    name: 'PPL Push',
    estimatedMins: 55,
    exercises: [
      { exerciseId: 'bench',           setsTarget: 4 },
      { exerciseId: 'incline_db',      setsTarget: 3 },
      { exerciseId: 'cable_fly',       setsTarget: 3 },
      { exerciseId: 'ohp',             setsTarget: 3 },
      { exerciseId: 'lateral_raise',   setsTarget: 3 },
      { exerciseId: 'tricep_pushdown', setsTarget: 3 },
    ],
  },
  {
    name: 'PPL Pull',
    estimatedMins: 55,
    exercises: [
      { exerciseId: 'pullup',       setsTarget: 4 },
      { exerciseId: 'row',          setsTarget: 4 },
      { exerciseId: 'lat_pulldown', setsTarget: 3 },
      { exerciseId: 'face_pull',    setsTarget: 3 },
      { exerciseId: 'curl',         setsTarget: 3 },
      { exerciseId: 'hammer_curl',  setsTarget: 3 },
    ],
  },
  {
    name: 'PPL Legs',
    estimatedMins: 60,
    exercises: [
      { exerciseId: 'squat',      setsTarget: 4 },
      { exerciseId: 'rdl',        setsTarget: 3 },
      { exerciseId: 'leg_press',  setsTarget: 3 },
      { exerciseId: 'leg_curl',   setsTarget: 3 },
      { exerciseId: 'calf_raise', setsTarget: 4 },
    ],
  },
  {
    name: 'Upper A',
    estimatedMins: 60,
    exercises: [
      { exerciseId: 'bench',           setsTarget: 4 },
      { exerciseId: 'row',             setsTarget: 4 },
      { exerciseId: 'ohp',             setsTarget: 3 },
      { exerciseId: 'lat_pulldown',    setsTarget: 3 },
      { exerciseId: 'tricep_pushdown', setsTarget: 3 },
      { exerciseId: 'curl',            setsTarget: 3 },
    ],
  },
  {
    name: 'Full Body',
    estimatedMins: 50,
    exercises: [
      { exerciseId: 'squat', setsTarget: 3 },
      { exerciseId: 'bench', setsTarget: 3 },
      { exerciseId: 'row',   setsTarget: 3 },
      { exerciseId: 'ohp',   setsTarget: 2 },
      { exerciseId: 'rdl',   setsTarget: 3 },
      { exerciseId: 'curl',  setsTarget: 2 },
    ],
  },
];

const BRO_TEMPLATES: Template[] = [
  {
    name: 'Bro Chest',
    estimatedMins: 65,
    exercises: [
      { exerciseId: 'bench',           setsTarget: 4 },
      { exerciseId: 'incline_db',      setsTarget: 4 },
      { exerciseId: 'cable_fly',       setsTarget: 3 },
      { exerciseId: 'dips',            setsTarget: 3 },
      { exerciseId: 'cable_fly',       setsTarget: 3 },
    ],
  },
  {
    name: 'Bro Back',
    estimatedMins: 65,
    exercises: [
      { exerciseId: 'pullup',          setsTarget: 4 },
      { exerciseId: 'row',             setsTarget: 4 },
      { exerciseId: 'lat_pulldown',    setsTarget: 3 },
      { exerciseId: 'tbar_row',        setsTarget: 3 },
      { exerciseId: 'face_pull',       setsTarget: 3 },
    ],
  },
  {
    name: 'Bro Legs',
    estimatedMins: 70,
    exercises: [
      { exerciseId: 'squat',           setsTarget: 4 },
      { exerciseId: 'leg_press',       setsTarget: 4 },
      { exerciseId: 'rdl',             setsTarget: 3 },
      { exerciseId: 'leg_curl',        setsTarget: 3 },
      { exerciseId: 'calf_raise',      setsTarget: 4 },
    ],
  },
  {
    name: 'Bro Shoulders',
    estimatedMins: 60,
    exercises: [
      { exerciseId: 'ohp',             setsTarget: 4 },
      { exerciseId: 'lateral_raise',   setsTarget: 4 },
      { exerciseId: 'rear_delt_fly',   setsTarget: 3 },
      { exerciseId: 'face_pull',       setsTarget: 3 },
      { exerciseId: 'shrug',           setsTarget: 3 },
    ],
  },
  {
    name: 'Bro Arms',
    estimatedMins: 60,
    exercises: [
      { exerciseId: 'curl',            setsTarget: 4 },
      { exerciseId: 'hammer_curl',     setsTarget: 3 },
      { exerciseId: 'preacher_curl',   setsTarget: 3 },
      { exerciseId: 'skullcrusher',    setsTarget: 4 },
      { exerciseId: 'tricep_pushdown', setsTarget: 3 },
    ],
  },
];

// ─── Create Split Sheet ───────────────────────────────────────────────────────
function CreateSplitSheet({ visible, mode, onClose, onSaved }: {
  visible: boolean;
  mode: 'split' | 'template';
  onClose: () => void;
  onSaved: (split: UserSplit) => void;
}) {
  const [name, setName]         = useState('');
  const [exercises, setExercises] = useState<{ exerciseId: string; setsTarget: number }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving]     = useState(false);

  const usedExIds = useMemo(() => new Set(exercises.map(e => e.exerciseId)), [exercises]);

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Enter a name for this split.'); return; }
    if (exercises.length === 0) { Alert.alert('No exercises', 'Add at least one exercise.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      // Splits persist to custom_splits; templates persist to my_templates
      const col = mode === 'split' ? 'custom_splits' : 'my_templates';
      const { data: profile } = await supabase.from('profiles').select(col).eq('id', user.id).single();
      const current = ((profile as any)?.[col] ?? []) as UserSplit[];
      const newSplit: UserSplit = { id: Date.now().toString(), name: name.trim(), exercises };
      await supabase.from('profiles').update({ [col]: [...current, newSplit] }).eq('id', user.id);
      onSaved(newSplit);
      setName(''); setExercises([]);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: '#292524', maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, lineHeight: 28, paddingTop: 2 }}>
                {mode === 'split' ? 'CREATE SPLIT' : 'CREATE TEMPLATE'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>CLOSE</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
                {mode === 'split' ? 'SPLIT NAME' : 'TEMPLATE NAME'}
              </Text>
              <TextInput
                style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#1c1917', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20 }}
                placeholder={mode === 'split' ? 'e.g. My Push Day' : 'e.g. Upper Body A'}
                placeholderTextColor={COLORS.text700}
                value={name}
                onChangeText={setName}
              />
              {exercises.length > 0 && (
                <>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>EXERCISES</Text>
                  {exercises.map((e, i) => {
                    const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId);
                    return (
                      <View key={e.exerciseId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text300, flex: 1 }} numberOfLines={1}>{ex?.name ?? e.exerciseId}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity onPress={() => setExercises(prev => prev.map((x, j) => j === i ? { ...x, setsTarget: Math.max(1, x.setsTarget - 1) } : x))}
                            style={{ width: 28, height: 28, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: COLORS.text500, fontSize: 14, lineHeight: 18 }}>−</Text>
                          </TouchableOpacity>
                          <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text100, width: 20, textAlign: 'center' }}>{e.setsTarget}</Text>
                          <TouchableOpacity onPress={() => setExercises(prev => prev.map((x, j) => j === i ? { ...x, setsTarget: Math.min(10, x.setsTarget + 1) } : x))}
                            style={{ width: 28, height: 28, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: COLORS.text500, fontSize: 14, lineHeight: 18 }}>+</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setExercises(prev => prev.filter((_, j) => j !== i))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: '#f87171' }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ height: 16 }} />
                </>
              )}
              <TouchableOpacity onPress={() => setShowPicker(true)}
                style={{ paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(87,83,78,0.5)', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 }}>+ ADD EXERCISE</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving}
                style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: saving ? '#292524' : COLORS.accent }}>
                {saving ? <ActivityIndicator size="small" color={COLORS.bg} /> : (
                  <Text style={{ fontFamily: FONTS.anton, fontSize: 14, color: COLORS.bg, letterSpacing: 2 }}>
                    {mode === 'split' ? 'SAVE SPLIT' : 'SAVE TEMPLATE'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
      <AddExerciseSheet
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onAdd={id => { setExercises(prev => [...prev, { exerciseId: id, setsTarget: 3 }]); }}
        usedIds={usedExIds}
      />
    </Modal>
  );
}

// ─── Session Selector ─────────────────────────────────────────────────────────
const SELECTOR_TABS = ['New Session', 'My Splits', 'Templates', 'Past Session'] as const;
type SelectorTab = typeof SELECTOR_TABS[number];

function SessionSelector({
  historyData,
  todayWorkout,
  onSelectTemplate,
  onRepeatSession,
  onNewSession,
  userSplits,
  userTemplates,
  onSelectSplit,
  onSplitSaved,
}: {
  historyData: any[] | undefined;
  todayWorkout: any;
  onSelectTemplate: (exercises: { exerciseId: string; setsTarget: number }[]) => void;
  onRepeatSession: (workout: any) => void;
  onNewSession: () => void;
  userSplits: UserSplit[];
  userTemplates: UserSplit[];
  onSelectSplit: (exercises: { exerciseId: string; setsTarget: number }[]) => void;
  onSplitSaved: (split: UserSplit, mode: 'split' | 'template') => void;
}) {
  const [tab, setTab] = useState<SelectorTab>('New Session');
  const [createMode, setCreateMode] = useState<'split' | 'template' | null>(null);

  return (
    <View style={{ flex: 1 }}>
      {todayWorkout?.completed && (
        <View style={{ marginHorizontal: 12, marginTop: 12, padding: 12, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange400, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Already trained today</Text>
          <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>{todayWorkout.name}</Text>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, marginTop: 2 }}>
            {fmt0(todayWorkout.total_volume_kg ?? 0)} kg·reps
            {todayWorkout.duration_seconds ? ` · ${Math.round(todayWorkout.duration_seconds / 60)}m` : ''}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 16, gap: 6 }}>
        {SELECTOR_TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={{ flex: 1, paddingVertical: 8, borderWidth: 1, alignItems: 'center',
              borderColor: tab === t ? COLORS.accent : COLORS.border,
              backgroundColor: tab === t ? COLORS.accentMuted : 'transparent' }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: tab === t ? COLORS.accent : COLORS.text600, textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {tab === 'New Session' && (
          <View style={{ paddingTop: 24, alignItems: 'center' }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Blank Session</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text700, textAlign: 'center', marginBottom: 24 }}>Build your workout from scratch.</Text>
            <TouchableOpacity onPress={onNewSession}
              style={{ paddingVertical: 14, paddingHorizontal: 32, borderWidth: 1, borderColor: COLORS.accent, backgroundColor: COLORS.accentMuted }}>
              <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.accent, letterSpacing: 2 }}>START TRAINING</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'My Splits' && (
          <>
            <TouchableOpacity onPress={() => setCreateMode('split')}
              style={{ paddingVertical: 12, borderWidth: 1, borderColor: COLORS.accent, backgroundColor: COLORS.accentMuted, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 1.5 }}>+ CREATE SPLIT</Text>
            </TouchableOpacity>
            {userSplits.length === 0 ? (
              <View style={{ paddingTop: 24, alignItems: 'center' }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, textTransform: 'uppercase' }}>No saved splits yet.</Text>
              </View>
            ) : userSplits.map(split => (
              <TouchableOpacity key={split.id} onPress={() => onSelectSplit(split.exercises)}
                style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 10, padding: 14 }}>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 24, paddingTop: 2, marginBottom: 8 }}>{split.name.toUpperCase()}</Text>
                {split.exercises.slice(0, 4).map((e, j) => {
                  const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId);
                  return <Text key={j} style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, marginBottom: 2 }}>{e.setsTarget}× {ex?.name ?? e.exerciseId}</Text>;
                })}
                {split.exercises.length > 4 && <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, marginTop: 2 }}>+{split.exercises.length - 4} more</Text>}
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === 'Templates' && (
          <>
            <TouchableOpacity onPress={() => setCreateMode('template')}
              style={{ paddingVertical: 12, borderWidth: 1, borderColor: COLORS.accent, backgroundColor: COLORS.accentMuted, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 1.5 }}>+ CREATE TEMPLATE</Text>
            </TouchableOpacity>
            {/* PPL / standard templates */}
            {TEMPLATES.map((tmpl, i) => {
              const exerciseNames = tmpl.exercises.map(e => EXERCISE_LIBRARY.find(ex => ex.id === e.exerciseId)?.name ?? e.exerciseId);
              return (
                <TouchableOpacity key={i} onPress={() => onSelectTemplate(tmpl.exercises)}
                  style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 10, padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 24, paddingTop: 2 }}>{tmpl.name.toUpperCase()}</Text>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>~{tmpl.estimatedMins}m</Text>
                  </View>
                  {exerciseNames.slice(0, 4).map((name, j) => (
                    <Text key={j} style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, marginBottom: 2 }}>
                      {tmpl.exercises[j].setsTarget}× {name}
                    </Text>
                  ))}
                  {exerciseNames.length > 4 && (
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, marginTop: 2 }}>+{exerciseNames.length - 4} more</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            {/* BRO SPLIT header + templates */}
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginTop: 8, marginBottom: 10 }}>
              ── BRO SPLIT
            </Text>
            {BRO_TEMPLATES.map((tmpl, i) => {
              const exerciseNames = tmpl.exercises.map(e => EXERCISE_LIBRARY.find(ex => ex.id === e.exerciseId)?.name ?? e.exerciseId);
              return (
                <TouchableOpacity key={`bro-${i}`} onPress={() => onSelectTemplate(tmpl.exercises)}
                  style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 10, padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 24, paddingTop: 2 }}>{tmpl.name.toUpperCase()}</Text>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>~{tmpl.estimatedMins}m</Text>
                  </View>
                  {exerciseNames.slice(0, 4).map((name, j) => (
                    <Text key={j} style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, marginBottom: 2 }}>
                      {tmpl.exercises[j].setsTarget}× {name}
                    </Text>
                  ))}
                  {exerciseNames.length > 4 && (
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, marginTop: 2 }}>+{exerciseNames.length - 4} more</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            {/* User-created templates */}
            {userTemplates.map(tmpl => (
              <TouchableOpacity key={tmpl.id} onPress={() => onSelectSplit(tmpl.exercises)}
                style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 10, padding: 14 }}>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 24, paddingTop: 2, marginBottom: 8 }}>{tmpl.name.toUpperCase()}</Text>
                {tmpl.exercises.slice(0, 4).map((e, j) => {
                  const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId);
                  return <Text key={j} style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, marginBottom: 2 }}>{e.setsTarget}× {ex?.name ?? e.exerciseId}</Text>;
                })}
                {tmpl.exercises.length > 4 && <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, marginTop: 2 }}>+{tmpl.exercises.length - 4} more</Text>}
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === 'Past Session' && (
          historyData && historyData.length > 0 ? historyData.map((w: any, i: number) => {
            const date = w.finished_at ? new Date(w.finished_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
            const exercises = (w.workout_exercises ?? []);
            return (
              <TouchableOpacity key={w.id} onPress={() => onRepeatSession(w)}
                style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 10, padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2, flex: 1, marginRight: 8 }}>{w.name || 'Workout'}</Text>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>{date}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange400 }}>{fmt0(w.total_volume_kg ?? 0)} kg·reps</Text>
                  {w.duration_seconds && <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>{Math.round(w.duration_seconds / 60)}m</Text>}
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>{exercises.length} ex</Text>
                </View>
              </TouchableOpacity>
            );
          }) : (
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, textTransform: 'uppercase' }}>No past sessions yet.</Text>
            </View>
          )
        )}
      </ScrollView>

      {createMode !== null && (
        <CreateSplitSheet
          visible={createMode !== null}
          mode={createMode}
          onClose={() => setCreateMode(null)}
          onSaved={(split) => { onSplitSaved(split, createMode!); setCreateMode(null); }}
        />
      )}
    </View>
  );
}

// ─── Workout Review View ──────────────────────────────────────────────────────
function WorkoutReviewView({ workout, onClose }: { workout: any; onClose: () => void }) {
  const { mutateAsync: updateSet } = useUpdateSet();
  const [editedSets, setEditedSets] = useState<Record<string, { weight: string; reps: string }>>(() => {
    const init: Record<string, { weight: string; reps: string }> = {};
    for (const we of workout.workout_exercises ?? []) {
      for (const s of we.sets ?? []) {
        if (s.id) init[s.id] = { weight: String(s.weight_kg ?? 0), reps: String(s.reps ?? 0) };
      }
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const date = workout.started_at
    ? new Date(workout.started_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : '';
  const totalVol = workout.total_volume_kg ?? 0;
  const duration = workout.duration_seconds ? Math.round(workout.duration_seconds / 60) : null;

  async function handleSave() {
    setSaving(true);
    for (const [setId, vals] of Object.entries(editedSets)) {
      try { await updateSet({ setId, weightKg: Number(vals.weight) || 0, reps: Number(vals.reps) || 0 }); } catch {}
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const exercises = [...(workout.workout_exercises ?? [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['top','left','right']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontFamily: FONTS.anton, fontSize: 28, color: COLORS.text100, lineHeight: 36, paddingTop: 2 }}>FORGE</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5 }}>← BACK</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange300, textTransform: 'uppercase', letterSpacing: 1.2 }}>SESSION REVIEW</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {/* Session meta */}
          <View style={{ marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 32, color: COLORS.text100, textTransform: 'uppercase', lineHeight: 40, paddingTop: 2 }}>{workout.name || 'Workout'}</Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, marginTop: 4 }}>
              {date}{duration ? ` · ${duration}m` : ''}{totalVol ? ` · ${Math.round(totalVol).toLocaleString()} kg·reps` : ''}
            </Text>
          </View>

          {/* Exercise list */}
          {exercises.map((we: any, i: number) => (
            <View key={we.id} style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 12 }}>
              {/* Exercise header */}
              <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 24, paddingTop: 2 }}>{(we.notes ?? '').toUpperCase()}</Text>
              </View>
              {/* Column headers */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(28,25,23,0.5)', gap: 8 }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, width: 24, textAlign: 'center', textTransform: 'uppercase' }}>SET</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, width: 62, textAlign: 'center', textTransform: 'uppercase' }}>KG</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, width: 62, textAlign: 'center', textTransform: 'uppercase' }}>REPS</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, flex: 1, textAlign: 'right', textTransform: 'uppercase' }}>VOL</Text>
              </View>
              {/* Set rows */}
              {[...(we.sets ?? [])].sort((a: any, b: any) => a.set_number - b.set_number).map((s: any, si: number) => {
                const w = Number(editedSets[s.id]?.weight ?? s.weight_kg ?? 0);
                const r = Number(editedSets[s.id]?.reps   ?? s.reps       ?? 0);
                return (
                  <View key={s.id ?? si} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.borderLight, minHeight: 44 }}>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text600, width: 24, textAlign: 'center' }}>{si + 1}</Text>
                    <TextInput
                      style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, height: 38, width: 62, textAlign: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, lineHeight: 20, paddingTop: 2 }}
                      value={editedSets[s.id]?.weight ?? String(s.weight_kg ?? 0)}
                      onChangeText={v => { if (s.id) setEditedSets(p => ({ ...p, [s.id]: { ...p[s.id], weight: v } })); }}
                      keyboardType="decimal-pad"
                      placeholderTextColor={COLORS.text700}
                    />
                    <TextInput
                      style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, height: 38, width: 62, textAlign: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, lineHeight: 20, paddingTop: 2 }}
                      value={editedSets[s.id]?.reps ?? String(s.reps ?? 0)}
                      onChangeText={v => { if (s.id) setEditedSets(p => ({ ...p, [s.id]: { ...p[s.id], reps: v } })); }}
                      keyboardType="number-pad"
                      placeholderTextColor={COLORS.text700}
                    />
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange400, flex: 1, textAlign: 'right' }}>{fmt0(w * r)}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.accent, opacity: saving ? 0.7 : 1 }}>
            {saving
              ? <ActivityIndicator color={COLORS.bg} />
              : <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, letterSpacing: 2 }}>{saved ? 'SAVED ✓' : 'SAVE CHANGES'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600 }}>← Back to Forge</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ForgeScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const [workout, setWorkout]             = useState<WorkoutEntry[]>([]);
  const [showSelector, setShowSelector]   = useState(true);
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
  const [userSplits, setUserSplits]       = useState<UserSplit[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserSplit[]>([]);

  const restRemainingRef = useRef(90);
  const restIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const { mutateAsync: startWorkout,  isPending: starting  } = useStartWorkout();
  const { mutateAsync: addWeToDb }                           = useAddWorkoutExercise();
  const { mutateAsync: logSet }                              = useLogSet();
  const { mutateAsync: finishWorkout, isPending: finishing  } = useFinishWorkout();
  const { data: historyData }                                = useWorkoutHistory();
  const { data: todayWorkout }                               = useTodayWorkout();

  // Resolve workout to review from nav param — check todayWorkout first, then history
  const reviewWorkoutId: string | undefined = route.params?.reviewWorkoutId;
  const reviewWorkout = reviewWorkoutId
    ? (todayWorkout?.id === reviewWorkoutId
        ? todayWorkout
        : (historyData ?? []).find((w: any) => w.id === reviewWorkoutId))
    : null;

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

  // Pre-add an exercise when navigated from Dashboard muscle map
  const preAddExId = route.params?.preAddExerciseId;
  useEffect(() => {
    if (!preAddExId) return;
    setWorkout([{
      id:         `we-${Date.now()}`,
      exerciseId: preAddExId,
      sets:       [{ id: `s-${Date.now()}-0`, weight: 0, reps: 8 }],
    }]);
    setShowSelector(false);
    navigation.setParams({ preAddExerciseId: undefined });
  }, [preAddExId]);

  // Load user splits + templates from Supabase
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('profiles').select('custom_splits, my_templates').eq('id', user.id).single();
        if (data?.custom_splits) setUserSplits(data.custom_splits as UserSplit[]);
        if (data?.my_templates)  setUserTemplates(data.my_templates as UserSplit[]);
      } catch {}
    })();
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
  const [forgeMapMode, setForgeMapMode] = useState<'recovery' | 'growth'>('recovery');
  const forgeRecoveryMap = useMemo(() => volumesToRecoveryMap(volumes, maxVol), [volumes, maxVol]);
  const forgeGrowthMap   = useMemo(() => volumesToGrowthMap(volumes, maxVol),   [volumes, maxVol]);
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
    setShowSelector(true);
  }

  async function handleCancelSession() {
    const hasLoggedSets = doneSets > 0;

    async function doCancel() {
      if (workoutId) {
        try { await supabase.from('workouts').delete().eq('id', workoutId); } catch {}
      }
      resetSession();
    }

    if (!hasLoggedSets) {
      await doCancel();
      return;
    }

    Alert.alert(
      'Cancel Session?',
      'Your progress will be lost. This cannot be undone.',
      [
        { text: 'Keep Training', style: 'cancel' },
        { text: 'Cancel Session', style: 'destructive', onPress: doCancel },
      ],
    );
  }

  function handleNewSession() {
    setShowSelector(false);
  }

  function handleSelectTemplate(exercises: { exerciseId: string; setsTarget: number }[]) {
    const newEntries: WorkoutEntry[] = exercises.map((e, idx) => {
      const newId = `we-${Date.now()}-${idx}`;
      return {
        id: newId,
        exerciseId: e.exerciseId,
        sets: Array.from({ length: e.setsTarget }, (_, i) => ({
          id: `s-${Date.now()}-${idx}-${i}`,
          weight: 0,
          reps: 8,
        })),
      };
    });
    setWorkout(newEntries);
    setShowSelector(false);
  }

  function handleRepeatSession(pastWorkout: any) {
    const newEntries: WorkoutEntry[] = ((pastWorkout.workout_exercises ?? []) as any[]).map((we: any, idx: number) => {
      const ex = EXERCISE_LIBRARY.find(e => e.name.toLowerCase().trim() === (we.notes ?? '').toLowerCase().trim());
      if (!ex) return null;
      const pastSets = ((we.sets ?? []) as any[]).sort((a: any, b: any) => a.set_number - b.set_number);
      return {
        id: `we-${Date.now()}-${idx}`,
        exerciseId: ex.id,
        sets: pastSets.length > 0
          ? pastSets.map((s: any, i: number) => ({
              id: `s-${Date.now()}-${idx}-${i}`,
              weight: s.weight_kg ?? 0,
              reps: s.reps ?? 8,
            }))
          : [{ id: `s-${Date.now()}-${idx}-0`, weight: 0, reps: 8 }],
      };
    }).filter(Boolean) as WorkoutEntry[];
    setWorkout(newEntries);
    setShowSelector(false);
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

  // If navigated here with a specific workout ID, show full review view
  if (reviewWorkout) {
    return (
      <WorkoutReviewView
        workout={reviewWorkout}
        onClose={() => navigation.setParams({ reviewWorkoutId: undefined })}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top','left','right']}>

        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              {showSelector && !sessionStarted ? (
                // Selector mode: back to Home tab
                <TouchableOpacity onPress={() => navigation.navigate('Home')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingBottom: 5 }}>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, textTransform: 'uppercase' }}>‹ HOME</Text>
                </TouchableOpacity>
              ) : !showSelector && !sessionStarted ? (
                // Exercises chosen but session not started: back to selector
                <TouchableOpacity onPress={() => setShowSelector(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingBottom: 5 }}>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, textTransform: 'uppercase' }}>‹ BACK</Text>
                </TouchableOpacity>
              ) : sessionStarted ? (
                // Active session: cancel
                <TouchableOpacity onPress={handleCancelSession} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingBottom: 5 }}>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, textTransform: 'uppercase' }}>‹ CANCEL</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={{ fontFamily: FONTS.anton, fontSize: 28, color: COLORS.text100, lineHeight: 36, paddingTop: 2 }}>FORGE</Text>
            </View>
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

        {/* Main content area */}
        {showSelector && !sessionStarted ? (
          <SessionSelector
            historyData={historyData}
            todayWorkout={todayWorkout}
            onSelectTemplate={handleSelectTemplate}
            onRepeatSession={handleRepeatSession}
            onNewSession={handleNewSession}
            userSplits={userSplits}
            userTemplates={userTemplates}
            onSelectSplit={handleSelectTemplate}
            onSplitSaved={(split, mode) => {
              if (mode === 'split') setUserSplits(prev => [...prev, split]);
              else setUserTemplates(prev => [...prev, split]);
            }}
          />
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            {workout.length === 0 && sessionStarted && (
              <View style={{ alignItems: 'center', paddingTop: 48, paddingBottom: 24 }}>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>No exercises yet</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text700, textAlign: 'center' }}>Tap + ADD EXERCISE below</Text>
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
                  onOpenRestTimer={() => setShowRestSheet(true)}
                />
              );
            })}

            {/* Muscle Map */}
            {workout.length > 0 && (
              <View style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', padding: 14, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>MUSCLE MAP</Text>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text700 }}>live</Text>
                </View>
                <BodyMapDual
                  recoveryMap={forgeRecoveryMap}
                  growthMap={forgeGrowthMap}
                  mode={forgeMapMode}
                  setMode={setForgeMapMode}
                  onExercisePress={(id) => { addExercise(id); }}
                />
              </View>
            )}

            {/* Volume Breakdown — bar graph */}
            {workout.length > 0 && (() => {
              const muscleVols: { name: string; vol: number }[] = [];
              for (const we of workout) {
                const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
                if (!ex) continue;
                const vol = exerciseVolume(we);
                const push = (m: string, v: number) => {
                  const found = muscleVols.find(x => x.name === m);
                  if (found) found.vol += v;
                  else muscleVols.push({ name: m, vol: v });
                };
                ex.primary.forEach(m   => push(m, vol));
                ex.secondary.forEach(m => push(m, vol * 0.5));
              }
              muscleVols.sort((a, b) => b.vol - a.vol);
              const barMax = muscleVols[0]?.vol || 1;
              return (
                <View style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', marginBottom: 16 }}>
                  <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, lineHeight: 26, paddingTop: 2 }}>VOLUME BREAKDOWN</Text>
                  </View>
                  <View style={{ padding: 14, gap: 10 }}>
                    {muscleVols.map(({ name, vol }) => {
                      const pct = (vol / barMax) * 100;
                      return (
                        <View key={name}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, textTransform: 'uppercase' }}>{name.replace(/_/g, ' ')}</Text>
                            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange400 }}>{fmt0(vol)}</Text>
                          </View>
                          <View style={{ height: 3, backgroundColor: 'rgba(28,25,23,0.8)' }}>
                            <View style={{ height: '100%', width: `${pct}%` as any, backgroundColor: COLORS.accent }} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </ScrollView>
        )}

        {/* Bottom buttons */}
        {(!showSelector || sessionStarted) && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 }}>
            {(!showSelector || sessionStarted) && (
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
        )}

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
