import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from '../hooks/useSession';
import { useProfileStore } from '../store/useProfileStore';
import { useTheme, THEME_OPTIONS } from '../hooks/useTheme';
import { PENDING_TIER_KEY } from '../hooks/useProfile';

// -------------------- DOMAIN --------------------
const ACTIVITY_LEVELS = [
  { id: 'sedentary',   label: 'Sedentary',   mult: 1.2 },
  { id: 'light',       label: 'Light',        mult: 1.375 },
  { id: 'moderate',    label: 'Moderate',     mult: 1.55 },
  { id: 'active',      label: 'Active',       mult: 1.725 },
  { id: 'very_active', label: 'Very Active',  mult: 1.9 },
];

const GOALS = [
  { id: 'cut',      label: 'Cut',      offset: -300 },
  { id: 'bulk',     label: 'Bulk',     offset: +300 },
  { id: 'recomp',   label: 'Recomp',   offset: 0 },
  { id: 'maintain', label: 'Maintain', offset: 0 },
];

// -------------------- MACRO LOGIC (mirrors onboarding) --------------------
function calcMacros({ weightKg, heightCm, age, sex, activity, goal }) {
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr  = sex === 'male' ? base + 5 : base - 161;
  const mult = ACTIVITY_LEVELS.find(a => a.id === activity)?.mult ?? 1.55;
  const tdee = bmr * mult;
  const offset = GOALS.find(g => g.id === goal)?.offset ?? 0;
  const kcal   = Math.round(tdee + offset);
  const protein = Math.round(weightKg * 2.205);
  const fat     = Math.round((kcal * 0.25) / 9);
  const carbs   = Math.round((kcal - protein * 4 - fat * 9) / 4);
  return { kcal, protein, carbs, fat };
}

const DEFAULT_SETTINGS = {
  ghost_mode:     false,
  weight_unit:    'kg',
  height_unit:    'cm',
  energy_unit:    'kcal',
  volume_unit:    'ml',
  distance_unit:  'km',
  coach_alerts:   true,
  eat_back_calories: false,
  macro_mode:     'auto',
};

// -------------------- UI PRIMITIVES --------------------
function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="text-[10px] uppercase tracking-[0.25em] text-orange-400 font-mono">{label}</span>
      <div className="flex-1 h-px bg-stone-800/60" />
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, disabled, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 text-stone-100 text-sm focus:outline-none focus:border-orange-500/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ fontFamily: 'Manrope, sans-serif' }}
    />
  );
}

function NumberInput({ value, onChange, unit, min, max }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 pr-14 text-stone-100 font-mono text-sm tabular-nums focus:outline-none focus:border-orange-500/60 transition-colors"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 font-mono text-xs uppercase tracking-wider">
        {unit}
      </span>
    </div>
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors appearance-none"
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2378716c' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
    >
      {options.map(o => (
        <option key={o.id} value={o.id} style={{ background: '#1c1917' }}>{o.label}</option>
      ))}
    </select>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex bg-stone-950/60 border border-stone-800 p-1 gap-1">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className="flex-1 px-3 py-2 text-xs uppercase tracking-wider font-mono transition-all"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            background: value === o.id ? '#ed7a2a' : 'transparent',
            color: value === o.id ? '#0a0908' : '#78716c',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className="relative w-11 h-6 rounded-full transition-colors shrink-0"
      style={{ background: enabled ? '#ed7a2a' : '#292524' }}
      aria-pressed={enabled}
    >
      <span
        className="absolute top-1 w-4 h-4 rounded-full transition-transform"
        style={{
          background: enabled ? '#0a0908' : '#57534e',
          transform: enabled ? 'translateX(22px)' : 'translateX(4px)',
        }}
      />
    </button>
  );
}

function MacroStatCard({ label, value, unit, highlight }) {
  return (
    <div className="border border-stone-800/60 bg-stone-950/40 p-4">
      <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-1">{label}</div>
      <div
        className="font-anton text-3xl tabular-nums leading-none"
        style={{ fontFamily: 'Anton, sans-serif', color: highlight ? '#fbbf24' : '#e7e5e4' }}
      >
        {value?.toLocaleString() ?? '—'}
      </div>
      <div className="text-[10px] font-mono text-stone-500 mt-1">{unit}</div>
    </div>
  );
}

function SaveButton({ onClick, saving, label = 'Save Changes' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="px-6 py-2.5 uppercase tracking-wider transition-opacity disabled:opacity-50"
      style={{
        fontFamily: 'Anton, sans-serif',
        fontSize: 13,
        letterSpacing: 2,
        background: 'linear-gradient(135deg, #ed7a2a, #ff5a2a)',
        color: '#0a0908',
      }}
    >
      {saving ? 'Saving…' : label}
    </button>
  );
}

function StatusMessage({ error, success }) {
  if (error) return (
    <p className="text-xs font-mono px-3 py-2 border border-red-500/30 bg-red-500/10 text-red-300">{error}</p>
  );
  if (success) return (
    <p className="text-xs font-mono px-3 py-2 border border-green-500/30 bg-green-500/10 text-green-300">{success}</p>
  );
  return null;
}

// -------------------- DELETE MODAL --------------------
function DeleteModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm border border-stone-800 p-8"
        style={{ background: '#0f0e0d' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-[10px] uppercase tracking-[0.2em] text-red-400 font-mono mb-3">Danger Zone</div>
        <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: 24, letterSpacing: 1, color: '#e7e5e4' }} className="uppercase mb-3">
          Delete Account
        </h3>
        <p className="text-sm text-stone-400 mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Account deletion is handled by our support team to ensure all your data is properly removed.
          Email us and we'll process it within 24 hours.
        </p>
        <a
          href="mailto:support@ironlab.app"
          className="block w-full text-center py-3 border border-stone-700 text-stone-300 font-mono text-xs uppercase tracking-wider hover:border-stone-500 transition-colors mb-3"
        >
          support@ironlab.app
        </a>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 text-xs uppercase tracking-wider font-mono text-stone-500 hover:text-stone-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// -------------------- MAIN --------------------
export default function SettingsPage() {
  const navigate = useNavigate();
  const { session, user, loading: sessionLoading } = useSession();
  const storeProfile  = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const { theme, setTheme } = useTheme();

  // ---- Profile section ----
  const [displayName, setDisplayName]   = useState('');
  const [email, setEmail]               = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState({ error: null, success: null });

  // ---- Biometrics section ----
  const [height,     setHeight]     = useState('');
  const [weight,     setWeight]     = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [age,        setAge]        = useState('');
  const [sex,        setSex]        = useState('male');
  const [activity,   setActivity]   = useState('moderate');
  const [goal,       setGoal]       = useState('cut');
  const [bioSaving,  setBioSaving]  = useState(false);
  const [bioStatus,  setBioStatus]  = useState({ error: null, success: null });

  // ---- Custom macro targets ----
  const [macroMode,        setMacroMode]        = useState('auto'); // 'auto' | 'custom'
  const [customKcal,       setCustomKcal]       = useState('');
  const [customProteinPct, setCustomProteinPct] = useState('');
  const [customCarbsPct,   setCustomCarbsPct]   = useState('');
  const [customFatPct,     setCustomFatPct]     = useState('');
  const [macroSaving,      setMacroSaving]      = useState(false);
  const [macroStatus,      setMacroStatus]      = useState({ error: null, success: null });

  // ---- Preferences section ----
  const [prefs, setPrefs]           = useState(DEFAULT_SETTINGS);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // ---- Units section (batch save, not per-toggle) ----
  const [unitDraft,  setUnitDraft]  = useState({});  // pending edits before Save
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitSaved,  setUnitSaved]  = useState(false);

  // ---- Account section ----
  // Derived directly from the store — always in sync, no local state needed.
  const tier = storeProfile?.subscription_tier ?? 'basic';
  const [createdAt,    setCreatedAt]    = useState(null);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(null);
  const [upgradeError, setUpgradeError] = useState(null);

  // ---- Page loading ----
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError,   setLoadError]   = useState(null);

  // Redirect if no session
  useEffect(() => {
    if (!sessionLoading && !session) {
      navigate('/auth', { replace: true });
    }
  }, [session, sessionLoading, navigate]);

  // Re-check subscription_tier from DB every time Settings mounts.
  // The store is seeded at boot; after a Stripe upgrade the webhook may have updated
  // the DB but the store still holds the old tier. This single lightweight query
  // keeps the tier badge and upgrade buttons accurate without a full page reload.
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.subscription_tier !== storeProfile?.subscription_tier) {
          updateProfile({ subscription_tier: data.subscription_tier });
        }
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate form fields from the global profile store (fetched once at app boot)
  useEffect(() => {
    if (!storeProfile) return;
    setDisplayName(storeProfile.display_name ?? '');
    setEmail(user?.email ?? '');
    setHeight(storeProfile.height_cm ?? '');
    setWeight(storeProfile.weight_kg ?? '');
    setGoalWeight(storeProfile.goal_weight_kg ?? '');
    setAge(storeProfile.age ?? '');
    setSex(storeProfile.sex ?? 'male');
    setActivity(storeProfile.activity_level ?? 'moderate');
    setGoal(storeProfile.goal ?? 'cut');

    setCreatedAt(storeProfile.created_at ? new Date(storeProfile.created_at) : null);
    const merged = { ...DEFAULT_SETTINGS, ...(storeProfile.settings ?? {}) };
    setPrefs(merged);
    setMacroMode(merged.macro_mode ?? 'auto');
    const cm = storeProfile.current_macros;
    if (cm && cm.kcal > 0) {
      setCustomKcal(String(cm.kcal));
      setCustomProteinPct(String(Math.round(cm.protein * 4 / cm.kcal * 100)));
      setCustomCarbsPct(String(Math.round(cm.carbs   * 4 / cm.kcal * 100)));
      setCustomFatPct(String(Math.round(cm.fat       * 9 / cm.kcal * 100)));
    }
    setUnitDraft({
      weight_unit:   merged.weight_unit   ?? 'kg',
      height_unit:   merged.height_unit   ?? 'cm',
      energy_unit:   merged.energy_unit   ?? 'kcal',
      volume_unit:   merged.volume_unit   ?? 'ml',
      distance_unit: merged.distance_unit ?? 'km',
    });
    setPageLoading(false);
  }, [storeProfile, user?.email]);

  // Load eat_back_calories from the settings table
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('settings')
      .select('eat_back_calories')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('[settings] load error:', error); return; }
        if (data) {
          setPrefs(prev => ({ ...prev, eat_back_calories: data.eat_back_calories ?? false }));
        }
      });
  }, [user?.id]);

  // Live macro preview
  const macros = useMemo(() => calcMacros({
    weightKg: parseFloat(weight)     || 0,
    heightCm: parseFloat(height)     || 0,
    age:      parseFloat(age)        || 0,
    sex,
    activity,
    goal,
  }), [weight, height, age, sex, activity, goal]);

  // Live gram preview for custom macro mode
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

  // ---- Handlers ----
  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileStatus({ error: null, success: null });
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id);
    setProfileSaving(false);
    if (error) {
      setProfileStatus({ error: error.message, success: null });
    } else {
      updateProfile({ display_name: displayName.trim() });
      setProfileStatus({ error: null, success: 'Profile saved.' });
    }
  };

  const saveBiometrics = async () => {
    setBioSaving(true);
    setBioStatus({ error: null, success: null });
    const bioPayload = {
      height_cm:      parseFloat(height)     || null,
      weight_kg:      parseFloat(weight)     || null,
      goal_weight_kg: parseFloat(goalWeight) || null,
      age:            parseInt(age, 10)      || null,
      sex,
      activity_level: activity,
      goal,
      current_macros: macros,
    };
    const { error } = await supabase
      .from('profiles')
      .update(bioPayload)
      .eq('id', user.id);
    setBioSaving(false);
    if (error) {
      setBioStatus({ error: error.message, success: null });
    } else {
      updateProfile(bioPayload);
      setBioStatus({ error: null, success: 'Biometrics saved. Macros updated.' });
    }
  };

  const saveMacros = async () => {
    setMacroSaving(true);
    setMacroStatus({ error: null, success: null });

    let macrosToSave;
    if (macroMode === 'auto') {
      if (!macros) {
        setMacroSaving(false);
        setMacroStatus({ error: 'Fill in biometrics first to use auto mode.', success: null });
        return;
      }
      macrosToSave = macros;
    } else {
      const kcal = parseFloat(customKcal) || 0;
      const { pctSum, protein, carbs, fat } = customGrams;
      if (kcal < 500 || kcal > 10000) {
        setMacroSaving(false);
        setMacroStatus({ error: 'Calories must be between 500 and 10,000.', success: null });
        return;
      }
      if (pctSum < 99 || pctSum > 101) {
        setMacroSaving(false);
        setMacroStatus({ error: `Percentages must sum to 100% (currently ${pctSum}%).`, success: null });
        return;
      }
      macrosToSave = { kcal: Math.round(kcal), protein, carbs, fat };
    }

    const newSettings = { ...prefs, macro_mode: macroMode };
    const { error } = await supabase
      .from('profiles')
      .update({ current_macros: macrosToSave, settings: newSettings })
      .eq('id', user.id);

    setMacroSaving(false);
    if (error) {
      setMacroStatus({ error: error.message, success: null });
    } else {
      updateProfile({ current_macros: macrosToSave, settings: newSettings });
      setPrefs(newSettings);
      setMacroStatus({ error: null, success: 'Macro targets saved.' });
    }
  };

  const savePref = async (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setPrefsSaving(true);

    if (key === 'eat_back_calories') {
      // eat_back_calories lives in the settings table, not profiles
      const { data, error } = await supabase
        .from('settings')
        .upsert({ user_id: user.id, eat_back_calories: value }, { onConflict: 'user_id' })
        .select();
      console.log('[settings] eat_back_calories upsert →', { value, data, error });
      setPrefsSaving(false);
      if (error) console.error('[settings] eat_back upsert failed:', error);
    } else {
      // Other prefs live in profiles.settings JSONB
      const { error } = await supabase
        .from('profiles')
        .update({ settings: next })
        .eq('id', user.id);
      setPrefsSaving(false);
      if (!error) updateProfile({ settings: next });
    }
  };

  const saveUnits = async () => {
    if (!user?.id) return;
    setUnitSaving(true);
    setUnitSaved(false);
    // Merge unit draft into the existing prefs and write the full settings object
    const next = { ...prefs, ...unitDraft };
    const { error } = await supabase
      .from('profiles')
      .update({ settings: next })
      .eq('id', user.id);
    setUnitSaving(false);
    if (!error) {
      setPrefs(next);
      updateProfile({ settings: next });
      setUnitSaved(true);
      setTimeout(() => setUnitSaved(false), 3000);
    } else {
      console.error('[settings] saveUnits failed:', error);
    }
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  const handleUpgrade = async (priceId, tierName) => {
    setUpgradeLoading(priceId);
    setUpgradeError(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({ priceId, tier: tierName }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to start checkout');
      // Mark the expected tier in localStorage BEFORE the Stripe redirect.
      // After the redirect (full page reload), useProfile reads this and polls
      // until the webhook has updated the DB, then syncs the store.
      localStorage.setItem(PENDING_TIER_KEY, tierName);
      window.location.href = data.url;
    } catch (err) {
      setUpgradeError(err.message);
      setUpgradeLoading(null);
    }
  };

  // Trial end = created_at + 14 days
  const trialEnds = createdAt
    ? new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000)
    : null;
  const trialActive = trialEnds && trialEnds > new Date();

  const tierColor = { basic: '#78716c', pro: '#ed7a2a', elite: '#fbbf24' }[tier] ?? '#78716c';

  // ---- Render ----
  if (sessionLoading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111318' }}>
        <div className="flex flex-col items-center gap-3">
          <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 28, letterSpacing: 4, color: '#ed7a2a' }}>IRONLAB</span>
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'rgba(237,122,42,0.4)', borderTopColor: '#ed7a2a' }} />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111318' }}>
        <p className="text-red-400 font-mono text-sm">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="settings-page min-h-screen w-full" style={{ background: '#111318', fontFamily: 'Manrope, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
        .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
        select option { background: #1c1917; }
      `}</style>

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)'
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[50vh] opacity-[0.08] blur-3xl"
          style={{ background: 'radial-gradient(ellipse, #ff5a2a 0%, transparent 60%)' }} />
      </div>

      {/* TOP NAV */}
      <nav className="border-b border-stone-800/60 bg-stone-950/40 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[960px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="font-anton text-2xl uppercase tracking-tight text-stone-100 no-underline"
              style={{ fontFamily: 'Anton, sans-serif' }}>
              <span className="text-orange-500">▲</span> IRONLAB
            </Link>
            <Link to="/dashboard"
              className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-stone-500 hover:text-stone-300 transition-colors no-underline">
              ← Dashboard
            </Link>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Settings</span>
        </div>
      </nav>

      <div className="relative z-10 max-w-[960px] mx-auto px-6 py-10">

        {/* PAGE TITLE */}
        <header className="mb-10">
          <h1 style={{ fontFamily: 'Anton, sans-serif', fontSize: 48, letterSpacing: 1, color: '#e7e5e4' }}
            className="uppercase leading-none mb-2">
            Settings
          </h1>
          <p className="text-stone-500 font-mono text-xs uppercase tracking-wider">
            {email}
          </p>
        </header>

        <div className="space-y-10">

          {/* ========== SECTION 1: PROFILE ========== */}
          <section className="border border-stone-700/40 bg-stone-900/30 p-6 md:p-8">
            <SectionHeader label="Profile" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div>
                <FieldLabel>Display Name</FieldLabel>
                <TextInput
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="How should we address you?"
                />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <TextInput value={email} disabled />
                <p className="mt-1.5 text-[10px] font-mono text-stone-600">Managed by Supabase Auth — change via your email provider</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <SaveButton onClick={saveProfile} saving={profileSaving} label="Save Profile" />
              <StatusMessage {...profileStatus} />
            </div>
          </section>

          {/* ========== SECTION 2: BIOMETRICS ========== */}
          <section className="border border-stone-700/40 bg-stone-900/30 p-6 md:p-8">
            <SectionHeader label="Biometrics" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div>
                <FieldLabel>Height</FieldLabel>
                <NumberInput value={height} onChange={e => setHeight(e.target.value)} unit="cm" min="120" max="220" />
              </div>
              <div>
                <FieldLabel>Weight</FieldLabel>
                <NumberInput value={weight} onChange={e => setWeight(e.target.value)} unit="kg" min="35" max="200" />
              </div>
              <div>
                <FieldLabel>Goal Weight</FieldLabel>
                <NumberInput value={goalWeight} onChange={e => setGoalWeight(e.target.value)} unit="kg" min="35" max="200" />
              </div>
              <div>
                <FieldLabel>Age</FieldLabel>
                <NumberInput value={age} onChange={e => setAge(e.target.value)} unit="yrs" min="14" max="90" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div>
                <FieldLabel>Sex</FieldLabel>
                <SegmentedControl
                  options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }]}
                  value={sex}
                  onChange={setSex}
                />
              </div>
              <div>
                <FieldLabel>Goal</FieldLabel>
                <SelectInput
                  value={goal}
                  onChange={setGoal}
                  options={GOALS.map(g => ({ id: g.id, label: g.label }))}
                />
              </div>
              <div>
                <FieldLabel>Activity Level</FieldLabel>
                <SelectInput value={activity} onChange={setActivity} options={ACTIVITY_LEVELS} />
              </div>
            </div>

            {/* Computed macro preview */}
            {macros && (
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-3">
                  Computed Macros — Mifflin-St Jeor
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MacroStatCard label="Calories" value={macros.kcal}    unit="kcal / day" highlight />
                  <MacroStatCard label="Protein"  value={macros.protein} unit="grams" />
                  <MacroStatCard label="Carbs"    value={macros.carbs}   unit="grams" />
                  <MacroStatCard label="Fat"      value={macros.fat}     unit="grams" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <SaveButton onClick={saveBiometrics} saving={bioSaving} label="Save & Recompute Macros" />
              <StatusMessage {...bioStatus} />
            </div>
          </section>

          {/* ========== SECTION 3: MACRO TARGETS ========== */}
          <section className="border border-stone-700/40 bg-stone-900/30 p-6 md:p-8">
            <SectionHeader label="Macro Targets" />

            {/* Mode toggle */}
            <div className="mb-6">
              <FieldLabel>Mode</FieldLabel>
              <SegmentedControl
                options={[
                  { id: 'auto',   label: 'Auto — from biometrics' },
                  { id: 'custom', label: 'Custom — I set my own' },
                ]}
                value={macroMode}
                onChange={setMacroMode}
              />
            </div>

            {macroMode === 'auto' ? (
              <div>
                <p className="text-xs font-mono text-stone-500 mb-4">
                  Macros are calculated automatically from your height, weight, age, activity level, and goal.
                  Update those in the Biometrics section above.
                </p>
                {macros && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MacroStatCard label="Calories" value={macros.kcal}    unit="kcal / day" highlight />
                    <MacroStatCard label="Protein"  value={macros.protein} unit="grams / day" />
                    <MacroStatCard label="Carbs"    value={macros.carbs}   unit="grams / day" />
                    <MacroStatCard label="Fat"      value={macros.fat}     unit="grams / day" />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-xs font-mono text-stone-500">
                  Set your total daily calories and the % each macro contributes. Grams are calculated automatically.
                </p>

                {/* Total calories */}
                <div className="max-w-xs">
                  <FieldLabel>Total Daily Calories</FieldLabel>
                  <NumberInput
                    value={customKcal}
                    onChange={e => setCustomKcal(e.target.value)}
                    unit="kcal"
                    min="500"
                    max="10000"
                  />
                </div>

                {/* Macro % inputs */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Protein %', val: customProteinPct, set: setCustomProteinPct, cals: 4, color: '#ed7a2a' },
                    { label: 'Carbs %',   val: customCarbsPct,   set: setCustomCarbsPct,   cals: 4, color: '#7eb6ff' },
                    { label: 'Fat %',     val: customFatPct,     set: setCustomFatPct,     cals: 9, color: '#fbbf24' },
                  ].map(m => (
                    <div key={m.label}>
                      <FieldLabel>{m.label}</FieldLabel>
                      <div className="relative">
                        <input
                          type="number"
                          value={m.val}
                          onChange={e => m.set(e.target.value)}
                          min="0"
                          max="100"
                          className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 pr-8 text-stone-100 font-mono text-sm tabular-nums focus:outline-none focus:border-orange-500/60 transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 font-mono text-xs">%</span>
                      </div>
                      {m.val && customKcal && (
                        <div className="mt-1 text-[10px] font-mono tabular-nums" style={{ color: m.color }}>
                          = {Math.round(parseFloat(customKcal) * parseFloat(m.val) / 100 / m.cals)}g
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Live sum indicator */}
                <div className={`text-[10px] font-mono uppercase tracking-wider ${
                  customGrams.pctSum === 100 ? 'text-green-400' :
                  Math.abs(customGrams.pctSum - 100) <= 1 ? 'text-orange-300' : 'text-red-400'
                }`}>
                  {customGrams.pctSum === 0
                    ? 'Enter percentages above — they must sum to 100%'
                    : `Total: ${customGrams.pctSum}% ${customGrams.pctSum === 100 ? '✓' : `(need ${100 - customGrams.pctSum > 0 ? '+' : ''}${100 - customGrams.pctSum}%)`}`}
                </div>

                {/* Preview */}
                {customKcal && customGrams.pctSum >= 99 && customGrams.pctSum <= 101 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MacroStatCard label="Calories" value={parseFloat(customKcal) || 0} unit="kcal / day" highlight />
                    <MacroStatCard label="Protein"  value={customGrams.protein} unit="grams / day" />
                    <MacroStatCard label="Carbs"    value={customGrams.carbs}   unit="grams / day" />
                    <MacroStatCard label="Fat"      value={customGrams.fat}     unit="grams / day" />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 mt-6">
              <SaveButton onClick={saveMacros} saving={macroSaving} label="Save Macro Targets" />
              <StatusMessage {...macroStatus} />
            </div>
          </section>

          {/* ========== SECTION 4: PREFERENCES ========== */}
          <section className="border border-stone-700/40 bg-stone-900/30 p-6 md:p-8">
            <SectionHeader label="Preferences" />

            <div className="space-y-0 divide-y divide-stone-800/60">

              {/* Ghost Mode */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm text-stone-100" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Ghost Mode</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">Hide your profile from any future social features</div>
                </div>
                <Toggle enabled={prefs.ghost_mode} onChange={v => savePref('ghost_mode', v)} />
              </div>

              {/* Coach Alerts */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm text-stone-100" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Oracle Alerts</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">Get notified when Oracle has a new recommendation</div>
                </div>
                <Toggle enabled={prefs.coach_alerts} onChange={v => savePref('coach_alerts', v)} />
              </div>

              {/* Eat-Back Calories */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm text-stone-100" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Count Workout Calories Toward Daily Goal</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">Eat back calories burned during training</div>
                </div>
                <Toggle enabled={!!prefs.eat_back_calories} onChange={v => savePref('eat_back_calories', v)} />
              </div>

              {/* Timezone */}
              <div className="flex items-start justify-between py-4 gap-4">
                <div>
                  <div className="text-sm text-stone-100" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Timezone</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">Auto-detected from your device. All logs use local time.</div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-stone-900/60 border border-stone-700/60">
                    <span className="text-[10px] font-mono text-orange-300 tracking-wider">
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-stone-600 mt-1.5">To change, update your device timezone in system settings.</div>
                </div>
              </div>

              {/* Theme */}
              <div className="flex items-start justify-between py-4 gap-4">
                <div className="flex-1">
                  <div className="text-sm text-stone-100 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>App Theme</div>
                  <div className="text-xs text-stone-500 font-mono mb-4">Visual appearance. Orange accent in Dark, blue/green in Neutral, pink in Rose.</div>
                  <div className="flex flex-wrap gap-3">
                    {THEME_OPTIONS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`flex flex-col items-center gap-2 p-3 border transition-colors ${
                          theme === t.id
                            ? 'border-orange-500/60 bg-orange-500/5'
                            : 'border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        <div
                          className="w-20 h-12 relative overflow-hidden"
                          style={{ background: t.bg, border: `1px solid ${t.border}` }}
                        >
                          <div
                            className="absolute top-1.5 left-1.5 right-1.5 h-2.5"
                            style={{ background: t.card, border: `1px solid ${t.border}` }}
                          />
                          <div
                            className="absolute bottom-2 left-1.5 w-6 h-1.5"
                            style={{ background: t.accent }}
                          />
                          <div
                            className="absolute bottom-2 right-1.5 w-3 h-1.5"
                            style={{ background: t.border }}
                          />
                        </div>
                        <span className={`text-[9px] font-mono uppercase tracking-wider ${
                          theme === t.id ? 'text-orange-300' : 'text-stone-500'
                        }`}>
                          {t.name}
                        </span>
                        {theme === t.id && (
                          <div className="w-1 h-1 rounded-full bg-orange-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {prefsSaving && (
              <p className="mt-3 text-[10px] font-mono text-stone-600 uppercase tracking-wider">Saving…</p>
            )}
          </section>

          {/* ========== SECTION 3b: UNITS & MEASUREMENTS ========== */}
          <section className="border border-stone-700/40 bg-stone-900/30 p-6 md:p-8">
            <SectionHeader label="Units & Measurements" />

            <div className="space-y-0 divide-y divide-stone-800/60">

              {/* Weight Unit */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm text-stone-100" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Weight</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">Logged weight, plates, and load displays</div>
                </div>
                <div className="w-32">
                  <SegmentedControl
                    options={[{ id: 'kg', label: 'kg' }, { id: 'lbs', label: 'lbs' }]}
                    value={unitDraft.weight_unit ?? 'kg'}
                    onChange={v => setUnitDraft(d => ({ ...d, weight_unit: v }))}
                  />
                </div>
              </div>

              {/* Height Unit */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm text-stone-100" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Height</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">Displayed in biometrics and onboarding</div>
                </div>
                <div className="w-32">
                  <SegmentedControl
                    options={[{ id: 'cm', label: 'cm' }, { id: 'in', label: 'ft/in' }]}
                    value={unitDraft.height_unit ?? 'cm'}
                    onChange={v => setUnitDraft(d => ({ ...d, height_unit: v }))}
                  />
                </div>
              </div>

              {/* Energy Unit */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm text-stone-100" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Energy</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">Calorie targets and burned calorie displays</div>
                </div>
                <div className="w-32">
                  <SegmentedControl
                    options={[{ id: 'kcal', label: 'kcal' }, { id: 'kj', label: 'kJ' }]}
                    value={unitDraft.energy_unit ?? 'kcal'}
                    onChange={v => setUnitDraft(d => ({ ...d, energy_unit: v }))}
                  />
                </div>
              </div>

              {/* Volume Unit */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm text-stone-100" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Volume</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">Water intake and liquid measurements</div>
                </div>
                <div className="w-36">
                  <SegmentedControl
                    options={[{ id: 'ml', label: 'ml' }, { id: 'floz', label: 'fl oz' }]}
                    value={unitDraft.volume_unit ?? 'ml'}
                    onChange={v => setUnitDraft(d => ({ ...d, volume_unit: v }))}
                  />
                </div>
              </div>

              {/* Distance Unit */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm text-stone-100" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Distance</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">Cardio and movement tracking</div>
                </div>
                <div className="w-32">
                  <SegmentedControl
                    options={[{ id: 'km', label: 'km' }, { id: 'mi', label: 'mi' }]}
                    value={unitDraft.distance_unit ?? 'km'}
                    onChange={v => setUnitDraft(d => ({ ...d, distance_unit: v }))}
                  />
                </div>
              </div>

            </div>

            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={saveUnits}
                disabled={unitSaving}
                className="px-5 py-2 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50"
              >
                {unitSaving ? 'Saving…' : 'Save Units'}
              </button>
              {unitSaved && (
                <span className="text-[11px] font-mono text-green-400 uppercase tracking-wider">
                  Saved ✓
                </span>
              )}
            </div>
          </section>

          {/* ========== SECTION 4: ACCOUNT ========== */}
          <section className="border border-stone-700/40 bg-stone-900/30 p-6 md:p-8">
            <SectionHeader label="Account" />

            {/* Tier + Trial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="border border-stone-800/60 bg-stone-950/60 p-4">
                <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-2">Subscription Tier</div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-anton text-2xl uppercase"
                    style={{ fontFamily: 'Anton, sans-serif', color: tierColor }}
                  >
                    {tier}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 border font-mono uppercase tracking-wider"
                    style={{ borderColor: `${tierColor}40`, color: tierColor, background: `${tierColor}15` }}>
                    {tier === 'basic' ? 'Free' : tier === 'pro' ? '$14.99 / mo' : '$19.99 / mo'}
                  </span>
                </div>
              </div>

              <div className="border border-stone-800/60 bg-stone-950/60 p-4">
                <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-2">
                  {trialActive ? 'Trial Ends' : 'Trial Status'}
                </div>
                {trialEnds ? (
                  <div>
                    <div className="font-mono text-sm tabular-nums" style={{ color: trialActive ? '#fbbf24' : '#78716c' }}>
                      {trialEnds.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-[10px] font-mono text-stone-600 mt-0.5">
                      {trialActive
                        ? `${Math.ceil((trialEnds - new Date()) / (1000 * 60 * 60 * 24))} days remaining`
                        : 'Trial period ended'}
                    </div>
                  </div>
                ) : (
                  <div className="font-mono text-sm text-stone-600">—</div>
                )}
              </div>
            </div>

            {/* Upgrade — only shown when profile is loaded AND user is not already on Elite */}
            {storeProfile && tier !== 'elite' && (
              <div className="mb-8">
                <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-4">
                  Upgrade Plan
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* Pro */}
                  {tier !== 'pro' && (
                    <button
                      type="button"
                      disabled={!!upgradeLoading}
                      onClick={() => handleUpgrade(import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY, 'pro')}
                      className="relative group flex flex-col gap-2 p-5 border transition-all disabled:opacity-60 text-left"
                      style={{ borderColor: '#ed7a2a40', background: 'rgba(237,122,42,0.06)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#ed7a2a80'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#ed7a2a40'}
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 16, letterSpacing: 2, color: '#ed7a2a' }}>
                          {upgradeLoading === import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY ? 'REDIRECTING…' : 'UPGRADE TO PRO'}
                        </span>
                        <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 20, color: '#ed7a2a' }}>$14.99</span>
                      </div>
                      <div className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">/ month · Sentinel scan · Oracle · Unlimited history</div>
                    </button>
                  )}

                  {/* Elite */}
                  {tier !== 'elite' && (
                  <button
                    type="button"
                    disabled={!!upgradeLoading}
                    onClick={() => handleUpgrade(import.meta.env.VITE_STRIPE_PRICE_ELITE_MONTHLY, 'elite')}
                    className="relative group flex flex-col gap-2 p-5 border transition-all disabled:opacity-60 text-left"
                    style={{ borderColor: '#fbbf2440', background: 'rgba(251,191,36,0.06)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#fbbf2480'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#fbbf2440'}
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 16, letterSpacing: 2, color: '#fbbf24' }}>
                        {upgradeLoading === import.meta.env.VITE_STRIPE_PRICE_ELITE_MONTHLY ? 'REDIRECTING…' : 'UPGRADE TO ELITE'}
                      </span>
                      <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 20, color: '#fbbf24' }}>$19.99</span>
                    </div>
                    <div className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">/ month · Real-time coach · Form check · Custom programming</div>
                  </button>
                  )}

                </div>

                {upgradeError && (
                  <p className="mt-3 text-xs font-mono px-3 py-2 border border-red-500/30 bg-red-500/10 text-red-300">
                    {upgradeError}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signOutLoading}
                className="px-6 py-2.5 border border-stone-700 text-stone-300 uppercase tracking-wider transition-colors hover:border-stone-500 hover:text-stone-100 disabled:opacity-50"
                style={{ fontFamily: 'Anton, sans-serif', fontSize: 13, letterSpacing: 2 }}
              >
                {signOutLoading ? 'Signing Out…' : 'Sign Out'}
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-6 py-2.5 border border-red-900/40 text-red-500/70 uppercase tracking-wider transition-colors hover:border-red-700/60 hover:text-red-400"
                style={{ fontFamily: 'Anton, sans-serif', fontSize: 13, letterSpacing: 2 }}
              >
                Delete Account
              </button>
            </div>
          </section>

        </div>

        <footer className="mt-12 pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>IRONLAB v0.4 · Settings</span>
          <span>User ID: {user?.id?.slice(0, 8)}…</span>
        </footer>
      </div>

      {showDeleteModal && <DeleteModal onClose={() => setShowDeleteModal(false)} />}
    </div>
  );
}
