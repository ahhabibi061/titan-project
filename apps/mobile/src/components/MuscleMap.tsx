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
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import Body, { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';
import { COLORS, FONTS } from '../constants/theme';

// ── Copied verbatim from web ──────────────────────────────────────────────────

const MUSCLES: Record<string, string> = {
  chest: 'Chest', front_delts: 'Front Delts', side_delts: 'Side Delts',
  rear_delts: 'Rear Delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  lats: 'Lats', lower_back: 'Lower Back', glutes: 'Glutes',
  quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves',
};

// Web slug names → mobile library slug names.
// react-native-body-highlighter merges front/rear deltoids into 'deltoids'.
const MUSCLE_MAP: Record<string, string> = {
  chest:       'chest',
  front_delts: 'deltoids',
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
};

const MUSCLE_WINDOWS: Record<string, number> = {
  'chest': 72, 'deltoids': 48, 'biceps': 48, 'triceps': 48, 'forearm': 36,
  'abs': 24, 'obliques': 24, 'trapezius': 36,
  'upper-back': 72, 'lower-back': 72, 'gluteal': 72,
  'quadriceps': 72, 'hamstring': 72, 'calves': 36,
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

// ── Primitive adapter: web frequency-model → mobile ExtendedBodyPart[] ────────
// The web Model component resolves color via highlightedColors[frequency-1].
// The mobile Body component needs colors pre-resolved per part.
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
// Logic identical to web. Position: absolute div → Animated slide-up panel.

interface MuscleTooltipProps {
  muscle:       string | null;
  recoveryData: Record<string, any>;
  growthData:   Record<string, any>;
  mode:         'recovery' | 'growth';
  slideY:       Animated.Value;
  fadeAnim:     Animated.Value;
}

function MuscleTooltip({ muscle, recoveryData, growthData, mode, slideY, fadeAnim }: MuscleTooltipProps) {
  if (!muscle) return null;
  const displayName  = MUSCLE_DISPLAY_NAMES[muscle] || muscle.replace(/-/g, ' ').toUpperCase();
  const internalKey  = Object.entries(MUSCLE_MAP).find(([, s]) => s === muscle)?.[0];
  let value: number | null = null;
  let line2: string | null = null;

  if (mode === 'recovery' && internalKey) {
    const e = recoveryData?.[internalKey];
    if (e && e.status !== 'no_data') {
      value = e.pct ?? (e.status === 'ready' ? 100 : null);
      line2 = e.hoursRemaining > 0 ? `${e.hoursRemaining}h remaining` : null;
    }
  } else if (mode === 'growth' && internalKey) {
    const e = growthData?.[internalKey];
    if (e) {
      value = e.growthPct;
      line2 = e.prevVol != null
        ? `${fmt(e.currentVol)} vs ${fmt(e.prevVol)} kg·reps`
        : e.currentVol != null ? `${fmt(e.currentVol)} kg·reps` : null;
    }
  }

  const getStatus = (): { label: string; color: string } => {
    if (mode === 'recovery') {
      if (value === null) return { label: 'NO DATA',      color: '#78716c' };
      if (value >= 100)   return { label: 'READY',        color: '#22c55e' };
      if (value >= 67)    return { label: 'ALMOST READY', color: '#eab308' };
      if (value >= 34)    return { label: 'PARTIAL',      color: '#f97316' };
      return                     { label: 'RESTING',      color: '#ef4444' };
    } else {
      if (value === null) return { label: 'NO DATA',      color: '#78716c' };
      if (value! > 10)    return { label: 'PR TERRITORY', color: '#22c55e' };
      if (value! > 0)     return { label: 'IMPROVED',     color: '#86efac' };
      if (value! > -10)   return { label: 'SLIGHT DROP',  color: '#f97316' };
      return                     { label: 'REGRESSED',    color: '#ef4444' };
    }
  };
  const status = getStatus();

  return (
    <Animated.View style={{
      opacity: fadeAnim, transform: [{ translateY: slideY }],
      marginTop: 12, backgroundColor: '#0c0a09',
      borderWidth: 1, borderColor: '#292524', padding: 12,
    }}>
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
    </Animated.View>
  );
}

// ── BodyMapDual ───────────────────────────────────────────────────────────────
// Logic identical to web BodyMapDual. Primitives swapped throughout.

export interface BodyMapDualProps {
  recoveryMap: Record<string, any>;
  growthMap:   Record<string, any>;
  mode:        'recovery' | 'growth';
  setMode:     (m: 'recovery' | 'growth') => void;
}

export function BodyMapDual({ recoveryMap, growthMap, mode, setMode }: BodyMapDualProps) {
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

  // Summary items — identical logic to web
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
      {/* Mode toggle — web: flex gap-1 mb-4 */}
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

      {/* Body maps — web: flex gap-3 justify-center */}
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

      {/* Tooltip — web: absolute div; mobile: animated slide-up in-flow */}
      {tooltip && (
        <MuscleTooltip
          muscle={tooltip}
          recoveryData={recoveryMap}
          growthData={growthMap}
          mode={mode}
          slideY={slideY}
          fadeAnim={fadeAnim}
        />
      )}

      {/* Legend — web: mt-3 pt-3 border-t border-stone-800/60 */}
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

      {/* Summary — web: mt-3 pt-3 border-t space-y-2 */}
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
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text200 }}>{item.value}</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 }}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
