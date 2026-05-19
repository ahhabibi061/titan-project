import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Dimensions, Alert, Modal, Image, ActivityIndicator, KeyboardAvoidingView,
  Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import {
  useBiometricEntries,
  useLogWeight,
  useDeleteEntry,
  useProgressPhotos,
  useUploadPhoto,
  useWeeklyCheckin,
  type BiometricEntry,
  type ProgressPhoto,
} from '../hooks/useVault';
import { supabase } from '../lib/supabase';

const { width: SW } = Dimensions.get('window');

// ── MATH ──────────────────────────────────────────────────────────────────────

function linearRegression(values: number[]) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

function movingAverage(values: number[], window = 7) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// Expects entries in chronological (ascending) order
function projectGoalDate(ascEntries: BiometricEntry[], goalWeight: number): string | null {
  if (ascEntries.length < 7) return null;
  const weights = ascEntries.map(e => e.weight_kg);
  const reg = linearRegression(weights);
  if (Math.abs(reg.slope) < 0.001) return null;
  const current = weights[weights.length - 1];
  const daysNeeded = (goalWeight - current) / reg.slope;
  if (daysNeeded <= 0) return null;
  const eta = new Date();
  eta.setDate(eta.getDate() + Math.round(daysNeeded));
  return eta.toISOString().split('T')[0];
}

// US Navy body fat formula (all measurements in cm)
function navyBodyFat(
  waist: number, neck: number, hip: number | null,
  height: number, sex: 'male' | 'female',
): number | null {
  if (sex === 'male') {
    const diff = waist - neck;
    if (diff <= 0) return null;
    return 86.010 * Math.log10(diff) - 70.041 * Math.log10(height) + 36.76;
  }
  if (hip == null) return null;
  const sum = waist + hip - neck;
  if (sum <= 0) return null;
  return 163.205 * Math.log10(sum) - 97.684 * Math.log10(height) - 78.387;
}

// ── FORMATTERS ────────────────────────────────────────────────────────────────

const fmt0      = (n: number) => String(Math.round(n));
const fmt1      = (n: number) => Number(n).toFixed(1);
const fmtDate   = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDateLong = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoFromYM(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── TYPES ─────────────────────────────────────────────────────────────────────

type TimeRange = '2W' | '1M' | '3M' | 'ALL';

interface ProfileData {
  goal_weight_kg: number | null;
  height_cm: number | null;
  sex: 'male' | 'female' | null;
}

// ── TIME RANGE FILTER ─────────────────────────────────────────────────────────

function filterByRange(entries: BiometricEntry[], range: TimeRange): BiometricEntry[] {
  if (range === 'ALL') return entries;
  const days = range === '2W' ? 14 : range === '1M' ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return entries.filter(e => e.logged_at >= cutoffStr);
}

// ── WEIGHT CHART ──────────────────────────────────────────────────────────────

interface ChartPoint { entry: BiometricEntry; ma: number; regY: number; }

function WeightChart({ entries, goal }: { entries: BiometricEntry[]; goal: number | null }) {
  const [range, setRange]             = useState<TimeRange>('1M');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const filtered = filterByRange([...entries].reverse(), range);
  const weights  = filtered.map(e => e.weight_kg);
  const ma       = movingAverage(weights);
  const reg      = linearRegression(weights);

  const CHART_W = SW - 32 * 2;
  const CHART_H = 180;
  const PAD     = { t: 16, r: 12, b: 32, l: 44 };
  const iW      = CHART_W - PAD.l - PAD.r;
  const iH      = CHART_H - PAD.t - PAD.b;

  const points: ChartPoint[] = filtered.map((e, i) => ({
    entry: e,
    ma:    ma[i],
    regY:  reg.slope * i + reg.intercept,
  }));

  const allVals = [...weights, ...(goal ? [goal] : [])];
  const minW = allVals.length ? Math.min(...allVals) - 0.5 : 0;
  const maxW = allVals.length ? Math.max(...allVals) + 0.5 : 100;

  const px = (i: number) => PAD.l + (points.length <= 1 ? iW / 2 : (i / (points.length - 1)) * iW);
  const py = (w: number) => PAD.t + ((maxW - w) / Math.max(maxW - minW, 0.1)) * iH;

  const rawPath = weights.map((w, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)},${py(w).toFixed(1)}`).join(' ');
  const maPath  = ma.map((w, i)     => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)},${py(w).toFixed(1)}`).join(' ');
  const regPath = points.length >= 2
    ? `M ${px(0).toFixed(1)},${py(reg.intercept).toFixed(1)} L ${px(points.length - 1).toFixed(1)},${py(reg.slope * (points.length - 1) + reg.intercept).toFixed(1)}`
    : '';

  const maFill = points.length >= 2
    ? `${maPath} L ${px(points.length - 1).toFixed(1)},${(PAD.t + iH).toFixed(1)} L ${px(0).toFixed(1)},${(PAD.t + iH).toFixed(1)} Z`
    : '';

  const tickStep = 2;
  const yTicks: number[] = [];
  for (let v = Math.ceil(minW / tickStep) * tickStep; v <= maxW; v += tickStep) yTicks.push(v);

  const xTicks = filtered
    .map((e, i) => ({ dateStr: e.logged_at, i }))
    .filter(({ dateStr }) => dateStr.endsWith('-01') || filtered.indexOf(filtered.find(e => e.logged_at === dateStr)!) === 0)
    .slice(0, 5);

  function handleChartPress(event: any) {
    if (!points.length) return;
    const lx = event.nativeEvent.locationX;
    const ratio = (lx - PAD.l) / iW;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
    setSelectedIdx(prev => prev === idx ? null : idx);
  }

  const sel = selectedIdx != null ? points[selectedIdx] : null;
  const slopePerWeek = reg.slope * 7;
  const slopeLabel = points.length >= 7
    ? `${slopePerWeek >= 0 ? '+' : ''}${fmt1(slopePerWeek)} kg/wk`
    : 'Need 7+ entries';

  return (
    <View>
      <View style={ch.toggleRow}>
        {(['2W', '1M', '3M', 'ALL'] as TimeRange[]).map(r => (
          <TouchableOpacity
            key={r}
            style={[ch.toggleBtn, range === r && ch.toggleBtnActive]}
            onPress={() => { setRange(r); setSelectedIdx(null); }}
          >
            <Text style={[ch.toggleText, range === r && ch.toggleTextActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {points.length < 2 ? (
        <View style={ch.empty}>
          <Text style={ch.emptyText}>Log 2+ entries to see the chart</Text>
        </View>
      ) : (
        <Pressable onPress={handleChartPress}>
          <Svg width={CHART_W} height={CHART_H}>
            <Defs>
              <LinearGradient id="maFillVault" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#ed7a2a" stopOpacity="0.15" />
                <Stop offset="100%" stopColor="#ed7a2a" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {yTicks.map(v => (
              <React.Fragment key={v}>
                <Line x1={PAD.l} x2={PAD.l + iW} y1={py(v)} y2={py(v)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                <SvgText x={PAD.l - 6} y={py(v) + 3} fontSize={9} fill="#57534e" textAnchor="end" fontFamily={FONTS.mono}>{v}</SvgText>
              </React.Fragment>
            ))}
            {xTicks.map(({ dateStr, i }) => (
              <SvgText key={i} x={px(i)} y={PAD.t + iH + 18} fontSize={8} fill="#57534e" textAnchor="middle" fontFamily={FONTS.mono}>
                {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </SvgText>
            ))}
            {goal != null && (
              <>
                <Line x1={PAD.l} x2={PAD.l + iW} y1={py(goal)} y2={py(goal)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 4" />
                <SvgText x={PAD.l + iW - 2} y={py(goal) - 4} fontSize={8} fill="#f59e0b" textAnchor="end" fontFamily={FONTS.mono}>
                  {`GOAL · ${fmt1(goal)}kg`}
                </SvgText>
              </>
            )}
            {maFill ? <Path d={maFill} fill="url(#maFillVault)" /> : null}
            {weights.map((w, i) => (
              <Circle key={i} cx={px(i)} cy={py(w)} r={1.4} fill="#888" opacity={0.4} />
            ))}
            <Path d={maPath} fill="none" stroke="#ed7a2a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {regPath ? <Path d={regPath} fill="none" stroke="#a8a29e" strokeWidth={1.2} strokeDasharray="5 4" opacity={0.6} /> : null}
            {sel != null && selectedIdx != null && (
              <>
                <Line x1={px(selectedIdx)} x2={px(selectedIdx)} y1={PAD.t} y2={PAD.t + iH} stroke="#ed7a2a" strokeWidth={1} opacity={0.4} />
                <Circle cx={px(selectedIdx)} cy={py(sel.entry.weight_kg)} r={5} fill="#ff5a2a" stroke="#0a0908" strokeWidth={2} />
              </>
            )}
            {points.length > 0 && (
              <Circle cx={px(points.length - 1)} cy={py(weights[weights.length - 1])} r={4} fill="#ed7a2a" stroke="#0a0908" strokeWidth={2} />
            )}
          </Svg>
        </Pressable>
      )}

      {sel && (
        <View style={ch.tooltip}>
          <Text style={ch.tooltipDate}>{fmtDateLong(sel.entry.logged_at)}</Text>
          <Text style={ch.tooltipWeight}>{fmt1(sel.entry.weight_kg)}<Text style={ch.tooltipUnit}> kg</Text></Text>
          <Text style={ch.tooltipMa}>MA: {fmt1(sel.ma)} kg</Text>
          <Text style={ch.tooltipTrend}>Trend: {fmt1(sel.regY)} kg</Text>
          {sel.entry.body_fat_pct != null && (
            <Text style={ch.tooltipMa}>{fmt1(sel.entry.body_fat_pct)}% bf</Text>
          )}
        </View>
      )}

      <View style={ch.legendRow}>
        <View style={ch.legendItem}><View style={[ch.legendDot, { backgroundColor: '#888' }]} /><Text style={ch.legendLabel}>Daily</Text></View>
        <View style={ch.legendItem}><View style={[ch.legendLine, { backgroundColor: '#ed7a2a' }]} /><Text style={ch.legendLabel}>7-day MA</Text></View>
        <View style={ch.legendItem}><View style={[ch.legendLine, { backgroundColor: '#a8a29e' }]} /><Text style={ch.legendLabel}>Trend</Text></View>
        {goal != null && <View style={ch.legendItem}><View style={[ch.legendLine, { backgroundColor: '#f59e0b' }]} /><Text style={ch.legendLabel}>Goal</Text></View>}
        <Text style={[ch.legendLabel, { marginLeft: 'auto' as any, color: COLORS.orange300 }]}>{slopeLabel}</Text>
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  toggleRow:        { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  toggleBtn:        { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  toggleBtnActive:  { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  toggleText:       { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  toggleTextActive: { color: COLORS.orange300 },
  empty:            { height: 100, alignItems: 'center', justifyContent: 'center' },
  emptyText:        { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
  tooltip:          { borderWidth: 1, borderColor: 'rgba(237,122,42,0.4)', backgroundColor: COLORS.bgCard, padding: SPACING.md, marginTop: SPACING.sm, alignSelf: 'flex-start' },
  tooltipDate:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  tooltipWeight:    { fontFamily: FONTS.anton, fontSize: 28, color: COLORS.orange300, lineHeight: 34 },
  tooltipUnit:      { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text500 },
  tooltipMa:        { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, marginTop: 2 },
  tooltipTrend:     { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 },
  legendRow:        { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  legendItem:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:        { width: 6, height: 6 },
  legendLine:       { width: 14, height: 2 },
  legendLabel:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
});

// ── CALENDAR SECTION (Fix 2) ──────────────────────────────────────────────────

const CAL_CELL = Math.floor((SW - 64 - 24) / 7); // 64=screen+card pad, 24=6×4 gap

function CalendarSection({ entries, onDayPress }: { entries: BiometricEntry[]; onDayPress: (date: string) => void }) {
  const today    = new Date();
  const todayIso = todayISO();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const loggedSet = useMemo(() => new Set(entries.map(e => e.logged_at)), [entries]);

  const { currentStreak, longestStreak } = useMemo(() => {
    if (entries.length === 0) return { currentStreak: 0, longestStreak: 0 };

    // current streak: walk backwards from today
    let cur = 0;
    const d = new Date();
    while (true) {
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (loggedSet.has(iso)) { cur++; d.setDate(d.getDate() - 1); }
      else break;
    }

    // longest streak from sorted ASC entries
    const sorted = [...entries].reverse();
    let longest = cur, streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].logged_at + 'T12:00:00');
      const curr = new Date(sorted[i].logged_at + 'T12:00:00');
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
      if (diff === 1) { streak++; longest = Math.max(longest, streak); }
      else streak = 1;
    }
    return { currentStreak: cur, longestStreak: longest };
  }, [entries, loggedSet]);

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const maxFutureMonth = today.getMonth();
  const maxFutureYear  = today.getFullYear();
  const atMax = viewYear > maxFutureYear || (viewYear === maxFutureYear && viewMonth >= maxFutureMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (atMax) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();

  return (
    <View>
      <View style={cal.navRow}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
          <Text style={cal.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextMonth} style={cal.navBtn} disabled={atMax}>
          <Text style={[cal.navArrow, atMax && { opacity: 0.2 }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={cal.dowRow}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <Text key={i} style={cal.dowLabel}>{d}</Text>
        ))}
      </View>

      <View style={cal.grid}>
        {cells.map((day, i) => {
          if (day == null) return <View key={i} style={cal.cell} />;
          const iso      = isoFromYM(viewYear, viewMonth, day);
          const logged   = loggedSet.has(iso);
          const isToday  = iso === todayIso;
          const isFuture = iso > todayIso;
          return (
            <TouchableOpacity
              key={i}
              style={[cal.cell, logged && cal.cellLogged, isToday && !logged && cal.cellToday]}
              onPress={() => { if (!isFuture) onDayPress(iso); }}
              activeOpacity={isFuture ? 1 : 0.7}
            >
              <Text style={[
                cal.dayText,
                logged && cal.dayTextLogged,
                isToday && !logged && cal.dayTextToday,
                isFuture && cal.dayTextFuture,
              ]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={cal.streakRow}>
        <View style={cal.streakStat}>
          <Text style={cal.streakLabel}>Current Streak</Text>
          <Text style={cal.streakValue}>{currentStreak}<Text style={cal.streakUnit}> day{currentStreak !== 1 ? 's' : ''}</Text></Text>
        </View>
        <View style={cal.streakStat}>
          <Text style={cal.streakLabel}>Longest Streak</Text>
          <Text style={cal.streakValue}>{longestStreak}<Text style={cal.streakUnit}> day{longestStreak !== 1 ? 's' : ''}</Text></Text>
        </View>
        <View style={cal.streakStat}>
          <Text style={cal.streakLabel}>Total Logs</Text>
          <Text style={cal.streakValue}>{entries.length}</Text>
        </View>
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  navRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  navBtn:         { padding: SPACING.sm },
  navArrow:       { fontFamily: FONTS.mono, fontSize: 22, color: COLORS.text400 },
  monthLabel:     { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text300, letterSpacing: 1.5 },
  dowRow:         { flexDirection: 'row', marginBottom: SPACING.xs },
  dowLabel:       { width: CAL_CELL, textAlign: 'center', fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1 },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell:           { width: CAL_CELL, height: CAL_CELL, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,25,23,0.6)' },
  cellLogged:     { backgroundColor: COLORS.accent },
  cellToday:      { borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: 'rgba(237,122,42,0.1)' },
  dayText:        { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 },
  dayTextLogged:  { color: '#0a0908' },
  dayTextToday:   { color: COLORS.orange300 },
  dayTextFuture:  { color: COLORS.text700 },
  streakRow:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg, paddingTop: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border },
  streakStat:     { alignItems: 'center' },
  streakLabel:    { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  streakValue:    { fontFamily: FONTS.anton, fontSize: 24, color: COLORS.orange300, lineHeight: 30 },
  streakUnit:     { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 },
});

// ── BODY COMPOSITION PANEL ────────────────────────────────────────────────────

function BodyCompositionPanel({ entries }: { entries: BiometricEntry[] }) {
  if (entries.length < 2) {
    return (
      <View style={bc.empty}>
        <Text style={bc.emptyText}>Log at least 2 weigh-ins to see body composition</Text>
      </View>
    );
  }

  const asc      = [...entries].reverse();
  const first    = asc[0];
  const last     = asc[asc.length - 1];

  const firstFat  = first.weight_kg * ((first.body_fat_pct ?? 0) / 100);
  const firstLean = first.weight_kg - firstFat;
  const lastFat   = last.weight_kg  * ((last.body_fat_pct  ?? 0) / 100);
  const lastLean  = last.weight_kg  - lastFat;
  const fatLost   = firstFat  - lastFat;
  const leanLost  = firstLean - lastLean;
  const max       = Math.max(first.weight_kg, last.weight_kg);

  const BAR_MAX = SW - 32 - 32;

  function Bar({ lean, fat, total, label, date, hasBf }: {
    lean: number; fat: number; total: number;
    label: string; date: string; hasBf: boolean;
  }) {
    const barW = BAR_MAX * (total / max);
    return (
      <View>
        <View style={bc.barHeaderRow}>
          <Text style={bc.barLabel}>{label}</Text>
          <Text style={bc.barDate}>{date}</Text>
        </View>
        {hasBf ? (
          <View style={{ flexDirection: 'row', width: barW, height: 28 }}>
            <View style={[bc.leanSeg, { flex: lean / total }]}>
              <Text style={bc.segText}>{fmt1(lean)} kg</Text>
            </View>
            <View style={[bc.fatSeg, { flex: fat / total }]}>
              <Text style={bc.segText}>{fmt1(fat)} kg</Text>
            </View>
          </View>
        ) : (
          <View style={[bc.noFatBar, { width: barW }]}>
            <Text style={bc.noFatText}>No body fat % logged — tap the day in calendar to add</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View>
      <Bar
        lean={firstLean} fat={firstFat} total={first.weight_kg}
        label="FIRST ENTRY" date={fmtDate(first.logged_at)}
        hasBf={first.body_fat_pct != null}
      />
      <View style={{ height: SPACING.lg }} />
      <Bar
        lean={lastLean} fat={lastFat} total={last.weight_kg}
        label="TODAY" date={fmtDate(last.logged_at)}
        hasBf={last.body_fat_pct != null}
      />

      <View style={bc.summaryRow}>
        <View>
          <Text style={bc.summaryLabel}>Fat Lost</Text>
          <Text style={[bc.summaryValue, { color: fatLost >= 0 ? COLORS.orange400 : COLORS.red400 }]}>
            {fatLost >= 0 ? '−' : '+'}{fmt1(Math.abs(fatLost))}<Text style={bc.summaryUnit}> kg</Text>
          </Text>
        </View>
        <View>
          <Text style={bc.summaryLabel}>Lean Change</Text>
          <Text style={[bc.summaryValue, { color: leanLost > 0.5 ? COLORS.red400 : COLORS.text300 }]}>
            {leanLost > 0 ? '−' : '+'}{fmt1(Math.abs(leanLost))}<Text style={bc.summaryUnit}> kg</Text>
          </Text>
        </View>
      </View>

      <View style={bc.legendRow}>
        <View style={bc.legendItem}><View style={[bc.legendSwatch, { backgroundColor: COLORS.text400 }]} /><Text style={bc.legendText}>Lean</Text></View>
        <View style={bc.legendItem}><View style={[bc.legendSwatch, { backgroundColor: COLORS.orange500 }]} /><Text style={bc.legendText}>Fat</Text></View>
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  empty:        { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText:    { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  barHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabel:     { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5 },
  barDate:      { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 },
  leanSeg:      { backgroundColor: COLORS.text400, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 5, overflow: 'hidden' },
  fatSeg:       { backgroundColor: COLORS.orange500, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 5, overflow: 'hidden' },
  segText:      { fontFamily: FONTS.mono, fontSize: 10, color: '#1c1917' },
  noFatBar:     { height: 28, backgroundColor: 'rgba(41,37,36,0.4)', justifyContent: 'center', paddingHorizontal: SPACING.sm },
  noFatText:    { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.lg },
  summaryLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  summaryValue: { fontFamily: FONTS.anton, fontSize: 24, lineHeight: 30 },
  summaryUnit:  { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text500 },
  legendRow:    { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.md },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 12 },
  legendText:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
});

// ── GOAL PROGRESS ─────────────────────────────────────────────────────────────

function GoalProgress({ entries, goalWeight }: { entries: BiometricEntry[]; goalWeight: number | null }) {
  if (!goalWeight || entries.length === 0) return null;

  const current     = entries[0].weight_kg;
  const reversed    = [...entries].reverse();
  const startWeight = reversed[0].weight_kg;

  const totalDelta   = goalWeight - startWeight;
  const currentDelta = current - startWeight;
  const progress     = totalDelta === 0 ? 1 : Math.max(0, Math.min(1, currentDelta / totalDelta));

  const remaining    = Math.abs(current - goalWeight);
  const reg          = linearRegression(reversed.map(e => e.weight_kg));
  const slopePerWeek = reg.slope * 7;
  const weeksEta     = slopePerWeek !== 0 ? Math.abs((current - goalWeight) / slopePerWeek) : null;

  const BAR_W = SW - 32 - 32;

  return (
    <View>
      <View style={gp.barTrack}>
        <View style={[gp.barFill, { width: BAR_W * Math.abs(progress) }]} />
        <View style={[gp.marker, { left: BAR_W * Math.abs(progress) - 2 }]} />
      </View>
      <View style={gp.labelsRow}>
        <Text style={gp.labelText}>{fmt1(startWeight)} kg</Text>
        <Text style={[gp.labelText, { color: COLORS.orange300 }]}>{fmt1(current)} kg</Text>
        <Text style={gp.labelText}>GOAL {fmt1(goalWeight)} kg</Text>
      </View>
      <Text style={gp.eta}>
        {fmt1(remaining)} kg to go
        {weeksEta != null && entries.length >= 7 ? ` · ~${Math.round(weeksEta)} weeks` : ''}
      </Text>
    </View>
  );
}

const gp = StyleSheet.create({
  barTrack:  { height: 8, backgroundColor: '#292524', marginBottom: SPACING.xs, position: 'relative' },
  barFill:   { height: 8, backgroundColor: COLORS.accent, position: 'absolute', top: 0, left: 0 },
  marker:    { width: 4, height: 14, backgroundColor: COLORS.text100, position: 'absolute', top: -3 },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  labelText: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
  eta:       { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text400, letterSpacing: 0.5 },
});

// ── DERIVED METRICS CARD (Fix 1) ──────────────────────────────────────────────

function DerivedCard({ entries, goalWeight }: { entries: BiometricEntry[]; goalWeight: number | null }) {
  const asc     = [...entries].reverse();
  const need7   = asc.length < 7;

  // Use last 30 entries for regression (matching web useBiometricVault)
  const last30      = asc.slice(Math.max(0, asc.length - 30));
  const weights30   = last30.map(e => e.weight_kg);
  const reg30       = linearRegression(weights30);
  const slopePerWeek = reg30.slope * 7;

  const firstWeight = asc[0]?.weight_kg ?? 1;
  const lastWeight  = asc[asc.length - 1]?.weight_kg ?? 0;
  const pctBwPerWeek = firstWeight > 0 ? (slopePerWeek / firstWeight) * 100 : 0;
  const dailyDeficit = Math.abs(slopePerWeek) * 7700 / 7;

  // Projection
  let projection: { daysToGoal?: number; reached?: boolean; unreachable?: boolean } | null = null;
  if (goalWeight != null && asc.length >= 2) {
    if (lastWeight <= goalWeight) {
      projection = { reached: true };
    } else if (reg30.slope >= -0.005) {
      projection = { unreachable: true };
    } else {
      projection = { daysToGoal: Math.ceil((lastWeight - goalWeight) / -reg30.slope) };
    }
  }

  // Pace status (per instruction spec)
  let paceLabel = '—';
  let paceColor = COLORS.text500;
  if (!need7) {
    const absPct = Math.abs(pctBwPerWeek);
    if (absPct > 0.7)      { paceLabel = 'AGGRESSIVE'; paceColor = COLORS.red400; }
    else if (absPct < 0.3) { paceLabel = 'TOO SLOW';   paceColor = COLORS.orange400; }
    else                   { paceLabel = 'ON TARGET';   paceColor = COLORS.green400; }
  }

  const daysStr = projection
    ? (projection.reached ? '✓' : projection.unreachable ? '—' : String(projection.daysToGoal))
    : goalWeight == null ? 'Set goal first' : '—';

  function Row({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
      <View style={dm.row}>
        <Text style={dm.label}>{label}</Text>
        <Text style={[dm.value, color ? { color } : {}]}>{value}</Text>
      </View>
    );
  }

  return (
    <View>
      <Row
        label="Regression Slope"
        value={need7 ? '—' : `${fmt1(slopePerWeek)} kg/wk`}
        color={need7 ? undefined : COLORS.orange300}
      />
      <Row
        label="% BW / WK"
        value={need7 ? '—' : `${fmt1(pctBwPerWeek)}%`}
      />
      <Row
        label="Est. Daily Deficit"
        value={need7 ? '—' : `~${fmt0(dailyDeficit)} kcal/d`}
      />
      <Row
        label="Days to Goal"
        value={daysStr}
        color={projection?.daysToGoal != null ? COLORS.orange300 : undefined}
      />
      <Row
        label="Pace Status"
        value={need7 ? '7+ entries needed' : paceLabel}
        color={need7 ? COLORS.text600 : paceColor}
      />
      <Text style={dm.oracleNote}>
        These metrics feed Oracle every 7 days. Aggressive pace triggers macro adjustments; flat slope flags the cut as stalled.
      </Text>
    </View>
  );
}

const dm = StyleSheet.create({
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label:      { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  value:      { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text300 },
  oracleNote: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.md, textAlign: 'center', lineHeight: 14 },
});

// ── LOG DAY SHEET (Fix 3: bottom sheet for any calendar day) ─────────────────

function LogDaySheet({
  date,
  onClose,
  entries,
  profile,
}: {
  date: string | null;
  onClose: () => void;
  entries: BiometricEntry[];
  profile: ProfileData;
}) {
  const { logWeight, isLoading } = useLogWeight();
  const existing = date ? entries.find(e => e.logged_at === date) ?? null : null;

  const [weight,      setWeight]      = useState('');
  const [bf,          setBf]          = useState('');
  const [showMeasure, setShowMeasure] = useState(false);
  const [waist,       setWaist]       = useState('');
  const [neck,        setNeck]        = useState('');
  const [hip,         setHip]         = useState('');
  const [error,       setError]       = useState('');

  React.useEffect(() => {
    if (date) {
      setWeight(existing ? String(existing.weight_kg) : '');
      setBf(existing?.body_fat_pct != null ? fmt1(existing.body_fat_pct) : '');
      setWaist(existing?.waist_cm  != null ? String(existing.waist_cm)   : '');
      setNeck(existing?.neck_cm    != null ? String(existing.neck_cm)    : '');
      setHip(existing?.hip_cm      != null ? String(existing.hip_cm)     : '');
      setShowMeasure(false);
      setError('');
    }
  }, [date]);

  const computedBf = useMemo(() => {
    const w = parseFloat(waist);
    const n = parseFloat(neck);
    const h = parseFloat(hip) || null;
    if (!w || !n || !profile.height_cm || !profile.sex) return null;
    return navyBodyFat(w, n, h, profile.height_cm, profile.sex);
  }, [waist, neck, hip, profile]);

  React.useEffect(() => {
    if (computedBf != null && computedBf > 3 && computedBf < 60) {
      setBf(fmt1(computedBf));
    }
  }, [computedBf]);

  async function handleSave() {
    if (!date) return;
    const w = parseFloat(weight);
    if (!w || w < 30 || w > 300) { setError('Enter a weight between 30–300 kg'); return; }
    try {
      await logWeight({
        date,
        weight_kg:    w,
        body_fat_pct: bf    !== '' ? parseFloat(bf)    : undefined,
        waist_cm:     waist !== '' ? parseFloat(waist) : undefined,
        neck_cm:      neck  !== '' ? parseFloat(neck)  : undefined,
        hip_cm:       hip   !== '' ? parseFloat(hip)   : undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    }
  }

  return (
    <Modal visible={date !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={lw.overlay}>
          <View style={lw.sheet}>
            <View style={lw.sheetHeader}>
              <View>
                <Text style={lw.sheetDate}>{date ? fmtDateLong(date) : ''}</Text>
                <Text style={lw.sheetTitle}>{existing ? 'Update Weight' : 'Log Weight'}</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Text style={lw.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={lw.inputLabel}>Weight (kg)</Text>
            <TextInput
              style={lw.weightInput}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="84.0"
              placeholderTextColor={COLORS.text700}
              returnKeyType="done"
            />

            <Text style={lw.inputLabel}>
              Body fat % <Text style={{ color: COLORS.text700 }}>(optional)</Text>
            </Text>
            <TextInput
              style={lw.bfInput}
              value={bf}
              onChangeText={setBf}
              keyboardType="decimal-pad"
              placeholder="18.5"
              placeholderTextColor={COLORS.text700}
              returnKeyType="done"
            />

            <TouchableOpacity style={lw.measureToggle} onPress={() => setShowMeasure(v => !v)}>
              <Text style={lw.measureToggleText}>
                {showMeasure ? '▾' : '▸'} Body Measurements (US Navy formula)
              </Text>
            </TouchableOpacity>

            {showMeasure && (
              <View style={lw.measureGroup}>
                <Text style={lw.measureInfo}>
                  {profile.height_cm ? `Height ${profile.height_cm}cm` : 'Height not set in profile'} ·{' '}
                  {profile.sex ?? 'Sex not set in profile'}
                </Text>
                <View style={lw.measureRow}>
                  <View style={lw.measureField}>
                    <Text style={lw.inputLabel}>Waist cm</Text>
                    <TextInput style={lw.measureInput} value={waist} onChangeText={setWaist} keyboardType="decimal-pad" placeholder="82" placeholderTextColor={COLORS.text700} />
                  </View>
                  <View style={lw.measureField}>
                    <Text style={lw.inputLabel}>Neck cm</Text>
                    <TextInput style={lw.measureInput} value={neck} onChangeText={setNeck} keyboardType="decimal-pad" placeholder="37" placeholderTextColor={COLORS.text700} />
                  </View>
                  {profile.sex === 'female' && (
                    <View style={lw.measureField}>
                      <Text style={lw.inputLabel}>Hip cm</Text>
                      <TextInput style={lw.measureInput} value={hip} onChangeText={setHip} keyboardType="decimal-pad" placeholder="92" placeholderTextColor={COLORS.text700} />
                    </View>
                  )}
                </View>
                {computedBf != null && computedBf > 3 && computedBf < 60 && (
                  <Text style={lw.computedBf}>Navy formula → {fmt1(computedBf)}% body fat</Text>
                )}
              </View>
            )}

            {error !== '' && <Text style={lw.error}>{error}</Text>}

            <TouchableOpacity
              style={[lw.logBtn, isLoading && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={isLoading}
            >
              <Text style={lw.logBtnText}>{isLoading ? 'Saving…' : existing ? 'Update' : 'Log Weight'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const lw = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: 'rgba(10,9,8,0.85)', justifyContent: 'flex-end' },
  sheet:             { backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.lg, paddingBottom: 36 },
  sheetHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  sheetDate:         { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  sheetTitle:        { fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, textTransform: 'uppercase' },
  sheetClose:        { fontFamily: FONTS.mono, fontSize: 18, color: COLORS.text400, padding: SPACING.xs },
  inputLabel:        { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 5 },
  weightInput:       { fontFamily: FONTS.anton, fontSize: 36, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,11,10,0.6)', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, marginBottom: SPACING.md },
  bfInput:           { fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,11,10,0.6)', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, marginBottom: SPACING.sm },
  measureToggle:     { paddingVertical: SPACING.sm, marginBottom: SPACING.sm },
  measureToggleText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, textTransform: 'uppercase', letterSpacing: 1 },
  measureGroup:      { backgroundColor: 'rgba(28,25,23,0.5)', padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  measureInfo:       { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.md },
  measureRow:        { flexDirection: 'row', gap: SPACING.sm },
  measureField:      { flex: 1 },
  measureInput:      { fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,11,10,0.6)', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  computedBf:        { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange300, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.sm },
  error:             { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.red400, marginBottom: SPACING.sm },
  logBtn:            { paddingVertical: SPACING.md, backgroundColor: COLORS.accent, alignItems: 'center' },
  logBtnText:        { fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, textTransform: 'uppercase', letterSpacing: 1 },
});

// ── BEFORE/AFTER COMPARE SHEET (Fix 4) ───────────────────────────────────────

const COMPARE_W = Math.floor((SW - 64 - SPACING.sm) / 2);

const COMPARE_ANGLES: { label: string; key: string }[] = [
  { label: 'FRONT', key: 'front' },
  { label: 'SIDE',  key: 'side-left' },
  { label: 'BACK',  key: 'back' },
];

function CompareSheet({
  visible,
  onClose,
  sessions,
  entries,
}: {
  visible: boolean;
  onClose: () => void;
  sessions: [string, ProgressPhoto[]][];
  entries: BiometricEntry[];
}) {
  const [dateA, setDateA] = useState<string | null>(
    sessions.length >= 2 ? sessions[sessions.length - 1][0] : null
  );
  const [dateB, setDateB] = useState<string | null>(
    sessions.length >= 1 ? sessions[0][0] : null
  );
  const [angle, setAngle] = useState('front');

  const photoA  = sessions.find(([d]) => d === dateA)?.[1].find(p => p.angle === angle) ?? null;
  const photoB  = sessions.find(([d]) => d === dateB)?.[1].find(p => p.angle === angle) ?? null;
  const entryA  = dateA ? entries.find(e => e.logged_at === dateA) ?? null : null;
  const entryB  = dateB ? entries.find(e => e.logged_at === dateB) ?? null : null;

  const wtDelta = entryA?.weight_kg != null && entryB?.weight_kg != null
    ? entryB.weight_kg - entryA.weight_kg : null;
  const bfDelta = entryA?.body_fat_pct != null && entryB?.body_fat_pct != null
    ? entryB.body_fat_pct - entryA.body_fat_pct : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <View style={cm.sheet}>
          <View style={cm.sheetHeader}>
            <Text style={cm.sheetTitle}>Before / After</Text>
            <TouchableOpacity onPress={onClose}><Text style={cm.sheetClose}>✕</Text></TouchableOpacity>
          </View>

          {/* Angle toggle */}
          <View style={cm.angleRow}>
            {COMPARE_ANGLES.map(({ label, key }) => (
              <TouchableOpacity
                key={key}
                style={[cm.angleBtn, angle === key && cm.angleBtnActive]}
                onPress={() => setAngle(key)}
              >
                <Text style={[cm.angleBtnText, angle === key && cm.angleBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Side-by-side photos */}
          <View style={cm.photoRow}>
            {([
              { date: dateA, photo: photoA, label: 'BEFORE', entry: entryA },
              { date: dateB, photo: photoB, label: 'AFTER',  entry: entryB },
            ] as const).map(({ date, photo, label, entry }) => (
              <View key={label} style={cm.photoWrap}>
                <Text style={cm.photoSideLabel}>{label}</Text>
                {photo?.signedUrl
                  ? <Image source={{ uri: photo.signedUrl }} style={[cm.photo, { width: COMPARE_W, height: COMPARE_W * 1.35 }]} resizeMode="cover" />
                  : <View style={[cm.photoEmpty, { width: COMPARE_W, height: COMPARE_W * 1.35 }]}>
                      <Text style={cm.photoEmptyText}>No photo</Text>
                    </View>
                }
                <Text style={cm.photoDate}>{date ? fmtDate(date) : '—'}</Text>
                {entry && (
                  <Text style={cm.photoWeight}>
                    {fmt1(entry.weight_kg)} kg{entry.body_fat_pct != null ? ` · ${fmt1(entry.body_fat_pct)}%` : ''}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {/* Delta summary */}
          {(wtDelta != null || bfDelta != null) && (
            <View style={cm.deltaRow}>
              {wtDelta != null && (
                <Text style={cm.deltaText}>Weight: {wtDelta >= 0 ? '+' : ''}{fmt1(wtDelta)} kg</Text>
              )}
              {bfDelta != null && (
                <Text style={cm.deltaText}>Body fat: {bfDelta >= 0 ? '+' : ''}{fmt1(bfDelta)}%</Text>
              )}
            </View>
          )}

          {/* Date pickers (two columns) */}
          <View style={cm.pickersRow}>
            {[{ label: 'BEFORE', value: dateA, onChange: setDateA },
              { label: 'AFTER',  value: dateB, onChange: setDateB }].map(({ label, value, onChange }) => (
              <View key={label} style={cm.pickerCol}>
                <Text style={cm.pickerHeader}>{label}</Text>
                <ScrollView style={cm.pickerList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {sessions.map(([date]) => (
                    <TouchableOpacity
                      key={date}
                      style={[cm.pickerItem, value === date && cm.pickerItemActive]}
                      onPress={() => onChange(date)}
                    >
                      <Text style={[cm.pickerItemText, value === date && cm.pickerItemTextActive]}>
                        {fmtDate(date)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:            { flex: 1, backgroundColor: 'rgba(10,9,8,0.85)', justifyContent: 'flex-end' },
  sheet:              { backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.lg, paddingBottom: 36, maxHeight: '90%' },
  sheetHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sheetTitle:         { fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, textTransform: 'uppercase' },
  sheetClose:         { fontFamily: FONTS.mono, fontSize: 18, color: COLORS.text400, padding: SPACING.xs },
  angleRow:           { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  angleBtn:           { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  angleBtnActive:     { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  angleBtnText:       { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  angleBtnTextActive: { color: COLORS.orange300 },
  photoRow:           { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  photoWrap:          { alignItems: 'center' },
  photoSideLabel:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: SPACING.xs },
  photo:              { backgroundColor: '#1c1917' },
  photoEmpty:         { backgroundColor: '#1c1917', alignItems: 'center', justifyContent: 'center' },
  photoEmptyText:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1 },
  photoDate:          { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, marginTop: SPACING.xs },
  photoWeight:        { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, marginTop: 2 },
  deltaRow:           { flexDirection: 'row', gap: SPACING.lg, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, marginBottom: SPACING.sm },
  deltaText:          { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text300 },
  pickersRow:         { flexDirection: 'row', gap: SPACING.sm },
  pickerCol:          { flex: 1 },
  pickerHeader:       { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: SPACING.xs },
  pickerList:         { maxHeight: 120 },
  pickerItem:         { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm },
  pickerItemActive:   { backgroundColor: COLORS.accentMuted },
  pickerItemText:     { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500 },
  pickerItemTextActive: { color: COLORS.orange300 },
});

// ── VISUAL PROGRESS SECTION (Fix 5 — timeline scrubber + upload sheet) ────────

const ANGLES = ['front', 'back', 'side-left', 'side-right'] as const;
type Angle = typeof ANGLES[number];

const PHOTO_W = Math.floor((SW - 64 - SPACING.sm) / 2);

function VisualProgressSection({ entries }: { entries: BiometricEntry[] }) {
  const { data: photos = [], isLoading } = useProgressPhotos();
  const { uploadPhoto, isLoading: uploading } = useUploadPhoto();

  // Group photos into sessions keyed by taken_at (desc)
  const sessions = useMemo<[string, ProgressPhoto[]][]>(() => {
    const map = new Map<string, ProgressPhoto[]>();
    for (const p of photos) {
      if (!map.has(p.taken_at)) map.set(p.taken_at, []);
      map.get(p.taken_at)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [photos]);

  const [selectedDate,     setSelectedDate]     = useState<string | null>(null);
  const [showUploadSheet,  setShowUploadSheet]  = useState(false);
  const [showCompareSheet, setShowCompareSheet] = useState(false);
  const [viewingPhoto,     setViewingPhoto]     = useState<ProgressPhoto | null>(null);

  React.useEffect(() => {
    if (sessions.length > 0 && !selectedDate) {
      setSelectedDate(sessions[0][0]);
    }
  }, [sessions]);

  const sessionPhotos = useMemo(() => {
    if (!selectedDate) return [];
    return sessions.find(([d]) => d === selectedDate)?.[1] ?? [];
  }, [selectedDate, sessions]);

  const todayPhotos = useMemo(
    () => sessions.find(([d]) => d === todayISO())?.[1] ?? [],
    [sessions],
  );

  async function pickAndUpload(angle: Angle) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow photo library access in settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality:    0.8,
      base64:     true,
    });
    if (result.canceled || !result.assets[0].base64) return;
    try {
      await uploadPhoto({ base64: result.assets[0].base64, angle, date: todayISO() });
      if (!selectedDate) setSelectedDate(todayISO());
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload photo');
    }
  }

  return (
    <View>
      {isLoading ? (
        <View style={vp.loading}><ActivityIndicator color={COLORS.accent} /></View>
      ) : sessions.length === 0 ? (
        <View style={vp.empty}>
          <Text style={vp.emptyText}>No photos yet — tap Upload to add your first check-in</Text>
        </View>
      ) : (
        <>
          {/* Session scrubber */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={vp.scrubber} contentContainerStyle={{ gap: SPACING.xs, flexDirection: 'row', paddingBottom: SPACING.sm }}>
            {sessions.map(([date]) => (
              <TouchableOpacity
                key={date}
                style={[vp.sessionBtn, selectedDate === date && vp.sessionBtnActive]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[vp.sessionBtnText, selectedDate === date && vp.sessionBtnTextActive]}>
                  {fmtDate(date)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 2×2 angle grid for selected session */}
          <View style={vp.grid}>
            {ANGLES.map(angle => {
              const photo = sessionPhotos.find(p => p.angle === angle);
              return (
                <TouchableOpacity
                  key={angle}
                  style={[vp.gridCell, { width: PHOTO_W }]}
                  onPress={() => photo ? setViewingPhoto(photo) : null}
                  activeOpacity={photo ? 0.8 : 1}
                >
                  {photo?.signedUrl
                    ? <Image source={{ uri: photo.signedUrl }} style={[vp.photo, { width: PHOTO_W, height: PHOTO_W * 1.35 }]} />
                    : <View style={[vp.photoEmpty, { width: PHOTO_W, height: PHOTO_W * 1.35 }]}>
                        <Text style={vp.photoEmptyIcon}>—</Text>
                      </View>
                  }
                  <Text style={vp.angleLabel}>{angle.replace('-', ' ').toUpperCase()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <Text style={vp.hint}>Signed URLs expire 1hr · tap photo to view full screen</Text>

      {/* Full-screen photo viewer */}
      <Modal visible={viewingPhoto !== null} transparent animationType="fade" onRequestClose={() => setViewingPhoto(null)}>
        <View style={vp.modalBg}>
          <TouchableOpacity style={vp.modalClose} onPress={() => setViewingPhoto(null)}>
            <Text style={vp.modalCloseText}>✕</Text>
          </TouchableOpacity>
          {viewingPhoto?.signedUrl && (
            <Image source={{ uri: viewingPhoto.signedUrl }} style={vp.modalImage} resizeMode="contain" />
          )}
          <View style={vp.modalMeta}>
            <Text style={vp.modalDate}>{viewingPhoto ? fmtDateLong(viewingPhoto.taken_at) : ''}</Text>
            <Text style={vp.modalAngle}>{viewingPhoto?.angle.replace('-', ' ').toUpperCase()}</Text>
          </View>
        </View>
      </Modal>

      {/* Upload bottom sheet */}
      <Modal visible={showUploadSheet} transparent animationType="slide" onRequestClose={() => setShowUploadSheet(false)}>
        <View style={vp.sheetOverlay}>
          <View style={vp.sheet}>
            <View style={vp.sheetHeader}>
              <View>
                <Text style={vp.sheetTitle}>Upload Today's Photos</Text>
                <Text style={vp.sheetDate}>{fmtDateLong(todayISO())}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUploadSheet(false)}>
                <Text style={vp.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {uploading && <ActivityIndicator color={COLORS.accent} style={{ marginBottom: SPACING.md }} />}
            <View style={vp.grid}>
              {ANGLES.map(angle => {
                const existing = todayPhotos.find(p => p.angle === angle);
                return (
                  <TouchableOpacity
                    key={angle}
                    style={[vp.gridCell, { width: PHOTO_W }]}
                    onPress={() => pickAndUpload(angle)}
                    disabled={uploading}
                    activeOpacity={0.7}
                  >
                    {existing?.signedUrl ? (
                      <View>
                        <Image source={{ uri: existing.signedUrl }} style={[vp.photo, { width: PHOTO_W, height: PHOTO_W * 1.35 }]} />
                        <View style={vp.replaceOverlay}>
                          <Text style={vp.replaceText}>Replace</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={[vp.photoEmpty, vp.uploadPlaceholder, { width: PHOTO_W, height: PHOTO_W * 1.35 }]}>
                        <Text style={vp.uploadIcon}>+</Text>
                      </View>
                    )}
                    <Text style={vp.angleLabel}>{angle.replace('-', ' ').toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Before/After comparison sheet */}
      <CompareSheet
        visible={showCompareSheet}
        onClose={() => setShowCompareSheet(false)}
        sessions={sessions}
        entries={entries}
      />

      {/* Action buttons — rendered outside modals so they're always tappable */}
      <View style={vp.actions}>
        <TouchableOpacity
          style={[vp.uploadBtn, uploading && { opacity: 0.5 }]}
          onPress={() => setShowUploadSheet(true)}
          disabled={uploading}
        >
          <Text style={vp.uploadBtnText}>+ Upload</Text>
        </TouchableOpacity>
        {sessions.length >= 2 && (
          <TouchableOpacity
            style={vp.compareBtn}
            onPress={() => setShowCompareSheet(true)}
          >
            <Text style={vp.compareBtnText}>Compare</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const vp = StyleSheet.create({
  loading:          { paddingVertical: SPACING.xl, alignItems: 'center' },
  empty:            { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText:        { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  scrubber:         { marginBottom: SPACING.md },
  sessionBtn:       { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  sessionBtnActive: { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  sessionBtnText:   { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  sessionBtnTextActive: { color: COLORS.orange300 },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  gridCell:         {},
  photo:            { backgroundColor: '#1c1917' },
  photoEmpty:       { backgroundColor: '#1c1917', alignItems: 'center', justifyContent: 'center' },
  photoEmptyIcon:   { fontFamily: FONTS.mono, fontSize: 20, color: COLORS.text700 },
  angleLabel:       { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.xs },
  hint:             { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.md },
  actions:          { flexDirection: 'row', gap: SPACING.sm },
  uploadBtn:        { flex: 1, paddingVertical: SPACING.md, backgroundColor: COLORS.accent, alignItems: 'center' },
  uploadBtnText:    { fontFamily: FONTS.anton, fontSize: 14, color: COLORS.bg, textTransform: 'uppercase', letterSpacing: 1 },
  compareBtn:       { flex: 1, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  compareBtnText:   { fontFamily: FONTS.anton, fontSize: 14, color: COLORS.text300, textTransform: 'uppercase', letterSpacing: 1 },
  // Full-screen viewer
  modalBg:          { flex: 1, backgroundColor: 'rgba(10,9,8,0.97)', alignItems: 'center', justifyContent: 'center' },
  modalClose:       { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: SPACING.md },
  modalCloseText:   { fontFamily: FONTS.mono, fontSize: 20, color: COLORS.text400 },
  modalImage:       { width: SW, height: SW * 1.35 },
  modalMeta:        { position: 'absolute', bottom: 60, left: 20, right: 20 },
  modalDate:        { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  modalAngle:       { fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, textTransform: 'uppercase' },
  // Upload sheet
  sheetOverlay:     { flex: 1, backgroundColor: 'rgba(10,9,8,0.85)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.lg, paddingBottom: 36 },
  sheetHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  sheetTitle:       { fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, textTransform: 'uppercase' },
  sheetDate:        { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  sheetClose:       { fontFamily: FONTS.mono, fontSize: 18, color: COLORS.text400, padding: SPACING.xs },
  replaceOverlay:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,9,8,0.7)', paddingVertical: SPACING.xs, alignItems: 'center' },
  replaceText:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text300, textTransform: 'uppercase', letterSpacing: 1 },
  uploadPlaceholder:{ borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' as any },
  uploadIcon:       { fontFamily: FONTS.mono, fontSize: 24, color: COLORS.text600 },
});

// ── BIOMETRIC HISTORY TABLE ───────────────────────────────────────────────────

function HistoryRow({ entry, isLast }: { entry: BiometricEntry; isLast: boolean }) {
  const { deleteEntry } = useDeleteEntry();
  const fat  = entry.body_fat_pct;
  const lean = fat != null ? (entry.weight_kg * (1 - fat / 100)) : null;

  function confirmDelete() {
    Alert.alert(
      'Delete entry',
      `Remove ${fmt1(entry.weight_kg)} kg on ${fmtDate(entry.logged_at)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(entry.id) },
      ]
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onLongPress={confirmDelete}
      style={[ht.row, isLast && { borderBottomWidth: 0 }]}
    >
      <Text style={[ht.cell, ht.dateCell]}>{fmtDate(entry.logged_at)}</Text>
      <Text style={[ht.cell, ht.weightCell]}>{fmt1(entry.weight_kg)}</Text>
      <Text style={[ht.cell, ht.bfCell]}>{fat != null ? fmt1(fat) + '%' : '—'}</Text>
      <Text style={[ht.cell, ht.leanCell]}>{lean != null ? fmt1(lean) : '—'}</Text>
      <Text style={ht.deleteHint}>⋯</Text>
    </TouchableOpacity>
  );
}

function BiometricHistoryTable({ entries }: { entries: BiometricEntry[] }) {
  if (entries.length === 0) {
    return <View style={ht.empty}><Text style={ht.emptyText}>No entries yet</Text></View>;
  }
  return (
    <View>
      <View style={ht.header}>
        <Text style={[ht.headerCell, ht.dateCell]}>Date</Text>
        <Text style={[ht.headerCell, ht.weightCell]}>Weight</Text>
        <Text style={[ht.headerCell, ht.bfCell]}>BF%</Text>
        <Text style={[ht.headerCell, ht.leanCell]}>Lean</Text>
      </View>
      {entries.map((e, i) => (
        <HistoryRow key={e.id} entry={e} isLast={i === entries.length - 1} />
      ))}
      <Text style={ht.hint}>Long-press a row to delete</Text>
    </View>
  );
}

const ht = StyleSheet.create({
  header:     { flexDirection: 'row', paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.xs },
  headerCell: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5 },
  row:        { flexDirection: 'row', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: COLORS.bg },
  cell:       { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text300 },
  dateCell:   { flex: 2.5 },
  weightCell: { flex: 1.5, textAlign: 'right' as any },
  bfCell:     { flex: 1.2, textAlign: 'right' as any },
  leanCell:   { flex: 1.5, textAlign: 'right' as any },
  deleteHint: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text700, paddingLeft: SPACING.sm },
  empty:      { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText:  { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
  hint:       { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.md },
});

// ── WEEKLY CHECK-IN MODAL (Fix 2) ─────────────────────────────────────────────

const MOOD_EMOJI = ['😞', '😐', '🙂', '😀', '🤩'];

function WeeklyCheckinModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { checkin, submit, isSubmitting } = useWeeklyCheckin();

  const [mood,   setMood]   = useState(3);
  const [energy, setEnergy] = useState(3);
  const [sleep,  setSleep]  = useState(3);
  const [notes,  setNotes]  = useState('');
  const [error,  setError]  = useState('');

  React.useEffect(() => {
    if (visible) {
      setMood(checkin?.mood   ?? 3);
      setEnergy(checkin?.energy ?? 3);
      setSleep(checkin?.sleep_quality ?? 3);
      setNotes(checkin?.notes ?? '');
      setError('');
    }
  }, [visible, checkin]);

  async function handleSubmit() {
    try {
      await submit({ mood, energy, sleep_quality: sleep, notes });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save check-in');
    }
  }

  function Scale({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
    return (
      <View style={wc.scaleWrap}>
        <Text style={wc.scaleLabel}>{label}</Text>
        <View style={wc.scaleRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity
              key={n}
              style={[wc.scaleBtn, value === n && wc.scaleBtnActive]}
              onPress={() => onChange(n)}
            >
              <Text style={[wc.scaleBtnText, value === n && wc.scaleBtnTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={wc.overlay}>
          <View style={wc.sheet}>
            <View style={wc.header}>
              <Text style={wc.title}>Weekly Check-In</Text>
              <TouchableOpacity onPress={onClose}><Text style={wc.close}>✕</Text></TouchableOpacity>
            </View>

            <Text style={wc.sectionLabel}>Mood</Text>
            <View style={wc.emojiRow}>
              {MOOD_EMOJI.map((emoji, i) => (
                <TouchableOpacity
                  key={i}
                  style={[wc.emojiBtn, mood === i + 1 && wc.emojiBtnActive]}
                  onPress={() => setMood(i + 1)}
                >
                  <Text style={wc.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Scale value={energy} onChange={setEnergy} label="Energy" />
            <Scale value={sleep}  onChange={setSleep}  label="Sleep Quality" />

            <Text style={wc.sectionLabel}>
              Notes <Text style={{ color: COLORS.text700 }}>(optional)</Text>
            </Text>
            <TextInput
              style={wc.notesInput}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholder="How's the week going…"
              placeholderTextColor={COLORS.text700}
            />

            {error !== '' && <Text style={wc.error}>{error}</Text>}

            <TouchableOpacity
              style={[wc.submitBtn, isSubmitting && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={wc.submitText}>{isSubmitting ? 'Saving…' : 'Submit Check-In'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const wc = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: 'rgba(10,9,8,0.85)', justifyContent: 'flex-end' },
  sheet:             { backgroundColor: '#111110', borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.lg, paddingBottom: 36 },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  title:             { fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, textTransform: 'uppercase' },
  close:             { fontFamily: FONTS.mono, fontSize: 18, color: COLORS.text400, padding: SPACING.xs },
  sectionLabel:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: SPACING.sm },
  emojiRow:          { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  emojiBtn:          { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  emojiBtnActive:    { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  emojiText:         { fontSize: 22 },
  scaleWrap:         { marginBottom: SPACING.lg },
  scaleLabel:        { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: SPACING.sm },
  scaleRow:          { flexDirection: 'row', gap: SPACING.sm },
  scaleBtn:          { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  scaleBtnActive:    { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  scaleBtnText:      { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text500 },
  scaleBtnTextActive:{ color: COLORS.orange300 },
  notesInput:        { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,11,10,0.6)', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, minHeight: 72, textAlignVertical: 'top', marginBottom: SPACING.md },
  error:             { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.red400, marginBottom: SPACING.sm },
  submitBtn:         { paddingVertical: SPACING.md, backgroundColor: COLORS.accent, alignItems: 'center' },
  submitText:        { fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, textTransform: 'uppercase', letterSpacing: 1 },
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────

export default function VaultScreen() {
  const { data: entries = [], isLoading } = useBiometricEntries();
  const [profile,     setProfile]     = useState<ProfileData>({ goal_weight_kg: null, height_cm: null, sex: null });
  const [showCheckin, setShowCheckin] = useState(false);
  const [logDate,     setLogDate]     = useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('goal_weight_kg, height_cm, sex')
        .eq('id', user.id)
        .single();
      if (data) {
        setProfile({
          goal_weight_kg: data.goal_weight_kg ? Number(data.goal_weight_kg) : null,
          height_cm:      data.height_cm      ? Number(data.height_cm)      : null,
          sex:            (data.sex as 'male' | 'female' | null) ?? null,
        });
      }
    })();
  }, []);

  const goalWeight  = profile.goal_weight_kg;
  const latest      = entries[0] ?? null;
  const prev        = entries[1] ?? null;

  const currentWeight = latest?.weight_kg ?? null;
  const currentBf     = latest?.body_fat_pct ?? null;
  const currentLean   = currentWeight != null && currentBf != null
    ? currentWeight * (1 - currentBf / 100)
    : null;

  const deltaWeight = currentWeight != null && prev?.weight_kg != null
    ? currentWeight - prev.weight_kg
    : null;
  const deltaBf = currentBf != null && prev?.body_fat_pct != null
    ? currentBf - prev.body_fat_pct
    : null;
  const prevLean = prev?.weight_kg != null && prev.body_fat_pct != null
    ? prev.weight_kg * (1 - prev.body_fat_pct / 100)
    : null;
  const deltaLean = currentLean != null && prevLean != null ? currentLean - prevLean : null;

  // Fix 1: ETA projection (needs ascending order)
  const ascEntries = useMemo(() => [...entries].reverse(), [entries]);
  const goalEtaDate = goalWeight != null ? projectGoalDate(ascEntries, goalWeight) : null;

  function DeltaBadge({ delta, unit = 'kg', higherBad = false }: { delta: number | null; unit?: string; higherBad?: boolean }) {
    if (delta == null) return null;
    const up    = delta > 0;
    const good  = higherBad ? !up : up;
    const color = Math.abs(delta) < 0.05 ? COLORS.text500 : good ? COLORS.green400 : COLORS.red400;
    return <Text style={[s.delta, { color }]}>{up ? '↑' : '↓'} {fmt1(Math.abs(delta))} {unit}</Text>;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.loadingWrap}><ActivityIndicator color={COLORS.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SPACING.xs }}>
            <Text style={s.titleGray}>Biometric</Text>
            <Text style={s.titleOrange}>Vault</Text>
          </View>
          <View style={s.headerRow}>
            <Text style={s.subtitle}>
              {entries.length} weigh-ins{goalWeight ? ` · Goal ${fmt1(goalWeight)} kg` : ''}
            </Text>
            <TouchableOpacity style={s.checkinBtn} onPress={() => setShowCheckin(true)}>
              <Text style={s.checkinBtnText}>Weekly Check-In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. HEADLINE STAT ROW (Fix 1: 4 stats) ──────────────────────────── */}
        <View style={s.statRow}>
          <View style={s.statCell}>
            <Text style={s.statLabel}>Weight</Text>
            <Text style={[s.statValue, { color: COLORS.orange300 }]}>
              {currentWeight != null ? fmt1(currentWeight) : '—'}<Text style={s.statUnit}> kg</Text>
            </Text>
            <DeltaBadge delta={deltaWeight} unit="kg" higherBad={goalWeight != null && currentWeight != null && goalWeight < currentWeight} />
          </View>
          <View style={[s.statCell, s.statCellBorder]}>
            <Text style={s.statLabel}>Body Fat</Text>
            <Text style={s.statValue}>
              {currentBf != null ? fmt1(currentBf) : '—'}<Text style={s.statUnit}>%</Text>
            </Text>
            <DeltaBadge delta={deltaBf} unit="%" higherBad />
          </View>
          <View style={[s.statCell, s.statCellBorder]}>
            <Text style={s.statLabel}>Lean Mass</Text>
            <Text style={s.statValue}>
              {currentLean != null ? fmt1(currentLean) : '—'}<Text style={s.statUnit}> kg</Text>
            </Text>
            <DeltaBadge delta={deltaLean} unit="kg" />
          </View>
          <View style={[s.statCell, s.statCellBorder]}>
            <Text style={s.statLabel}>Goal ETA</Text>
            <Text style={[s.statValue, s.statValueSm, { color: goalEtaDate ? COLORS.orange300 : COLORS.text600 }]}>
              {goalEtaDate ? fmtDate(goalEtaDate) : '—'}
            </Text>
            {goalWeight && <Text style={s.delta}>→ {fmt1(goalWeight)} kg</Text>}
          </View>
        </View>

        {/* Fix 1: Projection headline */}
        {goalEtaDate && (
          <View style={s.projectionBar}>
            <Text style={s.projectionText}>
              At current rate → goal on {fmtDateLong(goalEtaDate)}
            </Text>
          </View>
        )}

        {/* ── 3. CHECK-IN CALENDAR (Fix 3: tappable days) ──────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Check-in Calendar</Text>
            <Text style={s.cardTag}>Consistency</Text>
          </View>
          <CalendarSection entries={entries} onDayPress={date => setLogDate(date)} />
          <Text style={s.calHint}>Tap any day to log or update your weight.</Text>
        </View>

        {/* ── 4. WEIGHT TREND CHART ─────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Weight Timeline</Text>
            <Text style={s.cardTag}>Tap to inspect</Text>
          </View>
          <WeightChart entries={entries} goal={goalWeight} />
        </View>

        {/* ── 5. BODY COMPOSITION ───────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Body Composition</Text>
            <Text style={s.cardTag}>Lean vs Fat</Text>
          </View>
          <BodyCompositionPanel entries={entries} />
        </View>

        {/* ── 6. GOAL PROGRESS ──────────────────────────────────────────────── */}
        {goalWeight && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Goal Progress</Text>
              <Text style={[s.cardTag, { color: COLORS.orange400 }]}>→ {fmt1(goalWeight)} kg</Text>
            </View>
            <GoalProgress entries={entries} goalWeight={goalWeight} />
          </View>
        )}

        {/* ── 7. DERIVED METRICS (Fix 4) ────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Analytics</Text>
            <Text style={s.cardTag}>OLS regression</Text>
          </View>
          <DerivedCard entries={entries} goalWeight={goalWeight} />
        </View>

        {/* ── 8. VISUAL PROGRESS ────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Visual Progress</Text>
            <Text style={s.cardTag}>Private · encrypted</Text>
          </View>
          <VisualProgressSection entries={entries} />
        </View>

        {/* ── 10. HISTORY TABLE ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>History</Text>
            <Text style={s.cardTag}>{entries.length} entries</Text>
          </View>
          <BiometricHistoryTable entries={entries} />
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Vault v0.7 · OLS regression · 7d MA · US Navy BF formula</Text>
        </View>

      </ScrollView>

      <WeeklyCheckinModal visible={showCheckin} onClose={() => setShowCheckin(false)} />
      <LogDaySheet date={logDate} onClose={() => setLogDate(null)} entries={entries} profile={profile} />
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: COLORS.bg },
  scroll:          { flex: 1 },
  content:         { paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  loadingWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:          { paddingTop: SPACING.lg, paddingBottom: SPACING.xl, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.xl },
  titleGray:       { fontFamily: FONTS.anton, fontSize: 38, color: COLORS.text100, textTransform: 'uppercase', letterSpacing: 0.5 },
  titleOrange:     { fontFamily: FONTS.anton, fontSize: 38, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
  subtitle:        { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  checkinBtn:      { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  checkinBtnText:  { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.orange300, textTransform: 'uppercase', letterSpacing: 1 },
  calHint:         { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.sm },

  statRow:         { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, marginBottom: SPACING.xs },
  statCell:        { flex: 1, paddingHorizontal: SPACING.xs, paddingVertical: SPACING.md },
  statCellBorder:  { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  statLabel:       { fontFamily: FONTS.mono, fontSize: 7, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  statValue:       { fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, lineHeight: 22 },
  statValueSm:     { fontSize: 14, lineHeight: 18 },
  statUnit:        { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text500 },
  delta:           { fontFamily: FONTS.mono, fontSize: 8, marginTop: 2, color: COLORS.text600 },

  projectionBar:   { backgroundColor: COLORS.accentMuted, borderWidth: 1, borderColor: COLORS.accentBorder, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.lg },
  projectionText:  { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange300, textTransform: 'uppercase', letterSpacing: 1 },

  card:            { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, padding: SPACING.lg, marginBottom: SPACING.lg },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACING.lg },
  cardTitle:       { fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, textTransform: 'uppercase' },
  cardTag:         { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.2 },

  footer:          { paddingTop: SPACING.xl, borderTopWidth: 1, borderTopColor: COLORS.border },
  footerText:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1 },
});
