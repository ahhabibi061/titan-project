import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Modal, ScrollView, StyleSheet, Dimensions, ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path, Circle, Line, Rect, Defs,
  LinearGradient as SvgGradient, Stop,
} from 'react-native-svg';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Body from 'react-native-body-highlighter';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { supabase } from '../lib/supabase';

const { width: SW, height: SH } = Dimensions.get('window');

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface Exercise {
  id: string;
  name: string;
  primary: string;
  secondary: string[];
  equipment: string;
  pattern: string;
  difficulty: number;
  splits: string[];
  premium: boolean;
  cues: string[] | null;
  video_url: string | null;
  description: string | null;
  mistakes: string[] | null;
  rep_ranges: { strength?: string; hypertrophy?: string; endurance?: string } | null;
  popular: number;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const MUSCLES: Record<string, string> = {
  chest:       'Chest',
  front_delts: 'Front Delts',
  side_delts:  'Side Delts',
  rear_delts:  'Rear Delts',
  lats:        'Lats',
  traps:       'Traps',
  biceps:      'Biceps',
  triceps:     'Triceps',
  forearms:    'Forearms',
  abs:         'Abs',
  obliques:    'Obliques',
  quads:       'Quads',
  hamstrings:  'Hamstrings',
  glutes:      'Glutes',
  calves:      'Calves',
  lower_back:  'Lower Back',
};

const SPLITS = [
  { id: 'all',           label: 'All',       group: 'all' },
  { id: 'push',          label: 'Push',      group: 'PPL' },
  { id: 'pull',          label: 'Pull',      group: 'PPL' },
  { id: 'legs',          label: 'Legs',      group: 'PPL' },
  { id: 'upper',         label: 'Upper',     group: 'U/L' },
  { id: 'lower',         label: 'Lower',     group: 'U/L' },
  { id: 'bro_chest',     label: 'Chest',     group: 'Bro' },
  { id: 'bro_back',      label: 'Back',      group: 'Bro' },
  { id: 'bro_legs',      label: 'Legs',      group: 'Bro' },
  { id: 'bro_shoulders', label: 'Shoulders', group: 'Bro' },
  { id: 'bro_arms',      label: 'Arms',      group: 'Bro' },
];

const EQUIPMENT = [
  { id: 'barbell',    label: 'Barbell' },
  { id: 'dumbbell',   label: 'Dumbbell' },
  { id: 'cable',      label: 'Cable' },
  { id: 'machine',    label: 'Machine' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'cardio',     label: 'Cardio' },
];

const SORTS = [
  { id: 'popular',    label: 'Most Logged' },
  { id: 'alpha',      label: 'A → Z' },
  { id: 'compound',   label: 'Compound First' },
  { id: 'difficulty', label: 'Hardest First' },
];

const PATTERN_ACCENTS: Record<string, { from: string; to: string }> = {
  push:      { from: '#ed7a2a', to: '#7a2410' },
  pull:      { from: '#7eb6ff', to: '#1e3a5f' },
  squat:     { from: '#fbbf24', to: '#7a4a10' },
  hinge:     { from: '#c084fc', to: '#3a1e5f' },
  isolation: { from: '#94a3b8', to: '#1e293b' },
};

// Popular scores for client-side sort (not a DB column)
const POPULAR_SCORES: Record<string, number> = {
  squat: 95, deadlift: 92, bench: 92, curl: 92, lateral_raise: 90,
  pullup: 88, row: 90, incline_db: 88, ohp: 85, lat_pulldown: 85,
  leg_press: 88, rdl: 82, hammer_curl: 80, hip_thrust: 80,
  plank: 75, face_pull: 78, cable_fly: 75, leg_curl: 75,
  tricep_pushdown: 88, rear_delt_fly: 72, bulgarian: 72, front_squat: 70,
  calf_raise: 70, tbar_row: 70, skullcrusher: 70, dips: 68,
  crunch: 65, shrug: 65, preacher_curl: 60, leg_raise: 70,
};

// Muscle → react-native-body-highlighter slug
const BODY_SLUGS: Record<string, string> = {
  chest:       'chest',
  front_delts: 'front-deltoids',
  side_delts:  'deltoids',
  rear_delts:  'trapezius',
  lats:        'latissimus-dorsi',
  traps:       'trapezius',
  biceps:      'biceps',
  triceps:     'triceps',
  forearms:    'forearm',
  abs:         'abs',
  obliques:    'obliques',
  quads:       'quadriceps',
  hamstrings:  'hamstrings',
  glutes:      'gluteal',
  calves:      'calves',
  lower_back:  'lower-back',
};

// ── DATA HOOK ─────────────────────────────────────────────────────────────────

function useExercises() {
  return useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, primary_muscle, secondary_muscles, equipment, pattern, difficulty, splits, premium, cues, video_url')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: any): Exercise => ({
        id:          row.id,
        name:        row.name,
        primary:     row.primary_muscle ?? '',
        secondary:   row.secondary_muscles ?? [],
        equipment:   row.equipment ?? '',
        pattern:     row.pattern ?? 'isolation',
        difficulty:  row.difficulty ?? 1,
        splits:      row.splits ?? [],
        premium:     row.premium ?? false,
        cues:        row.cues ?? null,
        video_url:   row.video_url ?? null,
        description: null,
        mistakes:    null,
        rep_ranges:  null,
        popular:     POPULAR_SCORES[row.id] ?? 50,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

// ── MOTION ICON ───────────────────────────────────────────────────────────────

function MotionIcon({
  pattern,
  size = 60,
  color = 'rgba(245,245,244,0.8)',
}: { pattern: string; size?: number; color?: string }) {
  const base = {
    width: size, height: size,
    viewBox: '0 0 60 60',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
  };
  switch (pattern) {
    case 'push':
      return (
        <Svg {...base}>
          <Circle cx="14" cy="30" r="3" fill={color} />
          <Path d="M 18,30 Q 30,18 42,30" />
          <Path d="M 38,26 L 46,30 L 38,34" />
          <Path d="M 14,42 L 14,46" opacity="0.4" />
          <Path d="M 14,14 L 14,18" opacity="0.4" />
        </Svg>
      );
    case 'pull':
      return (
        <Svg {...base}>
          <Circle cx="46" cy="30" r="3" fill={color} />
          <Path d="M 42,30 Q 30,42 18,30" />
          <Path d="M 22,26 L 14,30 L 22,34" />
          <Path d="M 46,42 L 46,46" opacity="0.4" />
          <Path d="M 46,14 L 46,18" opacity="0.4" />
        </Svg>
      );
    case 'squat':
      return (
        <Svg {...base}>
          <Line x1="12" y1="20" x2="48" y2="20" strokeWidth={3} />
          <Path d="M 30,22 L 30,40" />
          <Path d="M 22,40 L 30,32 L 38,40" />
          <Path d="M 22,46 L 30,38 L 38,46" opacity="0.5" />
          <Path d="M 26,52 L 34,52" />
        </Svg>
      );
    case 'hinge':
      return (
        <Svg {...base}>
          <Circle cx="30" cy="14" r="3" fill={color} />
          <Path d="M 30,18 L 30,28 Q 30,32 36,32 L 46,38" />
          <Path d="M 30,28 L 24,42" />
          <Line x1="14" y1="46" x2="50" y2="46" strokeWidth={3} />
        </Svg>
      );
    default:
      return (
        <Svg {...base}>
          <Circle cx="30" cy="30" r="14" strokeDasharray="3,3" />
          <Circle cx="30" cy="30" r="5" fill={color} />
          <Path d="M 30,12 L 30,8" opacity="0.5" />
          <Path d="M 30,52 L 30,48" opacity="0.5" />
          <Path d="M 12,30 L 8,30" opacity="0.5" />
          <Path d="M 52,30 L 48,30" opacity="0.5" />
        </Svg>
      );
  }
}

// ── CHIP ──────────────────────────────────────────────────────────────────────

function Chip({
  active,
  onPress,
  children,
}: { active: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity
      style={[cx.chip, active && cx.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[cx.chipText, active && cx.chipTextActive]}>{children}</Text>
    </TouchableOpacity>
  );
}

const cx = StyleSheet.create({
  chip:           { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,11,10,0.6)' },
  chipActive:     { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  chipText:       { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  chipTextActive: { color: COLORS.orange300 },
});

// ── EXERCISE CARD ─────────────────────────────────────────────────────────────

const CARD_GAP = SPACING.sm;
const CARD_W   = Math.floor((SW - SPACING.lg * 2 - CARD_GAP) / 2);
const THUMB_H  = Math.floor(CARD_W * 3 / 4);

// Grid lines for the card thumbnail background
const H_LINES = Array.from({ length: Math.ceil(THUMB_H / 14) }, (_, i) => i);
const V_LINES = Array.from({ length: Math.ceil(CARD_W  / 14) }, (_, i) => i);

function ExerciseCard({ ex, onOpen }: { ex: Exercise; onOpen: (e: Exercise) => void }) {
  const accent = PATTERN_ACCENTS[ex.pattern] ?? PATTERN_ACCENTS.isolation;
  const gradId = `g_${ex.id}`;

  return (
    <TouchableOpacity style={cd.card} onPress={() => onOpen(ex)} activeOpacity={0.85}>
      {/* Thumbnail */}
      <View style={[cd.thumb, { height: THUMB_H }]}>
        {/* Gradient */}
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none">
          <Defs>
            <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%"   stopColor={accent.from} stopOpacity="0.13" />
              <Stop offset="100%" stopColor={accent.to}   stopOpacity="0.67" />
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradId})`} />
        </Svg>

        {/* Grid overlay */}
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${CARD_W} ${THUMB_H}`}>
          {H_LINES.map(i => (
            <Line key={`h${i}`} x1="0" y1={i * 14} x2={CARD_W} y2={i * 14}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
          {V_LINES.map(i => (
            <Line key={`v${i}`} x1={i * 14} y1="0" x2={i * 14} y2={THUMB_H}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
        </Svg>

        {/* Motion icon */}
        <View style={cd.iconWrap}>
          <MotionIcon pattern={ex.pattern} size={70} />
        </View>

        {/* Difficulty dots — top left */}
        <View style={cd.dotsRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[cd.dot, i < ex.difficulty ? cd.dotOn : cd.dotOff]} />
          ))}
        </View>

        {/* PRO badge — top right */}
        {ex.premium && (
          <View style={cd.proBadge}>
            <Text style={cd.proText}>PRO</Text>
          </View>
        )}

        {/* Play circle — bottom right */}
        <View style={cd.playCircle}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M3 2L11 7L3 12V2Z" fill={COLORS.text300} />
          </Svg>
        </View>

        {/* Pattern label — bottom left */}
        <Text style={cd.patternLabel}>{ex.pattern}</Text>
      </View>

      {/* Card body */}
      <View style={cd.body}>
        <Text style={cd.name} numberOfLines={2}>{ex.name.toUpperCase()}</Text>
        <View style={cd.pillRow}>
          <View style={cd.pillPrimary}>
            <Text style={cd.pillPrimaryText}>{MUSCLES[ex.primary] ?? ex.primary}</Text>
          </View>
          {ex.secondary.slice(0, 2).map(m => (
            <View key={m} style={cd.pillSecondary}>
              <Text style={cd.pillSecondaryText}>{MUSCLES[m] ?? m}</Text>
            </View>
          ))}
          {ex.secondary.length > 2 && (
            <Text style={cd.pillMore}>+{ex.secondary.length - 2}</Text>
          )}
        </View>
        <View style={cd.metaRow}>
          <Text style={cd.metaEquip}>{ex.equipment}</Text>
          <Text style={cd.metaPop}>★ {ex.popular}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cd = StyleSheet.create({
  card:             { width: CARD_W, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, overflow: 'hidden', marginBottom: CARD_GAP },
  thumb:            { width: CARD_W, backgroundColor: '#0a0908', overflow: 'hidden' },
  iconWrap:         { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  dotsRow:          { position: 'absolute', top: SPACING.sm, left: SPACING.sm, flexDirection: 'row', gap: 3 },
  dot:              { width: 6, height: 6, borderRadius: 3 },
  dotOn:            { backgroundColor: COLORS.orange400 },
  dotOff:           { backgroundColor: 'rgba(87,83,78,0.5)' },
  proBadge:         { position: 'absolute', top: SPACING.sm, right: SPACING.sm, backgroundColor: COLORS.accent, paddingHorizontal: 4, paddingVertical: 2 },
  proText:          { fontFamily: FONTS.mono, fontSize: 7, color: '#0a0908', textTransform: 'uppercase', letterSpacing: 1 },
  playCircle:       { position: 'absolute', bottom: SPACING.sm, right: SPACING.sm, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(12,11,10,0.8)', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  patternLabel:     { position: 'absolute', bottom: SPACING.sm, left: SPACING.sm, fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text300, textTransform: 'uppercase', letterSpacing: 1.5 },
  body:             { padding: SPACING.md },
  name:             { fontFamily: FONTS.anton, fontSize: 14, color: COLORS.text100, lineHeight: 18, marginBottom: SPACING.xs },
  pillRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: SPACING.xs + 2 },
  pillPrimary:      { paddingHorizontal: 5, paddingVertical: 2, backgroundColor: 'rgba(237,122,42,0.15)', borderWidth: 1, borderColor: 'rgba(237,122,42,0.25)' },
  pillPrimaryText:  { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.orange300, textTransform: 'uppercase', letterSpacing: 0.8 },
  pillSecondary:    { paddingHorizontal: 5, paddingVertical: 2, backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' },
  pillSecondaryText:{ fontFamily: FONTS.mono, fontSize: 8, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.8 },
  pillMore:         { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, alignSelf: 'center' },
  metaRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaEquip:        { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  metaPop:          { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 },
});

// ── EXERCISE DETAIL SHEET ─────────────────────────────────────────────────────

const VIDEO_H  = Math.floor(SW * 9 / 16);
const SHEET_H  = Math.floor(SH * 0.95);

function ExerciseDetailSheet({
  ex, visible, onClose, isPro,
}: { ex: Exercise | null; visible: boolean; onClose: () => void; isPro: boolean }) {
  const navigation = useNavigation<any>();

  if (!ex) return null;
  const accent = PATTERN_ACCENTS[ex.pattern] ?? PATTERN_ACCENTS.isolation;

  const bodyData = useMemo(() => {
    const parts: any[] = [];
    if (BODY_SLUGS[ex.primary]) parts.push({ slug: BODY_SLUGS[ex.primary], intensity: 2 });
    ex.secondary.forEach(m => {
      if (BODY_SLUGS[m]) parts.push({ slug: BODY_SLUGS[m], intensity: 1 });
    });
    return parts;
  }, [ex.id]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={dt.overlay}>
        <View style={[dt.sheet, { height: SHEET_H }]}>

          {/* ── VIDEO / ICON HEADER ── */}
          <View style={[dt.videoWrap, { height: VIDEO_H }]}>
            {/* Gradient bg */}
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none">
              <Defs>
                <SvgGradient id="detailGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%"   stopColor={accent.from} stopOpacity="0.13" />
                  <Stop offset="100%" stopColor={accent.to}   stopOpacity="0.67" />
                </SvgGradient>
              </Defs>
              <Rect x="0" y="0" width="1" height="1" fill="url(#detailGrad)" />
            </Svg>

            {ex.video_url ? (
              <Video
                source={{ uri: ex.video_url }}
                shouldPlay
                isLooping
                isMuted
                resizeMode={ResizeMode.COVER}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={dt.iconCentered}>
                <MotionIcon pattern={ex.pattern} size={110} color="rgba(245,245,244,0.7)" />
              </View>
            )}

            {/* Pattern label — top left */}
            <View style={dt.overlayLabel}>
              <Text style={dt.overlayLabelText}>{ex.pattern} · demo loop</Text>
            </View>

            {/* Muscle map — top right area (compact) */}
            {bodyData.length > 0 && (
              <View style={dt.muscleMap} pointerEvents="none">
                <Body
                  data={bodyData}
                  gender="male"
                  side="front"
                  colors={['rgba(237,122,42,0.45)', '#ed7a2a']}
                  scale={0.38}
                />
              </View>
            )}

            {/* Close — absolute top right */}
            <TouchableOpacity style={dt.closeBtn} onPress={onClose}>
              <Text style={dt.closeBtnText}>✕</Text>
            </TouchableOpacity>

            {/* Play/pause — bottom right */}
            <TouchableOpacity style={dt.playBtn}>
              <Svg width={18} height={18} viewBox="0 0 14 14" fill="none">
                <Path d="M3 2L11 7L3 12V2Z" fill="#0a0908" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* ── SCROLLABLE BODY ── */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={dt.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Name row */}
            <View style={dt.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={dt.name}>{ex.name.toUpperCase()}</Text>
                <View style={dt.pillRow}>
                  <View style={cd.pillPrimary}>
                    <Text style={cd.pillPrimaryText}>{MUSCLES[ex.primary] ?? ex.primary} · Primary</Text>
                  </View>
                  {ex.secondary.map(m => (
                    <View key={m} style={cd.pillSecondary}>
                      <Text style={cd.pillSecondaryText}>{MUSCLES[m] ?? m}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={dt.diffBlock}>
                <Text style={dt.diffLabel}>Difficulty</Text>
                <View style={dt.diffDots}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <View key={i} style={[cd.dot, { width: 7, height: 7, borderRadius: 4 }, i < ex.difficulty ? cd.dotOn : cd.dotOff]} />
                  ))}
                </View>
                <Text style={dt.equipText}>{ex.equipment}</Text>
              </View>
            </View>

            {/* Description */}
            {ex.description ? (
              <View style={dt.section}>
                <Text style={dt.bodyText}>{ex.description}</Text>
              </View>
            ) : null}

            {/* Form Cues */}
            {ex.cues && ex.cues.length > 0 && (
              <View style={dt.section}>
                <Text style={dt.sectionTitle}>Form Cues</Text>
                {ex.cues.map((cue, i) => (
                  <View key={i} style={dt.cueRow}>
                    <Text style={dt.cueNum}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={dt.cueText}>{cue}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Common Mistakes */}
            {ex.mistakes && ex.mistakes.length > 0 && (
              <View style={dt.section}>
                <Text style={dt.sectionTitle}>Common Mistakes</Text>
                {ex.mistakes.map((m, i) => (
                  <View key={i} style={dt.cueRow}>
                    <Text style={[dt.cueNum, { color: COLORS.red400 }]}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={dt.cueText}>{m}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Rep Ranges */}
            {ex.rep_ranges && (
              <View style={dt.section}>
                <Text style={dt.sectionTitle}>Rep Ranges</Text>
                <View style={dt.repTable}>
                  {(['strength', 'hypertrophy', 'endurance'] as const).map((goal, i) => (
                    <View key={goal} style={[dt.repCol, i > 0 && dt.repColBorder]}>
                      <Text style={dt.repLabel}>{goal}</Text>
                      <Text style={dt.repValue}>{ex.rep_ranges?.[goal] ?? '—'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Form Check Video — Pro gated */}
            <View style={[dt.section, dt.proSection, !isPro && dt.proSectionGated]}>
              <View style={dt.proBadgeRow}>
                <Text style={dt.sectionTitle}>Form Check Video</Text>
                {!isPro && <View style={cd.proBadge}><Text style={cd.proText}>PRO</Text></View>}
              </View>
              {isPro ? (
                <Text style={dt.bodyText}>
                  Slow-motion form demo with annotated coaching points. Tap the video above to play.
                </Text>
              ) : (
                <>
                  <Text style={[dt.bodyText, { color: COLORS.text500 }]}>
                    Slow-motion form demonstration with annotated coaching points, common mistake breakdowns, and progressive variations.
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                    <Text style={dt.upgradeLink}>Upgrade to Pro to unlock →</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Programs This Fits */}
            {ex.splits && ex.splits.length > 0 && (
              <View style={dt.section}>
                <Text style={dt.sectionTitle}>Programs This Fits</Text>
                <View style={dt.splitPills}>
                  {ex.splits.map(s => {
                    const split = SPLITS.find(x => x.id === s);
                    return split ? (
                      <View key={s} style={dt.splitPill}>
                        <Text style={dt.splitPillText}>{split.group} · {split.label}</Text>
                      </View>
                    ) : null;
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* ── FOOTER ACTIONS ── */}
          <View style={dt.footer}>
            <TouchableOpacity
              style={dt.historyBtn}
              onPress={() => { onClose(); navigation.navigate('Forge'); }}
            >
              <Text style={dt.historyBtnText}>View History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dt.addBtn}
              onPress={() => { onClose(); navigation.navigate('Forge'); }}
            >
              <Text style={dt.addBtnText}>+ Add to Workout</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const dt = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(10,9,8,0.6)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: '#0d0c0a', borderTopWidth: 1, borderTopColor: COLORS.border },
  videoWrap:       { width: SW, overflow: 'hidden', backgroundColor: '#0a0908' },
  iconCentered:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  overlayLabel:    { position: 'absolute', top: SPACING.md, left: SPACING.md, backgroundColor: 'rgba(10,9,8,0.8)', borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  overlayLabelText:{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text300, textTransform: 'uppercase', letterSpacing: 1.5 },
  muscleMap:       { position: 'absolute', top: SPACING.xs, right: SPACING.xl + SPACING.xs },
  closeBtn:        { position: 'absolute', top: SPACING.md, right: SPACING.md, width: 32, height: 32, backgroundColor: 'rgba(10,9,8,0.85)', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:    { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text400 },
  playBtn:         { position: 'absolute', bottom: SPACING.md, right: SPACING.md, width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },

  scrollContent:   { padding: SPACING.lg, paddingBottom: SPACING.md },
  nameRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.lg },
  name:            { fontFamily: FONTS.anton, fontSize: 24, color: COLORS.text100, lineHeight: 28, marginBottom: SPACING.sm },
  pillRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  diffBlock:       { alignItems: 'flex-end', flexShrink: 0 },
  diffLabel:       { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  diffDots:        { flexDirection: 'row', gap: 3, marginBottom: 4, justifyContent: 'flex-end' },
  equipText:       { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },

  section:         { marginBottom: SPACING.lg },
  sectionTitle:    { fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, textTransform: 'uppercase', marginBottom: SPACING.md },
  bodyText:        { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.text300, lineHeight: 20 },
  cueRow:          { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm, alignItems: 'flex-start' },
  cueNum:          { fontFamily: FONTS.mono, fontSize: 10, color: 'rgba(237,122,42,0.6)', width: 24, marginTop: 2 },
  cueText:         { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.text300, flex: 1, lineHeight: 20 },

  repTable:        { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border },
  repCol:          { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  repColBorder:    { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  repLabel:        { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  repValue:        { fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100 },

  proSection:      { borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
  proSectionGated: { borderColor: 'rgba(237,122,42,0.3)', backgroundColor: 'rgba(237,122,42,0.05)' },
  proBadgeRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  upgradeLink:     { fontFamily: FONTS.anton, fontSize: 12, color: COLORS.orange300, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: 'rgba(237,122,42,0.4)', alignSelf: 'flex-start', marginTop: SPACING.sm },

  splitPills:      { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  splitPill:       { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 2, backgroundColor: 'rgba(28,25,23,0.6)', borderWidth: 1, borderColor: COLORS.border },
  splitPillText:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text400, textTransform: 'uppercase', letterSpacing: 1 },

  footer:          { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  historyBtn:      { flex: 1, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  historyBtnText:  { fontFamily: FONTS.anton, fontSize: 13, color: COLORS.text400, textTransform: 'uppercase', letterSpacing: 1 },
  addBtn:          { flex: 1, paddingVertical: SPACING.md, backgroundColor: COLORS.accent, alignItems: 'center' },
  addBtnText:      { fontFamily: FONTS.anton, fontSize: 13, color: COLORS.bg, textTransform: 'uppercase', letterSpacing: 1 },
});

// ── SPLIT GROUPS (for grouped label display) ──────────────────────────────────

const SPLIT_GROUPS: [string, typeof SPLITS][] = (() => {
  const map = new Map<string, typeof SPLITS>();
  for (const s of SPLITS) {
    if (!map.has(s.group)) map.set(s.group, []);
    map.get(s.group)!.push(s);
  }
  return [...map.entries()];
})();

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────

export default function CodexScreen() {
  const { data: exercises = [], isLoading } = useExercises();

  const [search,          setSearch]          = useState('');
  const [activeSplit,     setActiveSplit]     = useState('all');
  const [activeMuscles,   setActiveMuscles]   = useState<Set<string>>(new Set());
  const [activeEquipment, setActiveEquipment] = useState<Set<string>>(new Set());
  const [sortBy,          setSortBy]          = useState('popular');
  const [selected,        setSelected]        = useState<Exercise | null>(null);

  const isPro = false; // wire to subscription hook when available

  const sortIdx   = SORTS.findIndex(s => s.id === sortBy);
  const cycleSort = useCallback(() => {
    setSortBy(SORTS[(sortIdx + 1) % SORTS.length].id);
  }, [sortIdx]);

  const toggleMuscle = useCallback((id: string) => {
    setActiveMuscles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleEquipment = useCallback((id: string) => {
    setActiveEquipment(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setActiveSplit('all');
    setActiveMuscles(new Set());
    setActiveEquipment(new Set());
    setSearch('');
  }, []);

  const filtered = useMemo(() => {
    let result = exercises.filter(ex => {
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeSplit !== 'all' && !ex.splits?.includes(activeSplit)) return false;
      if (activeMuscles.size > 0 && !activeMuscles.has(ex.primary) && !ex.secondary.some(m => activeMuscles.has(m))) return false;
      if (activeEquipment.size > 0 && !activeEquipment.has(ex.equipment)) return false;
      return true;
    });
    switch (sortBy) {
      case 'alpha':      result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'popular':    result.sort((a, b) => b.popular - a.popular); break;
      case 'compound':   result.sort((a, b) => (b.secondary.length - a.secondary.length) || (b.popular - a.popular)); break;
      case 'difficulty': result.sort((a, b) => b.difficulty - a.difficulty); break;
    }
    return result;
  }, [exercises, search, activeSplit, activeMuscles, activeEquipment, sortBy]);

  const ListHeader = useCallback(() => (
    <View>
      {/* TITLE */}
      <Text style={sc.titleMain}>CODEX</Text>

      {/* ROW 1 — SEARCH (full width) */}
      <TextInput
        style={sc.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search exercises…"
        placeholderTextColor={COLORS.text700}
      />

      {/* ROW 2 — SPLITS with group labels */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.filterRow}>
        {SPLIT_GROUPS.map(([group, splits]) => (
          <React.Fragment key={group}>
            {group !== 'all' && (
              <Text style={sc.groupLabel}>{group} ·</Text>
            )}
            {splits.map(s => (
              <Chip key={s.id} active={activeSplit === s.id} onPress={() => setActiveSplit(s.id)}>
                {s.label}
              </Chip>
            ))}
          </React.Fragment>
        ))}
      </ScrollView>

      {/* ROW 3 — MUSCLES */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.filterRow}>
        {Object.entries(MUSCLES).map(([id, label]) => (
          <Chip key={id} active={activeMuscles.has(id)} onPress={() => toggleMuscle(id)}>
            {label}
          </Chip>
        ))}
      </ScrollView>

      {/* ROW 4 — EQUIPMENT */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.filterRow}>
        {EQUIPMENT.map(e => (
          <Chip key={e.id} active={activeEquipment.has(e.id)} onPress={() => toggleEquipment(e.id)}>
            {e.label}
          </Chip>
        ))}
      </ScrollView>

      {/* ROW 5 — SORT cycle button + result count */}
      <View style={sc.sortRow}>
        <TouchableOpacity style={sc.sortBtn} onPress={cycleSort} activeOpacity={0.8}>
          <Text style={sc.sortBtnText}>{SORTS[sortIdx]?.label ?? 'Sort'} ▾</Text>
        </TouchableOpacity>
        <Text style={sc.resultCount}>{filtered.length} exercises</Text>
      </View>
    </View>
  ), [search, activeSplit, activeMuscles, activeEquipment, sortIdx, cycleSort, filtered.length, toggleMuscle, toggleEquipment]);

  if (isLoading) {
    return (
      <SafeAreaView style={sc.root} edges={['top']}>
        <View style={sc.loadingWrap}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sc.root} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={ex => ex.id}
        numColumns={2}
        columnWrapperStyle={sc.columnWrapper}
        contentContainerStyle={sc.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={sc.empty}>
            <Text style={sc.emptyTitle}>No Matches</Text>
            <Text style={sc.emptyHint}>Try widening your filters</Text>
          </View>
        }
        renderItem={({ item }) => <ExerciseCard ex={item} onOpen={setSelected} />}
      />

      <ExerciseDetailSheet
        ex={selected}
        visible={selected !== null}
        onClose={() => setSelected(null)}
        isPro={isPro}
      />
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  root:            { flex: 1, backgroundColor: COLORS.bg },
  loadingWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent:     { paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  columnWrapper:   { gap: CARD_GAP, justifyContent: 'space-between' },

  titleMain:    { fontFamily: FONTS.anton, fontSize: 28, color: COLORS.accent, textTransform: 'uppercase', paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  searchInput:  { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text100, backgroundColor: 'rgba(12,11,10,0.6)', borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.sm, paddingVertical: Platform.OS === 'ios' ? SPACING.xs : 5, height: 36, marginBottom: SPACING.sm },
  filterRow:    { flexDirection: 'row', gap: SPACING.xs, paddingBottom: SPACING.sm, alignItems: 'center' },
  groupLabel:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: SPACING.xs, marginRight: 2, alignSelf: 'center' },
  sortRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  sortBtn:      { paddingHorizontal: SPACING.sm, height: 36, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,11,10,0.6)', alignItems: 'center', justifyContent: 'center' },
  sortBtnText:  { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text400, textTransform: 'uppercase', letterSpacing: 1 },
  resultCount:  { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, marginLeft: SPACING.sm },

  empty:           { paddingVertical: 80, alignItems: 'center' },
  emptyTitle:      { fontFamily: FONTS.anton, fontSize: 28, color: COLORS.text700, textTransform: 'uppercase', marginBottom: SPACING.xs },
  emptyHint:       { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1 },
});
