// SESSION REVIEW — view and edit a completed workout session
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
import { useWorkoutHistory } from '../hooks/useWorkout';

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface SetData {
  id: string;
  weight: number | string;
  reps: number | string;
  isNew?: boolean;
}

interface WorkoutEntry {
  id: string;         // Supabase workout_exercise UUID
  exerciseId: string; // EXERCISE_LIBRARY id (may be empty if not found)
  sets: SetData[];
}

interface LastSessionExercise {
  sets:     Array<{ weight: number; reps: number }>;
  totalVol: number;
}

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
      <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, width: 20, textAlign: 'center' }}>
        {String(idx + 1).padStart(2, '0')}
      </Text>

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

      <TextInput
        style={{ fontFamily: FONTS.anton, fontSize: 15, color: COLORS.text100, height: 36, width: 52, textAlign: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, paddingTop: 2 }}
        value={String(set.reps)}
        onChangeText={v => onUpdate({ reps: v === '' ? '' : Number(v) })}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={COLORS.text700}
      />

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

      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, width: 36, textAlign: 'center' }}>
        {curVol > 0 ? fmt0(curVol) : '—'}
      </Text>

      <View style={{ width: 52, paddingHorizontal: 4, paddingVertical: 3, backgroundColor: status.bg, borderWidth: 1, borderColor: status.border, alignItems: 'center' }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: status.color, textTransform: 'uppercase', letterSpacing: 0.2 }} numberOfLines={1}>
          {status.label}
        </Text>
      </View>

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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 24, paddingTop: 2 }}>{ex.name.toUpperCase()}</Text>
          </View>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, lineHeight: 26, paddingTop: 2 }}>REST TIMER</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>CLOSE</Text>
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ fontFamily: FONTS.anton, fontSize: 64, color: running ? COLORS.accent : COLORS.text400, lineHeight: 72, paddingTop: 4 }}>
              {display}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[60, 90, 120, 180].map(opt => (
              <TouchableOpacity key={opt} onPress={() => onSetDuration(opt)}
                style={{ flex: 1, paddingVertical: 10, borderWidth: 1, alignItems: 'center',
                  borderColor: duration === opt ? COLORS.accent : COLORS.border,
                  backgroundColor: duration === opt ? COLORS.accentMuted : 'transparent' }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: duration === opt ? COLORS.accent : COLORS.text600 }}>
                  {fmtPreset(opt)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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
export default function SessionReviewScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const workoutId: string = route.params?.workoutId;

  // ── Fetch State ──────────────────────────────────────────────────────────────
  const [loading, setLoading]   = useState(true);
  const [fetchError, setError]  = useState<string | null>(null);
  const [meta, setMeta]         = useState<{ name: string; startedAt: string; durationSeconds: number | null; totalVolumeKg: number } | null>(null);

  // ── Workout State ─────────────────────────────────────────────────────────────
  const [workout, setWorkout]             = useState<WorkoutEntry[]>([]);
  const [deletedSetIds, setDeletedSetIds] = useState<Set<string>>(new Set());
  const originalSetsRef = useRef<Map<string, { weight: number; reps: number }>>(new Map());

  // ── UI State ──────────────────────────────────────────────────────────────────
  const [showRestSheet, setShowRestSheet] = useState(false);
  const [restRunning, setRestRunning]     = useState(false);
  const [restDisplay, setRestDisplay]     = useState('01:30');
  const [restDuration, setRestDuration]   = useState(90);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState<string | null>(null);
  const [mapMode, setMapMode]             = useState<'recovery' | 'growth'>('recovery');

  const restRemainingRef = useRef(90);
  const restIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: historyData } = useWorkoutHistory();

  // ── Data Fetch ────────────────────────────────────────────────────────────────
  async function fetchWorkout() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_exercises (
            *,
            exercise:exercises(*),
            sets(*)
          )
        `)
        .eq('id', workoutId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Workout not found');

      setMeta({
        name:            data.name ?? 'Workout',
        startedAt:       data.started_at ?? data.finished_at ?? '',
        durationSeconds: data.duration_seconds ?? null,
        totalVolumeKg:   data.total_volume_kg ?? 0,
      });

      const origMap = new Map<string, { weight: number; reps: number }>();
      const entries: WorkoutEntry[] = [];

      const sorted = [...(data.workout_exercises ?? [])].sort(
        (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
      );

      for (const we of sorted) {
        const exerciseName = (we.notes ?? we.exercise?.name ?? '').toLowerCase().trim();
        const ex = EXERCISE_LIBRARY.find(e =>
          e.name.toLowerCase().trim() === exerciseName,
        );

        const sortedSets: SetData[] = [...(we.sets ?? [])]
          .sort((a: any, b: any) => (a.set_number ?? 0) - (b.set_number ?? 0))
          .map((s: any) => {
            origMap.set(s.id, { weight: s.weight_kg ?? 0, reps: s.reps ?? 0 });
            return {
              id:     s.id,
              weight: s.weight_kg ?? 0,
              reps:   s.reps ?? 0,
            };
          });

        entries.push({
          id:         we.id,
          exerciseId: ex?.id ?? '',
          sets:       sortedSets.length > 0
            ? sortedSets
            : [{ id: `new-${Date.now()}-${we.id}`, weight: 0, reps: 0, isNew: true }],
        });
      }

      originalSetsRef.current = origMap;
      setWorkout(entries);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load workout');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchWorkout(); }, [workoutId]);

  // ── Last Session Map (previous session only — excludes this workout) ──────────
  const lastSessionMap = useMemo(() => {
    const map = new Map<string, LastSessionExercise>();
    if (!historyData) return map;
    for (const w of historyData as any[]) {
      if (w.id === workoutId) continue;
      for (const we of (w.workout_exercises ?? [])) {
        const name = ((we.notes as string) ?? '').toLowerCase().trim();
        if (map.has(name)) continue;
        const sortedSets = ((we.sets ?? []) as any[])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((s: any) => ({ weight: s.weight_kg ?? 0, reps: s.reps ?? 0 }));
        const totalVol = sortedSets.reduce((a: number, s: any) => a + s.weight * s.reps, 0);
        map.set(name, { sets: sortedSets, totalVol });
      }
    }
    return map;
  }, [historyData, workoutId]);

  // ── Change Detection ─────────────────────────────────────────────────────────
  const hasChanges = useMemo(() => {
    if (deletedSetIds.size > 0) return true;
    for (const we of workout) {
      for (const s of we.sets) {
        if (s.isNew) return true;
        const orig = originalSetsRef.current.get(s.id);
        if (orig && (Number(s.weight) !== orig.weight || Number(s.reps) !== orig.reps)) return true;
      }
    }
    return false;
  }, [workout, deletedSetIds]);

  // ── Rest Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); };
  }, []);

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
    if (restRunning) startRestTimer(secs);
    else {
      restRemainingRef.current = secs;
      setRestDisplay(fmtRestTime(secs));
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  const volumes      = useMemo(() => muscleVolumes(workout), [workout]);
  const maxVol       = useMemo(() => Math.max(800, ...Object.values(volumes)), [volumes]);
  const recoveryMap  = useMemo(() => volumesToRecoveryMap(volumes, maxVol), [volumes, maxVol]);
  const growthMap    = useMemo(() => volumesToGrowthMap(volumes, maxVol),   [volumes, maxVol]);
  const totalVolume  = useMemo(() => workout.reduce((a, we) => a + exerciseVolume(we), 0), [workout]);

  // ── Exercise Update (with deletion tracking) ──────────────────────────────────
  const updateExercise = useCallback((weId: string, updated: WorkoutEntry) => {
    setWorkout(w => {
      const old = w.find(x => x.id === weId);
      if (old) {
        const removedIds = old.sets
          .filter(s => !s.isNew && !updated.sets.find(x => x.id === s.id))
          .map(s => s.id);
        if (removedIds.length > 0) {
          setDeletedSetIds(prev => {
            const next = new Set(prev);
            removedIds.forEach(id => next.add(id));
            return next;
          });
        }
      }
      return w.map(we => we.id === weId ? updated : we);
    });
  }, []);

  const addSet = useCallback((weId: string) =>
    setWorkout(w => w.map(we => {
      if (we.id !== weId) return we;
      const last = we.sets[we.sets.length - 1];
      return {
        ...we,
        sets: [...we.sets, {
          id:     `new-${Date.now()}`,
          reps:   last?.reps   ?? 8,
          weight: last?.weight ?? 0,
          isNew:  true,
        }],
      };
    })), []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      // PATCH existing sets
      for (const we of workout) {
        let setNumber = 0;
        for (const s of we.sets) {
          setNumber += 1;
          if (s.isNew) {
            await supabase.from('sets').insert({
              workout_exercise_id: we.id,
              set_number:          setNumber,
              weight_kg:           Number(s.weight) || 0,
              reps:                Number(s.reps)   || 0,
              rir:                 0,
              completed:           true,
            });
          } else {
            await supabase.from('sets').update({
              weight_kg: Number(s.weight) || 0,
              reps:      Number(s.reps)   || 0,
            }).eq('id', s.id);
          }
        }
      }

      // DELETE removed sets
      for (const id of deletedSetIds) {
        await supabase.from('sets').delete().eq('id', id);
      }

      // UPDATE total volume
      await supabase
        .from('workouts')
        .update({ total_volume_kg: totalVolume })
        .eq('id', workoutId);

      showToast('Saved ✓');
      setTimeout(() => navigation.goBack(), 2000);
    } catch (e: any) {
      showToast(`Save failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Discard ───────────────────────────────────────────────────────────────────
  function handleDiscard() {
    if (!hasChanges) { navigation.goBack(); return; }
    Alert.alert(
      'Discard changes?',
      'Your edits to this session will not be saved.',
      [
        { text: 'No',  style: 'cancel' },
        { text: 'Yes', style: 'destructive', onPress: () => navigation.goBack() },
      ],
    );
  }

  // ── Loading / Error ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Loading session…
        </Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text300, letterSpacing: 1, marginBottom: 8 }}>LOAD FAILED</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, textAlign: 'center', marginBottom: 24 }}>{fetchError}</Text>
        <TouchableOpacity onPress={fetchWorkout}
          style={{ paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: COLORS.accent }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 1 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dateLabel = meta?.startedAt ? fmtDate(meta.startedAt) : '';
  const durationLabel = meta?.durationSeconds ? `${Math.round(meta.durationSeconds / 60)}m` : null;

  // ── Volume breakdown ──────────────────────────────────────────────────────────
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
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          {/* Row 1: back button + SESSION REVIEW label + date */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <TouchableOpacity onPress={handleDiscard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500 }}>‹</Text>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 }}>HOME</Text>
            </TouchableOpacity>

            <Text style={{ fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, lineHeight: 28, paddingTop: 2 }}>
              SESSION REVIEW
            </Text>

            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, letterSpacing: 0.3 }}>
              {dateLabel}
            </Text>
          </View>

          {/* Row 2: workout name + meta */}
          <Text style={{ fontFamily: FONTS.anton, fontSize: 28, color: COLORS.text100, lineHeight: 36, paddingTop: 2 }}>
            {(meta?.name ?? 'Workout').toUpperCase()}
          </Text>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, marginTop: 2 }}>
            {[durationLabel, `${fmt0(totalVolume)} kg·reps`].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Exercise Cards */}
            {workout.map((we, idx) => {
              const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
              const lastSession = ex ? lastSessionMap.get(ex.name.toLowerCase().trim()) : undefined;
              return (
                <ExerciseCard
                  key={we.id}
                  we={we}
                  index={idx}
                  lastSession={lastSession}
                  onUpdate={updated => updateExercise(we.id, updated)}
                  onRemove={() => {
                    const removedSetIds = we.sets.filter(s => !s.isNew).map(s => s.id);
                    setDeletedSetIds(prev => {
                      const next = new Set(prev);
                      removedSetIds.forEach(id => next.add(id));
                      return next;
                    });
                    setWorkout(w => w.filter(x => x.id !== we.id));
                  }}
                  onAddSet={() => addSet(we.id)}
                  onOpenRestTimer={() => setShowRestSheet(true)}
                />
              );
            })}

            {workout.length === 0 && (
              <View style={{ paddingTop: 40, alignItems: 'center' }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, textTransform: 'uppercase' }}>No exercises in this session.</Text>
              </View>
            )}

            {/* Muscle Map */}
            {workout.length > 0 && (
              <View style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,10,8,0.4)', padding: 14, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.text100, lineHeight: 20, paddingTop: 2 }}>MUSCLE MAP</Text>
                </View>
                <BodyMapDual
                  recoveryMap={recoveryMap}
                  growthMap={growthMap}
                  mode={mapMode}
                  setMode={setMapMode}
                />
              </View>
            )}

            {/* Volume Breakdown */}
            {muscleVols.length > 0 && (
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
            )}
          </ScrollView>

          {/* Bottom Buttons */}
          <View style={{ paddingHorizontal: 12, paddingBottom: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 }}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{ paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.accent, opacity: saving ? 0.7 : 1 }}
            >
              {saving
                ? <ActivityIndicator color={COLORS.bg} />
                : <Text style={{ fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, letterSpacing: 2 }}>SAVE CHANGES</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDiscard} style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600 }}>DISCARD CHANGES</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Rest Timer Modal */}
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

        {/* Toast */}
        {toast && <Toast message={toast} />}
      </SafeAreaView>
    </View>
  );
}
