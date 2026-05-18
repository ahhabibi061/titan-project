/**
 * MuscleMap — ported from apps/web/src/pages/DashboardPage.jsx
 *
 * Logic: identical to web (buildModelData, getRecoveryFreq, getGrowthFreq,
 *        MuscleTooltip status calculations, summaryItems sorting).
 * Primitives swapped:
 *   div/span/p → View / Text
 *   button     → TouchableOpacity
 *   className  → inline StyleSheet using COLORS / FONTS
 *   Model (react-body-highlighter web, frequency+palette API)
 *     → Body  (react-native-body-highlighter, ExtendedBodyPart[] API)
 *   mouse tooltip positioning → Animated slide-up panel
 */

import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal, ScrollView } from 'react-native';
import Body, { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';
import { COLORS, FONTS } from '../constants/theme';
import { EXERCISE_LIBRARY } from '../constants/exercises';

// ── Muscle display labels (local copy — keeps MuscleMap self-contained) ────────

const MUSCLES: Record<string, string> = {
  chest: 'Chest', front_delts: 'Front Delts', side_delts: 'Side Delts',
  rear_delts: 'Rear Delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  lats: 'Lats', lower_back: 'Lower Back', glutes: 'Glutes',
  quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves',
  adductors: 'Adductors', abductors: 'Abductors',
};

// Internal muscle key → react-native-body-highlighter slug
// Verified against README slug table (trapezius/triceps/forearm/adductors/calves/
// deltoids/obliques/chest/biceps/abs/quadriceps/abductors/upper-back/lower-back/
// hamstring/gluteal).
const MUSCLE_MAP: Record<string, string> = {
  chest:       'chest',
  front_delts: 'deltoids',
  side_delts:  'deltoids',   // was missing — caused lateral raises not to light up
  rear_delts:  'deltoids',
  biceps:      'biceps',
  triceps:     'triceps',
  forearms:    'forearm',
  abs:         'abs',
  obliques:    'obliques',
  traps:       'trapezius',
  lats:        'upper-back',
  lower_back:  'lower-back',
  glutes:      'gluteal',
  quads:       'quadriceps',
  hamstrings:  'hamstring',
  calves:      'calves',
  adductors:   'adductors',
  abductors:   'abductors',
};

const MUSCLE_DISPLAY_NAMES: Record<string, string> = {
  'chest':       'Pectoralis Major',
  'deltoids':    'Deltoids',
  'biceps':      'Biceps Brachii',
  'triceps':     'Triceps Brachii',
  'forearm':     'Forearm Flexors',
  'abs':         'Rectus Abdominis',
  'obliques':    'Obliques',
  'trapezius':   'Trapezius',
  'upper-back':  'Latissimus Dorsi',
  'lower-back':  'Erector Spinae',
  'gluteal':     'Gluteus Maximus',
  'quadriceps':  'Quadriceps',
  'hamstring':   'Hamstrings',
  'calves':      'Gastrocnemius',
  'adductors':   'Hip Adductors',
  'abductors':   'Hip Abductors',
};

const MUSCLE_WINDOWS: Record<string, number> = {
  'chest': 72, 'deltoids': 48, 'biceps': 48, 'triceps': 48, 'forearm': 36,
  'abs': 24, 'obliques': 24, 'trapezius': 36,
  'upper-back': 72, 'lower-back': 72, 'gluteal': 72,
  'quadriceps': 72, 'hamstring': 72, 'calves': 36,
  'adductors': 48, 'abductors': 48,
};

const RECOVERY_HIGHLIGHTED = ['#4ade80', '#a3e635', '#fbbf24', '#f87171'];
const GROWTH_HIGHLIGHTED   = ['#fb923c', '#4ade80', '#60a5fa', '#fbbf24', '#f87171'];

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function getRecoveryFreq(status: string): number | null {
  return ({ ready: 1, almost: 2, partial: 3, resting: 4 } as Record<string, number>)[status] ?? null;
}
function getGrowthFreq(status: string): number | null {
  return ({ pr: 1, improved: 2, first: 3, regressed: 4, dropped: 5 } as Record<string, number>)[status] ?? null;
}

function buildModelData(
  recoveryMap: Record<string, any>,
  growthMap:   Record<string, any>,
  mode:        'recovery' | 'growth',
): { name: string; muscles: string[]; frequency: number }[] {
  const slugFreq: Record<string, number> = {};
  const map = mode === 'recovery' ? recoveryMap : growthMap;
  for (const [key, val] of Object.entries(map)) {
    const slug = MUSCLE_MAP[key];
    if (!slug) continue;
    const freq = mode === 'recovery'
      ? (val.status && val.status !== 'no_data' ? getRecoveryFreq(val.status) : null)
      : (val.status ? getGrowthFreq(val.status) : null);
    if (freq === null) continue;
    if (!slugFreq[slug] || freq < slugFreq[slug]) slugFreq[slug] = freq;
  }
  return Object.entries(slugFreq).map(([slug, frequency]) => ({ name: slug, muscles: [slug], frequency }));
}

function toBodyParts(
  modelData:         { name: string; frequency: number }[],
  highlightedColors: string[],
): ExtendedBodyPart[] {
  return modelData.map(({ name, frequency }) => ({
    slug:   name as Slug,
    styles: { fill: highlightedColors[frequency - 1] ?? highlightedColors[highlightedColors.length - 1] },
  }));
}

// ── MuscleTooltip ─────────────────────────────────────────────────────────────

interface MuscleTooltipProps {
  muscle:           string | null;
  recoveryData:     Record<string, any>;
  growthData:       Record<string, any>;
  mode:             'recovery' | 'growth';
  slideY:           Animated.Value;
  fadeAnim:         Animated.Value;
  onExercisePress?: (exerciseId: string) => void;
}

function MuscleTooltip({ muscle, recoveryData, growthData, mode, slideY, fadeAnim, onExercisePress }: MuscleTooltipProps) {
  const [showModal, setShowModal] = useState(false);

  if (!muscle) return null;

  const displayName = MUSCLE_DISPLAY_NAMES[muscle] || muscle.replace(/-/g, ' ').toUpperCase();
  const internalKey = Object.entries(MUSCLE_MAP).find(([, s]) => s === muscle)?.[0];
  let value: number | null = null;
  let line2: string | null = null;
  let statusStr: string | null = null;

  if (mode === 'recovery' && internalKey) {
    const e = recoveryData?.[internalKey];
    if (e && e.status !== 'no_data') {
      statusStr = e.status;
      value = e.pct ?? (e.status === 'ready' ? 100 : null);
      line2 = e.hoursRemaining > 0 ? `${e.hoursRemaining}h remaining` : null;
    }
  } else if (mode === 'growth' && internalKey) {
    const e = growthData?.[internalKey];
    if (e) {
      statusStr = e.status;
      value = e.growthPct;
      line2 = e.prevVol != null
        ? `${fmt(e.currentVol)} vs ${fmt(e.prevVol)} kg·reps`
        : e.currentVol != null ? `${fmt(e.currentVol)} kg·reps` : null;
    }
  }

  const RECOVERY_COLORS: Record<string, { label: string; color: string }> = {
    ready:   { label: 'READY',        color: RECOVERY_HIGHLIGHTED[0] },
    almost:  { label: 'ALMOST READY', color: RECOVERY_HIGHLIGHTED[1] },
    partial: { label: 'PARTIAL',      color: RECOVERY_HIGHLIGHTED[2] },
    resting: { label: 'RESTING',      color: RECOVERY_HIGHLIGHTED[3] },
  };
  const GROWTH_COLORS: Record<string, { label: string; color: string }> = {
    pr:        { label: 'PR TERRITORY', color: GROWTH_HIGHLIGHTED[0] },
    improved:  { label: 'IMPROVED',     color: GROWTH_HIGHLIGHTED[1] },
    first:     { label: 'FIRST TIME',   color: GROWTH_HIGHLIGHTED[2] },
    regressed: { label: 'REGRESSED',    color: GROWTH_HIGHLIGHTED[3] },
    dropped:   { label: 'DROPPED',      color: GROWTH_HIGHLIGHTED[4] },
  };
  const lookup = mode === 'recovery' ? RECOVERY_COLORS : GROWTH_COLORS;
  const status: { label: string; color: string } = (statusStr ? lookup[statusStr] : null) ?? { label: 'NO DATA', color: '#78716c' };

  // All internal keys that map to this slug (e.g. deltoids → front_delts, side_delts, rear_delts)
  const internalKeys = Object.entries(MUSCLE_MAP)
    .filter(([, s]) => s === muscle)
    .map(([k]) => k);

  const matchedExercises = EXERCISE_LIBRARY.filter(ex =>
    internalKeys.some(key =>
      (ex.primary as string[]).includes(key) || (ex.secondary as string[]).includes(key),
    ),
  );
  const firstFour = matchedExercises.slice(0, 4);
  const hasMore   = matchedExercises.length > 4;

  return (
    <Animated.View style={{
      opacity: fadeAnim, transform: [{ translateY: slideY }],
      marginTop: 12, backgroundColor: '#0c0a09',
      borderWidth: 1, borderColor: '#292524', padding: 12,
    }}>
      {/* Status header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontFamily: FONTS.anton, fontSize: 13, color: '#f5f5f4', letterSpacing: 0.5, textTransform: 'uppercase' }}>{displayName}</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.2 }}>
          {mode === 'recovery' ? '7d volume' : 'vs last week'}
        </Text>
      </View>
      {value !== null && (
        <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: status.color, marginBottom: 4 }}>
          {mode === 'recovery'
            ? `${Math.round(value)}% recovered`
            : value! > 0
              ? `↑ ${Math.round(value!)}% vs last`
              : `↓ ${Math.abs(Math.round(value!))}% vs last`}
        </Text>
      )}
      {line2 && (
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: '#78716c', marginBottom: 6, letterSpacing: 0.5 }}>{line2}</Text>
      )}
      <View style={{
        alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
        backgroundColor: `${status.color}22`, borderWidth: 1, borderColor: `${status.color}44`,
      }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: status.color }}>{status.label}</Text>
      </View>

      {/* Exercise pills */}
      {matchedExercises.length > 0 && (
        <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#292524' }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
            EXERCISES TARGETING THIS MUSCLE
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {firstFour.map(ex => (
              <TouchableOpacity
                key={ex.id}
                onPress={() => onExercisePress?.(ex.id)}
                style={{ paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border }}
              >
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text400 }} numberOfLines={1}>
                  {ex.name}
                </Text>
              </TouchableOpacity>
            ))}
            {hasMore && (
              <TouchableOpacity onPress={() => setShowModal(true)} style={{ paddingVertical: 3, paddingHorizontal: 4 }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.accent }}>
                  {firstFour.length} of {matchedExercises.length} →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Full exercise list modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <View style={{ backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: '#292524', maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#292524' }}>
              <View>
                <Text style={{ fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, lineHeight: 26, paddingTop: 2 }}>
                  {displayName.toUpperCase()}
                </Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>
                  {matchedExercises.length} EXERCISES
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase' }}>CLOSE</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {matchedExercises.map((ex, i) => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => { onExercisePress?.(ex.id); setShowModal(false); }}
                  style={{
                    paddingVertical: 14, paddingHorizontal: 16,
                    borderBottomWidth: i < matchedExercises.length - 1 ? 1 : 0,
                    borderBottomColor: '#1c1917',
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text100 }}>{ex.name}</Text>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {(ex.primary as string[])[0]?.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

// ── BodyMapDual ───────────────────────────────────────────────────────────────

export interface BodyMapDualProps {
  recoveryMap:      Record<string, any>;
  growthMap:        Record<string, any>;
  mode:             'recovery' | 'growth';
  setMode:          (m: 'recovery' | 'growth') => void;
  onExercisePress?: (exerciseId: string) => void;
}

export function BodyMapDual({ recoveryMap, growthMap, mode, setMode, onExercisePress }: BodyMapDualProps) {
  const slideY   = useRef(new Animated.Value(80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [tooltip, setTooltip] = useState<string | null>(null);

  const highlightedColors = mode === 'recovery' ? RECOVERY_HIGHLIGHTED : GROWTH_HIGHLIGHTED;
  const modelData = buildModelData(recoveryMap, growthMap, mode);
  const data      = toBodyParts(modelData, highlightedColors);

  function handleMuscleClick(muscleStats: { muscle: string }) {
    if (!muscleStats?.muscle) return;
    if (tooltip === muscleStats.muscle) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 80, useNativeDriver: true, damping: 15, stiffness: 140 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start(() => setTooltip(null));
    } else {
      setTooltip(muscleStats.muscle);
      slideY.setValue(80);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 140 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }

  const summaryItems = mode === 'recovery'
    ? Object.entries(recoveryMap)
        .filter(([, v]) => v.status !== 'no_data' && v.status !== 'ready')
        .sort(([, a], [, b]) => (a.pct ?? 100) - (b.pct ?? 100))
        .slice(0, 3)
        .map(([k, v]) => ({
          key:   k,
          label: MUSCLES[k] ?? k,
          value: `${v.pct}%`,
          sub:   `${v.hoursRemaining}h left`,
          color: RECOVERY_HIGHLIGHTED[(getRecoveryFreq(v.status) ?? 1) - 1],
        }))
    : Object.entries(growthMap)
        .filter(([, v]) => v.growthPct !== null)
        .sort(([, a], [, b]) => (b.growthPct ?? 0) - (a.growthPct ?? 0))
        .slice(0, 3)
        .map(([k, v]) => ({
          key:   k,
          label: MUSCLES[k] ?? k,
          value: `${v.growthPct > 0 ? '+' : ''}${v.growthPct}%`,
          sub:   `${fmt(v.currentVol)} kg·reps`,
          color: GROWTH_HIGHLIGHTED[(getGrowthFreq(v.status) ?? 1) - 1],
        }));

  return (
    <View>
      {/* Mode toggle */}
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 16 }}>
        {(['recovery', 'growth'] as const).map(m => (
          <TouchableOpacity
            key={m}
            onPress={() => { setMode(m); setTooltip(null); }}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1,
              borderColor:       mode === m ? 'rgba(237,122,42,0.6)' : COLORS.border,
              backgroundColor:   mode === m ? 'rgba(237,122,42,0.1)' : 'transparent',
            }}
          >
            <Text style={{
              fontFamily:    FONTS.mono, fontSize: 10,
              textTransform: 'uppercase', letterSpacing: 1.5,
              color: mode === m ? '#fda47a' : COLORS.text500,
            }}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Front + back body maps */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
        <View style={{ alignItems: 'center' }}>
          <Body
            data={data} side="front" gender="male" scale={0.75}
            border="none" defaultFill="#1c1917"
            onBodyPartPress={(bp: any) => handleMuscleClick({ muscle: bp.slug })}
          />
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.5, color: '#57534e', textTransform: 'uppercase', marginTop: 6 }}>
            ANTERIOR
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Body
            data={data} side="back" gender="male" scale={0.75}
            border="none" defaultFill="#1c1917"
            onBodyPartPress={(bp: any) => handleMuscleClick({ muscle: bp.slug })}
          />
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.5, color: '#57534e', textTransform: 'uppercase', marginTop: 6 }}>
            POSTERIOR
          </Text>
        </View>
      </View>

      {/* Tooltip */}
      {tooltip && (
        <MuscleTooltip
          muscle={tooltip}
          recoveryData={recoveryMap}
          growthData={growthMap}
          mode={mode}
          slideY={slideY}
          fadeAnim={fadeAnim}
          onExercisePress={onExercisePress}
        />
      )}

      {/* Legend */}
      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(68,64,60,0.6)' }}>
        {mode === 'recovery' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {([['#4ade80','Ready'],['#a3e635','Almost'],['#fbbf24','Partial'],['#f87171','Resting']] as [string,string][]).map(([c, label]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {([['#fb923c','PR'],['#4ade80','Improved'],['#60a5fa','First'],['#fbbf24','Regressed'],['#f87171','Dropped']] as [string,string][]).map(([c, label]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Summary */}
      {summaryItems.length > 0 && (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(68,64,60,0.6)', gap: 8 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: COLORS.text600 }}>
            {mode === 'recovery' ? 'Most Fatigued' : 'Top Gains'}
          </Text>
          {summaryItems.map(item => (
            <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color }} />
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400 }}>{item.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text300 }}>{item.value}</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
