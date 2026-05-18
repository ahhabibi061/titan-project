import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Switch,
  StyleSheet, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { getCalendars } from 'expo-localization';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useProfile, useUpdateProfile, useUpdateMacros } from '../hooks/useSettings';
import { COLORS, FONTS, SPACING } from '../constants/theme';

// ─── Domain ──────────────────────────────────────────────────────────────────

const ACTIVITY_LEVELS = [
  { id: 'sedentary',   label: 'Sedentary',  mult: 1.2   },
  { id: 'light',       label: 'Light',       mult: 1.375 },
  { id: 'moderate',    label: 'Moderate',    mult: 1.55  },
  { id: 'active',      label: 'Active',      mult: 1.725 },
  { id: 'very_active', label: 'Very Active', mult: 1.9   },
];

const GOALS = [
  { id: 'cut',      label: 'Cut',      offset: -300 },
  { id: 'bulk',     label: 'Bulk',     offset: +300 },
  { id: 'recomp',   label: 'Recomp',   offset: 0    },
  { id: 'maintain', label: 'Maintain', offset: 0    },
];

const THEME_OPTIONS = [
  { id: 'dark',    name: 'DARK',    bg: '#0a0908', card: '#1c1917', accent: '#ed7a2a', border: '#292524' },
  { id: 'neutral', name: 'NEUTRAL', bg: '#f5f5f4', card: '#ffffff', accent: '#ed7a2a', border: '#d6d3d1' },
  { id: 'rose',    name: 'ROSE',    bg: '#1a0a0a', card: '#1f1010', accent: '#f43f5e', border: '#3d1515' },
];

const DEFAULT_SETTINGS = {
  ghost_mode: false, coach_alerts: true, eat_back_calories: false,
  macro_mode: 'auto', weight_unit: 'kg', height_unit: 'cm',
  energy_unit: 'kcal', volume_unit: 'ml', distance_unit: 'km',
  theme: 'dark',
};

function calcMacros({ weightKg, heightCm, age, sex, activity, goal }: any) {
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr  = sex === 'male' ? base + 5 : base - 161;
  const mult  = ACTIVITY_LEVELS.find(a => a.id === activity)?.mult ?? 1.55;
  const tdee  = bmr * mult;
  const offset = GOALS.find(g => g.id === goal)?.offset ?? 0;
  const kcal   = Math.round(tdee + offset);
  const protein = Math.round(weightKg * 2.205);
  const fat     = Math.round((kcal * 0.25) / 9);
  const carbs   = Math.round((kcal - protein * 4 - fat * 9) / 4);
  return { kcal, protein, carbs, fat };
}

// ─── Primitives ──────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderText}>{label}</Text>
      <View style={s.sectionHeaderLine} />
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

function SettingRow({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) {
  return (
    <View style={s.settingRow}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={s.settingLabel}>{label}</Text>
        {sub ? <Text style={s.settingSubLabel}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function SegmentedControl({ options, value, onChange }: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.segmented}>
      {options.map(o => (
        <TouchableOpacity
          key={o.id}
          onPress={() => onChange(o.id)}
          style={[s.segmentBtn, value === o.id && s.segmentBtnActive]}
        >
          <Text style={[s.segmentText, value === o.id && s.segmentTextActive]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NumericInput({ value, onChange, unit, placeholder }: {
  value: string; onChange: (v: string) => void; unit?: string; placeholder?: string;
}) {
  return (
    <View style={s.numericWrap}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder={placeholder ?? '—'}
        placeholderTextColor={COLORS.text700}
        style={s.numericInput}
      />
      {unit ? <Text style={s.numericUnit}>{unit}</Text> : null}
    </View>
  );
}

function MacroCard({ label, value, unit, highlight }: {
  label: string; value: number | null; unit: string; highlight?: boolean;
}) {
  return (
    <View style={s.macroCard}>
      <Text style={s.macroCardLabel}>{label}</Text>
      <Text style={[s.macroCardValue, highlight && { color: '#fbbf24' }]}>
        {value != null ? value.toLocaleString() : '—'}
      </Text>
      <Text style={s.macroCardUnit}>{unit}</Text>
    </View>
  );
}

function SaveBtn({ onPress, saving, label = 'Save Changes' }: {
  onPress: () => void; saving: boolean; label?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.5 }]}>
      <Text style={s.saveBtnText}>{saving ? 'Saving…' : label}</Text>
    </TouchableOpacity>
  );
}

function StatusMsg({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return (
    <View style={s.statusError}><Text style={s.statusErrorText}>{error}</Text></View>
  );
  if (success) return (
    <View style={s.statusSuccess}><Text style={s.statusSuccessText}>{success}</Text></View>
  );
  return null;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { updateProfile } = useUpdateProfile();
  const { updateMacros }  = useUpdateMacros();

  // ── Profile
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [profileSaving, setProfileSaving]   = useState(false);
  const [profileStatus, setProfileStatus]   = useState<{ error?: string; success?: string }>({});

  // ── Biometrics
  const [height,    setHeight]    = useState('');
  const [weight,    setWeight]    = useState('');
  const [goalWeight,setGoalWeight]= useState('');
  const [age,       setAge]       = useState('');
  const [sex,       setSex]       = useState('male');
  const [activity,  setActivity]  = useState('moderate');
  const [goal,      setGoal]      = useState('cut');
  const [bioSaving, setBioSaving] = useState(false);
  const [bioStatus, setBioStatus] = useState<{ error?: string; success?: string }>({});

  // ── Macros
  const [macroMode,        setMacroMode]        = useState('auto');
  const [customKcal,       setCustomKcal]       = useState('');
  const [customProteinPct, setCustomProteinPct] = useState('');
  const [customCarbsPct,   setCustomCarbsPct]   = useState('');
  const [customFatPct,     setCustomFatPct]     = useState('');
  const [macroSaving,      setMacroSaving]      = useState(false);
  const [macroStatus,      setMacroStatus]      = useState<{ error?: string; success?: string }>({});

  // ── Preferences & Units
  const [prefs,       setPrefs]      = useState({ ...DEFAULT_SETTINGS });
  const [prefsSaving, setPrefsSaving]= useState(false);
  const [unitDraft,   setUnitDraft]  = useState({ weight_unit: 'kg', height_unit: 'cm', energy_unit: 'kcal', volume_unit: 'ml', distance_unit: 'km' });
  const [unitSaving,  setUnitSaving] = useState(false);
  const [unitSaved,   setUnitSaved]  = useState(false);

  // ── Account
  const [signOutLoading,   setSignOutLoading]   = useState(false);

  // ── Reminders
  const [remindersEnabled, setRemindersEnabled]   = useState(false);
  const [notifPermission,  setNotifPermission]    = useState<string>('undetermined');
  const [workoutReminder,  setWorkoutReminder]    = useState({ on: false, time: '07:00' });
  const [weighInReminder,  setWeighInReminder]    = useState({ on: false, time: '07:30' });
  const [nutritionReminder,setNutritionReminder]  = useState({ on: false, time: '08:00' });

  // ── Timezone
  const [timezone] = useState(() => {
    try { return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
  });

  // ── Populate from profile
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setHeight(String(profile.height_cm ?? ''));
    setWeight(String(profile.weight_kg ?? ''));
    setGoalWeight(String(profile.goal_weight_kg ?? ''));
    setAge(String(profile.age ?? ''));
    setSex(profile.sex ?? 'male');
    setActivity((profile as any).activity_level ?? 'moderate');
    setGoal(profile.goal ?? 'cut');
    const merged = { ...DEFAULT_SETTINGS, ...(profile.settings ?? {}) };
    setPrefs(merged as any);
    setMacroMode((merged as any).macro_mode ?? 'auto');
    setUnitDraft({
      weight_unit:   (merged as any).weight_unit   ?? 'kg',
      height_unit:   (merged as any).height_unit   ?? 'cm',
      energy_unit:   (merged as any).energy_unit   ?? 'kcal',
      volume_unit:   (merged as any).volume_unit   ?? 'ml',
      distance_unit: (merged as any).distance_unit ?? 'km',
    });
    const cm = profile.current_macros;
    if (cm && cm.kcal > 0) {
      setCustomKcal(String(cm.kcal));
      setCustomProteinPct(String(Math.round(cm.protein * 4 / cm.kcal * 100)));
      setCustomCarbsPct(String(Math.round(cm.carbs   * 4 / cm.kcal * 100)));
      setCustomFatPct(String(Math.round(cm.fat       * 9 / cm.kcal * 100)));
    }
  }, [profile]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? '');
    });
    Notifications.getPermissionsAsync().then(({ status }) => setNotifPermission(status));
  }, []);

  const macros = useMemo(() => calcMacros({
    weightKg: parseFloat(weight) || 0,
    heightCm: parseFloat(height) || 0,
    age:      parseFloat(age)    || 0,
    sex, activity, goal,
  }), [weight, height, age, sex, activity, goal]);

  const customGrams = useMemo(() => {
    const kcal = parseFloat(customKcal) || 0;
    const p    = parseFloat(customProteinPct) || 0;
    const c    = parseFloat(customCarbsPct)   || 0;
    const f    = parseFloat(customFatPct)     || 0;
    return {
      protein: Math.round(kcal * p / 100 / 4),
      carbs:   Math.round(kcal * c / 100 / 4),
      fat:     Math.round(kcal * f / 100 / 9),
      pctSum:  Math.round(p + c + f),
    };
  }, [customKcal, customProteinPct, customCarbsPct, customFatPct]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const saveProfile = async () => {
    setProfileSaving(true); setProfileStatus({});
    try {
      await updateProfile({ display_name: displayName.trim() });
      setProfileStatus({ success: 'Profile saved.' });
    } catch (e: any) { setProfileStatus({ error: e.message }); }
    setProfileSaving(false);
  };

  const saveBiometrics = async () => {
    setBioSaving(true); setBioStatus({});
    try {
      await updateProfile({
        height_cm:      parseFloat(height)     || null,
        weight_kg:      parseFloat(weight)     || null,
        goal_weight_kg: parseFloat(goalWeight) || null,
        age:            parseInt(age, 10)      || null,
        sex, goal,
        activity_level: activity,
        current_macros: macros ?? undefined,
      } as any);
      setBioStatus({ success: 'Biometrics saved. Macros updated.' });
    } catch (e: any) { setBioStatus({ error: e.message }); }
    setBioSaving(false);
  };

  const saveMacroTargets = async () => {
    setMacroSaving(true); setMacroStatus({});
    let macrosToSave;
    if (macroMode === 'auto') {
      if (!macros) { setMacroStatus({ error: 'Fill in biometrics first.' }); setMacroSaving(false); return; }
      macrosToSave = macros;
    } else {
      const kcal = parseFloat(customKcal) || 0;
      if (kcal < 500 || kcal > 10000) { setMacroStatus({ error: 'Calories must be 500–10,000.' }); setMacroSaving(false); return; }
      if (Math.abs(customGrams.pctSum - 100) > 1) { setMacroStatus({ error: `Percentages must sum to 100% (currently ${customGrams.pctSum}%).` }); setMacroSaving(false); return; }
      macrosToSave = { kcal: Math.round(kcal), protein: customGrams.protein, carbs: customGrams.carbs, fat: customGrams.fat };
    }
    try {
      await updateMacros({ ...macrosToSave, mode: macroMode as 'auto' | 'custom' });
      setMacroStatus({ success: 'Macro targets saved.' });
    } catch (e: any) { setMacroStatus({ error: e.message }); }
    setMacroSaving(false);
  };

  const savePref = async (key: string, value: any) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next as any);
    setPrefsSaving(true);
    if (key === 'eat_back_calories') {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('settings').upsert({ user_id: user?.id, eat_back_calories: value }, { onConflict: 'user_id' });
    } else {
      await updateProfile({ settings: next } as any).catch(() => {});
    }
    setPrefsSaving(false);
  };

  const saveUnits = async () => {
    setUnitSaving(true); setUnitSaved(false);
    const next = { ...prefs, ...unitDraft };
    try {
      await updateProfile({ settings: next } as any);
      setPrefs(next as any);
      setUnitSaved(true);
      setTimeout(() => setUnitSaved(false), 3000);
    } catch {}
    setUnitSaving(false);
  };

  const requestNotifPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifPermission(status);
    if (status !== 'granted') {
      Alert.alert('Notifications Blocked', 'Enable notifications in your device Settings to use reminders.');
    }
  };

  const scheduleReminder = async (identifier: string, title: string, body: string, hour: number, minute: number) => {
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body },
      trigger: { hour, minute, repeats: true } as any,
    });
  };

  const toggleReminder = async (type: 'workout' | 'weighIn' | 'nutrition', enabled: boolean, time: string) => {
    if (enabled && notifPermission !== 'granted') { await requestNotifPermission(); return; }
    const [h, m] = time.split(':').map(Number);
    const configs: Record<string, [string, string, string]> = {
      workout:   ['workout-reminder',   'Time to train 🏋️', 'Log your workout in Forge.'],
      weighIn:   ['weighin-reminder',   'Daily Weigh-In ⚖️', 'Log your weight in Vault.'],
      nutrition: ['nutrition-reminder', 'Log Your Meals 🍽️', 'Track nutrition in Sentinel.'],
    };
    const [id, title, body] = configs[type];
    if (enabled) {
      await scheduleReminder(id, title, body, h, m);
    } else {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    await supabase.auth.signOut();
    setSignOutLoading(false);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Account deletion is handled by our support team. Email us and we\'ll process it within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email Support', onPress: () => Linking.openURL('mailto:support@ironlab.app') },
      ],
    );
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const tier = profile?.subscription_tier ?? 'basic';
  const tierColor = { basic: COLORS.text500, pro: COLORS.accent, elite: '#fbbf24' }[tier] ?? COLORS.text500;

  if (profileLoading) return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.backBtn}>‹ BACK</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>SETTINGS</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── 1. PROFILE ──────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader label="Profile" />
          <View style={s.card}>
            <FieldLabel>Display Name</FieldLabel>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="How should we address you?"
              placeholderTextColor={COLORS.text700}
              style={s.textInput}
            />
            <View style={{ height: 12 }} />
            <FieldLabel>Email</FieldLabel>
            <View style={[s.textInput, { justifyContent: 'center', opacity: 0.5 }]}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text300 }}>{email || '—'}</Text>
            </View>
            <Text style={s.helperText}>Managed by Supabase Auth — change via your email provider</Text>
            <View style={{ height: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SaveBtn onPress={saveProfile} saving={profileSaving} label="Save Profile" />
              <StatusMsg {...profileStatus} />
            </View>
          </View>
        </View>

        {/* ── 2. BIOMETRICS ───────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader label="Biometrics" />
          <View style={s.card}>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Height</FieldLabel>
                <NumericInput value={height} onChange={setHeight} unit="cm" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Weight</FieldLabel>
                <NumericInput value={weight} onChange={setWeight} unit="kg" />
              </View>
            </View>
            <View style={[s.row2, { marginTop: 10 }]}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Goal Weight</FieldLabel>
                <NumericInput value={goalWeight} onChange={setGoalWeight} unit="kg" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Age</FieldLabel>
                <NumericInput value={age} onChange={setAge} unit="yrs" />
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <FieldLabel>Sex</FieldLabel>
              <SegmentedControl
                options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }]}
                value={sex} onChange={setSex}
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <FieldLabel>Goal</FieldLabel>
              <SegmentedControl
                options={GOALS.map(g => ({ id: g.id, label: g.label }))}
                value={goal} onChange={setGoal}
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <FieldLabel>Activity Level</FieldLabel>
              <SegmentedControl
                options={ACTIVITY_LEVELS.map(a => ({ id: a.id, label: a.label.split(' ')[0] }))}
                value={activity} onChange={setActivity}
              />
            </View>
            {macros && (
              <View style={{ marginTop: 16 }}>
                <Text style={s.computedLabel}>Computed Macros — Mifflin-St Jeor</Text>
                <View style={s.macroGrid}>
                  <MacroCard label="Calories" value={macros.kcal}    unit="kcal/day" highlight />
                  <MacroCard label="Protein"  value={macros.protein} unit="grams" />
                  <MacroCard label="Carbs"    value={macros.carbs}   unit="grams" />
                  <MacroCard label="Fat"      value={macros.fat}     unit="grams" />
                </View>
              </View>
            )}
            <View style={{ height: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SaveBtn onPress={saveBiometrics} saving={bioSaving} label="Save & Recompute Macros" />
              <StatusMsg {...bioStatus} />
            </View>
          </View>
        </View>

        {/* ── 3. MACRO TARGETS ────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader label="Macro Targets" />
          <View style={s.card}>
            <FieldLabel>Mode</FieldLabel>
            <SegmentedControl
              options={[{ id: 'auto', label: 'Auto' }, { id: 'custom', label: 'Custom' }]}
              value={macroMode} onChange={setMacroMode}
            />
            {macroMode === 'auto' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={s.helperText}>Macros calculated from height, weight, age, activity & goal above.</Text>
                {macros && (
                  <View style={[s.macroGrid, { marginTop: 10 }]}>
                    <MacroCard label="Calories" value={macros.kcal}    unit="kcal/day" highlight />
                    <MacroCard label="Protein"  value={macros.protein} unit="g/day" />
                    <MacroCard label="Carbs"    value={macros.carbs}   unit="g/day" />
                    <MacroCard label="Fat"      value={macros.fat}     unit="g/day" />
                  </View>
                )}
              </View>
            ) : (
              <View style={{ marginTop: 12, gap: 10 }}>
                <Text style={s.helperText}>Set total daily calories and macro % splits. Grams are calculated automatically.</Text>
                <View>
                  <FieldLabel>Total Daily Calories</FieldLabel>
                  <NumericInput value={customKcal} onChange={setCustomKcal} unit="kcal" />
                </View>
                <View style={s.row3}>
                  {[
                    { label: 'Protein %', val: customProteinPct, set: setCustomProteinPct },
                    { label: 'Carbs %',   val: customCarbsPct,   set: setCustomCarbsPct   },
                    { label: 'Fat %',     val: customFatPct,     set: setCustomFatPct     },
                  ].map(m => (
                    <View key={m.label} style={{ flex: 1 }}>
                      <FieldLabel>{m.label}</FieldLabel>
                      <NumericInput value={m.val} onChange={m.set} unit="%" />
                    </View>
                  ))}
                </View>
                <Text style={[s.helperText, {
                  color: customGrams.pctSum === 100 ? COLORS.green400
                    : Math.abs(customGrams.pctSum - 100) <= 1 ? COLORS.orange300
                    : COLORS.red400,
                }]}>
                  {customGrams.pctSum === 0
                    ? 'Enter % above — must sum to 100%'
                    : `Total: ${customGrams.pctSum}% ${customGrams.pctSum === 100 ? '✓' : `(need ${100 - customGrams.pctSum > 0 ? '+' : ''}${100 - customGrams.pctSum}%)`}`}
                </Text>
                {customKcal && customGrams.pctSum >= 99 && customGrams.pctSum <= 101 && (
                  <View style={s.macroGrid}>
                    <MacroCard label="Calories" value={parseFloat(customKcal) || 0} unit="kcal/day" highlight />
                    <MacroCard label="Protein"  value={customGrams.protein} unit="g/day" />
                    <MacroCard label="Carbs"    value={customGrams.carbs}   unit="g/day" />
                    <MacroCard label="Fat"      value={customGrams.fat}     unit="g/day" />
                  </View>
                )}
              </View>
            )}
            <View style={{ height: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SaveBtn onPress={saveMacroTargets} saving={macroSaving} label="Save Macro Targets" />
              <StatusMsg {...macroStatus} />
            </View>
          </View>
        </View>

        {/* ── 4. PREFERENCES ──────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader label="Preferences" />
          <View style={[s.card, { padding: 0 }]}>
            <SettingRow
              label="Ghost Mode"
              sub="Hide your profile from any future social features"
              right={
                <Switch
                  value={!!(prefs as any).ghost_mode}
                  onValueChange={v => savePref('ghost_mode', v)}
                  trackColor={{ false: '#292524', true: COLORS.accent }}
                  thumbColor={(prefs as any).ghost_mode ? '#0a0908' : '#57534e'}
                />
              }
            />
            <View style={s.rowDivider} />
            <SettingRow
              label="Oracle Alerts"
              sub="Get notified when Oracle has a new recommendation"
              right={
                <Switch
                  value={!!(prefs as any).coach_alerts}
                  onValueChange={v => savePref('coach_alerts', v)}
                  trackColor={{ false: '#292524', true: COLORS.accent }}
                  thumbColor={(prefs as any).coach_alerts ? '#0a0908' : '#57534e'}
                />
              }
            />
            <View style={s.rowDivider} />
            <SettingRow
              label="Count Workout Calories"
              sub="Eat back calories burned during training"
              right={
                <Switch
                  value={!!(prefs as any).eat_back_calories}
                  onValueChange={v => savePref('eat_back_calories', v)}
                  trackColor={{ false: '#292524', true: COLORS.accent }}
                  thumbColor={(prefs as any).eat_back_calories ? '#0a0908' : '#57534e'}
                />
              }
            />
            <View style={s.rowDivider} />
            {/* Timezone */}
            <View style={[s.settingRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <Text style={s.settingLabel}>Timezone</Text>
              <Text style={s.settingSubLabel}>Auto-detected from your device. All logs use local time.</Text>
              <View style={s.timezonePill}>
                <Text style={s.timezonePillText}>{timezone}</Text>
              </View>
              <Text style={[s.helperText, { marginTop: 4 }]}>To change, update your device timezone in system settings.</Text>
            </View>
            <View style={s.rowDivider} />
            {/* Theme */}
            <View style={[s.settingRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <Text style={s.settingLabel}>App Theme</Text>
              <Text style={[s.settingSubLabel, { marginBottom: 12 }]}>Visual appearance of the app.</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {THEME_OPTIONS.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => savePref('theme', t.id)}
                    style={[s.themeCard, (prefs as any).theme === t.id && s.themeCardActive]}
                  >
                    <View style={[s.themePreview, { backgroundColor: t.bg, borderColor: t.border }]}>
                      <View style={[s.themePreviewCard, { backgroundColor: t.card, borderColor: t.border }]} />
                      <View style={[s.themePreviewAccent, { backgroundColor: t.accent }]} />
                    </View>
                    <Text style={[s.themeLabel, (prefs as any).theme === t.id && { color: COLORS.orange300 }]}>{t.name}</Text>
                    {(prefs as any).theme === t.id && <View style={s.themeDot} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          {prefsSaving && <Text style={s.savingText}>Saving…</Text>}
        </View>

        {/* ── 5. UNITS & MEASUREMENTS ─────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader label="Units & Measurements" />
          <View style={[s.card, { padding: 0 }]}>
            {[
              { label: 'Weight', sub: 'Logged weight, plates, and load displays', key: 'weight_unit', options: [{ id: 'kg', label: 'kg' }, { id: 'lbs', label: 'lbs' }] },
              { label: 'Height', sub: 'Displayed in biometrics', key: 'height_unit', options: [{ id: 'cm', label: 'cm' }, { id: 'in', label: 'ft/in' }] },
              { label: 'Energy', sub: 'Calorie targets and displays', key: 'energy_unit', options: [{ id: 'kcal', label: 'kcal' }, { id: 'kj', label: 'kJ' }] },
              { label: 'Volume', sub: 'Water intake and liquids', key: 'volume_unit', options: [{ id: 'ml', label: 'ml' }, { id: 'floz', label: 'fl oz' }] },
              { label: 'Distance', sub: 'Cardio tracking', key: 'distance_unit', options: [{ id: 'km', label: 'km' }, { id: 'mi', label: 'mi' }] },
            ].map((row, i, arr) => (
              <View key={row.key}>
                <View style={s.settingRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={s.settingLabel}>{row.label}</Text>
                    <Text style={s.settingSubLabel}>{row.sub}</Text>
                  </View>
                  <View style={{ width: 120 }}>
                    <SegmentedControl
                      options={row.options}
                      value={(unitDraft as any)[row.key] ?? row.options[0].id}
                      onChange={v => setUnitDraft(d => ({ ...d, [row.key]: v }))}
                    />
                  </View>
                </View>
                {i < arr.length - 1 && <View style={s.rowDivider} />}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <SaveBtn onPress={saveUnits} saving={unitSaving} label="Save Units" />
            {unitSaved && <Text style={s.savedText}>Saved ✓</Text>}
          </View>
        </View>

        {/* ── 6. REMINDERS ────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader label="Reminders" />
          {notifPermission === 'denied' && (
            <View style={s.statusError}>
              <Text style={s.statusErrorText}>Notifications blocked. Enable them in device Settings to use reminders.</Text>
            </View>
          )}
          <View style={[s.card, { padding: 0 }]}>
            <SettingRow
              label="Enable Reminders"
              sub="Push notifications for training, nutrition & recovery"
              right={
                <Switch
                  value={remindersEnabled}
                  onValueChange={async v => {
                    if (v && notifPermission !== 'granted') { await requestNotifPermission(); }
                    setRemindersEnabled(v);
                  }}
                  trackColor={{ false: '#292524', true: COLORS.accent }}
                  thumbColor={remindersEnabled ? '#0a0908' : '#57534e'}
                />
              }
            />
            {remindersEnabled && notifPermission === 'granted' && (
              <>
                <View style={s.rowDivider} />
                <SettingRow
                  label="Workout Reminder 🏋️"
                  sub={`Daily at ${workoutReminder.time}`}
                  right={
                    <Switch
                      value={workoutReminder.on}
                      onValueChange={v => { setWorkoutReminder(r => ({ ...r, on: v })); toggleReminder('workout', v, workoutReminder.time); }}
                      trackColor={{ false: '#292524', true: COLORS.accent }}
                      thumbColor={workoutReminder.on ? '#0a0908' : '#57534e'}
                    />
                  }
                />
                <View style={s.rowDivider} />
                <SettingRow
                  label="Daily Weigh-In ⚖️"
                  sub={`Daily at ${weighInReminder.time}`}
                  right={
                    <Switch
                      value={weighInReminder.on}
                      onValueChange={v => { setWeighInReminder(r => ({ ...r, on: v })); toggleReminder('weighIn', v, weighInReminder.time); }}
                      trackColor={{ false: '#292524', true: COLORS.accent }}
                      thumbColor={weighInReminder.on ? '#0a0908' : '#57534e'}
                    />
                  }
                />
                <View style={s.rowDivider} />
                <SettingRow
                  label="Log Meals 🍽️"
                  sub={`Daily at ${nutritionReminder.time}`}
                  right={
                    <Switch
                      value={nutritionReminder.on}
                      onValueChange={v => { setNutritionReminder(r => ({ ...r, on: v })); toggleReminder('nutrition', v, nutritionReminder.time); }}
                      trackColor={{ false: '#292524', true: COLORS.accent }}
                      thumbColor={nutritionReminder.on ? '#0a0908' : '#57534e'}
                    />
                  }
                />
              </>
            )}
          </View>
        </View>

        {/* ── 7. SUBSCRIPTION ─────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader label="Account" />
          <View style={s.card}>
            {/* Tier badge */}
            <View style={s.tierRow}>
              <View>
                <Text style={s.computedLabel}>Subscription Tier</Text>
                <Text style={[s.tierName, { color: tierColor }]}>{tier.toUpperCase()}</Text>
              </View>
              <View style={[s.tierBadge, { borderColor: `${tierColor}40`, backgroundColor: `${tierColor}15` }]}>
                <Text style={[s.tierBadgeText, { color: tierColor }]}>
                  {tier === 'basic' ? 'Free' : tier === 'pro' ? '$14.99 / mo' : '$19.99 / mo'}
                </Text>
              </View>
            </View>
            {/* Upgrade buttons */}
            {tier !== 'elite' && (
              <View style={{ marginTop: 16, gap: 8 }}>
                <Text style={s.computedLabel}>Upgrade Plan</Text>
                {tier !== 'pro' && (
                  <TouchableOpacity style={s.upgradeBtn} onPress={() => navigation.navigate('Tabs', { screen: 'Oracle' })}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[s.upgradeBtnTitle, { color: COLORS.accent }]}>UPGRADE TO PRO</Text>
                      <Text style={[s.upgradeBtnPrice, { color: COLORS.accent }]}>$14.99</Text>
                    </View>
                    <Text style={s.upgradeBtnSub}>/ month · Sentinel scan · Oracle · Unlimited history</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.upgradeBtn, { borderColor: 'rgba(251,191,36,0.25)', backgroundColor: 'rgba(251,191,36,0.06)' }]}
                  onPress={() => navigation.navigate('Tabs', { screen: 'Oracle' })}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[s.upgradeBtnTitle, { color: '#fbbf24' }]}>UPGRADE TO ELITE</Text>
                    <Text style={[s.upgradeBtnPrice, { color: '#fbbf24' }]}>$19.99</Text>
                  </View>
                  <Text style={s.upgradeBtnSub}>/ month · Real-time coach · Form check · Custom programming</Text>
                </TouchableOpacity>
              </View>
            )}
            {tier === 'elite' && (
              <Text style={[s.helperText, { marginTop: 8, color: '#fbbf24' }]}>You're on the best plan.</Text>
            )}
          </View>
        </View>

        {/* ── 8. ACCOUNT ACTIONS ──────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader label="Security & Data" />
          <View style={[s.card, { padding: 0 }]}>
            <TouchableOpacity
              style={s.settingRow}
              onPress={async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user?.email) return;
                await supabase.auth.resetPasswordForEmail(user.email);
                Alert.alert('Check your inbox', 'A password reset link has been sent to ' + user.email);
              }}
            >
              <Text style={s.settingLabel}>Change Password</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <View style={s.rowDivider} />
            <TouchableOpacity
              style={s.settingRow}
              onPress={handleSignOut}
              disabled={signOutLoading}
            >
              <Text style={[s.settingLabel, signOutLoading && { opacity: 0.5 }]}>
                {signOutLoading ? 'Signing Out…' : 'Sign Out'}
              </Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <View style={s.rowDivider} />
            <TouchableOpacity style={s.settingRow} onPress={handleDeleteAccount}>
              <Text style={[s.settingLabel, { color: COLORS.red400 }]}>Delete Account</Text>
              <Text style={[s.chevron, { color: COLORS.red400 }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 9. HELP & SUPPORT ───────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader label="Help & Support" />
          <View style={[s.card, { padding: 0 }]}>
            {[
              { label: 'Contact Support', action: () => Linking.openURL('mailto:support@ironlab.app') },
              { label: 'Privacy Policy',  action: () => Linking.openURL('https://ironlab.app/privacy') },
              { label: 'Terms of Service',action: () => Linking.openURL('https://ironlab.app/terms') },
            ].map((item, i, arr) => (
              <View key={item.label}>
                <TouchableOpacity style={s.settingRow} onPress={item.action}>
                  <Text style={s.settingLabel}>{item.label}</Text>
                  <Text style={s.chevron}>›</Text>
                </TouchableOpacity>
                {i < arr.length - 1 && <View style={s.rowDivider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <Text style={s.footer}>IRONLAB v{version}</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: COLORS.bg },
  scroll:   { paddingHorizontal: SPACING.lg, paddingBottom: 48 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontFamily: FONTS.anton, fontSize: 18, color: COLORS.text100, letterSpacing: 1 },

  section: { marginTop: SPACING.xl },
  card:    { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, padding: SPACING.lg },

  sectionHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionHeaderText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange400, textTransform: 'uppercase', letterSpacing: 4 },
  sectionHeaderLine: { flex: 1, height: 1, backgroundColor: 'rgba(41,37,36,0.6)' },

  fieldLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 6 },
  helperText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, marginTop: 4 },
  computedLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 },

  textInput: {
    backgroundColor: 'rgba(12,11,10,0.6)', borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FONTS.sans, fontSize: 14, color: COLORS.text100,
  },

  numericWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(12,11,10,0.6)', borderWidth: 1, borderColor: COLORS.border },
  numericInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text100 },
  numericUnit:  { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, paddingRight: 10 },

  segmented:        { flexDirection: 'row', backgroundColor: 'rgba(12,11,10,0.6)', borderWidth: 1, borderColor: COLORS.border, padding: 2, gap: 2 },
  segmentBtn:       { flex: 1, paddingVertical: 7, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: COLORS.accent },
  segmentText:      { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1 },
  segmentTextActive:{ color: COLORS.bg },

  macroGrid: { flexDirection: 'row', gap: 6 },
  macroCard: { flex: 1, borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,11,10,0.4)', padding: 8 },
  macroCardLabel: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  macroCardValue: { fontFamily: FONTS.anton, fontSize: 20, color: COLORS.text100, lineHeight: 24 },
  macroCardUnit:  { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, marginTop: 2 },

  saveBtn:     { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.accent },
  saveBtnText: { fontFamily: FONTS.anton, fontSize: 13, color: COLORS.bg, textTransform: 'uppercase', letterSpacing: 2 },
  savedText:   { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.green400, textTransform: 'uppercase', letterSpacing: 1.5 },
  savingText:  { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text700, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 8 },

  statusError:       { borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 10, paddingVertical: 6 },
  statusErrorText:   { fontFamily: FONTS.mono, fontSize: 10, color: '#fca5a5' },
  statusSuccess:     { borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.1)', paddingHorizontal: 10, paddingVertical: 6 },
  statusSuccessText: { fontFamily: FONTS.mono, fontSize: 10, color: '#86efac' },

  settingRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: 14 },
  settingLabel:   { fontFamily: FONTS.sansMed, fontSize: 14, color: COLORS.text100 },
  settingSubLabel:{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, marginTop: 2 },
  rowDivider:     { height: 1, backgroundColor: 'rgba(41,37,36,0.4)', marginHorizontal: SPACING.lg },
  chevron:        { fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text600 },

  timezonePill:     { marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(41,37,36,0.6)', backgroundColor: 'rgba(12,11,10,0.6)', alignSelf: 'flex-start' },
  timezonePillText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.orange300, letterSpacing: 1 },

  themeCard:       { alignItems: 'center', gap: 6, padding: 8, borderWidth: 1, borderColor: COLORS.border },
  themeCardActive: { borderColor: 'rgba(237,122,42,0.6)', backgroundColor: 'rgba(237,122,42,0.05)' },
  themePreview:    { width: 64, height: 40, borderWidth: 1, position: 'relative', overflow: 'hidden' },
  themePreviewCard:{ position: 'absolute', top: 5, left: 5, right: 5, height: 10, borderWidth: 1 },
  themePreviewAccent: { position: 'absolute', bottom: 5, left: 5, width: 20, height: 5 },
  themeLabel:      { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1.5 },
  themeDot:        { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.orange400 },

  tierRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierName:      { fontFamily: FONTS.anton, fontSize: 26, textTransform: 'uppercase', lineHeight: 32 },
  tierBadge:     { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  tierBadgeText: { fontFamily: FONTS.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 },

  upgradeBtn:      { borderWidth: 1, borderColor: 'rgba(237,122,42,0.25)', backgroundColor: 'rgba(237,122,42,0.06)', padding: 14 },
  upgradeBtnTitle: { fontFamily: FONTS.anton, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' },
  upgradeBtnPrice: { fontFamily: FONTS.anton, fontSize: 18 },
  upgradeBtnSub:   { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },

  row2: { flexDirection: 'row', gap: 10 },
  row3: { flexDirection: 'row', gap: 8 },

  footer: {
    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text700,
    textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginTop: 32, marginBottom: 16,
  },
});
