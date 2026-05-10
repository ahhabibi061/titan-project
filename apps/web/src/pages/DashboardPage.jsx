import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useDashboard } from '../hooks/useDashboard';

const NAV_MODULES = [
  { id: 'home',       label: 'Home',       path: '/dashboard'  },
  { id: 'logger',     label: 'IRONLAB',    path: '/logger'     },
  { id: 'vision',     label: 'Sentinel',   path: '/nutrition'  },
  { id: 'biometrics', label: 'Biometrics', path: '/biometrics' },
  { id: 'library',    label: 'Codex',      path: '/exercises'  },
  { id: 'coach',      label: 'Oracle',     path: '/coach'      },
];

// -------------------- HELPERS --------------------
const fmt0 = (n) => Math.round(n).toLocaleString('en-US');
const fmt1 = (n) => (n ?? 0).toFixed(1);
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};
const fmtDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// -------------------- SKELETON --------------------
function Sk({ className = '' }) {
  return <div className={`bg-stone-800 animate-pulse rounded-sm ${className}`} />;
}

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
  const pct = Math.min(consumed / (target || 1), 1);
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
  if (!values || values.length < 2) return <Sk className="w-full h-8" />;
  const min   = Math.min(...values);
  const max   = Math.max(...values);
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
      done:   'bg-orange-500',
      missed: 'bg-red-500/20 border border-red-500/40',
      rest:   'bg-stone-800 border border-stone-700',
      future: 'bg-stone-900/40 border border-stone-800/40',
      empty:  'bg-stone-900/40 border border-stone-800/40',
    };
    return (
      <div className="flex flex-col items-center gap-1">
        <div className={`w-full h-2 ${colors[status]}`} title={`${label}: ${status}`} />
      </div>
    );
  };

  if (!days.length) {
    return <Sk className="w-full h-32" />;
  }

  return (
    <div className="space-y-3">
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

      {[
        { key: 'workout', label: 'Workout',   getter: d => d.future ? 'future' : d.rest ? 'rest' : d.workout === true ? 'done' : d.workout === false ? (d.today ? 'future' : 'missed') : 'rest' },
        { key: 'meals',   label: 'Nutrition', getter: d => d.future ? 'future' : d.meals ? 'done' : 'missed' },
        { key: 'weight',  label: 'Weight',    getter: d => d.future ? 'future' : d.weight ? 'done' : 'missed' },
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
  const { user } = useSession();
  const { data, loading } = useDashboard(user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(searchParams.get('upgraded') === 'true');

  useEffect(() => {
    if (showUpgradeBanner) setSearchParams({}, { replace: true });
  }, []);

  // Safe derived values — work in both loading and loaded states
  const profile        = data?.profile        ?? {};
  const consumed       = data?.consumed       ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0 };
  const targets        = data?.adjustedTargets ?? data?.targets ?? { kcal: 2000, protein: 150, carbs: 200, fat: 65 };
  const rawTargets     = data?.targets        ?? { kcal: 2000, protein: 150, carbs: 200, fat: 65 };
  const calsBurned     = data?.calsBurned     ?? null;
  const eatBackCalories = data?.eatBackCalories ?? false;
  const workout        = data?.workout        ?? null;
  const coach          = data?.coach          ?? null;
  const bio            = data?.biometrics     ?? { current: null, weekAgo: null, goal: null, sparkline: [] };
  const weeklyStats    = data?.weeklyStats    ?? { totalSets: 0, avgKcal: 0, avgProtein: 0, streak: 0 };
  const weeklyAdherence = data?.weeklyAdherence ?? [];
  const activityFeed   = data?.activityFeed   ?? [];

  const remaining    = targets.kcal - consumed.kcal;
  const weightDelta  = bio.current != null && bio.weekAgo != null ? bio.current - bio.weekAgo : null;
  const completedDays    = weeklyAdherence.filter(d => d.workout === true).length;
  const totalWorkoutDays = weeklyAdherence.filter(d => !d.rest && !d.future).length;

  const displayName = profile?.display_name || 'Athlete';
  const initials    = (displayName[0] ?? 'A').toUpperCase();
  const tier        = profile?.subscription_tier ?? 'basic';
  const tierLabel   = tier.toUpperCase();
  const goalLabel   = profile?.goal ? `goal: ${profile.goal}` : 'loading';

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
                  <Link
                    key={m.id}
                    to={m.path}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider font-mono transition-colors no-underline ${
                      m.path === '/dashboard'
                        ? 'text-orange-300 bg-orange-500/10 border border-orange-500/30'
                        : 'text-stone-500 hover:text-stone-200 border border-transparent hover:border-stone-700'
                    }`}
                  >
                    {m.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-mono">
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                {loading ? '—' : `${weeklyStats.streak}d streak`}
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono">
                {loading ? '…' : tierLabel}
              </span>
              <Link
                to="/settings"
                title="Settings"
                className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-orange-400 border border-transparent hover:border-stone-700 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="8" cy="8" r="2.5" />
                  <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
                </svg>
              </Link>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-anton text-stone-950 text-base">
                {initials}
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-[1400px] mx-auto px-6 py-8">

          {/* UPGRADE BANNER */}
          {showUpgradeBanner && (
            <div className="relative mb-8 border border-orange-500/40 bg-orange-500/10 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 20, letterSpacing: 2, color: '#ed7a2a' }}>
                  WELCOME TO THE NEXT LEVEL
                </span>
                <span className="text-sm text-stone-300" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Your subscription is now active. All Pro features are unlocked.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowUpgradeBanner(false)}
                className="shrink-0 text-stone-500 hover:text-stone-300 font-mono text-xs uppercase tracking-wider transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* GREETING */}
          <header className="mb-8">
            <div className="flex items-baseline gap-3 mb-2">
              <h1 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100">
                {greeting()},{' '}
                {loading
                  ? <Sk className="inline-block w-32 h-10 align-bottom" />
                  : <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">{displayName}</span>
                }.
              </h1>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-stone-500">
              <span>{fmtDate(new Date())}</span>
              <span className="text-stone-700">·</span>
              <span className="px-2 py-1 bg-orange-500/15 text-orange-300 border border-orange-500/30 uppercase tracking-wider">
                {loading ? '…' : goalLabel}
              </span>
            </div>
          </header>

          {/* TOP STATS STRIP */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-8 border border-stone-800/60 bg-stone-950/40">

            {/* Weight */}
            <div className="px-5 py-4 border-r border-stone-800/60">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Weight</div>
              {loading || bio.current == null ? (
                <>
                  <Sk className="h-8 w-24 mb-1" />
                  <Sk className="h-3 w-16" />
                </>
              ) : (
                <>
                  <div className="font-anton text-3xl tabular-nums text-stone-100">
                    {fmt1(bio.current)}<span className="text-stone-500 text-lg ml-1">kg</span>
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-orange-300 mt-0.5">
                    {weightDelta != null
                      ? `${weightDelta < 0 ? '↓' : '↑'} ${fmt1(Math.abs(weightDelta))} kg / 7d`
                      : 'No prior data'}
                  </div>
                </>
              )}
            </div>

            {/* Calories Left */}
            <div className="px-5 py-4 border-r border-stone-800/60">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Calories Left</div>
              {loading ? (
                <>
                  <Sk className="h-8 w-20 mb-1" />
                  <Sk className="h-3 w-28" />
                </>
              ) : (
                <>
                  <div className={`font-anton text-3xl tabular-nums ${consumed.mealsLogged === 0 ? 'text-stone-500' : 'text-orange-300'}`}>
                    {fmt0(remaining)}
                  </div>
                  {eatBackCalories && calsBurned ? (
                    <div className="text-[10px] font-mono text-orange-400 mt-0.5 tabular-nums">
                      {fmt0(rawTargets.kcal)} + {fmt0(calsBurned)} burned = {fmt0(targets.kcal)} available
                    </div>
                  ) : consumed.mealsLogged > 0 ? (
                    <div className="text-[10px] font-mono text-stone-500 mt-0.5 tabular-nums">
                      {fmt0(consumed.kcal)} / {fmt0(targets.kcal)} kcal
                      {calsBurned ? ` · ${fmt0(calsBurned)} burned` : ''}
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-stone-600 mt-0.5 tabular-nums">
                      {fmt0(targets.kcal)} kcal target
                      {calsBurned ? ` · ${fmt0(calsBurned)} burned` : ''}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Workout */}
            <div className="px-5 py-4 border-r border-stone-800/60">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Workout</div>
              {loading ? (
                <>
                  <Sk className="h-8 w-28 mb-1" />
                  <Sk className="h-3 w-20" />
                </>
              ) : workout ? (
                <>
                  <div className="font-anton text-3xl text-stone-100 leading-none mt-1">{workout.name}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mt-1">
                    {workout.exercises.length} exercises · ~{workout.estimatedMinutes}m
                  </div>
                </>
              ) : (
                <>
                  <div className="font-anton text-3xl text-stone-700 leading-none mt-1">Rest Day</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-stone-600 mt-1">
                    no workout scheduled
                  </div>
                </>
              )}
            </div>

            {/* Streak */}
            <div className="px-5 py-4">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Streak</div>
              {loading ? (
                <>
                  <Sk className="h-8 w-20 mb-1" />
                  <Sk className="h-3 w-28" />
                </>
              ) : (
                <>
                  <div className="font-anton text-3xl tabular-nums text-stone-100">
                    {weeklyStats.streak}<span className="text-stone-500 text-lg ml-1">days</span>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mt-0.5">
                    {weeklyStats.streak === 0 ? 'start your streak today' : 'keep going'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* COACH ALERT — only shown when an unapplied recommendation exists */}
          {!loading && coach && (
            <div className="border border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-orange-500/5 p-4 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="#ed7a2a" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="5" />
                  <path d="M7 4v3l2 1" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-orange-400 font-mono">New from Oracle</span>
                  <span className="text-[9px] text-stone-700 font-mono">just now</span>
                </div>
                <div className="font-anton text-xl uppercase tracking-tight text-stone-100 leading-tight">
                  {coach.headline}
                </div>
                <div className="text-xs text-stone-400">{coach.summary}</div>
              </div>
              <Link
                to="/coach"
                className="shrink-0 px-4 py-2 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors no-underline"
              >
                Review →
              </Link>
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

              {loading ? (
                <div className="flex-1 space-y-3">
                  <Sk className="h-10 w-48" />
                  <Sk className="h-3 w-36" />
                  <div className="space-y-2 mt-4">
                    {[1,2,3,4,5].map(i => <Sk key={i} className="h-9 w-full" />)}
                  </div>
                </div>
              ) : workout ? (
                <>
                  <div className="font-anton text-4xl uppercase tracking-tight text-stone-100 leading-none mb-2">
                    {workout.name}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500">
                      {workout.exercises.length} exercises · ~{workout.estimatedMinutes} min
                      {workout.completed ? ' · completed' : ''}
                    </span>
                  </div>
                  {workout.completed && calsBurned > 0 && (
                    <div className="font-mono text-[11px] text-orange-400 mb-3 tabular-nums">
                      🔥 {fmt0(calsBurned)} cal burned
                    </div>
                  )}
                  {!(workout.completed && calsBurned > 0) && <div className="mb-3" />}
                  <div className="space-y-2 mb-5 flex-1">
                    {workout.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-stone-800/40 last:border-b-0">
                        <span className="font-mono text-[10px] tabular-nums text-stone-600 w-5">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1 text-stone-300 text-sm">{ex.name}</span>
                        <span className="font-mono text-[10px] tabular-nums text-stone-500">{ex.sets} × sets</span>
                      </div>
                    ))}
                    {workout.exercises.length === 0 && (
                      <p className="text-xs font-mono text-stone-600 py-4">No exercises added yet. Open the Logger to build this workout.</p>
                    )}
                  </div>
                  <Link
                    to={workout.completed ? `/logger?workoutId=${workout.id}` : '/logger'}
                    className="w-full px-5 py-3 bg-orange-500 text-stone-950 font-anton text-base uppercase tracking-wider hover:bg-orange-400 transition-colors text-center no-underline block"
                  >
                    {workout.completed ? 'View Workout →' : 'Start Workout →'}
                  </Link>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                  <div className="text-stone-700 font-mono text-5xl mb-4">—</div>
                  <div className="font-anton text-3xl uppercase text-stone-700 mb-2">Rest Day</div>
                  <div className="text-xs text-stone-600 font-mono uppercase tracking-wider mb-6">No workout scheduled today</div>
                  <Link
                    to="/logger"
                    className="px-5 py-2.5 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-stone-500 hover:text-stone-200 transition-colors no-underline"
                  >
                    Schedule a workout →
                  </Link>
                </div>
              )}
            </div>

            {/* TODAY'S MACROS */}
            <div className="lg:col-span-4 border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Today's Macros</span>
                <span className="text-[9px] text-stone-700 font-mono">→ sentinel</span>
              </div>

              {loading ? (
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-4">
                    <Sk className="w-24 h-24 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Sk className="h-7 w-20" />
                      <Sk className="h-3 w-28" />
                    </div>
                  </div>
                  {[1,2,3].map(i => <Sk key={i} className="h-7 w-full" />)}
                </div>
              ) : consumed.mealsLogged === 0 ? (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-4 mb-5">
                    <MiniCalorieRing consumed={0} target={targets.kcal} />
                    <div className="flex-1 min-w-0">
                      <div className="font-anton text-2xl tabular-nums text-stone-600 leading-none">{fmt0(targets.kcal)}</div>
                      {eatBackCalories && calsBurned ? (
                        <div className="text-[10px] font-mono text-orange-400 mt-1 tabular-nums">
                          {fmt0(rawTargets.kcal)} + {fmt0(calsBurned)} burned = {fmt0(targets.kcal)} available
                        </div>
                      ) : calsBurned ? (
                        <div className="text-[10px] font-mono text-stone-500 mt-1 tabular-nums">
                          {fmt0(calsBurned)} cal burned today
                        </div>
                      ) : (
                        <div className="text-[10px] uppercase tracking-wider text-stone-600 font-mono mt-1">kcal target</div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center py-4">
                    <p className="text-xs font-mono text-stone-600 text-center">
                      No meals logged yet.<br />
                      <span className="text-stone-700">Use the Sentinel scanner or manual entry.</span>
                    </p>
                  </div>
                  <Link
                    to="/nutrition"
                    className="mt-4 w-full px-5 py-3 border border-stone-700 text-stone-300 font-anton text-base uppercase tracking-wider hover:bg-stone-800 hover:text-stone-100 transition-colors flex items-center justify-center gap-2 no-underline"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="3" width="10" height="8" rx="1" />
                      <circle cx="7" cy="7" r="2" />
                    </svg>
                    Log First Meal
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-5">
                    <MiniCalorieRing consumed={consumed.kcal} target={targets.kcal} />
                    <div className="flex-1 min-w-0">
                      <div className="font-anton text-2xl tabular-nums text-orange-300 leading-none">{fmt0(remaining)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-1">kcal remaining</div>
                      {eatBackCalories && calsBurned ? (
                        <div className="text-[10px] font-mono text-orange-400 mt-1 tabular-nums">
                          {fmt0(rawTargets.kcal)} + {fmt0(calsBurned)} burned = {fmt0(targets.kcal)} available
                        </div>
                      ) : calsBurned ? (
                        <div className="text-[10px] font-mono text-stone-500 mt-1 tabular-nums">
                          {fmt0(calsBurned)} cal burned today
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono tabular-nums text-stone-600 mt-2">
                          {consumed.mealsLogged} meal{consumed.mealsLogged !== 1 ? 's' : ''} logged
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2.5 flex-1">
                    {[
                      { l: 'Protein', c: consumed.protein, t: targets.protein, color: 'rgb(237, 122, 42)' },
                      { l: 'Carbs',   c: consumed.carbs,   t: targets.carbs,   color: 'rgb(126, 182, 255)' },
                      { l: 'Fat',     c: consumed.fat,     t: targets.fat,     color: 'rgb(251, 191, 36)' },
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
                          <div className="absolute inset-y-0 left-0" style={{ width: `${Math.min((m.c / (m.t || 1)) * 100, 100)}%`, background: m.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/nutrition"
                    className="mt-5 w-full px-5 py-3 border border-stone-700 text-stone-300 font-anton text-base uppercase tracking-wider hover:bg-stone-800 hover:text-stone-100 transition-colors flex items-center justify-center gap-2 no-underline"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="3" width="10" height="8" rx="1" />
                      <circle cx="7" cy="7" r="2" />
                    </svg>
                    Scan Meal
                  </Link>
                </>
              )}
            </div>

            {/* WEIGHT TREND */}
            <div className="lg:col-span-3 border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Body Comp</span>
                <span className="text-[9px] text-stone-700 font-mono">→ vault</span>
              </div>

              {loading ? (
                <div className="flex-1 space-y-3">
                  <Sk className="h-12 w-32" />
                  <Sk className="h-3 w-24" />
                  <Sk className="h-8 w-full mt-4" />
                </div>
              ) : bio.current == null ? (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                  <div className="text-stone-700 font-mono text-3xl mb-3">—</div>
                  <p className="text-xs font-mono text-stone-600 uppercase tracking-wider mb-4">No weight data yet</p>
                  <Link
                    to="/biometrics"
                    className="px-4 py-2 border border-stone-700 text-stone-500 font-mono text-xs uppercase tracking-wider hover:border-stone-500 hover:text-stone-300 transition-colors no-underline"
                  >
                    Log today's weight →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="font-anton text-5xl tabular-nums text-stone-100 leading-none mb-2">
                    {fmt1(bio.current)}
                    <span className="text-stone-500 text-2xl ml-1">kg</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-4">
                    {weightDelta != null ? (
                      <>
                        <span className="text-[11px] font-mono tabular-nums text-orange-300">
                          {weightDelta < 0 ? '↓' : '↑'} {fmt1(Math.abs(weightDelta))} kg
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-stone-600">last 7d</span>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono text-stone-600">logging…</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <MiniSparkline values={bio.sparkline} />
                  </div>
                  {bio.goal != null && (
                    <div className="mt-4 pt-4 border-t border-stone-800/60">
                      <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Goal</div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="font-anton text-lg text-orange-300 tabular-nums">{bio.goal} kg</span>
                        <span className="text-[10px] font-mono tabular-nums text-stone-500">
                          {fmt1(Math.abs(bio.current - bio.goal))} to go
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* THIS WEEK + ACTIVITY FEED */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

            {/* THIS WEEK */}
            <div className="lg:col-span-7 border border-stone-800/60 bg-stone-950/40 p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">This Week</h2>
                <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">
                  {loading ? '…' : `${completedDays}/${totalWorkoutDays} workouts`}
                </span>
              </div>

              {loading ? (
                <Sk className="w-full h-40" />
              ) : (
                <WeeklyGrid days={weeklyAdherence} />
              )}

              <div className="mt-5 pt-5 border-t border-stone-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Total Sets</div>
                  {loading
                    ? <Sk className="h-7 w-16 mt-1" />
                    : <div className="font-anton text-2xl text-stone-100 tabular-nums">{weeklyStats.totalSets}<span className="text-stone-500 text-sm ml-1">sets</span></div>
                  }
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Avg Daily</div>
                  {loading
                    ? <Sk className="h-7 w-20 mt-1" />
                    : weeklyStats.avgKcal === 0
                      ? <div className="font-anton text-2xl text-stone-700">—</div>
                      : <div className="font-anton text-2xl text-stone-100 tabular-nums">{weeklyStats.avgKcal.toLocaleString()}<span className="text-stone-500 text-sm ml-1">kcal</span></div>
                  }
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Avg Protein</div>
                  {loading
                    ? <Sk className="h-7 w-16 mt-1" />
                    : weeklyStats.avgProtein === 0
                      ? <div className="font-anton text-2xl text-stone-700">—</div>
                      : <div className="font-anton text-2xl text-stone-100 tabular-nums">{weeklyStats.avgProtein}<span className="text-stone-500 text-sm ml-1">g</span></div>
                  }
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Cal Burned</div>
                  {loading
                    ? <Sk className="h-7 w-16 mt-1" />
                    : calsBurned > 0
                      ? <div className="font-anton text-2xl text-orange-300 tabular-nums">{fmt0(calsBurned)}<span className="text-stone-500 text-sm ml-1">kcal</span></div>
                      : <div className="font-anton text-2xl text-stone-700">—</div>
                  }
                </div>
              </div>
            </div>

            {/* ACTIVITY FEED */}
            <div className="lg:col-span-5 border border-stone-800/60 bg-stone-950/40 p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Today's Activity</h2>
                <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">
                  {loading ? '…' : `${activityFeed.length} events`}
                </span>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1,2,3,4].map(i => <Sk key={i} className="h-10 w-full" />)}
                </div>
              ) : activityFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="text-stone-700 font-mono text-3xl mb-3">—</div>
                  <p className="text-xs font-mono text-stone-600 uppercase tracking-wider">No activity logged today yet.</p>
                  <p className="text-xs font-mono text-stone-700 mt-1">Log a meal or start a workout to see it here.</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {activityFeed.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-stone-800/40 last:border-b-0">
                      <span className="font-mono text-[10px] tabular-nums text-stone-600 w-10 shrink-0">{a.time}</span>
                      <span className={`shrink-0 w-7 h-7 border flex items-center justify-center ${
                        a.type === 'coach'  ? 'text-orange-300 border-orange-500/30 bg-orange-500/5' :
                        'text-stone-400 border-stone-700/60'
                      }`}>
                        <ActivityIcon type={a.type} />
                      </span>
                      <span className="flex-1 text-stone-300 text-sm truncate">{a.text}</span>
                    </div>
                  ))}
                </div>
              )}
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
                { name: 'IRONLAB', sub: 'Logger',    accent: 'from-orange-300 to-orange-600', to: '/logger' },
                { name: 'Sentinel', sub: 'Nutrition', accent: 'from-amber-300 to-orange-500',  to: '/nutrition' },
                { name: 'Vault',   sub: 'Biometric', accent: 'from-orange-300 to-red-500',    to: '/biometrics' },
                { name: 'Codex',   sub: 'Exercises', accent: 'from-stone-300 to-stone-500',   to: '/exercises' },
                { name: 'Oracle',  sub: 'Engine',    accent: 'from-orange-400 to-orange-700', to: '/coach' },
              ].map(m => (
                <Link
                  key={m.name}
                  to={m.to}
                  className="group relative overflow-hidden border border-stone-800/60 bg-stone-950/40 hover:border-orange-500/40 transition-all p-4 text-left no-underline block"
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
                </Link>
              ))}
            </div>
          </div>

          <footer className="pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
            <span>IRONLAB v0.4 · Dashboard · Daily snapshot</span>
            <span>{loading ? 'loading…' : '5 modules unified'}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
