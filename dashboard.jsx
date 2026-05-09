import React, { useState, useMemo } from 'react';

/* =========================================================================
 * DASHBOARD — Daily Home Screen
 * The unifying surface. First view on app open. Pulls a snapshot from
 * every module so the user can see the whole picture at once and drill
 * into any module from here.
 *
 * Production notes:
 *   - All snapshot data is fetched in a single edge-function call:
 *     `get-daily-dashboard` joins biometric_entries, nutrition_logs,
 *     workouts, coach_recommendations and returns a single object.
 *   - Cached for 60s on the client via TanStack Query.
 *   - Each card is a navigable link to its parent module.
 * ========================================================================= */

// -------------------- DATA --------------------
const TODAY = {
  date: new Date('2026-05-08'),
  user: { name: 'Marcus', tier: 'Pro', initials: 'M' },
  program: { week: 5, duration: 12, phase: 'cut' },
  streak: 23,

  weight: { current: 80.4, yesterday: 80.6, weekAgo: 81.5, goal: 80.0 },

  nutrition: {
    consumed: { kcal: 1310, protein: 104, carbs: 130, fat: 38 },
    target:   { kcal: 2200, protein: 180, carbs: 220, fat: 70 },
    mealsLogged: 4,
  },

  workout: {
    name: 'Push Day',
    exercises: [
      { name: 'Barbell Bench Press', sets: 4 },
      { name: 'Incline DB Press',    sets: 4 },
      { name: 'Cable Crossover',     sets: 3 },
      { name: 'OHP',                 sets: 3 },
      { name: 'Tricep Pushdown',     sets: 3 },
    ],
    estimatedMinutes: 65,
    completed: false,
    lastSession: '2 days ago',
  },

  coach: {
    headline: 'Add 100 kcal',
    summary: 'Cut too aggressive — protect muscle',
    daysAgo: 0,
    fresh: true,
  },

  // 7 days, Monday → Sunday
  weeklyAdherence: [
    { day: 'M', label: 'May 4', workout: true,  meals: true,  weight: true },
    { day: 'T', label: 'May 5', workout: true,  meals: true,  weight: true },
    { day: 'W', label: 'May 6', workout: null,  meals: true,  weight: true,  rest: true },
    { day: 'T', label: 'May 7', workout: true,  meals: true,  weight: true },
    { day: 'F', label: 'May 8', workout: false, meals: true,  weight: true,  today: true },
    { day: 'S', label: 'May 9', workout: false, meals: false, weight: false, future: true },
    { day: 'S', label: 'May 10', workout: false, meals: false, weight: false, future: true },
  ],

  recentActivity: [
    { time: '06:14', type: 'coach',  text: 'New macros recommended (+100 kcal)' },
    { time: '07:42', type: 'weight', text: '80.4 kg logged' },
    { time: '08:14', type: 'meal',   text: 'Oatmeal & Blueberries · 380 kcal' },
    { time: '12:38', type: 'meal',   text: 'Greek Yogurt & Walnuts · 240 kcal' },
    { time: '15:02', type: 'meal',   text: 'Whey Protein Shake · 150 kcal' },
    { time: '15:20', type: 'photo',  text: 'Progress photos uploaded · week 5' },
  ],
};

const NAV_MODULES = [
  { id: 'home',     label: 'Home',     active: true },
  { id: 'IRONLAB',    label: 'IRONLAB',    active: false },
  { id: 'vision',   label: 'Vision',   active: false },
  { id: 'vault',    label: 'Vault',    active: false },
  { id: 'library',  label: 'Library',  active: false },
  { id: 'coach',    label: 'Coach',    active: false },
];

// -------------------- HELPERS --------------------
const fmt0 = (n) => Math.round(n).toLocaleString('en-US');
const fmt1 = (n) => n.toFixed(1);
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};
const fmtDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// -------------------- ACTIVITY ICONS --------------------
function ActivityIcon({ type }) {
  const props = { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' };
  switch (type) {
    case 'meal':
      return (
        <svg {...props}>
          <path d="M3 3v8M3 7h2M11 3v8M11 7c-1.5 0-2-1-2-2V3" />
        </svg>
      );
    case 'weight':
      return (
        <svg {...props}>
          <rect x="2" y="4" width="10" height="7" rx="1" />
          <path d="M5 4V3h4v1" />
          <path d="M5 7h4" />
        </svg>
      );
    case 'photo':
      return (
        <svg {...props}>
          <rect x="2" y="4" width="10" height="8" rx="1" />
          <circle cx="7" cy="8" r="2" />
          <path d="M5 4l1-2h2l1 2" />
        </svg>
      );
    case 'workout':
      return (
        <svg {...props}>
          <path d="M2 7h2M10 7h2M4 5v4M10 5v4M5 6h5v2H5z" fill="currentColor" />
        </svg>
      );
    case 'coach':
      return (
        <svg {...props}>
          <circle cx="7" cy="7" r="5" />
          <path d="M7 4v3l2 1" />
        </svg>
      );
    default:
      return <svg {...props}><circle cx="7" cy="7" r="2" fill="currentColor" /></svg>;
  }
}

// -------------------- MINI CALORIE RING --------------------
function MiniCalorieRing({ consumed, target }) {
  const pct = Math.min(consumed / target, 1);
  const r = 36;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="44" cy="44" r={r}
          fill="none" stroke="url(#mini-grad)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
        />
        <defs>
          <linearGradient id="mini-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ff5a2a" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-anton text-xl tabular-nums text-stone-100 leading-none">{fmt0(consumed)}</span>
        <span className="text-[8px] uppercase tracking-wider text-stone-500 font-mono mt-0.5">/{fmt0(target)}</span>
      </div>
    </div>
  );
}

// -------------------- SPARKLINE --------------------
function MiniSparkline({ values }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x},${y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <path d={path} stroke="#ed7a2a" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2" fill="#ed7a2a" />
    </svg>
  );
}

// -------------------- WEEKLY ADHERENCE GRID --------------------
function WeeklyGrid({ days }) {
  const Cell = ({ status, label }) => {
    const colors = {
      done:  'bg-orange-500',
      missed: 'bg-red-500/20 border border-red-500/40',
      rest:  'bg-stone-800 border border-stone-700',
      future: 'bg-stone-900/40 border border-stone-800/40',
      empty: 'bg-stone-900/40 border border-stone-800/40',
    };
    return (
      <div className="flex flex-col items-center gap-1">
        <div className={`w-full h-2 ${colors[status]}`} title={`${label}: ${status}`} />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => (
          <div key={i} className="text-center">
            <div className={`text-[9px] uppercase tracking-wider font-mono ${d.today ? 'text-orange-300' : 'text-stone-600'}`}>
              {d.day}
            </div>
            <div className={`text-[9px] tabular-nums font-mono mt-0.5 ${d.today ? 'text-orange-400' : 'text-stone-700'}`}>
              {d.label.split(' ')[1]}
            </div>
          </div>
        ))}
      </div>

      {/* Rows: Workout, Meals, Weight */}
      {[
        { key: 'workout', label: 'Workout', getter: d => d.future ? 'future' : d.rest ? 'rest' : d.workout === true ? 'done' : d.workout === false ? (d.today ? 'future' : 'missed') : 'rest' },
        { key: 'meals',   label: 'Nutrition', getter: d => d.future ? 'future' : d.meals ? 'done' : 'missed' },
        { key: 'weight',  label: 'Weight',  getter: d => d.future ? 'future' : d.weight ? 'done' : 'missed' },
      ].map(row => (
        <div key={row.key}>
          <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono mb-1.5">{row.label}</div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((d, i) => (
              <Cell key={i} status={row.getter(d)} label={d.label} />
            ))}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-3 border-t border-stone-800/60 text-[9px] uppercase tracking-wider text-stone-600 font-mono">
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-orange-500" />Done</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-red-500/20 border border-red-500/40" />Missed</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-stone-800 border border-stone-700" />Rest</span>
      </div>
    </div>
  );
}

// -------------------- MAIN --------------------
export default function Dashboard() {
  const t = TODAY;
  const remaining = t.nutrition.target.kcal - t.nutrition.consumed.kcal;
  const weightDelta = t.weight.current - t.weight.weekAgo;
  const completedDays = t.weeklyAdherence.filter(d => d.workout === true).length;
  const totalWorkoutDays = t.weeklyAdherence.filter(d => !d.rest && !d.future).length;

  // Mini sparkline data — last 7 days of weights
  const weightSparkline = [81.5, 81.4, 81.2, 81.0, 80.8, 80.6, 80.4];

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
        .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
        .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
        body { background: #0a0908; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)'
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[40vh] opacity-[0.06] blur-3xl" style={{
          background: 'radial-gradient(ellipse, #ff5a2a 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10">
        {/* TOP NAV */}
        <nav className="border-b border-stone-800/60 bg-stone-950/40 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <div className="font-anton text-2xl uppercase tracking-tight text-stone-100">
                <span className="text-orange-500">▲</span> IRONLAB
              </div>
              <div className="hidden md:flex items-center gap-1">
                {NAV_MODULES.map(m => (
                  <button
                    key={m.id}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider font-mono transition-colors ${
                      m.active
                        ? 'text-orange-300 bg-orange-500/10 border border-orange-500/30'
                        : 'text-stone-500 hover:text-stone-200 border border-transparent hover:border-stone-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-mono">
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                {t.streak}d streak
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono">
                {t.user.tier}
              </span>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-anton text-stone-950 text-base">
                {t.user.initials}
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-[1400px] mx-auto px-6 py-8">

          {/* GREETING */}
          <header className="mb-8">
            <div className="flex items-baseline gap-3 mb-2">
              <h1 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100">
                {greeting()}, <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">{t.user.name}</span>.
              </h1>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-stone-500">
              <span>{fmtDate(t.date)}</span>
              <span className="text-stone-700">·</span>
              <span className="px-2 py-1 bg-orange-500/15 text-orange-300 border border-orange-500/30 uppercase tracking-wider">
                Week {t.program.week} / {t.program.duration} · {t.program.phase}
              </span>
            </div>
          </header>

          {/* TOP STATS STRIP */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-8 border border-stone-800/60 bg-stone-950/40">
            <div className="px-5 py-4 border-r border-stone-800/60">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Weight</div>
              <div className="font-anton text-3xl tabular-nums text-stone-100">{fmt1(t.weight.current)}<span className="text-stone-500 text-lg ml-1">kg</span></div>
              <div className="text-[10px] font-mono tabular-nums text-orange-300 mt-0.5">
                {weightDelta < 0 ? '↓' : '↑'} {fmt1(Math.abs(weightDelta))} kg / 7d
              </div>
            </div>
            <div className="px-5 py-4 border-r border-stone-800/60">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Calories Left</div>
              <div className="font-anton text-3xl tabular-nums text-orange-300">{fmt0(remaining)}</div>
              <div className="text-[10px] font-mono tabular-nums text-stone-500 mt-0.5">
                {fmt0(t.nutrition.consumed.kcal)} / {fmt0(t.nutrition.target.kcal)}
              </div>
            </div>
            <div className="px-5 py-4 border-r border-stone-800/60">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Workout</div>
              <div className="font-anton text-3xl text-stone-100 leading-none mt-1">{t.workout.name}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mt-1">
                {t.workout.exercises.length} exercises · ~{t.workout.estimatedMinutes}m
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Streak</div>
              <div className="font-anton text-3xl tabular-nums text-stone-100">{t.streak}<span className="text-stone-500 text-lg ml-1">days</span></div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mt-0.5">
                personal best · keep going
              </div>
            </div>
          </div>

          {/* COACH ALERT (if fresh) */}
          {t.coach.fresh && (
            <div className="border border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-orange-500/5 p-4 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="#ed7a2a" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="5" />
                  <path d="M7 4v3l2 1" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-orange-400 font-mono">New from Coach</span>
                  <span className="text-[9px] text-stone-700 font-mono">just now</span>
                </div>
                <div className="font-anton text-xl uppercase tracking-tight text-stone-100 leading-tight">
                  {t.coach.headline}
                </div>
                <div className="text-xs text-stone-400">{t.coach.summary}</div>
              </div>
              <button className="shrink-0 px-4 py-2 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors">
                Review →
              </button>
            </div>
          )}

          {/* PRIMARY 3-CARD GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

            {/* TODAY'S WORKOUT */}
            <div className="lg:col-span-5 border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Today's Workout</span>
                <span className="text-[9px] text-stone-700 font-mono">→ IRONLAB</span>
              </div>
              <div className="font-anton text-4xl uppercase tracking-tight text-stone-100 leading-none mb-2">
                {t.workout.name}
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-stone-500 mb-5">
                {t.workout.exercises.length} exercises · ~{t.workout.estimatedMinutes} min · last done {t.workout.lastSession}
              </div>
              <div className="space-y-2 mb-5 flex-1">
                {t.workout.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-stone-800/40 last:border-b-0">
                    <span className="font-mono text-[10px] tabular-nums text-stone-600 w-5">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1 text-stone-300 text-sm">{ex.name}</span>
                    <span className="font-mono text-[10px] tabular-nums text-stone-500">{ex.sets} × sets</span>
                  </div>
                ))}
              </div>
              <button className="w-full px-5 py-3 bg-orange-500 text-stone-950 font-anton text-base uppercase tracking-wider hover:bg-orange-400 transition-colors">
                Start Workout →
              </button>
            </div>

            {/* TODAY'S MACROS */}
            <div className="lg:col-span-4 border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Today's Macros</span>
                <span className="text-[9px] text-stone-700 font-mono">→ vision</span>
              </div>
              <div className="flex items-center gap-4 mb-5">
                <MiniCalorieRing consumed={t.nutrition.consumed.kcal} target={t.nutrition.target.kcal} />
                <div className="flex-1 min-w-0">
                  <div className="font-anton text-2xl tabular-nums text-orange-300 leading-none">{fmt0(remaining)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-1">kcal remaining</div>
                  <div className="text-[10px] font-mono tabular-nums text-stone-600 mt-2">
                    {t.nutrition.mealsLogged} meals logged
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 flex-1">
                {[
                  { l: 'Protein', c: t.nutrition.consumed.protein, t: t.nutrition.target.protein, color: 'rgb(237, 122, 42)' },
                  { l: 'Carbs',   c: t.nutrition.consumed.carbs,   t: t.nutrition.target.carbs,   color: 'rgb(126, 182, 255)' },
                  { l: 'Fat',     c: t.nutrition.consumed.fat,     t: t.nutrition.target.fat,     color: 'rgb(251, 191, 36)' },
                ].map(m => (
                  <div key={m.l}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">{m.l}</span>
                      <span className="font-mono text-[10px] tabular-nums">
                        <span className="text-stone-300">{m.c}</span>
                        <span className="text-stone-600"> / {m.t}g</span>
                      </span>
                    </div>
                    <div className="relative h-1 bg-stone-900">
                      <div className="absolute inset-y-0 left-0" style={{ width: `${Math.min((m.c / m.t) * 100, 100)}%`, background: m.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-5 w-full px-5 py-3 border border-stone-700 text-stone-300 font-anton text-base uppercase tracking-wider hover:bg-stone-800 hover:text-stone-100 transition-colors flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="10" height="8" rx="1" />
                  <circle cx="7" cy="7" r="2" />
                </svg>
                Scan Meal
              </button>
            </div>

            {/* WEIGHT TREND */}
            <div className="lg:col-span-3 border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Body Comp</span>
                <span className="text-[9px] text-stone-700 font-mono">→ vault</span>
              </div>
              <div className="font-anton text-5xl tabular-nums text-stone-100 leading-none mb-2">
                {fmt1(t.weight.current)}
                <span className="text-stone-500 text-2xl ml-1">kg</span>
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-[11px] font-mono tabular-nums text-orange-300">
                  ↓ {fmt1(Math.abs(weightDelta))} kg
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-stone-600">last 7d</span>
              </div>
              <div className="flex-1">
                <MiniSparkline values={weightSparkline} />
              </div>
              <div className="mt-4 pt-4 border-t border-stone-800/60">
                <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Goal</div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="font-anton text-lg text-orange-300 tabular-nums">{t.weight.goal} kg</span>
                  <span className="text-[10px] font-mono tabular-nums text-stone-500">
                    {fmt1(t.weight.current - t.weight.goal)} to go
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* THIS WEEK + ACTIVITY FEED */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

            {/* THIS WEEK */}
            <div className="lg:col-span-7 border border-stone-800/60 bg-stone-950/40 p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">This Week</h2>
                <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">
                  {completedDays}/{totalWorkoutDays} workouts · 5/5 logged
                </span>
              </div>
              <WeeklyGrid days={t.weeklyAdherence} />
              <div className="mt-5 pt-5 border-t border-stone-800/60 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Volume</div>
                  <div className="font-anton text-2xl text-stone-100 tabular-nums">42.8<span className="text-stone-500 text-sm ml-1">k kg</span></div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Avg Daily</div>
                  <div className="font-anton text-2xl text-stone-100 tabular-nums">2,178<span className="text-stone-500 text-sm ml-1">kcal</span></div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Avg Protein</div>
                  <div className="font-anton text-2xl text-stone-100 tabular-nums">181<span className="text-stone-500 text-sm ml-1">g</span></div>
                </div>
              </div>
            </div>

            {/* ACTIVITY FEED */}
            <div className="lg:col-span-5 border border-stone-800/60 bg-stone-950/40 p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Today's Activity</h2>
                <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">
                  {t.recentActivity.length} events
                </span>
              </div>
              <div className="space-y-0">
                {[...t.recentActivity].sort((a, b) => a.time.localeCompare(b.time)).map((a, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-stone-800/40 last:border-b-0">
                    <span className="font-mono text-[10px] tabular-nums text-stone-600 w-10 shrink-0">{a.time}</span>
                    <span className={`shrink-0 w-7 h-7 border flex items-center justify-center ${
                      a.type === 'coach' ? 'text-orange-300 border-orange-500/30 bg-orange-500/5' :
                      a.type === 'meal'  ? 'text-stone-400 border-stone-700/60' :
                      a.type === 'weight' ? 'text-stone-400 border-stone-700/60' :
                      a.type === 'photo' ? 'text-stone-400 border-stone-700/60' :
                      'text-stone-400 border-stone-700/60'
                    }`}>
                      <ActivityIcon type={a.type} />
                    </span>
                    <span className="flex-1 text-stone-300 text-sm truncate">{a.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* QUICK ACCESS TILES */}
          <div className="mb-8">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-anton text-xl uppercase tracking-tight text-stone-100">Modules</h2>
              <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">jump to</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { name: 'IRONLAB',   sub: 'Logger',     accent: 'from-orange-300 to-orange-600' },
                { name: 'Vision',  sub: 'Nutrition',  accent: 'from-amber-300 to-orange-500' },
                { name: 'Vault',   sub: 'Biometric',  accent: 'from-orange-300 to-red-500' },
                { name: 'Library', sub: 'Exercises',  accent: 'from-stone-300 to-stone-500' },
                { name: 'Coach',   sub: 'Engine',     accent: 'from-orange-400 to-orange-700' },
              ].map(m => (
                <button
                  key={m.name}
                  className="group relative overflow-hidden border border-stone-800/60 bg-stone-950/40 hover:border-orange-500/40 transition-all p-4 text-left"
                >
                  <div className="text-[9px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-1">
                    {m.sub}
                  </div>
                  <div className={`font-anton text-2xl uppercase tracking-tight bg-gradient-to-br ${m.accent} bg-clip-text text-transparent`}>
                    {m.name}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute top-3 right-3 text-stone-700 group-hover:text-orange-400 transition-colors">
                    <path d="M3 11L11 3M11 3H5M11 3V9" strokeLinecap="round" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <footer className="pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
            <span>IRONLAB v0.4 · Dashboard · Daily snapshot</span>
            <span>5 modules unified · synced 2s ago</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
