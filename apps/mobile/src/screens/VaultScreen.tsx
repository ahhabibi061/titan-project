import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Dimensions, Alert, Modal, Image, ActivityIndicator, KeyboardAvoidingView,
  Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import {
  useBiometricEntries,
  useLogWeight,
  useDeleteEntry,
  useProgressPhotos,
  useUploadPhoto,
  type BiometricEntry,
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

// ── FORMATTERS ────────────────────────────────────────────────────────────────

const fmt1     = (n: number) => Number(n).toFixed(1);
const fmtDate  = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDateLong = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── TIME RANGE FILTER ─────────────────────────────────────────────────────────

type TimeRange = '2W' | '1M' | '3M' | 'ALL';

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
  const [range, setRange]           = useState<TimeRange>('1M');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const filtered = filterByRange([...entries].reverse(), range); // chronological
  const weights  = filtered.map(e => e.weight_kg);
  const ma       = movingAverage(weights);
  const reg      = linearRegression(weights);

  const CHART_W  = SW - 32 * 2;          // screen padding * 2
  const CHART_H  = 180;
  const PAD      = { t: 16, r: 12, b: 32, l: 44 };
  const iW       = CHART_W - PAD.l - PAD.r;
  const iH       = CHART_H - PAD.t - PAD.b;

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

  // y-axis ticks
  const tickStep = 2;
  const yTicks: number[] = [];
  for (let v = Math.ceil(minW / tickStep) * tickStep; v <= maxW; v += tickStep) yTicks.push(v);

  // x-axis ticks: first of each month
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
      {/* TIME RANGE TOGGLES */}
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

      {/* CHART */}
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

            {/* grid lines */}
            {yTicks.map(v => (
              <React.Fragment key={v}>
                <Line x1={PAD.l} x2={PAD.l + iW} y1={py(v)} y2={py(v)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                <SvgText x={PAD.l - 6} y={py(v) + 3} fontSize={9} fill="#57534e" textAnchor="end" fontFamily={FONTS.mono}>{v}</SvgText>
              </React.Fragment>
            ))}

            {/* x ticks */}
            {xTicks.map(({ dateStr, i }) => (
              <SvgText key={i} x={px(i)} y={PAD.t + iH + 18} fontSize={8} fill="#57534e" textAnchor="middle" fontFamily={FONTS.mono}>
                {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </SvgText>
            ))}

            {/* goal line */}
            {goal != null && (
              <>
                <Line x1={PAD.l} x2={PAD.l + iW} y1={py(goal)} y2={py(goal)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 4" />
                <SvgText x={PAD.l + iW - 2} y={py(goal) - 4} fontSize={8} fill="#f59e0b" textAnchor="end" fontFamily={FONTS.mono}>
                  {`GOAL · ${fmt1(goal)}kg`}
                </SvgText>
              </>
            )}

            {/* MA fill */}
            {maFill ? <Path d={maFill} fill="url(#maFillVault)" /> : null}

            {/* raw data points */}
            {weights.map((w, i) => (
              <Circle key={i} cx={px(i)} cy={py(w)} r={1.4} fill="#888" opacity={0.4} />
            ))}

            {/* MA line */}
            <Path d={maPath} fill="none" stroke="#ed7a2a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

            {/* regression line */}
            {regPath ? <Path d={regPath} fill="none" stroke="#a8a29e" strokeWidth={1.2} strokeDasharray="5 4" opacity={0.6} /> : null}

            {/* selected point crosshair */}
            {sel != null && selectedIdx != null && (
              <>
                <Line x1={px(selectedIdx)} x2={px(selectedIdx)} y1={PAD.t} y2={PAD.t + iH} stroke="#ed7a2a" strokeWidth={1} opacity={0.4} />
                <Circle cx={px(selectedIdx)} cy={py(sel.entry.weight_kg)} r={5} fill="#ff5a2a" stroke="#0a0908" strokeWidth={2} />
              </>
            )}

            {/* latest dot */}
            {points.length > 0 && (
              <Circle cx={px(points.length - 1)} cy={py(weights[weights.length - 1])} r={4} fill="#ed7a2a" stroke="#0a0908" strokeWidth={2} />
            )}
          </Svg>
        </Pressable>
      )}

      {/* TOOLTIP */}
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

      {/* LEGEND + SLOPE */}
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
  toggleRow:       { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  toggleBtn:       { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  toggleBtnActive: { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  toggleText:      { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  toggleTextActive:{ color: COLORS.orange300 },
  empty:           { height: 100, alignItems: 'center', justifyContent: 'center' },
  emptyText:       { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
  tooltip:         { borderWidth: 1, borderColor: 'rgba(237,122,42,0.4)', backgroundColor: COLORS.bgCard, padding: SPACING.md, marginTop: SPACING.sm, alignSelf: 'flex-start' },
  tooltipDate:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  tooltipWeight:   { fontFamily: FONTS.anton, fontSize: 28, color: COLORS.orange300, lineHeight: 34 },
  tooltipUnit:     { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text500 },
  tooltipMa:       { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, marginTop: 2 },
  tooltipTrend:    { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 },
  legendRow:       { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:       { width: 6, height: 6 },
  legendLine:      { width: 14, height: 2 },
  legendLabel:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
});

// ── BODY COMPOSITION PANEL ────────────────────────────────────────────────────

function BodyCompositionPanel({ entries }: { entries: BiometricEntry[] }) {
  const withFat = entries.filter(e => e.body_fat_pct != null);
  if (withFat.length < 1) {
    return (
      <View style={bc.empty}>
        <Text style={bc.emptyText}>Log body fat % with a weigh-in to unlock composition tracking</Text>
      </View>
    );
  }
  // entries are desc, so first = latest, last = oldest with fat
  const latest  = withFat[0];
  const oldest  = withFat[withFat.length - 1];
  const latFat  = latest.weight_kg * ((latest.body_fat_pct ?? 0) / 100);
  const latLean = latest.weight_kg - latFat;
  const oldFat  = oldest.weight_kg * ((oldest.body_fat_pct ?? 0) / 100);
  const oldLean = oldest.weight_kg - oldFat;
  const maxW    = Math.max(latest.weight_kg, oldest.weight_kg);
  const fatDelta  = oldFat  - latFat;
  const leanDelta = oldLean - latLean;

  const BAR_MAX = SW - 32 - 32; // screen pad + card pad

  function Bar({ lean, fat, total, label, date }: { lean: number; fat: number; total: number; label: string; date: string }) {
    const barW = BAR_MAX * (total / maxW);
    return (
      <View style={{ marginBottom: SPACING.md }}>
        <View style={[bc.barHeaderRow]}>
          <Text style={bc.barLabel}>{label}</Text>
          <Text style={bc.barDate}>{date}</Text>
        </View>
        <View style={{ flexDirection: 'row', width: barW, height: 28 }}>
          <View style={[bc.leanBar, { flex: lean / total }]}>
            <Text style={bc.barText}>{fmt1(lean)}kg</Text>
          </View>
          <View style={[bc.fatBar, { flex: fat / total }]}>
            <Text style={bc.barText}>{fmt1(fat)}kg</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Bar lean={latLean} fat={latFat} total={latest.weight_kg} label="Latest"      date={fmtDate(latest.logged_at)} />
      {withFat.length >= 2 && (
        <Bar lean={oldLean} fat={oldFat} total={oldest.weight_kg} label="First entry" date={fmtDate(oldest.logged_at)} />
      )}
      {withFat.length >= 2 && (
        <View style={bc.deltaRow}>
          <View>
            <Text style={bc.deltaLabel}>Fat change</Text>
            <Text style={[bc.deltaValue, { color: COLORS.orange400 }]}>
              {fatDelta >= 0 ? '−' : '+'}{fmt1(Math.abs(fatDelta))}<Text style={bc.deltaUnit}>kg</Text>
            </Text>
          </View>
          <View>
            <Text style={bc.deltaLabel}>Lean change</Text>
            <Text style={[bc.deltaValue, { color: leanDelta > 0.5 ? COLORS.red400 : COLORS.text300 }]}>
              {leanDelta > 0 ? '−' : '+'}{fmt1(Math.abs(leanDelta))}<Text style={bc.deltaUnit}>kg</Text>
            </Text>
          </View>
        </View>
      )}
      <View style={bc.legendRow}>
        <View style={bc.legendItem}><View style={[bc.legendSwatch, { backgroundColor: '#a8a29e' }]} /><Text style={bc.legendText}>Lean</Text></View>
        <View style={bc.legendItem}><View style={[bc.legendSwatch, { backgroundColor: COLORS.orange500 }]} /><Text style={bc.legendText}>Fat</Text></View>
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  empty:        { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText:    { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  barHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabel:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5 },
  barDate:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600 },
  leanBar:      { backgroundColor: '#a8a29e', alignItems: 'flex-end', justifyContent: 'center', paddingRight: 5 },
  fatBar:       { backgroundColor: COLORS.orange500, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 5 },
  barText:      { fontFamily: FONTS.mono, fontSize: 9, color: '#1c1917', fontWeight: '500' },
  deltaRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.md },
  deltaLabel:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  deltaValue:   { fontFamily: FONTS.anton, fontSize: 26, lineHeight: 32 },
  deltaUnit:    { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text500 },
  legendRow:    { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.md },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 12 },
  legendText:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
});

// ── GOAL PROGRESS ─────────────────────────────────────────────────────────────

function GoalProgress({ entries, goalWeight }: { entries: BiometricEntry[]; goalWeight: number | null }) {
  if (!goalWeight || entries.length === 0) return null;

  const current = entries[0].weight_kg;
  const reversed = [...entries].reverse();
  const startWeight = reversed[0].weight_kg;

  // Progress: how far from start toward goal
  const totalDelta = goalWeight - startWeight;
  const currentDelta = current - startWeight;
  const progress = totalDelta === 0 ? 1 : Math.max(0, Math.min(1, currentDelta / totalDelta));

  const remaining = Math.abs(current - goalWeight);
  const reg = linearRegression(reversed.map(e => e.weight_kg));
  const slopePerWeek = reg.slope * 7;
  const weeksEta = slopePerWeek !== 0 ? Math.abs((current - goalWeight) / slopePerWeek) : null;

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

// ── LOG WEIGHT CARD ───────────────────────────────────────────────────────────

function LogWeightCard({ entries }: { entries: BiometricEntry[] }) {
  const { logWeight, isLoading } = useLogWeight();
  const today     = todayISO();
  const todayEntry = entries.find(e => e.logged_at === today);
  const [editing, setEditing]   = useState(false);
  const [weight, setWeight]     = useState('');
  const [bf, setBf]             = useState('');
  const [error, setError]       = useState('');

  const showForm = !todayEntry || editing;

  async function handleLog() {
    const w = parseFloat(weight);
    if (!w || w < 30 || w > 300) { setError('Enter a weight between 30–300 kg'); return; }
    try {
      await logWeight({ date: today, weight_kg: w, body_fat_pct: bf !== '' ? parseFloat(bf) : undefined });
      setEditing(false);
      setWeight('');
      setBf('');
      setError('');
    } catch (e: any) {
      setError(e.message ?? 'Failed to log weight');
    }
  }

  if (!showForm) {
    return (
      <View style={lw.loggedRow}>
        <View>
          <Text style={lw.loggedLabel}>Logged today</Text>
          <Text style={lw.loggedValue}>
            {fmt1(todayEntry!.weight_kg)}<Text style={lw.loggedUnit}> kg</Text>
            {todayEntry!.body_fat_pct != null && <Text style={lw.loggedBf}>  {fmt1(todayEntry!.body_fat_pct)}% bf</Text>}
          </Text>
        </View>
        <TouchableOpacity style={lw.editBtn} onPress={() => {
          setWeight(String(todayEntry!.weight_kg));
          setBf(todayEntry!.body_fat_pct != null ? String(todayEntry!.body_fat_pct) : '');
          setEditing(true);
        }}>
          <Text style={lw.editBtnText}>✎ Edit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={lw.label}><Text style={lw.inputLabel}>Weight (kg)</Text></View>
      <TextInput
        style={lw.weightInput}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder="84.0"
        placeholderTextColor={COLORS.text700}
        returnKeyType="done"
      />
      <View style={lw.label}><Text style={lw.inputLabel}>Body fat % <Text style={{ color: COLORS.text700 }}>(optional)</Text></Text></View>
      <TextInput
        style={lw.bfInput}
        value={bf}
        onChangeText={setBf}
        keyboardType="decimal-pad"
        placeholder="18.5"
        placeholderTextColor={COLORS.text700}
        returnKeyType="done"
      />
      {error !== '' && <Text style={lw.error}>{error}</Text>}
      <View style={lw.btnRow}>
        {editing && (
          <TouchableOpacity style={lw.cancelBtn} onPress={() => { setEditing(false); setError(''); }}>
            <Text style={lw.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[lw.logBtn, isLoading && { opacity: 0.5 }]} onPress={handleLog} disabled={isLoading}>
          <Text style={lw.logBtnText}>{isLoading ? 'Saving…' : todayEntry ? 'Update' : 'Log Weight'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const lw = StyleSheet.create({
  loggedRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loggedLabel:  { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  loggedValue:  { fontFamily: FONTS.anton, fontSize: 36, color: COLORS.text100, lineHeight: 44 },
  loggedUnit:   { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text500 },
  loggedBf:     { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text400 },
  editBtn:      { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  editBtnText:  { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text400, textTransform: 'uppercase', letterSpacing: 1 },
  label:        { marginBottom: 5 },
  inputLabel:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5 },
  weightInput:  { fontFamily: FONTS.anton, fontSize: 36, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,11,10,0.6)', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, marginBottom: SPACING.md },
  bfInput:      { fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text100, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,11,10,0.6)', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, marginBottom: SPACING.md },
  error:        { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.red400, marginBottom: SPACING.sm },
  btnRow:       { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn:    { flex: 1, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelText:   { fontFamily: FONTS.anton, fontSize: 14, color: COLORS.text400, textTransform: 'uppercase', letterSpacing: 1 },
  logBtn:       { flex: 1, paddingVertical: SPACING.md, backgroundColor: COLORS.accent, alignItems: 'center' },
  logBtnText:   { fontFamily: FONTS.anton, fontSize: 16, color: COLORS.bg, textTransform: 'uppercase', letterSpacing: 1 },
});

// ── PROGRESS PHOTOS ───────────────────────────────────────────────────────────

const ANGLES = ['front', 'back', 'side-left', 'side-right'] as const;
type Angle = typeof ANGLES[number];

function ProgressPhotosSection() {
  const { data: photos = [], isLoading } = useProgressPhotos();
  const { uploadPhoto, isLoading: uploading } = useUploadPhoto();
  const [selectedAngle, setSelectedAngle]   = useState<Angle>('front');
  const [showAnglePicker, setShowAnglePicker] = useState(false);
  const [viewingPhoto, setViewingPhoto]      = useState<typeof photos[0] | null>(null);

  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required', 'Please allow photo library access in settings.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality:    0.8,
      base64:     true,
    });
    if (result.canceled || !result.assets[0].base64) return;

    const today = todayISO();
    try {
      await uploadPhoto({ base64: result.assets[0].base64, angle: selectedAngle, date: today });
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload photo');
    }
    setShowAnglePicker(false);
  }

  return (
    <View>
      {/* ANGLE SELECTOR + UPLOAD BUTTON */}
      <View style={pp.controlRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
            {ANGLES.map(a => (
              <TouchableOpacity
                key={a}
                style={[pp.angleBtn, selectedAngle === a && pp.angleBtnActive]}
                onPress={() => setSelectedAngle(a)}
              >
                <Text style={[pp.angleText, selectedAngle === a && pp.angleTextActive]}>
                  {a.replace('-', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TouchableOpacity
          style={[pp.uploadBtn, uploading && { opacity: 0.5 }]}
          onPress={pickAndUpload}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator size="small" color={COLORS.bg} />
            : <Text style={pp.uploadBtnText}>+ Upload</Text>
          }
        </TouchableOpacity>
      </View>

      {/* PHOTO GRID */}
      {isLoading ? (
        <View style={pp.loading}><ActivityIndicator color={COLORS.accent} /></View>
      ) : photos.length === 0 ? (
        <View style={pp.empty}>
          <Text style={pp.emptyText}>No photos yet — upload your first check-in photo</Text>
        </View>
      ) : (
        <View style={pp.grid}>
          {photos.map(photo => (
            <TouchableOpacity key={photo.id} style={pp.photoCell} onPress={() => setViewingPhoto(photo)}>
              {photo.signedUrl ? (
                <Image source={{ uri: photo.signedUrl }} style={pp.photoThumb} />
              ) : (
                <View style={[pp.photoThumb, pp.photoPlaceholder]} />
              )}
              <View style={pp.photoMeta}>
                <Text style={pp.photoDate}>{fmtDate(photo.taken_at)}</Text>
                <Text style={pp.photoAngle}>{photo.angle.replace('-', ' ').toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={pp.hint}>jpg · png · signed URLs expire 1hr</Text>

      {/* FULL-SCREEN PHOTO MODAL */}
      <Modal visible={viewingPhoto !== null} transparent animationType="fade" onRequestClose={() => setViewingPhoto(null)}>
        <View style={pp.modalBg}>
          <TouchableOpacity style={pp.modalClose} onPress={() => setViewingPhoto(null)}>
            <Text style={pp.modalCloseText}>✕</Text>
          </TouchableOpacity>
          {viewingPhoto?.signedUrl && (
            <Image source={{ uri: viewingPhoto.signedUrl }} style={pp.modalImage} resizeMode="contain" />
          )}
          <View style={pp.modalMeta}>
            <Text style={pp.modalDate}>{viewingPhoto ? fmtDateLong(viewingPhoto.taken_at) : ''}</Text>
            <Text style={pp.modalAngle}>{viewingPhoto?.angle.replace('-', ' ').toUpperCase()}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CELL_W = (SW - 32 - 32 - SPACING.sm) / 2; // 2 columns, account for padding + gap

const pp = StyleSheet.create({
  controlRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  angleBtn:       { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  angleBtnActive: { borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted },
  angleText:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  angleTextActive:{ color: COLORS.orange300 },
  uploadBtn:      { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.accent, flexShrink: 0 },
  uploadBtnText:  { fontFamily: FONTS.anton, fontSize: 14, color: COLORS.bg, textTransform: 'uppercase' },
  loading:        { paddingVertical: SPACING.xl, alignItems: 'center' },
  empty:          { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText:      { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  photoCell:      { width: CELL_W },
  photoThumb:     { width: CELL_W, height: CELL_W * 1.35, backgroundColor: '#1c1917' },
  photoPlaceholder:{ backgroundColor: '#292524' },
  photoMeta:      { paddingVertical: SPACING.xs, paddingHorizontal: 2, flexDirection: 'row', justifyContent: 'space-between' },
  photoDate:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500 },
  photoAngle:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
  hint:           { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1 },
  modalBg:        { flex: 1, backgroundColor: 'rgba(10,9,8,0.97)', alignItems: 'center', justifyContent: 'center' },
  modalClose:     { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: SPACING.md },
  modalCloseText: { fontFamily: FONTS.mono, fontSize: 20, color: COLORS.text400 },
  modalImage:     { width: SW, height: SW * 1.35 },
  modalMeta:      { position: 'absolute', bottom: 60, left: 20, right: 20 },
  modalDate:      { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  modalAngle:     { fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, textTransform: 'uppercase' },
});

// ── BIOMETRIC HISTORY TABLE ───────────────────────────────────────────────────

function HistoryRow({ entry, isLast }: { entry: BiometricEntry; isLast: boolean }) {
  const { deleteEntry } = useDeleteEntry();
  const swipeRef = useRef<Swipeable>(null);

  const fat   = entry.body_fat_pct;
  const lean  = fat != null ? (entry.weight_kg * (1 - fat / 100)) : null;

  function renderRightActions() {
    return (
      <TouchableOpacity
        style={ht.deleteAction}
        onPress={() => {
          Alert.alert(
            'Delete entry',
            `Remove ${fmt1(entry.weight_kg)} kg on ${fmtDate(entry.logged_at)}?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => swipeRef.current?.close() },
              { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(entry.id) },
            ]
          );
        }}
      >
        <Text style={ht.deleteText}>Delete</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <View style={[ht.row, isLast && { borderBottomWidth: 0 }]}>
        <Text style={[ht.cell, ht.dateCell]}>{fmtDate(entry.logged_at)}</Text>
        <Text style={[ht.cell, ht.weightCell]}>{fmt1(entry.weight_kg)}</Text>
        <Text style={[ht.cell, ht.bfCell]}>{fat != null ? fmt1(fat) + '%' : '—'}</Text>
        <Text style={[ht.cell, ht.leanCell]}>{lean != null ? fmt1(lean) : '—'}</Text>
      </View>
    </Swipeable>
  );
}

function BiometricHistoryTable({ entries }: { entries: BiometricEntry[] }) {
  if (entries.length === 0) {
    return (
      <View style={ht.empty}>
        <Text style={ht.emptyText}>No entries yet</Text>
      </View>
    );
  }
  // compute delta vs previous entry (entries are desc, so next = older)
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
      <Text style={ht.hint}>Swipe left on a row to delete</Text>
    </View>
  );
}

const ht = StyleSheet.create({
  header:       { flexDirection: 'row', paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.xs },
  headerCell:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5 },
  row:          { flexDirection: 'row', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: COLORS.bg },
  cell:         { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text300 },
  dateCell:     { flex: 2.5 },
  weightCell:   { flex: 1.5, textAlign: 'right' as any },
  bfCell:       { flex: 1.2, textAlign: 'right' as any },
  leanCell:     { flex: 1.5, textAlign: 'right' as any },
  deleteAction: { backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', width: 80 },
  deleteText:   { fontFamily: FONTS.mono, fontSize: 11, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  empty:        { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText:    { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
  hint:         { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.md },
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────

export default function VaultScreen() {
  const { data: entries = [], isLoading } = useBiometricEntries();
  const [goalWeight, setGoalWeight]       = useState<number | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('goal_weight_kg')
        .eq('id', user.id)
        .single();
      if (data?.goal_weight_kg) setGoalWeight(Number(data.goal_weight_kg));
    })();
  }, []);

  const latest = entries[0] ?? null;
  const prev   = entries[1] ?? null;

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
        <View style={s.loadingWrap}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── 1. HEADER ────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SPACING.xs }}>
              <Text style={s.titleGray}>Biometric</Text>
              <Text style={s.titleOrange}>Vault</Text>
            </View>
            <Text style={s.subtitle}>
              {entries.length} weigh-ins{goalWeight ? ` · Goal ${fmt1(goalWeight)} kg` : ''}
            </Text>
          </View>
        </View>

        {/* ── 2. HEADLINE STAT ROW ─────────────────────────────────────── */}
        <View style={s.statRow}>
          <View style={s.statCell}>
            <Text style={s.statLabel}>Current Weight</Text>
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
        </View>

        {/* ── 3. WEIGHT TREND CHART ────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Weight Timeline</Text>
            <Text style={s.cardTag}>Tap to inspect</Text>
          </View>
          <WeightChart entries={entries} goal={goalWeight} />
        </View>

        {/* ── 4. BODY COMPOSITION PANEL ────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Body Composition</Text>
            <Text style={s.cardTag}>Lean vs Fat</Text>
          </View>
          <BodyCompositionPanel entries={entries} />
        </View>

        {/* ── 5. GOAL PROGRESS ─────────────────────────────────────────── */}
        {goalWeight && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Goal Progress</Text>
              <Text style={[s.cardTag, { color: COLORS.orange400 }]}>→ {fmt1(goalWeight)} kg</Text>
            </View>
            <GoalProgress entries={entries} goalWeight={goalWeight} />
          </View>
        )}

        {/* ── 6. LOG WEIGHT CARD ───────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{entries.find(e => e.logged_at === todayISO()) ? 'Today\'s Log ✓' : 'Log Today'}</Text>
            <Text style={s.cardTag}>{entries.find(e => e.logged_at === todayISO()) ? 'Logged' : 'Daily weigh-in'}</Text>
          </View>
          <LogWeightCard entries={entries} />
        </View>

        {/* ── 7. PROGRESS PHOTOS ───────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Visual Progress</Text>
            <Text style={s.cardTag}>Private · encrypted at rest</Text>
          </View>
          <ProgressPhotosSection />
        </View>

        {/* ── 8. BIOMETRIC HISTORY TABLE ───────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>History</Text>
            <Text style={s.cardTag}>{entries.length} entries</Text>
          </View>
          <BiometricHistoryTable entries={entries} />
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Vault v0.5 · Regression: ordinary least squares · MA window 7d</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bg },
  scroll:       { flex: 1 },
  content:      { paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header:       { paddingTop: SPACING.lg, paddingBottom: SPACING.xl, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.xl },
  titleGray:    { fontFamily: FONTS.anton, fontSize: 38, color: COLORS.text100, textTransform: 'uppercase', letterSpacing: 0.5 },
  titleOrange:  { fontFamily: FONTS.anton, fontSize: 38, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
  subtitle:     { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },

  // Stat row
  statRow:      { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, marginBottom: SPACING.lg },
  statCell:     { flex: 1, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.md },
  statCellBorder:{ borderLeftWidth: 1, borderLeftColor: COLORS.border },
  statLabel:    { fontFamily: FONTS.mono, fontSize: 7, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 3 },
  statValue:    { fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, lineHeight: 25 },
  statUnit:     { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500 },
  delta:        { fontFamily: FONTS.mono, fontSize: 9, marginTop: 2 },

  // Card
  card:         { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, padding: SPACING.lg, marginBottom: SPACING.lg },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACING.lg },
  cardTitle:    { fontFamily: FONTS.anton, fontSize: 22, color: COLORS.text100, textTransform: 'uppercase' },
  cardTag:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.2 },

  // Footer
  footer:       { paddingTop: SPACING.xl, borderTopWidth: 1, borderTopColor: COLORS.border },
  footerText:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1 },
});
