import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, FlatList, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';
import { COLORS, FONTS } from '../constants/theme';
import {
  useDailyNutrition, useLogMeal, useDeleteMeal,
  useWaterLog, useLogWater, useDeleteWater, useScanMeal, useFoodSearch,
  FoodResult, ScanResult, NutritionLog,
} from '../hooks/useNutrition';
import { useProfile } from '../hooks/useSettings';

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
  dinner:    '🌙',
  snacks:    '◆',
};

const WATER_QUICK = [250, 500, 750, 1000];
const WATER_TARGET_ML = 2500;

// ── Date helpers ───────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = toLocalDateStr(new Date());
  const yesterday = toLocalDateStr(new Date(Date.now() - 86_400_000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── CalorieRing ────────────────────────────────────────────────────────────

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const r = 54;
  const cx = 68; const cy = 68;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const offset = circ * (1 - pct);
  const remaining = Math.max(target - consumed, 0);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={136} height={136}>
        <G rotation="-90" origin={`${cx}, ${cy}`}>
          <Circle cx={cx} cy={cy} r={r} stroke="rgba(41,37,36,0.5)" strokeWidth={7} fill="none" />
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={pct >= 1 ? COLORS.accentHot : COLORS.accent}
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
        <Text style={{ fontFamily: FONTS.mono, fontSize: 9, color: COLORS.accent, marginTop: 4 }}>
          {remaining} left
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

function MealSection({ type, items, onAdd, onScan, onDelete }: {
  type: MealType;
  items: NutritionLog[];
  onAdd: () => void;
  onScan: () => void;
  onDelete: (id: string) => void;
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
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>
            {kcal} kcal
          </Text>
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

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <TouchableOpacity style={s.addBtn} onPress={onAdd}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>
            + ADD FOOD
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.addBtn, { paddingHorizontal: 10 }]} onPress={onScan}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, letterSpacing: 1 }}>
            ⬡ SCAN
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── WaterSection ───────────────────────────────────────────────────────────

function WaterSection({ date }: { date: string }) {
  const { data: waterDay } = useWaterLog(date);
  const { logWater, isLoading: logging } = useLogWater();
  const { deleteWater } = useDeleteWater();
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const totalMl  = waterDay?.total_ml ?? 0;
  const logs     = waterDay?.logs ?? [];
  const pct      = Math.min(totalMl / WATER_TARGET_ML, 1);

  async function add(ml: number) {
    if (!ml || ml <= 0) return;
    try { await logWater(ml); } catch { Alert.alert('Error', 'Could not log water.'); }
  }

  return (
    <View style={s.card}>
      <Text style={s.sectionLabel}>💧  WATER</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 20, color: COLORS.text100, marginRight: 8 }}>
          {totalMl < 1000 ? `${totalMl}ml` : `${(totalMl / 1000).toFixed(1)}L`}
        </Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500 }}>
          / {WATER_TARGET_ML / 1000}L
        </Text>
      </View>

      <View style={{ height: 6, backgroundColor: 'rgba(41,37,36,0.5)', borderRadius: 3, marginBottom: 12 }}>
        <View style={{ height: 6, width: `${pct * 100}%` as any, backgroundColor: '#60a5fa', borderRadius: 3 }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
        {WATER_QUICK.map(ml => (
          <TouchableOpacity
            key={ml}
            style={s.waterQuickBtn}
            onPress={() => add(ml)}
            disabled={logging}
          >
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text300 }}>
              {ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.waterQuickBtn, { paddingHorizontal: 10 }]}
          onPress={() => setShowCustom(v => !v)}
        >
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
  onLog: (entry: { meal_name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; meal_type: string }) => Promise<void>;
}) {
  const [query, setQuery]           = useState('');
  const [committed, setCommitted]   = useState('');
  const [selected, setSelected]     = useState<FoodResult | null>(null);
  const [serving, setServing]       = useState('100');
  const [logging, setLogging]       = useState(false);
  // Manual add mode
  const [manual, setManual]         = useState(false);
  const [mName, setMName]           = useState('');
  const [mKcal, setMKcal]           = useState('');
  const [mP, setMP]                 = useState('');
  const [mC, setMC]                 = useState('');
  const [mF, setMF]                 = useState('');

  const { data: results, isFetching } = useFoodSearch(committed);

  function reset() {
    setQuery(''); setCommitted(''); setSelected(null); setServing('100');
    setManual(false); setMName(''); setMKcal(''); setMP(''); setMC(''); setMF('');
  }

  function close() { reset(); onClose(); }

  function scale(val: number) {
    const s = parseFloat(serving) || 100;
    return Math.round((val * s) / 100);
  }

  async function confirmFood() {
    if (!selected) return;
    setLogging(true);
    try {
      await onLog({
        meal_name: selected.name,
        kcal:      scale(selected.kcal),
        protein_g: scale(selected.protein_g),
        carbs_g:   scale(selected.carbs_g),
        fat_g:     scale(selected.fat_g),
        meal_type: mealType,
      });
      close();
    } catch { Alert.alert('Error', 'Could not log meal.'); }
    finally { setLogging(false); }
  }

  async function confirmManual() {
    if (!mName.trim() || !mKcal) return;
    setLogging(true);
    try {
      await onLog({
        meal_name: mName.trim(),
        kcal:      parseInt(mKcal, 10) || 0,
        protein_g: parseInt(mP, 10) || 0,
        carbs_g:   parseInt(mC, 10) || 0,
        fat_g:     parseInt(mF, 10) || 0,
        meal_type: mealType,
      });
      close();
    } catch { Alert.alert('Error', 'Could not log meal.'); }
    finally { setLogging(false); }
  }

  const color = MEAL_COLORS[mealType];

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
              <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text500 }}>✕ CLOSE</Text>
            </TouchableOpacity>
          </View>

          {/* Tab toggle */}
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8 }}>
            <TouchableOpacity
              style={[s.tabToggle, !manual && { borderColor: COLORS.accent }]}
              onPress={() => setManual(false)}
            >
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: manual ? COLORS.text500 : COLORS.accent, letterSpacing: 1 }}>
                SEARCH
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabToggle, manual && { borderColor: COLORS.accent }]}
              onPress={() => setManual(true)}
            >
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: manual ? COLORS.accent : COLORS.text500, letterSpacing: 1 }}>
                MANUAL
              </Text>
            </TouchableOpacity>
          </View>

          {!manual ? (
            <>
              {/* Search input */}
              <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8 }}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="Search food (e.g. chicken breast)…"
                  placeholderTextColor={COLORS.text600}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={() => { setCommitted(query); Keyboard.dismiss(); }}
                  returnKeyType="search"
                  autoFocus
                />
                <TouchableOpacity
                  style={[s.addBtn, { paddingHorizontal: 14 }]}
                  onPress={() => { setCommitted(query); Keyboard.dismiss(); }}
                >
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent }}>GO</Text>
                </TouchableOpacity>
              </View>

              {isFetching && <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />}

              {/* Selected food confirm */}
              {selected && (
                <View style={[s.card, { margin: 16 }]}>
                  <Text style={{ fontFamily: FONTS.sansSB, fontSize: 13, color: COLORS.text100, marginBottom: 6 }} numberOfLines={2}>
                    {selected.name}
                  </Text>
                  <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500, marginBottom: 10 }}>
                    Per 100g · {selected.kcal} kcal · P {selected.protein_g}g · C {selected.carbs_g}g · F {selected.fat_g}g
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text500 }}>SERVING (g)</Text>
                    <TextInput
                      style={[s.input, { width: 80 }]}
                      keyboardType="numeric"
                      value={serving}
                      onChangeText={setServing}
                    />
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text400, flex: 1 }}>
                      = {scale(selected.kcal)} kcal
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
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

              {/* Results */}
              {!selected && results && results.length > 0 && (
                <FlatList
                  data={results}
                  keyExtractor={item => String(item.fdcId)}
                  style={{ marginHorizontal: 16, marginTop: 8 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[s.mealItem, { marginBottom: 0, borderTopWidth: 1, borderTopColor: 'rgba(41,37,36,0.3)' }]}
                      onPress={() => { setSelected(item); setServing('100'); Keyboard.dismiss(); }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: FONTS.sansSB, fontSize: 12, color: COLORS.text300 }} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600 }}>
                          {item.kcal} kcal / 100g
                        </Text>
                      </View>
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.accent }}>+</Text>
                    </TouchableOpacity>
                  )}
                />
              )}

              {!selected && !isFetching && committed.length >= 2 && results?.length === 0 && (
                <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.text600, textAlign: 'center', marginTop: 24 }}>
                  No results for "{committed}"
                </Text>
              )}
            </>
          ) : (
            /* Manual add form */
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <View style={s.card}>
                <Text style={s.fieldLabel}>FOOD NAME</Text>
                <TextInput style={[s.input, { marginBottom: 12 }]} placeholder="e.g. Oatmeal with banana" placeholderTextColor={COLORS.text600} value={mName} onChangeText={setMName} />

                <Text style={s.fieldLabel}>CALORIES (kcal)</Text>
                <TextInput style={[s.input, { marginBottom: 12 }]} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text600} value={mKcal} onChangeText={setMKcal} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>PROTEIN (g)</Text>
                    <TextInput style={s.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text600} value={mP} onChangeText={setMP} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>CARBS (g)</Text>
                    <TextInput style={s.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text600} value={mC} onChangeText={setMC} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>FAT (g)</Text>
                    <TextInput style={s.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text600} value={mF} onChangeText={setMF} />
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.addBtn, { marginTop: 16, alignSelf: 'stretch', alignItems: 'center', backgroundColor: COLORS.accentMuted, borderColor: COLORS.accentBorder }]}
                  onPress={confirmManual}
                  disabled={logging || !mName.trim() || !mKcal}
                >
                  {logging
                    ? <ActivityIndicator size="small" color={COLORS.accent} />
                    : <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>LOG MEAL</Text>
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
  const [fat, setFat]       = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (result) {
      setName(result.meal_name);
      setKcal(String(result.kcal));
      setProt(String(result.protein_g));
      setCarb(String(result.carbs_g));
      setFat(String(result.fat_g));
    }
  }, [result]);

  async function confirm() {
    setSaving(true);
    try {
      await onConfirm({
        meal_name: name,
        kcal:      parseInt(kcal, 10) || 0,
        protein_g: parseInt(prot, 10) || 0,
        carbs_g:   parseInt(carb, 10) || 0,
        fat_g:     parseInt(fat, 10)  || 0,
        meal_type: mealType,
        source:    'vision_api',
        confidence: result?.confidence,
      });
      onClose();
    } catch { Alert.alert('Error', 'Could not save.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={!!result} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.accent, letterSpacing: 1 }}>
            ⬡  SCAN RESULT
          </Text>
          {result && (
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, marginTop: 4 }}>
              {Math.round(result.confidence)}% confidence
            </Text>
          )}
        </View>
        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.fieldLabel}>FOOD NAME</Text>
            <TextInput style={[s.input, { marginBottom: 12 }]} value={name} onChangeText={setName} placeholderTextColor={COLORS.text600} />

            <Text style={s.fieldLabel}>CALORIES (kcal)</Text>
            <TextInput style={[s.input, { marginBottom: 12 }]} value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholderTextColor={COLORS.text600} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>PROTEIN</Text>
                <TextInput style={s.input} value={prot} onChangeText={setProt} keyboardType="numeric" placeholderTextColor={COLORS.text600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>CARBS</Text>
                <TextInput style={s.input} value={carb} onChangeText={setCarb} keyboardType="numeric" placeholderTextColor={COLORS.text600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>FAT</Text>
                <TextInput style={s.input} value={fat} onChangeText={setFat} keyboardType="numeric" placeholderTextColor={COLORS.text600} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
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
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── SentinelScreen ─────────────────────────────────────────────────────────

export default function SentinelScreen() {
  const today = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: nutrition, isLoading: loadingNutrition } = useDailyNutrition(selectedDate);
  const { data: profile } = useProfile();
  const { logMeal } = useLogMeal();
  const { deleteMeal } = useDeleteMeal();
  const { scanMeal, isLoading: scanning } = useScanMeal();

  const [searchMealType, setSearchMealType] = useState<MealType>('breakfast');
  const [showSearch, setShowSearch]         = useState(false);
  const [scanMealType, setScanMealType]     = useState<MealType>('breakfast');
  const [scanResult, setScanResult]         = useState<ScanResult | null>(null);

  const macros  = profile?.current_macros ?? { kcal: 2000, protein: 150, carbs: 200, fat: 65 };
  const totals  = nutrition?.totals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const logs    = nutrition?.logs   ?? [];

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

  function openSearch(mt: MealType) { setSearchMealType(mt); setShowSearch(true); }

  async function openScan(mt: MealType) {
    if (profile?.subscription_tier === 'basic') {
      Alert.alert('Pro Feature', 'Meal scanning requires a Pro or Elite subscription.');
      return;
    }
    setScanMealType(mt);
    try {
      const result = await scanMeal();
      setScanResult(result);
    } catch (e: any) {
      if (e?.message !== 'Cancelled') Alert.alert('Scan Failed', e?.message ?? 'Try again.');
    }
  }

  async function handleLogMeal(entry: any) {
    await logMeal(entry);
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete Entry', 'Remove this food from your log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMeal(id) },
    ]);
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.screenTitle}>SENTINEL</Text>
        <Text style={s.screenSub}>Nutrition Logger</Text>
      </View>

      {/* Date nav */}
      <View style={s.dateNav}>
        <TouchableOpacity onPress={prevDay} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 18, color: COLORS.text500 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text300, letterSpacing: 1 }}>
          {formatDisplayDate(selectedDate).toUpperCase()}
        </Text>
        <TouchableOpacity onPress={nextDay} disabled={isToday} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 18, color: isToday ? COLORS.text700 : COLORS.text500 }}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Summary card */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <CalorieRing consumed={totals.kcal} target={macros.kcal} />
            <View style={{ flex: 1 }}>
              <MacroBar label="PROTEIN" consumed={totals.protein} target={macros.protein} color={COLORS.blue400} />
              <MacroBar label="CARBS"   consumed={totals.carbs}   target={macros.carbs}   color={COLORS.accent} />
              <MacroBar label="FAT"     consumed={totals.fat}     target={macros.fat}     color="#fbbf24" />
            </View>
          </View>
        </View>

        {loadingNutrition && (
          <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 20 }} />
        )}

        {/* Meal sections */}
        {MEAL_TYPES.map(mt => (
          <MealSection
            key={mt}
            type={mt}
            items={logs.filter(l => l.meal_type === mt)}
            onAdd={() => openSearch(mt)}
            onScan={() => openScan(mt)}
            onDelete={handleDelete}
          />
        ))}

        {/* Water tracker */}
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

      {/* Food search modal */}
      <FoodSearchModal
        visible={showSearch}
        mealType={searchMealType}
        onClose={() => setShowSearch(false)}
        onLog={handleLogMeal}
      />

      {/* Scan result modal */}
      <ScanResultModal
        result={scanResult}
        mealType={scanMealType}
        onConfirm={handleLogMeal}
        onClose={() => setScanResult(null)}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  screenTitle: {
    fontFamily: FONTS.anton,
    fontSize:   24,
    color:      COLORS.text100,
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
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
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
    marginBottom:  10,
  },
  mealItem: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(41,37,36,0.3)',
  },
  addBtn: {
    borderWidth:   1,
    borderColor:   COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf:     'flex-start',
  },
  waterQuickBtn: {
    borderWidth:   1,
    borderColor:   COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  input: {
    borderWidth:     1,
    borderColor:     COLORS.border,
    backgroundColor: 'rgba(12,11,10,0.6)',
    color:           COLORS.text300,
    fontFamily:      FONTS.mono,
    fontSize:        12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fieldLabel: {
    fontFamily:    FONTS.mono,
    fontSize:      9,
    color:         COLORS.text600,
    letterSpacing: 1,
    marginBottom:  4,
  },
  tabToggle: {
    borderWidth:   1,
    borderColor:   COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,9,8,0.85)',
    alignItems:      'center',
    justifyContent:  'center',
  },
});
