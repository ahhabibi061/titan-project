import React, { useState, useMemo } from 'react';
import { useSession } from '../hooks/useSession';
import { useSentinel } from '../hooks/useSentinel';
import { FoodSearch } from '../components/FoodSearch';
import AppNav from '../components/AppNav';

/* =========================================================================
 * SENTINEL — Module 1
 * Camera scan flow + live meal log wired to Supabase nutrition_logs.
 * Manual entry, date navigation, delete with inline confirm.
 * ========================================================================= */

// Vision-API scan demo candidates (UI demo only — scan writes via addMeal)
const SCAN_CANDIDATES = [
  {
    id: 'a',
    name: 'Grilled Chicken Bowl',
    portion: '1 medium bowl · ~480 g',
    confidence: 92,
    macros: { kcal: 620, protein: 45, carbs: 55, fat: 22 },
    detected: ['Grilled chicken', 'Brown rice', 'Avocado', 'Black beans', 'Salsa'],
  },
  {
    id: 'b',
    name: 'Mediterranean Power Bowl',
    portion: '1 medium bowl · ~490 g',
    confidence: 78,
    macros: { kcal: 580, protein: 38, carbs: 62, fat: 18 },
    detected: ['Chicken', 'Rice', 'Hummus', 'Olives'],
  },
  {
    id: 'c',
    name: 'Buddha Bowl',
    portion: '1 medium bowl · ~470 g',
    confidence: 64,
    macros: { kcal: 540, protein: 28, carbs: 70, fat: 16 },
    detected: ['Mixed grains', 'Roasted vegetables', 'Plant protein'],
  },
];

const DETECTED_REGIONS = [
  { x: 28, y: 18, w: 30, h: 28, label: 'Grilled Chicken', conf: 94 },
  { x: 56, y: 32, w: 30, h: 36, label: 'Brown Rice',      conf: 89 },
  { x: 14, y: 52, w: 22, h: 26, label: 'Avocado',          conf: 91 },
  { x: 46, y: 64, w: 26, h: 20, label: 'Black Beans',      conf: 86 },
  { x: 70, y: 14, w: 22, h: 22, label: 'Salsa',            conf: 81 },
];

// -------------------- HELPERS --------------------
const fmt0 = (n) => Math.round(n).toLocaleString('en-US');

// -------------------- SKELETON --------------------
const Sk = ({ w = 'w-16', h = 'h-3' }) => (
  <div className={`${w} ${h} bg-stone-800 animate-pulse rounded-sm`} />
);

// -------------------- FOOD ILLUSTRATION --------------------
function MealIllustration() {
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full">
      <defs>
        <radialGradient id="bowl-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3a342e" />
          <stop offset="80%" stopColor="#1f1c19" />
          <stop offset="100%" stopColor="#0f0d0b" />
        </radialGradient>
        <radialGradient id="rice-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e8d4a8" />
          <stop offset="100%" stopColor="#c4a878" />
        </radialGradient>
        <radialGradient id="chicken-grad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#c47a3d" />
          <stop offset="100%" stopColor="#7a4520" />
        </radialGradient>
        <radialGradient id="avo-grad" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#9bc46a" />
          <stop offset="100%" stopColor="#5a7c3a" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="178" fill="url(#bowl-grad)" stroke="#2a2622" strokeWidth="2" />
      <circle cx="200" cy="200" r="160" fill="none" stroke="#3a342e" strokeWidth="1" opacity="0.6" />
      <g opacity="0.95">
        {Array.from({ length: 32 }).map((_, i) => {
          const angle = (i / 32) * Math.PI * 2;
          const r = 60 + (i % 4) * 18;
          const cx = 230 + Math.cos(angle) * r * 0.4;
          const cy = 220 + Math.sin(angle) * r * 0.4;
          return <ellipse key={i} cx={cx} cy={cy} rx="6" ry="3.2" fill="url(#rice-grad)" transform={`rotate(${(i * 23) % 180} ${cx} ${cy})`} />;
        })}
      </g>
      <ellipse cx="148" cy="148" rx="34" ry="22" fill="url(#chicken-grad)" transform="rotate(-25 148 148)" />
      <ellipse cx="172" cy="120" rx="30" ry="18" fill="url(#chicken-grad)" transform="rotate(20 172 120)" />
      <ellipse cx="120" cy="178" rx="28" ry="18" fill="url(#chicken-grad)" transform="rotate(-50 120 178)" />
      <ellipse cx="200" cy="148" rx="26" ry="16" fill="url(#chicken-grad)" transform="rotate(45 200 148)" />
      <path d="M 84,260 Q 100,234 132,250 Q 124,288 88,288 Z" fill="url(#avo-grad)" />
      <path d="M 96,266 Q 108,258 122,266" fill="none" stroke="#3a5028" strokeWidth="1" opacity="0.5" />
      <g fill="#2a1a14">
        {[[220,280],[240,270],[260,282],[232,296],[252,300],[276,286],[212,296],[248,266]].map(([cx,cy],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="6" ry="4.5" />
        ))}
      </g>
      <g fill="#c83a28" opacity="0.85">
        {[[280,138],[290,154],[272,156],[296,130],[306,144],[284,124]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="3.5" />
        ))}
      </g>
      <path d="M 138,238 Q 120,238 122,256 Q 138,254 144,244 Z" fill="#b8c84a" />
      <path d="M 138,240 L 138,254" stroke="#7a8a2a" strokeWidth="0.5" />
    </svg>
  );
}

// -------------------- CAMERA VIEW --------------------
function CameraView({ state }) {
  const showBoxes = state === 'results' || state === 'confirmed';
  return (
    <div className="relative aspect-square w-full max-w-md mx-auto bg-stone-950 overflow-hidden">
      <div className={`absolute inset-0 transition-all duration-500 ${state === 'capturing' ? 'brightness-150' : ''} ${state === 'analyzing' ? 'brightness-75' : ''}`}>
        <MealIllustration />
      </div>
      {state === 'analyzing' && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(237,122,42,0.15) 48%, rgba(237,122,42,0.4) 50%, rgba(237,122,42,0.15) 52%, transparent 100%)',
            animation: 'scan 1.4s ease-in-out infinite',
          }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(237,122,42,0.08) 0px, rgba(237,122,42,0.08) 1px, transparent 1px, transparent 4px)',
          }} />
        </>
      )}
      {state === 'capturing' && (
        <div className="absolute inset-0 bg-white pointer-events-none animate-pulse" style={{ opacity: 0.7 }} />
      )}
      <div className="absolute inset-0 pointer-events-none">
        {[
          { top: 12, left: 12,   rot: 0   },
          { top: 12, right: 12,  rot: 90  },
          { bottom: 12, right: 12, rot: 180 },
          { bottom: 12, left: 12,  rot: 270 },
        ].map((p, i) => (
          <div key={i} className="absolute w-6 h-6" style={{ ...p, transform: `rotate(${p.rot}deg)` }}>
            <div className="absolute top-0 left-0 w-full h-px bg-orange-400" />
            <div className="absolute top-0 left-0 w-px h-full bg-orange-400" />
          </div>
        ))}
      </div>
      {showBoxes && DETECTED_REGIONS.map((r, i) => (
        <div
          key={i}
          className="absolute border-2 border-orange-400/80 transition-all duration-300"
          style={{
            left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
            animation: `boxIn 400ms ${i * 80}ms ease-out both`,
            backgroundColor: 'rgba(237,122,42,0.06)',
          }}
        >
          <div className="absolute -top-6 left-0 bg-orange-500 text-stone-950 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider whitespace-nowrap">
            {r.label} <span className="opacity-70">{r.conf}%</span>
          </div>
        </div>
      ))}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em]">
        <span className="bg-stone-950/80 backdrop-blur-sm border border-orange-500/40 px-2 py-1 text-orange-300">
          {state === 'idle'      && '● ready'}
          {state === 'capturing' && '◉ capture'}
          {state === 'analyzing' && '◌ analyzing'}
          {state === 'results'   && `▣ ${DETECTED_REGIONS.length} items`}
          {state === 'confirmed' && '✓ logged'}
        </span>
        <span className="bg-stone-950/80 backdrop-blur-sm border border-stone-700 px-2 py-1 text-stone-500">logmeal v3</span>
      </div>
      {state === 'idle' && (
        <div className="absolute inset-0 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="font-anton text-3xl uppercase tracking-tight text-stone-100 mb-2">Tap to Scan</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-500">point camera at meal</div>
          </div>
        </div>
      )}
      {state === 'analyzing' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-950/90 border border-orange-500/40 px-4 py-2 backdrop-blur-sm">
          <div className="font-anton text-sm uppercase tracking-wider text-orange-300">Analyzing Meal…</div>
          <div className="text-[9px] font-mono text-stone-500 tracking-wider">vision model · 1.4s avg</div>
        </div>
      )}
    </div>
  );
}

// -------------------- CANDIDATE ROW --------------------
function CandidateRow({ candidate, selected, onSelect, isTop }) {
  const { name, portion, confidence, macros, detected } = candidate;
  const ringColor = confidence >= 90 ? 'text-orange-400' : confidence >= 75 ? 'text-stone-300' : 'text-stone-500';
  return (
    <button
      onClick={() => onSelect(candidate.id)}
      className={`w-full text-left p-4 border transition-all ${
        selected
          ? 'border-orange-500/60 bg-orange-500/10'
          : 'border-stone-800/60 bg-stone-950/40 hover:border-stone-700 hover:bg-stone-900/40'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="relative w-14 h-14 shrink-0">
          <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3"
              strokeDasharray={`${(confidence / 100) * 150.8} 150.8`} strokeLinecap="square" className={ringColor} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-anton text-base tabular-nums ${ringColor}`}>{confidence}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-anton text-lg uppercase tracking-tight text-stone-100">{name}</span>
            {isTop && (
              <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/30 font-mono">
                TOP MATCH
              </span>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-2">{portion}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums">
            <span className="text-stone-300">{macros.kcal} <span className="text-stone-600">kcal</span></span>
            <span className="text-orange-300">{macros.protein}g <span className="text-stone-600">P</span></span>
            <span className="text-stone-400">{macros.carbs}g <span className="text-stone-600">C</span></span>
            <span className="text-stone-400">{macros.fat}g <span className="text-stone-600">F</span></span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {detected.map((d, i) => (
              <span key={i} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-stone-800/60 text-stone-500 border border-stone-700/50 font-mono">
                {d}
              </span>
            ))}
          </div>
        </div>
        <div className={`w-5 h-5 border-2 shrink-0 flex items-center justify-center mt-1 ${
          selected ? 'border-orange-500 bg-orange-500' : 'border-stone-600'
        }`}>
          {selected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="#0a0908" strokeWidth="2" strokeLinecap="square" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}

// -------------------- CALORIE RING --------------------
function CalorieRing({ consumed, target }) {
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const radius = 76;
  const c = 2 * Math.PI * radius;
  const remaining = Math.max(target - consumed, 0);
  return (
    <div className="relative w-48 h-48">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle cx="100" cy="100" r={radius} fill="none" stroke="url(#ring-grad)" strokeWidth="10"
          strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 800ms ease' }} />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ff5a2a" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-mono">Consumed</div>
        <div className="font-anton text-4xl tabular-nums text-stone-100 leading-none mt-1">{fmt0(consumed)}</div>
        <div className="text-[10px] text-stone-500 font-mono mt-1">/ {fmt0(target)} kcal</div>
        <div className="mt-2 px-2 py-0.5 border border-stone-800 text-[9px] font-mono tabular-nums uppercase tracking-wider">
          <span className="text-stone-600">left</span> <span className="text-orange-300">{fmt0(remaining)}</span>
        </div>
      </div>
    </div>
  );
}

// -------------------- MACRO BAR --------------------
function MacroBar({ label, consumed, target, color }) {
  const pct = Math.min((consumed / Math.max(target, 1)) * 100, 100);
  const remaining = Math.max(target - consumed, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-stone-400">
          <span className="text-stone-200">{fmt0(consumed)}</span>
          <span className="text-stone-600"> / {fmt0(target)} g</span>
          <span className="text-stone-700"> · </span>
          <span className="text-stone-500">{fmt0(remaining)} left</span>
        </span>
      </div>
      <div className="relative h-1.5 bg-stone-900/80">
        <div className="absolute inset-y-0 left-0 transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// -------------------- MEAL ENTRY --------------------
function MealEntry({ meal, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const time = new Date(meal.logged_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  return (
    <div className="flex items-center gap-3 py-3 border-b border-stone-800/40 last:border-b-0">
      <span className="font-mono text-[10px] tabular-nums text-stone-600 w-12 shrink-0">{time}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-stone-200 text-sm truncate">{meal.name}</span>
          {meal.source === 'vision_api' && (
            <span className="text-[8px] uppercase tracking-wider px-1 py-0.5 bg-orange-500/15 text-orange-300 border border-orange-500/25 font-mono shrink-0">
              ◌ vision
            </span>
          )}
          {meal.source === 'barcode' && (
            <span className="text-[8px] uppercase tracking-wider px-1 py-0.5 bg-stone-700/40 text-stone-400 border border-stone-700/50 font-mono shrink-0">
              ▣ barcode
            </span>
          )}
          {meal.source === 'manual' && (
            <span className="text-[8px] uppercase tracking-wider px-1 py-0.5 bg-stone-900/60 text-stone-600 border border-stone-800/60 font-mono shrink-0">
              ✎ manual
            </span>
          )}
        </div>
        <div className="flex gap-3 text-[10px] font-mono tabular-nums mt-0.5">
          <span className="text-stone-500">{meal.kcal} kcal</span>
          <span className="text-stone-600">{meal.protein_g}p · {meal.carbs_g}c · {meal.fat_g}f</span>
        </div>
      </div>
      {confirming ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">Delete?</span>
          <button
            onClick={() => onDelete(meal.id)}
            className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 border border-stone-700 text-stone-500 hover:bg-stone-800 transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="shrink-0 text-stone-700 hover:text-stone-400 transition-colors p-1"
          aria-label="Delete meal"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3.5h10M5.5 3.5V2.5h3v1M11 3.5l-.75 8.5H3.75L3 3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// -------------------- ADD MEAL FORM --------------------
// AddMealForm replaced by FoodSearch component (Open Food Facts + barcode)

// -------------------- MAIN --------------------
export default function VisionNutrition() {
  const { user } = useSession();
  const {
    meals, totals, targets, loading,
    addMeal, deleteMeal,
    selectedDate, setSelectedDate,
    calsBurned, eatBackCalories,
  } = useSentinel(user?.id);

  const [scanState, setScanState] = useState('results');
  const [selectedId, setSelectedId] = useState('a');
  const [showAddForm, setShowAddForm] = useState(false);

  // Date helpers
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const selMidnight = new Date(selectedDate);
  selMidnight.setHours(0, 0, 0, 0);
  const isToday = selMidnight.getTime() === todayMidnight.getTime();

  // Resolved targets with fallbacks — adjust kcal if eat-back is enabled and today has a burn
  const baseTgt = {
    kcal:    targets?.kcal    ?? 2200,
    protein: targets?.protein ?? 180,
    carbs:   targets?.carbs   ?? 220,
    fat:     targets?.fat     ?? 70,
  };
  const tgt = {
    ...baseTgt,
    kcal: isToday && eatBackCalories && calsBurned
      ? baseTgt.kcal + Math.round(calsBurned)
      : baseTgt.kcal,
  };

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const nextDay = () => {
    if (isToday) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };
  const fmtDate = () => {
    if (isToday) return 'Today';
    const yest = new Date(todayMidnight);
    yest.setDate(yest.getDate() - 1);
    if (selMidnight.getTime() === yest.getTime()) return 'Yesterday';
    return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const visionCount = meals.filter(m => m.source === 'vision_api').length;
  const remaining   = Math.max(0, tgt.kcal - totals.kcal);
  const kcalPct     = Math.round((remaining / Math.max(tgt.kcal, 1)) * 100);

  const macroSplit = useMemo(() => {
    const t = totals.kcal || 1;
    return {
      p: Math.round((totals.protein * 4 / t) * 100),
      c: Math.round((totals.carbs   * 4 / t) * 100),
      f: Math.round((totals.fat     * 9 / t) * 100),
    };
  }, [totals]);

  const startScan = () => {
    setScanState('capturing');
    setTimeout(() => setScanState('analyzing'), 350);
    setTimeout(() => setScanState('results'), 1900);
  };

  const confirmSelection = () => {
    const c = SCAN_CANDIDATES.find(x => x.id === selectedId);
    if (!c) return;
    addMeal({
      name:      c.name,
      kcal:      c.macros.kcal,
      protein_g: c.macros.protein,
      carbs_g:   c.macros.carbs,
      fat_g:     c.macros.fat,
    });
    setScanState('confirmed');
    setTimeout(() => setScanState('idle'), 1800);
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
        .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
        .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
        body { background: #0a0908; }
        @keyframes scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes boxIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <AppNav />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)'
        }} />
        <div className="absolute top-0 right-0 w-[60vw] h-[50vh] opacity-[0.07] blur-3xl" style={{
          background: 'radial-gradient(ellipse, #fbbf24 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-8">

        {/* HEADER */}
        <header className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-stone-800/60">
          <div>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-anton text-5xl uppercase tracking-tight text-stone-100">Sentinel</span>
              <span className="font-anton text-5xl uppercase tracking-tight bg-gradient-to-br from-amber-300 to-orange-500 bg-clip-text text-transparent">Nutrition</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-stone-500">
              <span className="px-2 py-1 bg-orange-500/15 text-orange-300 border border-orange-500/30 uppercase tracking-wider">PRO</span>
              {loading ? (
                <>
                  <Sk w="w-20" h="h-3" />
                  <Sk w="w-16" h="h-3" />
                </>
              ) : (
                <>
                  <span>{meals.length} meals {isToday ? 'today' : fmtDate()}</span>
                  <span className="text-stone-700">·</span>
                  <span>{visionCount} via vision</span>
                  <span className="text-stone-700">·</span>
                  <span>{kcalPct}% under target</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={startScan}
            disabled={scanState !== 'idle' && scanState !== 'results'}
            className="px-5 py-2.5 bg-orange-500 text-stone-950 font-anton text-lg uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanState === 'idle' ? 'Scan Meal' : scanState === 'results' ? 'Re-scan' : 'Scanning…'}
          </button>
        </header>

        {/* WORKOUT BURN BANNER — shown when today has a completed workout with calories_burned */}
        {isToday && calsBurned != null && (
          <div className="flex items-center gap-3 flex-wrap border border-orange-500/30 bg-orange-500/08 px-5 py-3 mb-6">
            <span className="text-base">🔥</span>
            <span className="font-mono text-sm tabular-nums text-stone-200">
              {Math.round(calsBurned)} cal burned today
            </span>
            {eatBackCalories ? (
              <span className="font-mono text-[10px] text-orange-300">— eating back included</span>
            ) : (
              <span className="font-mono text-[10px] text-stone-600">
                · <a href="/settings" className="text-orange-400 hover:underline">Enable eat-back</a> to add to target
              </span>
            )}
          </div>
        )}

        {/* HEADLINE */}
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-2">
            {isToday ? "Today's intake" : `${fmtDate()}'s intake`}
          </div>
          {loading ? (
            <Sk w="w-2/3" h="h-14" />
          ) : (
            <h1 className="font-anton text-5xl md:text-6xl uppercase tracking-tight leading-[0.95] text-stone-100 max-w-4xl">
              <span className="text-orange-400 tabular-nums">{fmt0(totals.kcal)}</span>{' '}
              <span className="text-stone-500">/</span>{' '}
              {fmt0(tgt.kcal)} <span className="text-stone-500">kcal</span>
              <span className="text-stone-600"> — {fmt0(remaining)} remaining for the day.</span>
            </h1>
          )}
        </div>

        {/* TOP DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-10">

          {/* Calorie ring */}
          <div className="md:col-span-4 border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col items-center justify-center">
            {loading ? (
              <div className="w-48 h-48 flex items-center justify-center">
                <Sk w="w-40" h="h-40" />
              </div>
            ) : (
              <CalorieRing consumed={totals.kcal} target={tgt.kcal} />
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 w-full">
              <div className="text-center border border-stone-800/60 py-2">
                <div className="text-[9px] font-mono uppercase text-stone-600 tracking-wider">Goal</div>
                <div className="font-anton text-orange-300 text-sm">CUT</div>
              </div>
              <div className="text-center border border-stone-800/60 py-2">
                <div className="text-[9px] font-mono uppercase text-stone-600 tracking-wider">Burn</div>
                <div className="font-anton text-stone-300 text-sm tabular-nums">~2.6k</div>
              </div>
              <div className="text-center border border-stone-800/60 py-2">
                <div className="text-[9px] font-mono uppercase text-stone-600 tracking-wider">Streak</div>
                <div className="font-anton text-stone-300 text-sm tabular-nums">—</div>
              </div>
            </div>
          </div>

          {/* Macro bars */}
          <div className="md:col-span-4 border border-stone-800/60 bg-stone-950/40 p-6">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-anton text-xl uppercase tracking-tight text-stone-100">Macros</h2>
              <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">target split</span>
            </div>
            {loading ? (
              <div className="space-y-5">
                <Sk w="w-full" h="h-7" />
                <Sk w="w-full" h="h-7" />
                <Sk w="w-full" h="h-7" />
              </div>
            ) : (
              <div className="space-y-4">
                <MacroBar label="Protein" consumed={totals.protein} target={tgt.protein} color="rgb(237, 122, 42)" />
                <MacroBar label="Carbs"   consumed={totals.carbs}   target={tgt.carbs}   color="rgb(126, 182, 255)" />
                <MacroBar label="Fat"     consumed={totals.fat}     target={tgt.fat}     color="rgb(251, 191, 36)" />
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-stone-800/60 grid grid-cols-3 gap-2 text-center">
              {[
                { l: 'P', v: macroSplit.p },
                { l: 'C', v: macroSplit.c },
                { l: 'F', v: macroSplit.f },
              ].map(x => (
                <div key={x.l}>
                  <div className="text-[9px] font-mono uppercase text-stone-600 tracking-wider">{x.l}</div>
                  {loading
                    ? <Sk w="w-8 mx-auto" h="h-4" />
                    : <div className="font-anton text-stone-300 text-base tabular-nums">{x.v}%</div>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Meal log with date nav */}
          <div className="md:col-span-4 border border-stone-800/60 bg-stone-950/40 p-6">
            {/* Date nav */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-anton text-xl uppercase tracking-tight text-stone-100">{fmtDate()}</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevDay}
                  className="p-1.5 text-stone-500 hover:text-stone-300 border border-stone-800 hover:border-stone-700 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 2L4 6L8 10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {!isToday && (
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-1 border border-stone-800 text-stone-600 hover:text-stone-400 transition-colors"
                  >
                    today
                  </button>
                )}
                <button
                  onClick={nextDay}
                  disabled={isToday}
                  className="p-1.5 text-stone-500 hover:text-stone-300 border border-stone-800 hover:border-stone-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 2L8 6L4 10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 mt-2">
                <Sk w="w-full" h="h-10" />
                <Sk w="w-full" h="h-10" />
                <Sk w="w-4/5"  h="h-10" />
              </div>
            ) : meals.length === 0 ? (
              <div className="py-8 flex flex-col items-center text-center">
                <div className="text-stone-700 mb-1">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="6" y="10" width="20" height="16" rx="2" />
                    <path d="M11 10V8a5 5 0 0110 0v2" />
                    <circle cx="16" cy="18" r="2" />
                  </svg>
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-700 font-mono mb-1">Nothing logged yet</div>
                <div className="text-stone-600 text-xs leading-relaxed">
                  {isToday
                    ? 'Scan a meal or add one manually below.'
                    : 'Nothing was logged on this day.'}
                </div>
              </div>
            ) : (
              <div>
                {meals.map(m => (
                  <MealEntry key={m.id} meal={m} onDelete={deleteMeal} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SCAN SECTION */}
        <div className="border border-stone-800/60 bg-stone-950/40 mb-8">
          <div className="flex items-baseline justify-between p-6 pb-4 border-b border-stone-800/60">
            <div>
              <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Sentinel Scan</h2>
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-600 mt-1">vendor: logmeal · response 1.4s · cost $0.008/scan</div>
            </div>
            <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">edge function · pro tier</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
            <div className="lg:col-span-5">
              <CameraView state={scanState} />
              <div className="mt-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-stone-600">
                <span>{DETECTED_REGIONS.length} components detected</span>
                <span>conf avg {Math.round(DETECTED_REGIONS.reduce((a, r) => a + r.conf, 0) / DETECTED_REGIONS.length)}%</span>
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-anton text-lg uppercase tracking-tight text-stone-200">Match Candidates</h3>
                <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">tap to select · {SCAN_CANDIDATES.length} results</span>
              </div>
              <div className="space-y-2">
                {SCAN_CANDIDATES.map((c, i) => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    selected={c.id === selectedId}
                    onSelect={setSelectedId}
                    isTop={i === 0}
                  />
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-[10px] uppercase tracking-wider font-mono text-stone-500 hover:text-stone-300 px-3 py-2 border border-stone-800 hover:border-stone-700 transition-colors"
                >
                  None of these — search database
                </button>
                <button
                  onClick={confirmSelection}
                  disabled={scanState !== 'results'}
                  className="px-6 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scanState === 'confirmed' ? '✓ Logged' : 'Confirm & Log →'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FOOD DATABASE */}
        <div className="border border-stone-800/60 bg-stone-950/40 mb-8">
          <div className="flex items-baseline justify-between p-6 pb-4 border-b border-stone-800/60">
            <div>
              <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Add Meal</h2>
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-600 mt-1">search 3M+ products · open food facts · barcode scan</div>
            </div>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 border border-orange-500/40 text-orange-400 font-anton text-sm uppercase tracking-wider hover:bg-orange-500/10 transition-colors"
              >
                + Add Meal
              </button>
            )}
          </div>
          {showAddForm ? (
            <FoodSearch onAdd={addMeal} onCancel={() => setShowAddForm(false)} />
          ) : (
            <div className="p-6 text-center text-stone-700 text-[11px] font-mono uppercase tracking-[0.18em]">
              Search food database or scan a barcode to log a meal
            </div>
          )}
        </div>

        {/* SAFETY NOTE */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] font-mono text-stone-500 leading-relaxed">
            <div>
              <div className="text-orange-300 uppercase tracking-wider text-[10px] mb-1">Confidence threshold</div>
              Auto-confirm above 90%. Below, user must select.
            </div>
            <div>
              <div className="text-orange-300 uppercase tracking-wider text-[10px] mb-1">Manual fallback</div>
              ~20% of scans need correction. Manual log path always available.
            </div>
            <div>
              <div className="text-orange-300 uppercase tracking-wider text-[10px] mb-1">Cost gating</div>
              Sentinel is Pro-only. Each scan ~$0.008. Free tier = manual log.
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>Sentinel v0.4 · Module 1 · Camera-driven macro logging</span>
          <span>Provider: LogMeal · Fallback: Bite AI · Manual: anytime</span>
        </footer>
      </div>
    </div>
  );
}
