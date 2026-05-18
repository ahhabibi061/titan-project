import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, FlatList, Keyboard, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '../constants/theme';
import {
  useDailyNutrition, useLogMeal, useDeleteMeal,
  useWaterLog, useLogWater, useDeleteWater, useScanMeal, useFoodSearch,
  useMostLoggedFoods, searchFoodHistory, useTodayCaloriesBurned, useLoggedDates,
  useMealTemplates, useSaveTemplate, useDeleteTemplate, useLogTemplate,
  FoodResult, ScanResult, NutritionLog, MostLoggedFood, MealTemplate, TemplateItem,
} from '../hooks/useNutrition';
import { useProfile, useUpdateProfile } from '../hooks/useSettings';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Constants ──────────────────────────────────────────────────────────────

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
type MealType = typeof MEAL_TYPES[number];

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: '#fbbf24',
  lunch:     '#ed7a2a',
  dinner:    '#f87171',
  snacks:    '#a78bfa',
};

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '☀',
  lunch:     '⚡',
  dinner:    '●',
  snacks:    '◆',
};

const GOAL_LABELS: Record<string, string> = {
  cut:      'CUT',
  bulk:     'BULK',
  recomp:   'RECOMP',
  maintain: 'MAINTAIN',
};

const WATER_QUICK = [250, 500, 750, 1000];
const WATER_TARGET_ML = 2500;
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

// ── Date helpers ───────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const today = toLocalDateStr(new Date());
  const yesterday = toLocalDateStr(new Date(Date.now() - 86_400_000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildCalendarGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ── CrownIcon ──────────────────────────────────────────────────────────────

function CrownIcon({ size = 12, color = '#fbbf24' }: { size?: number; color?: string }) {
  const h = Math.round(size * 0.72);
  return (
    <Svg width={size} height={h} viewBox="0 0 20 14">
      <Path d="M1 13 L1 8 L5 12 L10 2 L15 12 L19 8 L19 13 Z" fill={color} />
    </Svg>
  );
}

// ── CalorieRing ────────────────────────────────────────────────────────────

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const r = 54;
  const cx = 68; const cy = 68;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const offset = circ * (1 - pct);
  const remaining = Math.max(target - consumed, 0);
  const over = consumed > target;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={136} height={136}>
        <G rotation="-90" origin={`${cx}, ${cy}`}>
          <Circle cx={cx} cy={cy} r={r} stroke="rgba(41,37,36,0.5)" strokeWidth={7} fill="none" />
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={over ? COLORS.accentHot : COLORS.accent}
            strokeWidth={7}
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: 136, height: 136, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 22, color: COLORS.text100, letterSpacing: -1 }}>
          {consumed}
        </Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, marginTop: 2 }}>
          / {target} KCAL
        </Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: over ? COLORS.red400 : COLORS.accent, marginTop: 4 }}>
          {over ? `+${consumed - target} over` : `${remaining} left`}
        </Text>
      </View>
    </View>
  );
}

// ── MacroBar ───────────────────────────────────────────────────────────────

function MacroBar({ label, consumed, target, color }: {
  label: string; consumed: number; target: number; color: string;
}) {
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text500, letterSpacing: 1 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text400 }}>
          {consumed}g / {target}g
        </Text>
      </View>
      <View style={{ height: 4, backgroundColor: 'rgba(41,37,36,0.5)', borderRadius: 2 }}>
        <View style={{ height: 4, width: `${pct * 100}%` as any, backgroundColor: color, borderRadius: 2 }} />
      </View>
    </View>
  );
}

// ── InfoPill ───────────────────────────────────────────────────────────────

function InfoPill({ label, color = COLORS.text600, bg = 'rgba(41,37,36,0.4)' }: {
  label: string; color?: string; bg?: string;
}) {
  return (
    <View style={{ backgroundColor: bg, borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 4 }}>
      <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

// ── ProLockedModal ─────────────────────────────────────────────────────────

function ProLockedModal({ visible, feature, onClose }: {
  visible: boolean; feature: string; onClose: () => void;
}) {
  const navigation = useNavigation<any>();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.proCard}>
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <CrownIcon size={36} color="#fbbf24" />
          </View>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: '#fbbf24', letterSpacing: 2, textAlign: 'center', marginBottom: 10 }}>
            PRO FEATURE
          </Text>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.text300, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
            {feature} is available on{'\n'}Pro and Elite plans.
          </Text>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: COLORS.accentMuted, borderColor: COLORS.accentBorder, alignSelf: 'stretch', alignItems: 'center', paddingVertical: 10, marginBottom: 8 }]}
            onPress={() => { onClose(); navigation.navigate('Settings'); }}
          >
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>
              VIEW PLANS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, letterSpacing: 1 }}>NOT NOW</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── CalendarModal ──────────────────────────────────────────────────────────

function CalendarModal({ visible, selectedDate, onSelect, onClose }: {
  visible: boolean;
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const today = toLocalDateStr(new Date());
  const initDate = new Date(selectedDate + 'T12:00:00');
  const [viewYear, setViewYear]   = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const { data: loggedDates }     = useLoggedDates(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const grid = buildCalendarGrid(viewYear, viewMonth);
  const cellW = Math.floor((SCREEN_W - 64) / 7);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text300, letterSpacing: 1, flex: 1 }}>CALENDAR</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text500 }}>✕ CLOSE</Text>
          </TouchableOpacity>
        </View>

        {/* Month nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 20, color: COLORS.text400 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text100, letterSpacing: 1 }}>
            {MONTH_NAMES[viewMonth].toUpperCase()} {viewYear}
          </Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 20, color: COLORS.text400 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day labels */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 6 }}>
          {DAY_LABELS.map(d => (
            <View key={d} style={{ width: cellW, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, letterSpacing: 1 }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        {grid.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 2 }}>
            {row.map((day, ci) => {
              if (day === null) return <View key={ci} style={{ width: cellW, height: 40 }} />;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDate;
              const isToday    = dateStr === today;
              const isFuture   = dateStr > today;
              const hasLog     = loggedDates?.has(dateStr) ?? false;

              return (
                <TouchableOpacity
                  key={ci}
                  style={{ width: cellW, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  disabled={isFuture}
                  onPress={() => { onSelect(dateStr); onClose(); }}
                >
                  <View style={[
                    { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
                    isSelected && { backgroundColor: COLORS.accent },
                    isToday && !isSelected && { borderWidth: 1, borderColor: COLORS.accent },
                  ]}>
                    <Text style={{
                      fontFamily: FONTS.mono,
                      fontSize:   12,
                      color:      isFuture ? COLORS.text700 : isSelected ? '#fff' : isToday ? COLORS.accent : COLORS.text300,
                    }}>
                      {day}
                    </Text>
                  </View>
                  {hasLog && !isSelected && (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.accent, marginTop: 1 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textAlign: 'center', marginTop: 16, letterSpacing: 1 }}>
          ● = FOOD LOGGED
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

// ── MacroEditModal ─────────────────────────────────────────────────────────

function MacroEditModal({ visible, current, onClose }: {
  visible: boolean;
  current: { kcal: number; protein: number; carbs: number; fat: number };
  onClose: () => void;
}) {
  const { updateProfile, isLoading } = useUpdateProfile();
  const [kcal, setKcal]       = useState(String(current.kcal));
  const [protein, setProtein] = useState(String(current.protein));
  const [carbs, setCarbs]     = useState(String(current.carbs));
  const [fat, setFat]         = useState(String(current.fat));

  useEffect(() => {
    if (visible) {
      setKcal(String(current.kcal));
      setProtein(String(current.protein));
      setCarbs(String(current.carbs));
      setFat(String(current.fat));
    }
  }, [visible]);

  async function save() {
    try {
      await updateProfile({
        current_macros: {
          kcal:    parseInt(kcal, 10)    || 0,
          protein: parseInt(protein, 10) || 0,
          carbs:   parseInt(carbs, 10)   || 0,
          fat:     parseInt(fat, 10)     || 0,
        },
      });
      onClose();
    } catch { Alert.alert('Error', 'Could not save macro targets.'); }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.proCard}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.accent, letterSpacing: 1, marginBottom: 14 }}>
            EDIT MACRO TARGETS
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>KCAL</Text>
              <TextInput style={s.input} value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholderTextColor={COLORS.text600} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'PROTEIN (g)', val: protein, set: setProtein },
              { label: 'CARBS (g)',   val: carbs,   set: setCarbs   },
              { label: 'FAT (g)',     val: fat,      set: setFat     },
            ].map(f => (
              <View key={f.label} style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <TextInput style={s.input} value={f.val} onChangeText={f.set} keyboardType="numeric" placeholderTextColor={COLORS.text600} />
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[s.addBtn, { alignSelf: 'stretch', alignItems: 'center', backgroundColor: COLORS.accentMuted, borderColor: COLORS.accentBorder, paddingVertical: 10, marginBottom: 8 }]}
            onPress={save}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator size="small" color={COLORS.accent} />
              : <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>SAVE TARGETS</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>CANCEL</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── MealItem ───────────────────────────────────────────────────────────────

function MealItem({ item, onDelete }: { item: NutritionLog; onDelete: (id: string) => void }) {
  return (
    <View style={s.mealItem}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.sansSB, fontSize: 13, color: COLORS.text300 }} numberOfLines={1}>
          {item.meal_name}
        </Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, marginTop: 2 }}>
          {item.kcal} kcal · P {item.protein_g}g · C {item.carbs_g}g · F {item.fat_g}g
        </Text>
      </View>
      <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text600 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── MealSection ────────────────────────────────────────────────────────────

function MealSection({ type, items, onAdd, onScan, onTemplates, onDelete, isPro }: {
  type: MealType;
  items: NutritionLog[];
  onAdd: () => void;
  onScan: () => void;
  onTemplates: () => void;
  onDelete: (id: string) => void;
  isPro: boolean;
}) {
  const color = MEAL_COLORS[type];
  const icon  = MEAL_ICONS[type];
  const kcal  = items.reduce((s, i) => s + (i.kcal ?? 0), 0);

  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ width: 3, height: 16, backgroundColor: color, marginRight: 8 }} />
        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color, letterSpacing: 1, textTransform: 'uppercase', flex: 1 }}>
          {icon}  {type}
        </Text>
        {kcal > 0 && (
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>{kcal} kcal</Text>
        )}
      </View>

      {items.map(item => (
        <MealItem key={item.id} item={item} onDelete={onDelete} />
      ))}

      {items.length === 0 && (
        <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.text600, marginBottom: 10 }}>
          Nothing logged yet
        </Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <TouchableOpacity style={s.addBtn} onPress={onAdd}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>
            + ADD FOOD
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.addBtn, { paddingHorizontal: 10 }]} onPress={onScan}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {!isPro && <CrownIcon size={9} color="#fbbf24" />}
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: isPro ? COLORS.text400 : COLORS.text600, letterSpacing: 1 }}>
              SCAN BARCODE
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[s.addBtn, { paddingHorizontal: 10 }]} onPress={onTemplates}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, letterSpacing: 1 }}>
            ⊞ TEMPLATES
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── WaterSection ───────────────────────────────────────────────────────────

function WaterSection({ date }: { date: string }) {
  const { data: waterDay }          = useWaterLog(date);
  const { logWater, isLoading }     = useLogWater();
  const { deleteWater }             = useDeleteWater();
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom]   = useState(false);

  const totalMl = waterDay?.total_ml ?? 0;
  const logs    = waterDay?.logs ?? [];
  const pct     = Math.min(totalMl / WATER_TARGET_ML, 1);

  async function add(ml: number) {
    if (!ml || ml <= 0) return;
    try { await logWater(ml); } catch { Alert.alert('Error', 'Could not log water.'); }
  }

  return (
    <View style={s.card}>
      <Text style={s.sectionLabel}>💧  WATER</Text>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 20, color: COLORS.text100, marginRight: 6 }}>
          {totalMl < 1000 ? `${totalMl}ml` : `${(totalMl / 1000).toFixed(1)}L`}
        </Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500 }}>
          / {WATER_TARGET_ML / 1000}L
        </Text>
      </View>

      <View style={{ height: 6, backgroundColor: 'rgba(41,37,36,0.5)', borderRadius: 3, marginBottom: 12 }}>
        <View style={{ height: 6, width: `${pct * 100}%` as any, backgroundColor: '#60a5fa', borderRadius: 3 }} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {WATER_QUICK.map(ml => (
          <TouchableOpacity key={ml} style={s.waterQuickBtn} onPress={() => add(ml)} disabled={isLoading}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text300 }}>
              {ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.waterQuickBtn, { paddingHorizontal: 10 }]} onPress={() => setShowCustom(v => !v)}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>custom</Text>
        </TouchableOpacity>
      </View>

      {showCustom && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="ml (e.g. 350)"
            placeholderTextColor={COLORS.text600}
            keyboardType="numeric"
            value={customInput}
            onChangeText={setCustomInput}
          />
          <TouchableOpacity
            style={[s.addBtn, { paddingHorizontal: 14 }]}
            onPress={() => {
              const ml = parseInt(customInput, 10);
              if (ml > 0) { add(ml); setCustomInput(''); setShowCustom(false); }
            }}
          >
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent }}>LOG</Text>
          </TouchableOpacity>
        </View>
      )}

      {logs.map(log => (
        <View key={log.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.3)' }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text400, flex: 1 }}>
            {log.amount_ml}ml · {new Date(log.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <TouchableOpacity onPress={() => deleteWater(log.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text700 }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ── FoodSearchModal ────────────────────────────────────────────────────────

function FoodSearchModal({ visible, mealType, onClose, onLog }: {
  visible: boolean;
  mealType: MealType;
  onClose: () => void;
  onLog: (entry: any) => Promise<void>;
}) {
  const [query, setQuery]             = useState('');
  const [committed, setCommitted]     = useState('');
  const [historyResults, setHistory]  = useState<MostLoggedFood[]>([]);
  const [selected, setSelected]       = useState<FoodResult | null>(null);
  const [serving, setServing]         = useState('100');
  const [logging, setLogging]         = useState(false);
  const [manual, setManual]           = useState(false);
  const [mName, setMName]             = useState('');
  const [mKcal, setMKcal]             = useState('');
  const [mP, setMP]                   = useState('');
  const [mC, setMC]                   = useState('');
  const [mF, setMF]                   = useState('');
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { data: mostLogged }          = useMostLoggedFoods();
  const { data: usdaResults, isFetching: fetchingUsda } = useFoodSearch(committed);

  // Debounce both USDA commit + history search together
  function handleQueryChange(text: string) {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCommitted(text);
      if (text.trim().length >= 2) {
        const hist = await searchFoodHistory(text).catch(() => []);
        setHistory(hist);
      } else {
        setHistory([]);
      }
    }, 500);
  }

  // Merged results: history first (deduped against USDA)
  const mergedResults = useMemo<FoodResult[]>(() => {
    const histItems: FoodResult[] = historyResults.map((h, i) => ({
      fdcId: -(i + 1),
      name:  h.name,
      kcal:  h.kcal,
      protein_g: h.protein_g,
      carbs_g:   h.carbs_g,
      fat_g:     h.fat_g,
      fromHistory: true,
      count: h.count,
    }));
    if (!usdaResults?.length) return histItems;
    const histNames = new Set(historyResults.map(h => h.name.toLowerCase()));
    const usdaFiltered = usdaResults.filter(u => !histNames.has(u.name.toLowerCase()));
    return [...histItems, ...usdaFiltered];
  }, [historyResults, usdaResults]);

  function reset() {
    setQuery(''); setCommitted(''); setHistory([]); setSelected(null); setServing('100');
    setManual(false); setMName(''); setMKcal(''); setMP(''); setMC(''); setMF('');
  }
  function close() { reset(); onClose(); }
  function scale(val: number) { return Math.round((val * (parseFloat(serving) || 100)) / 100); }

  async function confirmFood() {
    if (!selected) return;
    setLogging(true);
    try {
      await onLog({ meal_name: selected.name, kcal: scale(selected.kcal), protein_g: scale(selected.protein_g), carbs_g: scale(selected.carbs_g), fat_g: scale(selected.fat_g), meal_type: mealType });
      close();
    } catch { Alert.alert('Error', 'Could not log meal.'); }
    finally { setLogging(false); }
  }

  async function confirmManual() {
    if (!mName.trim() || !mKcal) return;
    setLogging(true);
    try {
      await onLog({ meal_name: mName.trim(), kcal: parseInt(mKcal, 10) || 0, protein_g: parseInt(mP, 10) || 0, carbs_g: parseInt(mC, 10) || 0, fat_g: parseInt(mF, 10) || 0, meal_type: mealType });
      close();
    } catch { Alert.alert('Error', 'Could not log meal.'); }
    finally { setLogging(false); }
  }

  const color = MEAL_COLORS[mealType];
  const showSuggestions = !committed && (mostLogged?.length ?? 0) > 0;
  const showResults     = committed.length >= 2 && !selected;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <View style={{ width: 3, height: 16, backgroundColor: color, marginRight: 10 }} />
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text300, letterSpacing: 1, textTransform: 'uppercase', flex: 1 }}>
              Add to {mealType}
            </Text>
            <TouchableOpacity onPress={close}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text500 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tab toggle */}
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8 }}>
            {(['SEARCH', 'MANUAL'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[s.tabToggle, (tab === 'MANUAL') === manual && { borderColor: COLORS.accent }]}
                onPress={() => setManual(tab === 'MANUAL')}
              >
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1, color: (tab === 'MANUAL') === manual ? COLORS.accent : COLORS.text500 }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!manual ? (
            <>
              {/* Search bar */}
              <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8 }}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="e.g. chicken breast, rice…"
                  placeholderTextColor={COLORS.text600}
                  value={query}
                  onChangeText={handleQueryChange}
                  onSubmitEditing={Keyboard.dismiss}
                  returnKeyType="search"
                  autoFocus
                />
                {query.length > 0 && (
                  <TouchableOpacity style={[s.addBtn, { paddingHorizontal: 10 }]} onPress={() => { setQuery(''); setCommitted(''); setHistory([]); }}>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Accuracy tip */}
              <View style={{ marginHorizontal: 16, marginTop: 10, padding: 10, backgroundColor: 'rgba(41,37,36,0.3)', borderWidth: 1, borderColor: 'rgba(41,37,36,0.4)' }}>
                <Text style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.text600, lineHeight: 16 }}>
                  💡 For packaged foods, use <Text style={{ color: COLORS.text400 }}>Scan Barcode</Text> for best accuracy. Search works best for whole ingredients like "chicken breast" or "brown rice".
                </Text>
              </View>

              {fetchingUsda && <ActivityIndicator color={COLORS.accent} style={{ marginTop: 16 }} />}

              {/* Selected food detail */}
              {selected && (
                <View style={[s.card, { margin: 16 }]}>
                  <Text style={{ fontFamily: FONTS.sansSB, fontSize: 13, color: COLORS.text100, marginBottom: 4 }} numberOfLines={2}>
                    {selected.name}
                  </Text>
                  {selected.fromHistory && (
                    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                      <InfoPill label={`LOGGED ${selected.count}×`} color={COLORS.accent} bg={COLORS.accentMuted} />
                    </View>
                  )}
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, marginBottom: 10 }}>
                    Per 100g · {selected.kcal} kcal · P {selected.protein_g}g · C {selected.carbs_g}g · F {selected.fat_g}g
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>SERVING (g)</Text>
                    <TextInput
                      style={[s.input, { width: 80 }]}
                      keyboardType="numeric"
                      value={serving}
                      onChangeText={setServing}
                    />
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent }}>
                      = {scale(selected.kcal)} kcal
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity style={s.addBtn} onPress={() => setSelected(null)}>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>BACK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.addBtn, { flex: 1, backgroundColor: COLORS.accentMuted, borderColor: COLORS.accentBorder, alignItems: 'center' }]}
                      onPress={confirmFood}
                      disabled={logging}
                    >
                      {logging
                        ? <ActivityIndicator size="small" color={COLORS.accent} />
                        : <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent }}>LOG MEAL</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!selected && (
                <FlatList
                  data={showSuggestions
                    ? mostLogged?.map((h, i): FoodResult => ({ fdcId: -(i + 1), name: h.name, kcal: h.kcal, protein_g: h.protein_g, carbs_g: h.carbs_g, fat_g: h.fat_g, fromHistory: true, count: h.count }))
                    : mergedResults}
                  keyExtractor={(item, i) => `${item.fdcId}-${i}`}
                  style={{ marginTop: 8 }}
                  keyboardShouldPersistTaps="handled"
                  ListHeaderComponent={showSuggestions ? (
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, letterSpacing: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
                      YOUR USUALS
                    </Text>
                  ) : mergedResults.some(r => r.fromHistory) ? (
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, letterSpacing: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
                      PREVIOUSLY LOGGED · USDA
                    </Text>
                  ) : null}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(41,37,36,0.25)' }}
                      onPress={() => { setSelected(item); setServing('100'); Keyboard.dismiss(); }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <Text style={{ fontFamily: FONTS.sansSB, fontSize: 12, color: COLORS.text300 }} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.fromHistory && (
                            <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.accent }}>★</Text>
                          )}
                        </View>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>
                          {item.kcal} kcal / 100g{item.count ? ` · logged ${item.count}×` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.accent }}>+</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={showResults && !fetchingUsda ? (
                    <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.text600, textAlign: 'center', padding: 24 }}>
                      No results for "{committed}"
                    </Text>
                  ) : null}
                />
              )}
            </>
          ) : (
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <View style={s.card}>
                <Text style={s.fieldLabel}>FOOD NAME</Text>
                <TextInput style={[s.input, { marginBottom: 12 }]} placeholder="e.g. Oatmeal with banana" placeholderTextColor={COLORS.text600} value={mName} onChangeText={setMName} />
                <Text style={s.fieldLabel}>CALORIES (kcal)</Text>
                <TextInput style={[s.input, { marginBottom: 12 }]} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text600} value={mKcal} onChangeText={setMKcal} />
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  {[['PROTEIN (g)', mP, setMP], ['CARBS (g)', mC, setMC], ['FAT (g)', mF, setMF]] .map(([label, val, set]: any) => (
                    <View key={label} style={{ flex: 1 }}>
                      <Text style={s.fieldLabel}>{label}</Text>
                      <TextInput style={s.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text600} value={val} onChangeText={set} />
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.addBtn, { alignSelf: 'stretch', alignItems: 'center', backgroundColor: COLORS.accentMuted, borderColor: COLORS.accentBorder, paddingVertical: 10 }]}
                  onPress={confirmManual}
                  disabled={logging || !mName.trim() || !mKcal}
                >
                  {logging
                    ? <ActivityIndicator size="small" color={COLORS.accent} />
                    : <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent }}>LOG MEAL</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── ScanResultModal ────────────────────────────────────────────────────────

function ScanResultModal({ result, mealType, onConfirm, onClose }: {
  result: ScanResult | null;
  mealType: MealType;
  onConfirm: (entry: any) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]     = useState('');
  const [kcal, setKcal]     = useState('');
  const [prot, setProt]     = useState('');
  const [carb, setCarb]     = useState('');
  const [fat,  setFat]      = useState('');
  const [saving, setSaving] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (result) {
      setName(result.meal_name);
      setKcal(String(result.kcal));
      setProt(String(result.protein_g));
      setCarb(String(result.carbs_g));
      setFat(String(result.fat_g));
      setFeedbackSent(false);
    }
  }, [result]);

  const confidence = result?.confidence ?? 0;
  const confColor  = confidence >= 80 ? COLORS.green400 : confidence >= 60 ? '#fbbf24' : COLORS.red400;
  const confLabel  = confidence >= 80 ? 'HIGH CONFIDENCE' : confidence >= 60 ? 'MODERATE — verify values' : 'LOW CONFIDENCE — verify manually';
  const showLowWarning = confidence > 0 && confidence < 60;

  async function confirm() {
    setSaving(true);
    try {
      await onConfirm({ meal_name: name, kcal: parseInt(kcal, 10) || 0, protein_g: parseInt(prot, 10) || 0, carbs_g: parseInt(carb, 10) || 0, fat_g: parseInt(fat, 10) || 0, meal_type: mealType, source: 'vision_api', confidence });
      onClose();
    } catch { Alert.alert('Error', 'Could not save.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={!!result} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.accent, letterSpacing: 1, flex: 1 }}>
              ⬡  SCAN RESULT
            </Text>
            {confidence > 0 && (
              <View style={{ backgroundColor: `${confColor}22`, borderWidth: 1, borderColor: confColor, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: confColor, letterSpacing: 1 }}>
                  {Math.round(confidence)}% · {confLabel}
                </Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {showLowWarning && (
            <View style={{ backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', padding: 10, marginBottom: 12 }}>
              <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.red400, lineHeight: 18 }}>
                ⚠ Low confidence scan. The values below may not be accurate — please verify against the food's nutrition label before logging.
              </Text>
            </View>
          )}

          <View style={s.card}>
            <Text style={s.fieldLabel}>FOOD NAME</Text>
            <TextInput style={[s.input, { marginBottom: 12 }]} value={name} onChangeText={setName} placeholderTextColor={COLORS.text600} />
            <Text style={s.fieldLabel}>CALORIES (kcal)</Text>
            <TextInput style={[s.input, { marginBottom: 12 }]} value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholderTextColor={COLORS.text600} />
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {[['PROTEIN', prot, setProt], ['CARBS', carb, setCarb], ['FAT', fat, setFat]].map(([label, val, set]: any) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>{label}</Text>
                  <TextInput style={s.input} value={val} onChangeText={set} keyboardType="numeric" placeholderTextColor={COLORS.text600} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TouchableOpacity style={s.addBtn} onPress={onClose}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>DISCARD</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.addBtn, { flex: 1, backgroundColor: COLORS.accentMuted, borderColor: COLORS.accentBorder, alignItems: 'center' }]}
                onPress={confirm}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color={COLORS.accent} />
                  : <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent }}>LOG MEAL</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* Manual feedback */}
          {!feedbackSent ? (
            <TouchableOpacity
              style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 }}
              onPress={() => setFeedbackSent(true)}
            >
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, letterSpacing: 1 }}>
                ↩ MARK RESULT AS INACCURATE
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, textAlign: 'center', paddingVertical: 8 }}>
              ✓ Feedback noted. Thank you.
            </Text>
          )}

          {/* Gating / disclaimer */}
          <View style={{ marginTop: 8, padding: 12, backgroundColor: 'rgba(41,37,36,0.25)', borderWidth: 1, borderColor: 'rgba(41,37,36,0.4)', flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <View style={{ marginTop: 2 }}><CrownIcon size={11} color="#fbbf24" /></View>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, letterSpacing: 0.5, lineHeight: 14, flex: 1 }}>
              AI meal analysis is a Pro / Elite feature. Scans use computer vision and may not always be precise — always verify values against a nutrition label when accuracy matters.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── TemplatesModal ─────────────────────────────────────────────────────────

function TemplatesModal({ visible, mealType, onClose }: {
  visible: boolean;
  mealType: MealType;
  onClose: () => void;
}) {
  const [mode, setMode]               = useState<'list' | 'builder'>('list');
  const { data: templates = [] }      = useMealTemplates();
  const { saveTemplate, isLoading: saving }   = useSaveTemplate();
  const { deleteTemplate }            = useDeleteTemplate();
  const { logTemplate, isLoading: logging }   = useLogTemplate();
  const { scanMeal, isLoading: scanning }     = useScanMeal();

  // Builder state
  const [tName, setTName]             = useState('');
  const [ingredients, setIngredients] = useState<TemplateItem[]>([]);
  const [searchQ, setSearchQ]         = useState('');
  const [committed, setCommitted]     = useState('');
  const [histItems, setHistItems]     = useState<MostLoggedFood[]>([]);
  const [pending, setPending]         = useState<FoodResult | null>(null);
  const [servingSize, setServing]     = useState('100');
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: usdaResults, isFetching } = useFoodSearch(committed);

  const mergedSearch = useMemo<FoodResult[]>(() => {
    const hist: FoodResult[] = histItems.map((h, i) => ({ fdcId: -(i + 1), name: h.name, kcal: h.kcal, protein_g: h.protein_g, carbs_g: h.carbs_g, fat_g: h.fat_g, fromHistory: true, count: h.count }));
    if (!usdaResults?.length) return hist;
    const histNames = new Set(histItems.map(h => h.name.toLowerCase()));
    return [...hist, ...usdaResults.filter(u => !histNames.has(u.name.toLowerCase()))];
  }, [histItems, usdaResults]);

  function handleSearchChange(text: string) {
    setSearchQ(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCommitted(text);
      if (text.trim().length >= 2) {
        const hist = await searchFoodHistory(text).catch(() => []);
        setHistItems(hist);
      } else {
        setHistItems([]);
      }
    }, 500);
  }

  function addIngredient(item: FoodResult, servingG: number) {
    const scale = servingG / 100;
    setIngredients(prev => [...prev, {
      name:      item.name,
      kcal:      Math.round(item.kcal * scale),
      protein_g: Math.round(item.protein_g * scale * 10) / 10,
      carbs_g:   Math.round(item.carbs_g   * scale * 10) / 10,
      fat_g:     Math.round(item.fat_g     * scale * 10) / 10,
    }]);
    setPending(null); setSearchQ(''); setCommitted(''); setHistItems([]); setServing('100');
  }

  async function handleScan() {
    try {
      const result = await scanMeal();
      setIngredients(prev => [...prev, { name: result.meal_name, kcal: result.kcal, protein_g: result.protein_g, carbs_g: result.carbs_g, fat_g: result.fat_g }]);
    } catch (e: any) {
      if (e?.message !== 'Cancelled') Alert.alert('Scan Failed', e?.message ?? 'Try again.');
    }
  }

  async function handleSave() {
    if (!tName.trim()) { Alert.alert('Name required', 'Give your template a name.'); return; }
    if (ingredients.length === 0) { Alert.alert('No ingredients', 'Add at least one ingredient.'); return; }
    try {
      await saveTemplate({ name: tName.trim(), items: ingredients });
      setMode('list'); setTName(''); setIngredients([]);
    } catch { Alert.alert('Error', 'Could not save template.'); }
  }

  function resetBuilder() {
    setTName(''); setIngredients([]); setSearchQ(''); setCommitted(''); setHistItems([]); setPending(null);
  }

  const builderTotals = ingredients.reduce(
    (acc, i) => ({ kcal: acc.kcal + i.kcal, protein_g: acc.protein_g + i.protein_g, carbs_g: acc.carbs_g + i.carbs_g, fat_g: acc.fat_g + i.fat_g }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          {mode === 'builder' && (
            <TouchableOpacity onPress={() => setMode('list')} style={{ marginRight: 12 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500 }}>‹ BACK</Text>
            </TouchableOpacity>
          )}
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text300, letterSpacing: 1, flex: 1 }}>
            {mode === 'list' ? `MEAL TEMPLATES · ${mealType.toUpperCase()}` : 'BUILD TEMPLATE'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text500 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {mode === 'list' ? (
          /* ── Template list ── */
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <TouchableOpacity
              style={[s.addBtn, { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 10, marginBottom: 14, backgroundColor: COLORS.accentMuted, borderColor: COLORS.accentBorder }]}
              onPress={() => { resetBuilder(); setMode('builder'); }}
            >
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>
                + BUILD NEW TEMPLATE
              </Text>
            </TouchableOpacity>

            {templates.length === 0 && (
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.text600, textAlign: 'center', marginTop: 20, lineHeight: 20 }}>
                No templates yet.{'\n'}Build one to log repetitive meals in one tap.
              </Text>
            )}

            {templates.map(tmpl => (
              <View key={tmpl.id} style={[s.card, { marginBottom: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FONTS.sansSB, fontSize: 13, color: COLORS.text100, marginBottom: 3 }}>{tmpl.name}</Text>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>
                      {tmpl.kcal} kcal · P {tmpl.protein_g}g · C {tmpl.carbs_g}g · F {tmpl.fat_g}g
                    </Text>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, marginTop: 2 }}>
                      {tmpl.items.length} ingredient{tmpl.items.length !== 1 ? 's' : ''} · used {tmpl.times_used}×
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert('Delete Template', `Remove "${tmpl.name}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteTemplate(tmpl.id) }])}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text700 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Ingredients preview */}
                {tmpl.items.slice(0, 3).map((item, i) => (
                  <Text key={i} style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.text600, marginTop: 4 }}>
                    · {item.name} ({item.kcal} kcal)
                  </Text>
                ))}
                {tmpl.items.length > 3 && (
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, marginTop: 2 }}>
                    +{tmpl.items.length - 3} more ingredient{tmpl.items.length - 3 !== 1 ? 's' : ''}
                  </Text>
                )}

                <TouchableOpacity
                  style={[s.addBtn, { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 9, marginTop: 12, backgroundColor: COLORS.accentMuted, borderColor: COLORS.accentBorder }]}
                  onPress={async () => { await logTemplate({ template: tmpl, mealType }); onClose(); }}
                  disabled={logging}
                >
                  {logging
                    ? <ActivityIndicator size="small" color={COLORS.accent} />
                    : <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>
                        LOG ALL → {mealType.toUpperCase()}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : (
          /* ── Builder ── */
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">

              {/* Template name */}
              <View style={s.card}>
                <Text style={s.fieldLabel}>TEMPLATE NAME</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Morning Oats, Post-Workout Shake…"
                  placeholderTextColor={COLORS.text600}
                  value={tName}
                  onChangeText={setTName}
                />
              </View>

              {/* Ingredient list */}
              <View style={s.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[s.sectionLabel, { flex: 1 }]}>
                    INGREDIENTS ({ingredients.length})
                  </Text>
                  {ingredients.length > 0 && (
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent }}>
                      {builderTotals.kcal} kcal total
                    </Text>
                  )}
                </View>

                {ingredients.length === 0 && (
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.text600, marginBottom: 8 }}>
                    Search below or scan a barcode to add ingredients.
                  </Text>
                )}

                {ingredients.map((ing, idx) => (
                  <View key={idx} style={[s.mealItem, { paddingVertical: 6 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: FONTS.sansSB, fontSize: 12, color: COLORS.text300 }} numberOfLines={1}>
                        {ing.name}
                      </Text>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>
                        {ing.kcal} kcal · P {ing.protein_g}g · C {ing.carbs_g}g · F {ing.fat_g}g
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIngredients(prev => prev.filter((_, i) => i !== idx))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text600 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Search + Scan */}
              <View style={s.card}>
                <Text style={s.sectionLabel}>ADD INGREDIENT</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 10 }}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Search food (e.g. oats, eggs)…"
                    placeholderTextColor={COLORS.text600}
                    value={searchQ}
                    onChangeText={handleSearchChange}
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    style={[s.addBtn, { paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }]}
                    onPress={handleScan}
                    disabled={scanning}
                  >
                    {scanning
                      ? <ActivityIndicator size="small" color={COLORS.accent} />
                      : <>
                          <Ionicons name="barcode-outline" size={16} color={COLORS.text400} />
                          <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text500, marginTop: 2 }}>SCAN</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>

                {/* Serving size confirm for selected search result */}
                {pending && (
                  <View style={{ padding: 10, borderWidth: 1, borderColor: COLORS.accentBorder, backgroundColor: COLORS.accentMuted, marginBottom: 10 }}>
                    <Text style={{ fontFamily: FONTS.sansSB, fontSize: 12, color: COLORS.text100, marginBottom: 6 }} numberOfLines={1}>
                      {pending.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>SERVING (g)</Text>
                      <TextInput
                        style={[s.input, { width: 70 }]}
                        value={servingSize}
                        onChangeText={setServing}
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.text600}
                      />
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, flex: 1 }}>
                        = {Math.round(pending.kcal * (parseFloat(servingSize) || 100) / 100)} kcal
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={s.addBtn} onPress={() => setPending(null)}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>CANCEL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.addBtn, { flex: 1, alignItems: 'center', backgroundColor: COLORS.accentMuted, borderColor: COLORS.accentBorder }]}
                        onPress={() => addIngredient(pending, parseFloat(servingSize) || 100)}
                      >
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent }}>+ ADD</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {isFetching && <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 6 }} />}

                {!pending && mergedSearch.length > 0 && mergedSearch.slice(0, 8).map((item, i) => (
                  <TouchableOpacity
                    key={`${item.fdcId}-${i}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.3)' }}
                    onPress={() => { setPending(item); setServing('100'); Keyboard.dismiss(); }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ fontFamily: FONTS.sansSB, fontSize: 12, color: COLORS.text300 }} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.fromHistory && <Text style={{ fontFamily: FONTS.mono, fontSize: 8, color: COLORS.accent }}>★</Text>}
                      </View>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>
                        {item.kcal} kcal / 100g
                      </Text>
                    </View>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.accent }}>+</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Save template button */}
              <TouchableOpacity
                style={[s.addBtn, {
                  alignSelf: 'stretch', alignItems: 'center', paddingVertical: 12,
                  backgroundColor: (tName.trim() && ingredients.length > 0) ? COLORS.accentMuted : 'transparent',
                  borderColor:     (tName.trim() && ingredients.length > 0) ? COLORS.accentBorder : COLORS.border,
                }]}
                onPress={handleSave}
                disabled={saving || !tName.trim() || ingredients.length === 0}
              >
                {saving
                  ? <ActivityIndicator size="small" color={COLORS.accent} />
                  : <Text style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1, color: (tName.trim() && ingredients.length > 0) ? COLORS.accent : COLORS.text600 }}>
                      SAVE TEMPLATE
                    </Text>
                }
              </TouchableOpacity>

            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── SentinelScreen ─────────────────────────────────────────────────────────

export default function SentinelScreen() {
  const today = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMacroEdit, setShowMacroEdit] = useState(false);
  const [proModal, setProModal]         = useState({ visible: false, feature: '' });
  const [searchMealType, setSearchMealType]       = useState<MealType>('breakfast');
  const [showSearch, setShowSearch]               = useState(false);
  const [scanMealType, setScanMealType]           = useState<MealType>('breakfast');
  const [scanResult, setScanResult]               = useState<ScanResult | null>(null);
  const [templatesMealType, setTemplatesMealType] = useState<MealType>('breakfast');
  const [showTemplates, setShowTemplates]         = useState(false);

  const { data: nutrition, isLoading } = useDailyNutrition(selectedDate);
  const { data: profile }              = useProfile();
  const { data: caloriesBurned = 0 }  = useTodayCaloriesBurned();
  const { logMeal }                    = useLogMeal();
  const { deleteMeal }                 = useDeleteMeal();
  const { scanMeal, isLoading: scanning } = useScanMeal();

  const macros  = profile?.current_macros ?? { kcal: 2000, protein: 150, carbs: 200, fat: 65 };
  const totals  = nutrition?.totals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const logs    = nutrition?.logs ?? [];
  const isPro   = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'elite';
  const streak  = (profile as any)?.current_streak ?? 0;
  const goal    = profile?.goal;

  function prevDay() {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(toLocalDateStr(d));
  }
  function nextDay() {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const next = toLocalDateStr(d);
    if (next <= today) setSelectedDate(next);
  }
  const isToday = selectedDate === today;

  function openSearch(mt: MealType)    { setSearchMealType(mt);    setShowSearch(true); }
  function openTemplates(mt: MealType) { setTemplatesMealType(mt); setShowTemplates(true); }

  async function openScan(mt: MealType) {
    if (!isPro) { setProModal({ visible: true, feature: 'Meal scanning' }); return; }
    setScanMealType(mt);
    try {
      const result = await scanMeal();
      setScanResult(result);
    } catch (e: any) {
      if (e?.message !== 'Cancelled') Alert.alert('Scan Failed', e?.message ?? 'Try again.');
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete Entry', 'Remove this food from your log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMeal(id) },
    ]);
  }

  // Net calories: consumed - burned
  const netKcal    = totals.kcal - caloriesBurned;
  const netDisplay = netKcal !== totals.kcal;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 }}>
        <Text style={s.screenTitle}>SENTINEL</Text>
        <Text style={s.screenSub}>Nutrition Logger</Text>
      </View>

      {/* Date nav */}
      <View style={s.dateNav}>
        <TouchableOpacity onPress={prevDay} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 20, color: COLORS.text500 }}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowCalendar(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text300, letterSpacing: 1 }}>
            {formatDisplayDate(selectedDate).toUpperCase()}
          </Text>
          <Ionicons name="calendar-outline" size={14} color={COLORS.text500} />
        </TouchableOpacity>
        <TouchableOpacity onPress={nextDay} disabled={isToday} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 20, color: isToday ? COLORS.text700 : COLORS.text500 }}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Summary card ───────────────────────────────────────────── */}
        <View style={s.card}>
          {/* Header row with edit targets button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={s.sectionLabel}>TODAY'S MACROS</Text>
            <TouchableOpacity
              onPress={() => setShowMacroEdit(true)}
              style={{ marginLeft: 'auto' as any }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, letterSpacing: 1 }}>✎ EDIT TARGETS</Text>
            </TouchableOpacity>
          </View>

          {/* Ring + macro bars */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <CalorieRing consumed={netDisplay ? netKcal : totals.kcal} target={macros.kcal} />
            <View style={{ flex: 1 }}>
              {/* protein=orange, carbs=blue, fat=yellow */}
              <MacroBar label="PROTEIN" consumed={totals.protein} target={macros.protein} color={COLORS.accent}   />
              <MacroBar label="CARBS"   consumed={totals.carbs}   target={macros.carbs}   color={COLORS.blue400} />
              <MacroBar label="FAT"     consumed={totals.fat}     target={macros.fat}     color="#fbbf24"        />
            </View>
          </View>

          {/* Pill row: goal · calories burned · streak */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
            {goal && GOAL_LABELS[goal] && (
              <InfoPill label={`🎯 ${GOAL_LABELS[goal]}`} color={COLORS.accent} bg={COLORS.accentMuted} />
            )}
            {caloriesBurned > 0 && (
              <InfoPill label={`🔥 ${caloriesBurned} KCAL BURNED`} color={COLORS.orange400 ?? '#fb923c'} />
            )}
            {streak > 0 && (
              <InfoPill label={`⚡ ${streak} DAY STREAK`} color="#fbbf24" />
            )}
          </View>

          {netDisplay && (
            <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, marginTop: 6, letterSpacing: 0.5 }}>
              Ring shows net kcal (consumed − burned). Raw: {totals.kcal} consumed.
            </Text>
          )}
        </View>

        {isLoading && <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 16 }} />}

        {/* ── Meal sections ──────────────────────────────────────────── */}
        {MEAL_TYPES.map(mt => (
          <MealSection
            key={mt}
            type={mt}
            items={logs.filter(l => l.meal_type === mt)}
            onAdd={() => openSearch(mt)}
            onScan={() => openScan(mt)}
            onTemplates={() => openTemplates(mt)}
            onDelete={handleDelete}
            isPro={isPro}
          />
        ))}

        {/* ── Water tracker ──────────────────────────────────────────── */}
        <WaterSection date={selectedDate} />

      </ScrollView>

      {/* Scan loading overlay */}
      {scanning && (
        <View style={s.scanOverlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text300, marginTop: 12, letterSpacing: 1 }}>
            ANALYSING MEAL…
          </Text>
        </View>
      )}

      {/* Modals */}
      <ProLockedModal
        visible={proModal.visible}
        feature={proModal.feature}
        onClose={() => setProModal({ visible: false, feature: '' })}
      />
      <CalendarModal
        visible={showCalendar}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        onClose={() => setShowCalendar(false)}
      />
      <MacroEditModal
        visible={showMacroEdit}
        current={macros}
        onClose={() => setShowMacroEdit(false)}
      />
      <TemplatesModal
        visible={showTemplates}
        mealType={templatesMealType}
        onClose={() => setShowTemplates(false)}
      />
      <FoodSearchModal
        visible={showSearch}
        mealType={searchMealType}
        onClose={() => setShowSearch(false)}
        onLog={logMeal}
      />
      <ScanResultModal
        result={scanResult}
        mealType={scanMealType}
        onConfirm={logMeal}
        onClose={() => setScanResult(null)}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  screenTitle: {
    fontFamily:    FONTS.anton,
    fontSize:      24,
    color:         COLORS.text100,
    letterSpacing: 2,
  },
  screenSub: {
    fontFamily:    FONTS.mono,
    fontSize:      9,
    color:         COLORS.text600,
    letterSpacing: 2,
    marginTop:     -2,
  },
  dateNav: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 20,
    paddingVertical:  8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  card: {
    backgroundColor: 'rgba(12,11,10,0.95)',
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         14,
    marginBottom:    10,
  },
  sectionLabel: {
    fontFamily:    FONTS.mono,
    fontSize:      10,
    color:         COLORS.text500,
    letterSpacing: 1,
  },
  mealItem: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 8,
    borderTopWidth:  1,
    borderTopColor:  'rgba(41,37,36,0.3)',
  },
  addBtn: {
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingVertical:   6,
    paddingHorizontal: 12,
    alignSelf:         'flex-start',
  },
  waterQuickBtn: {
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingVertical:   5,
    paddingHorizontal: 8,
  },
  input: {
    borderWidth:       1,
    borderColor:       COLORS.border,
    backgroundColor:   'rgba(12,11,10,0.6)',
    color:             COLORS.text300,
    fontFamily:        FONTS.mono,
    fontSize:          12,
    paddingHorizontal: 10,
    paddingVertical:   8,
  },
  fieldLabel: {
    fontFamily:    FONTS.mono,
    fontSize:      9,
    color:         COLORS.text600,
    letterSpacing: 1,
    marginBottom:  4,
  },
  tabToggle: {
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingVertical:   6,
    paddingHorizontal: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,9,8,0.8)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  proCard: {
    backgroundColor: 'rgba(18,17,16,0.98)',
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         24,
    width:           '100%',
    maxWidth:        320,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,9,8,0.85)',
    alignItems:      'center',
    justifyContent:  'center',
  },
});
