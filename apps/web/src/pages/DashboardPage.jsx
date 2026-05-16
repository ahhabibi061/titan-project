import React, { useState, useEffect, useRef } from 'react';
import Model from 'react-body-highlighter';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useDashboard } from '../hooks/useDashboard';
import { useProfileStore } from '../store/useProfileStore';
import { useCheckin } from '../hooks/useCheckin';
import { useUnits } from '../hooks/useUnits';
import { CheckinModal } from '../components/CheckinModal';
import { MacroBreakdownModal } from '../components/MacroBreakdownModal';
import { supabase } from '../lib/supabase';

const NAV_MODULES = [
  { id: 'home',       label: 'Home',       path: '/dashboard'  },
  { id: 'logger',     label: 'Forge',      path: '/logger'     },
  { id: 'vision',     label: 'Sentinel',   path: '/nutrition'  },
  { id: 'biometrics', label: 'Vault',       path: '/biometrics' },
  { id: 'library',    label: 'Codex',      path: '/exercises'  },
  { id: 'coach',      label: 'Oracle',     path: '/coach'      },
];

const MUSCLE_DATA = {
  weeklyVolume: {
    chest: 4200, front_delts: 1800, side_delts: 900, triceps: 2100,
    lats: 3800, biceps: 1600, rear_delts: 800, traps: 600,
    quads: 8400, hamstrings: 4200, glutes: 3100, calves: 1200,
    abs: 900, obliques: 400, lower_back: 1400, forearms: 600,
  },
  progression: {
    chest: -8.2, front_delts: -3.1, side_delts: 2.4, triceps: 1.5,
    lats: 4.2, biceps: 0.5, rear_delts: 1.8, traps: -1.2,
    quads: -5.4, hamstrings: -1.8, glutes: 2.1, calves: 3.0,
    abs: 0, obliques: 0, lower_back: -2.0, forearms: 0,
  },
};

const MOCK_GROWTH_MAP = (() => {
  const m = {};
  for (const [key, vol] of Object.entries(MUSCLE_DATA.weeklyVolume)) {
    const pct = MUSCLE_DATA.progression[key] ?? 0;
    if (pct === 0) continue;
    const status = pct > 10 ? 'pr' : pct > 0 ? 'improved' : pct > -10 ? 'regressed' : 'dropped';
    m[key] = { status, growthPct: Math.round(pct * 10) / 10, currentVol: Math.round(vol), prevVol: Math.round(vol / (1 + pct / 100)) };
  }
  return m;
})();
const MOCK_RECOVERY_MAP = {
  quads:       { status: 'resting',  pct: 28,  hoursRemaining: 36 },
  hamstrings:  { status: 'partial',  pct: 55,  hoursRemaining: 18 },
  glutes:      { status: 'partial',  pct: 62,  hoursRemaining: 12 },
  chest:       { status: 'almost',   pct: 80,  hoursRemaining: 6  },
  triceps:     { status: 'almost',   pct: 76,  hoursRemaining: 8  },
  front_delts: { status: 'almost',   pct: 72,  hoursRemaining: 10 },
  lats:        { status: 'ready',    pct: 100, hoursRemaining: 0  },
  biceps:      { status: 'ready',    pct: 100, hoursRemaining: 0  },
  rear_delts:  { status: 'ready',    pct: 100, hoursRemaining: 0  },
  calves:      { status: 'ready',    pct: 100, hoursRemaining: 0  },
  lower_back:  { status: 'partial',  pct: 58,  hoursRemaining: 14 },
};

// ================== BODY MAP (react-body-highlighter) ==================
const MUSCLES = {
  chest: 'Chest', front_delts: 'Front Delts', side_delts: 'Side Delts',
  rear_delts: 'Rear Delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  lats: 'Lats', lower_back: 'Lower Back', glutes: 'Glutes',
  quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves',
};

const MUSCLE_MAP = {
  chest: 'chest', front_delts: 'front-deltoids', rear_delts: 'back-deltoids',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearm',
  abs: 'abs', obliques: 'obliques', traps: 'trapezius',
  lats: 'upper-back', lower_back: 'lower-back', glutes: 'gluteal',
  quads: 'quadriceps', hamstrings: 'hamstring', calves: 'calves',
};

const MUSCLE_DISPLAY_NAMES = {
  'chest': 'Pectoralis Major', 'front-deltoids': 'Anterior Deltoids',
  'back-deltoids': 'Posterior Deltoids', 'biceps': 'Biceps Brachii',
  'triceps': 'Triceps Brachii', 'forearm': 'Forearm Flexors',
  'abs': 'Rectus Abdominis', 'obliques': 'Obliques', 'trapezius': 'Trapezius',
  'upper-back': 'Latissimus Dorsi', 'lower-back': 'Erector Spinae',
  'gluteal': 'Gluteus Maximus', 'quadriceps': 'Quadriceps',
  'hamstring': 'Hamstrings', 'calves': 'Gastrocnemius',
};

const MUSCLE_WINDOWS = {
  'chest': 72, 'front-deltoids': 48, 'back-deltoids': 48,
  'biceps': 48, 'triceps': 48, 'forearm': 36,
  'abs': 24, 'obliques': 24, 'trapezius': 36,
  'upper-back': 72, 'lower-back': 72, 'gluteal': 72,
  'quadriceps': 72, 'hamstring': 72, 'calves': 36,
};

const RECOVERY_HIGHLIGHTED = ['#4ade80', '#a3e635', '#fbbf24', '#f87171'];
const GROWTH_HIGHLIGHTED   = ['#fb923c', '#4ade80', '#60a5fa', '#fbbf24', '#f87171'];

const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function getRecoveryFreq(status) {
  return { ready: 1, almost: 2, partial: 3, resting: 4 }[status] ?? null;
}
function getGrowthFreq(status) {
  return { pr: 1, improved: 2, first: 3, regressed: 4, dropped: 5 }[status] ?? null;
}

function buildModelData(recoveryMap, growthMap, mode) {
  const slugFreq = {};
  const map = mode === 'recovery' ? recoveryMap : growthMap;
  for (const [key, val] of Object.entries(map)) {
    const slug = MUSCLE_MAP[key];
    if (!slug) continue;
    const freq = mode === 'recovery'
      ? (val.status && val.status !== 'no_data' ? getRecoveryFreq(val.status) : null)
      : (val.status ? getGrowthFreq(val.status) : null);
    if (freq === null) continue;
    if (!slugFreq[slug] || freq < slugFreq[slug]) slugFreq[slug] = freq;
  }
  return Object.entries(slugFreq).map(([slug, frequency]) => ({ name: slug, muscles: [slug], frequency }));
}

function MuscleTooltip({ muscle, recoveryData, growthData, mode, position }) {
  if (!muscle) return null;
  const displayName = MUSCLE_DISPLAY_NAMES[muscle] || muscle.replace(/-/g, ' ').toUpperCase();
  const internalKey = Object.entries(MUSCLE_MAP).find(([, s]) => s === muscle)?.[0];
  let value = null, line2 = null;
  if (mode === 'recovery' && internalKey) {
    const e = recoveryData?.[internalKey];
    if (e && e.status !== 'no_data') { value = e.pct ?? (e.status === 'ready' ? 100 : null); line2 = e.hoursRemaining > 0 ? `${e.hoursRemaining}h remaining` : null; }
  } else if (mode === 'growth' && internalKey) {
    const e = growthData?.[internalKey];
    if (e) { value = e.growthPct; line2 = e.prevVol !== null ? `${fmt(e.currentVol)} vs ${fmt(e.prevVol)} kg·reps` : e.currentVol != null ? `${fmt(e.currentVol)} kg·reps` : null; }
  }
  const getStatus = () => {
    if (mode === 'recovery') {
      if (value === null) return { label: 'NO DATA',      color: '#78716c' };
      if (value >= 100)   return { label: 'READY',        color: '#22c55e' };
      if (value >= 67)    return { label: 'ALMOST READY', color: '#eab308' };
      if (value >= 34)    return { label: 'PARTIAL',      color: '#f97316' };
      return                     { label: 'RESTING',      color: '#ef4444' };
    } else {
      if (value === null) return { label: 'NO DATA',      color: '#78716c' };
      if (value > 10)     return { label: 'PR TERRITORY', color: '#22c55e' };
      if (value > 0)      return { label: 'IMPROVED',     color: '#86efac' };
      if (value > -10)    return { label: 'SLIGHT DROP',  color: '#f97316' };
      return                     { label: 'REGRESSED',    color: '#ef4444' };
    }
  };
  const status = getStatus();
  const clampedX = Math.min(Math.max(position.x, 80), 260);
  return (
    <div style={{ position: 'absolute', left: clampedX, top: Math.max(position.y, 0), zIndex: 50, background: '#0c0a09', border: '1px solid #292524', padding: '10px 14px', minWidth: '164px', pointerEvents: 'none', transform: 'translateX(-50%)', boxShadow: '0 4px 24px rgba(0,0,0,0.7)' }}>
      <div style={{ fontFamily: 'Anton, sans-serif', fontSize: '13px', color: '#f5f5f4', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>{displayName}</div>
      {value !== null && (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: status.color, marginBottom: '4px' }}>
          {mode === 'recovery' ? `${Math.round(value)}% recovered` : value > 0 ? `↑ ${Math.round(value)}% vs last` : `↓ ${Math.abs(Math.round(value))}% vs last`}
        </div>
      )}
      {line2 && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#78716c', marginBottom: '6px', letterSpacing: '0.04em' }}>{line2}</div>}
      <div style={{ display: 'inline-flex', padding: '2px 8px', background: `${status.color}22`, border: `1px solid ${status.color}44`, fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: status.color }}>{status.label}</div>
    </div>
  );
}

function BodyMapDual({ recoveryMap, growthMap, mode, setMode }) {
  const containerRef = useRef(null);
  const lastMouse    = useRef({ x: 90, y: 80 });
  const [tooltip, setTooltip]       = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const highlightedColors = mode === 'recovery' ? RECOVERY_HIGHLIGHTED : GROWTH_HIGHLIGHTED;
  const data = buildModelData(recoveryMap, growthMap, mode);

  function handleMouseMove(e) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    lastMouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function handleMuscleClick(muscleStats) {
    if (!muscleStats?.muscle) return;
    const { x, y } = lastMouse.current;
    setTooltip(muscleStats.muscle);
    setTooltipPos({ x, y: Math.max(y - 20, 0) });
  }

  const summaryItems = mode === 'recovery'
    ? Object.entries(recoveryMap).filter(([, v]) => v.status !== 'no_data' && v.status !== 'ready').sort(([, a], [, b]) => (a.pct ?? 100) - (b.pct ?? 100)).slice(0, 3).map(([k, v]) => ({ key: k, label: MUSCLES[k], value: `${v.pct}%`, sub: `${v.hoursRemaining}h left`, color: RECOVERY_HIGHLIGHTED[(getRecoveryFreq(v.status) ?? 1) - 1] }))
    : Object.entries(growthMap).filter(([, v]) => v.growthPct !== null).sort(([, a], [, b]) => (b.growthPct ?? 0) - (a.growthPct ?? 0)).slice(0, 3).map(([k, v]) => ({ key: k, label: MUSCLES[k], value: `${v.growthPct > 0 ? '+' : ''}${v.growthPct}%`, sub: `${fmt(v.currentVol)} kg·reps`, color: GROWTH_HIGHLIGHTED[(getGrowthFreq(v.status) ?? 1) - 1] }));

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {['recovery', 'growth'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider border transition-colors ${mode === m ? 'border-orange-500/60 text-orange-300 bg-orange-500/10' : 'border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-600'}`}
          >{m}</button>
        ))}
      </div>
      <style>{`
        .body-map-container svg { filter: drop-shadow(0px 0px 8px rgba(237,122,42,0.06)); }
        .body-map-container svg path, .body-map-container svg polygon { stroke-linejoin: round; stroke-linecap: round; }
        .rbh polygon { transition: fill 150ms ease; }
        .rbh polygon:hover { fill: rgba(237,122,42,0.28) !important; cursor: pointer; }
      `}</style>
      <div ref={containerRef} className="body-map-container flex gap-3 justify-center relative" onMouseMove={handleMouseMove} onClick={(e) => { if (e.target.tagName !== 'polygon') setTooltip(null); }}>
        <div>
          <Model type="anterior" data={data} bodyColor="#1c1917" highlightedColors={highlightedColors} onClick={handleMuscleClick} style={{ width: '180px', padding: '4px' }} />
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '9px', letterSpacing: '0.15em', color: '#57534e', textTransform: 'uppercase', textAlign: 'center', marginTop: '6px' }}>ANTERIOR</div>
        </div>
        <div>
          <Model type="posterior" data={data} bodyColor="#1c1917" highlightedColors={highlightedColors} onClick={handleMuscleClick} style={{ width: '180px', padding: '4px' }} />
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '9px', letterSpacing: '0.15em', color: '#57534e', textTransform: 'uppercase', textAlign: 'center', marginTop: '6px' }}>POSTERIOR</div>
        </div>
        {tooltip && <MuscleTooltip muscle={tooltip} recoveryData={recoveryMap} growthData={growthMap} mode={mode} position={tooltipPos} />}
      </div>
      <div className="mt-3 pt-3 border-t border-stone-800/60">
        {mode === 'recovery' ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[['#4ade80','Ready'],['#a3e635','Almost'],['#fbbf24','Partial'],['#f87171','Resting']].map(([c, label]) => (
              <div key={label} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} /><span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">{label}</span></div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[['#fb923c','PR'],['#4ade80','Improved'],['#60a5fa','First'],['#fbbf24','Regressed'],['#f87171','Dropped']].map(([c, label]) => (
              <div key={label} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} /><span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">{label}</span></div>
            ))}
          </div>
        )}
      </div>
      {summaryItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-800/60 space-y-2">
          <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">{mode === 'recovery' ? 'Most Fatigued' : 'Top Gains'}</div>
          {summaryItems.map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-[10px] font-mono text-stone-400">{item.label}</span></div>
              <div className="text-right"><span className="text-[10px] font-mono text-stone-200">{item.value}</span><span className="text-[9px] font-mono text-stone-600 ml-1.5">{item.sub}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    case 'water': return <svg {...props}><path d="M7 2L4 7a3 3 0 006 0L7 2z" /></svg>;
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
      done:   'bg-orange-500 weekly-done',
      missed: 'bg-red-500/20 border border-red-500/40',
      rest:   'bg-stone-800 border border-stone-700 weekly-rest',
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
function getCheckinBannerVisible() {
  try {
    const until = localStorage.getItem('checkin_suppress_until');
    if (!until) return true;
    return new Date() > new Date(until);
  } catch { return true; }
}

export default function Dashboard() {
  const { user } = useSession();
  const { data, loading, refetch } = useDashboard(user?.id);
  const zustandProfile  = useProfileStore(s => s.profile);
  const updateProfile   = useProfileStore(s => s.updateProfile);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(searchParams.get('upgraded') === 'true');
  const [upgradedTier] = useState(searchParams.get('tier')); // captured before URL is cleared
  const [showCheckinBanner, setShowCheckinBanner] = useState(getCheckinBannerVisible);
  const [showCheckinModal, setShowCheckinModal]   = useState(false);
  const [showBreakdown, setShowBreakdown]         = useState(false);
  const [bodyMode, setBodyMode]                   = useState('growth');
  const checkin = useCheckin(user?.id);
  const [plateauAlerts, setPlateauAlerts] = useState([]);
  const { displayWeight, displayEnergy, weightLabel, energyLabel } = useUnits();

  const isSunday = new Date().getDay() === 0;

  function dismissCheckinBanner() {
    const until = new Date();
    until.setDate(until.getDate() + 7);
    localStorage.setItem('checkin_suppress_until', until.toISOString());
    setShowCheckinBanner(false);
  }

  async function dismissPlateauAlert(alert) {
    setPlateauAlerts(prev => prev.filter(p => p.exerciseId !== alert.exerciseId));
    await supabase
      .from('workout_exercises')
      .update({ plateaued: false })
      .in('id', alert.weIds);
  }

  useEffect(() => {
    if (showUpgradeBanner) setSearchParams({}, { replace: true });
  }, []);

  // Stripe only fires success_url after payment is confirmed — trust the URL param.
  // Update the store immediately so every page sees the new tier right away.
  // The webhook handles DB persistence separately; this keeps the UI instant.
  const setProfile = useProfileStore(s => s.setProfile);
  useEffect(() => {
    if (!showUpgradeBanner || !upgradedTier) return;
    updateProfile({ subscription_tier: upgradedTier });
  }, [showUpgradeBanner, upgradedTier]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load plateau alerts from recent workouts (last 7 days)
  useEffect(() => {
    if (!user?.id) return;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    supabase
      .from('workouts')
      .select('id')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .gte('completed_at', since.toISOString())
      .then(async ({ data: recentWorkouts }) => {
        if (!recentWorkouts?.length) return;
        const ids = recentWorkouts.map(w => w.id);
        const { data: plateaued } = await supabase
          .from('workout_exercises')
          .select('id, exercise_id, exercises(name)')
          .in('workout_id', ids)
          .eq('plateaued', true);
        if (plateaued?.length) {
          const exerciseMap = new Map();
          for (const we of plateaued) {
            if (!exerciseMap.has(we.exercise_id)) {
              exerciseMap.set(we.exercise_id, {
                exerciseId:   we.exercise_id,
                exerciseName: we.exercises?.name ?? we.exercise_id,
                weIds:        [],
              });
            }
            exerciseMap.get(we.exercise_id).weIds.push(we.id);
          }
          setPlateauAlerts([...exerciseMap.values()]);
        }
      });
  }, [user?.id]);

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
  const activityFeed   = [...(data?.activityFeed ?? []), { time: '16:45', type: 'water', text: '2.4 L logged · goal 3.0 L' }];

  const remaining    = targets.kcal - consumed.kcal;
  const weightDelta  = bio.current != null && bio.weekAgo != null ? bio.current - bio.weekAgo : null;
  const completedDays    = weeklyAdherence.filter(d => d.workout === true).length;
  const totalWorkoutDays = weeklyAdherence.filter(d => !d.rest && !d.future).length;

  const displayName   = profile?.display_name || 'Athlete';
  const initials      = (() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  })();
  const tier          = zustandProfile?.subscription_tier ?? profile?.subscription_tier ?? 'basic';
  const tierLabel     = tier.toUpperCase();
  const goalLabel     = profile?.goal ? `goal: ${profile.goal}` : 'loading';
  // Use Zustand profile for real-time streak updates (set by useBiometricVault after each log)
  const currentStreak = zustandProfile?.current_streak ?? weeklyStats.streak ?? 0;

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
              <span className={`hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono ${currentStreak >= 7 ? 'text-amber-400' : 'text-stone-500'}`}>
                🔥 {loading ? '—' : `${currentStreak}d streak`}
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono">
                {loading ? '…' : tierLabel}
              </span>
              <Link
                to="/settings"
                title="Settings"
                className="w-7 h-7 rounded-full flex items-center justify-center font-anton text-xs text-stone-950 shrink-0 hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #fbbf24, #ff5a2a)' }}
              >
                {initials}
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-[1400px] mx-auto px-6 py-8">

          {/* UPGRADE BANNER */}
          {showUpgradeBanner && (
            <div className="relative mb-8 border border-orange-500/40 bg-orange-500/10 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 20, letterSpacing: 2, color: '#ed7a2a' }}>
                  WELCOME TO {upgradedTier ? upgradedTier.toUpperCase() : 'THE NEXT LEVEL'}
                </span>
                <span className="text-sm text-stone-300" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Your subscription is now active. All {upgradedTier ? upgradedTier.charAt(0).toUpperCase() + upgradedTier.slice(1) : ''} features are unlocked.
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

          {/* SUNDAY CHECK-IN BANNER */}
          {isSunday && showCheckinBanner && !loading && (
            <div className="relative mb-8 border border-orange-500/40 bg-orange-500/5 px-6 py-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl shrink-0">📋</span>
                <div>
                  <div className="font-anton text-xl uppercase tracking-tight text-stone-100">Weekly Check-In</div>
                  <div className="text-sm text-stone-400 font-mono mt-0.5">How was your week? Rate mood, energy, and sleep quality.</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowCheckinModal(true)}
                  className="px-5 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors"
                >
                  Start →
                </button>
                <button
                  onClick={dismissCheckinBanner}
                  className="text-stone-600 hover:text-stone-300 font-mono text-xs uppercase tracking-wider transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* GREETING */}
          <header className="mb-8">
            <div className="flex items-baseline gap-3 mb-2">
              <h1 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100">
                {greeting()},{' '}
                {loading
                  ? <Sk className="inline-block w-32 h-10 align-bottom" />
                  : <span className="dash-greeting-name bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">{displayName}</span>
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
            <div onClick={() => navigate('/biometrics')} className="px-5 py-4 border-r border-stone-800/60 cursor-pointer hover:bg-stone-900/40 transition-colors">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Weight</div>
              {loading || bio.current == null ? (
                <>
                  <Sk className="h-8 w-24 mb-1" />
                  <Sk className="h-3 w-16" />
                </>
              ) : (
                <>
                  <div className="font-anton text-3xl tabular-nums text-stone-100">
                    {displayWeight(bio.current, { noUnit: true })}<span className="text-stone-500 text-lg ml-1">{weightLabel}</span>
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-orange-300 mt-0.5">
                    {weightDelta != null
                      ? `${weightDelta < 0 ? '↓' : '↑'} ${displayWeight(Math.abs(weightDelta), { noUnit: true })} ${weightLabel} / 7d`
                      : 'No prior data'}
                  </div>
                </>
              )}
            </div>

            {/* Calories Left */}
            <div onClick={() => navigate('/nutrition')} className="px-5 py-4 border-r border-stone-800/60 cursor-pointer hover:bg-stone-900/40 transition-colors">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Calories Left</div>
              {loading ? (
                <>
                  <Sk className="h-8 w-20 mb-1" />
                  <Sk className="h-3 w-28" />
                </>
              ) : (
                <>
                  <div className={`font-anton text-3xl tabular-nums ${consumed.mealsLogged === 0 ? 'text-stone-500' : 'text-orange-300'}`}>
                    {displayEnergy(remaining, { noUnit: true })}
                  </div>
                  {eatBackCalories && calsBurned ? (
                    <div className="text-[10px] font-mono text-orange-400 mt-0.5 tabular-nums">
                      {displayEnergy(rawTargets.kcal, { noUnit: true })} + {displayEnergy(calsBurned, { noUnit: true })} burned = {displayEnergy(targets.kcal, { noUnit: true })} {energyLabel}
                    </div>
                  ) : consumed.mealsLogged > 0 ? (
                    <div className="text-[10px] font-mono text-stone-500 mt-0.5 tabular-nums">
                      {displayEnergy(consumed.kcal, { noUnit: true })} / {displayEnergy(targets.kcal)} {calsBurned ? ` · ${displayEnergy(calsBurned, { noUnit: true })} burned` : ''}
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-stone-600 mt-0.5 tabular-nums">
                      {displayEnergy(targets.kcal)} target {calsBurned ? ` · ${displayEnergy(calsBurned, { noUnit: true })} burned` : ''}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Workout */}
            <div onClick={() => navigate('/logger')} className="px-5 py-4 border-r border-stone-800/60 cursor-pointer hover:bg-stone-900/40 transition-colors">
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
            <div onClick={() => navigate('/biometrics')} className="px-5 py-4 cursor-pointer hover:bg-stone-900/40 transition-colors">
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Streak</div>
              {loading ? (
                <>
                  <Sk className="h-8 w-20 mb-1" />
                  <Sk className="h-3 w-28" />
                </>
              ) : (
                <>
                  <div className={`font-anton text-3xl tabular-nums flex items-baseline gap-1.5 flex-wrap ${currentStreak >= 7 ? 'text-amber-400' : 'text-stone-100'}`}>
                    <span>🔥</span>
                    {currentStreak}
                    <span className="text-stone-500 text-lg">days</span>
                    {currentStreak >= 30 && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 font-mono uppercase tracking-wider">ELITE</span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mt-0.5">
                    {currentStreak === 0 ? 'Start your streak — log today' : 'keep going'}
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

          {/* PLATEAU ALERT */}
          {!loading && plateauAlerts.length > 0 && (
            <div className="mb-8 space-y-2">
              {plateauAlerts.map((p, i) => (
                <div key={i} className="border border-orange-500/40 bg-orange-500/5 p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0">⚠</span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] uppercase tracking-[0.2em] text-orange-400 font-mono">Plateau Detected</span>
                      </div>
                      <div className="font-anton text-lg uppercase tracking-tight text-stone-100">
                        Your {p.exerciseName} hasn't improved in 3 sessions
                      </div>
                      <div className="text-xs text-stone-500 font-mono mt-0.5">Consider a deload, form check, or variation</div>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <Link to="/exercises" className="px-4 py-2 border border-stone-700 text-stone-400 font-mono text-[10px] uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors no-underline">
                      Find Variations →
                    </Link>
                    <button
                      onClick={() => dismissPlateauAlert(p)}
                      className="text-stone-500 font-mono text-[10px] uppercase tracking-wider hover:text-orange-400 transition-colors"
                    >dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PRIMARY 3-CARD GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

            {/* TODAY'S WORKOUT */}
            <div className="lg:col-span-5 border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Today's Workout</span>
                <span className="text-[9px] text-stone-600 font-mono">FORGE</span>
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
                      <p className="text-xs font-mono text-stone-600 py-4">No exercises added yet. Open Forge to build this workout.</p>
                    )}
                  </div>
                  <Link
                    to={workout.completed ? `/logger?workoutId=${workout.id}` : '/logger'}
                    onClick={e => e.stopPropagation()}
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
            <div onClick={() => navigate('/nutrition')} className="lg:col-span-4 border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col cursor-pointer hover:border-stone-700 transition-colors group">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Today's Macros</span>
                <span className="text-[9px] text-stone-600 group-hover:text-orange-400 font-mono transition-colors">→ sentinel</span>
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
                    <button
                      onClick={() => setShowBreakdown(true)}
                      className="shrink-0 flex flex-col items-center gap-1"
                    >
                      <MiniCalorieRing consumed={0} target={targets.kcal} />
                      <span className="text-[9px] font-mono uppercase tracking-wider text-stone-600">tap for breakdown</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-anton text-2xl tabular-nums text-stone-600 leading-none">{displayEnergy(targets.kcal, { noUnit: true })}</div>
                      {eatBackCalories && calsBurned ? (
                        <div className="text-[10px] font-mono text-orange-400 mt-1 tabular-nums">
                          {displayEnergy(rawTargets.kcal, { noUnit: true })} + {displayEnergy(calsBurned, { noUnit: true })} burned = {displayEnergy(targets.kcal, { noUnit: true })} {energyLabel}
                        </div>
                      ) : calsBurned ? (
                        <div className="text-[10px] font-mono text-stone-500 mt-1 tabular-nums">
                          {displayEnergy(calsBurned)} burned today
                        </div>
                      ) : (
                        <div className="text-[10px] uppercase tracking-wider text-stone-600 font-mono mt-1">{energyLabel} target</div>
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
                    <button
                      onClick={() => setShowBreakdown(true)}
                      className="shrink-0 flex flex-col items-center gap-1"
                    >
                      <MiniCalorieRing consumed={consumed.kcal} target={targets.kcal} />
                      <span className="text-[9px] font-mono uppercase tracking-wider text-stone-600">tap for breakdown</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-anton text-2xl tabular-nums text-orange-300 leading-none">{displayEnergy(remaining, { noUnit: true })}</div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-1">{energyLabel} remaining</div>
                      {eatBackCalories && calsBurned ? (
                        <div className="text-[10px] font-mono text-orange-400 mt-1 tabular-nums">
                          {displayEnergy(rawTargets.kcal, { noUnit: true })} + {displayEnergy(calsBurned, { noUnit: true })} burned = {displayEnergy(targets.kcal, { noUnit: true })} {energyLabel}
                        </div>
                      ) : calsBurned ? (
                        <div className="text-[10px] font-mono text-stone-500 mt-1 tabular-nums">
                          {displayEnergy(calsBurned)} burned today
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
            <div onClick={() => navigate('/biometrics')} className="lg:col-span-3 border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col cursor-pointer hover:border-stone-700 transition-colors group">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Body Comp</span>
                <span className="text-[9px] text-stone-600 group-hover:text-orange-400 font-mono transition-colors">→ vault</span>
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
                    {displayWeight(bio.current, { noUnit: true })}
                    <span className="text-stone-500 text-2xl ml-1">{weightLabel}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-4">
                    {weightDelta != null ? (
                      <>
                        <span className="text-[11px] font-mono tabular-nums text-orange-300">
                          {weightDelta < 0 ? '↓' : '↑'} {displayWeight(Math.abs(weightDelta), { noUnit: true })} {weightLabel}
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
                        <span className="font-anton text-lg text-orange-300 tabular-nums">{displayWeight(bio.goal, { noUnit: true })} {weightLabel}</span>
                        <span className="text-[10px] font-mono tabular-nums text-stone-500">
                          {displayWeight(Math.abs(bio.current - bio.goal), { noUnit: true })} to go
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
            <div onClick={() => navigate('/biometrics')} className="lg:col-span-7 border border-stone-800/60 bg-stone-950/40 p-6 cursor-pointer hover:border-stone-700 transition-colors group">
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">This Week</h2>
                <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 group-hover:text-orange-400 font-mono transition-colors">
                  vault →
                </span>
              </div>

              {loading ? (
                <Sk className="w-full h-40" />
              ) : (
                <WeeklyGrid days={weeklyAdherence} />
              )}

              <div className="weekly-stats-grid mt-5 pt-5 border-t border-stone-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                      : <div className="font-anton text-2xl text-stone-100 tabular-nums">{displayEnergy(weeklyStats.avgKcal, { noUnit: true })}<span className="text-stone-500 text-sm ml-1">{energyLabel}</span></div>
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
                      ? <div className="font-anton text-2xl text-orange-300 tabular-nums">{displayEnergy(calsBurned, { noUnit: true })}<span className="text-stone-500 text-sm ml-1">{energyLabel}</span></div>
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
                <div className="overflow-y-auto max-h-[220px] space-y-0 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-stone-700">
                  {activityFeed.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-stone-800/40 last:border-b-0">
                      <span className="font-mono text-[10px] tabular-nums text-stone-600 w-10 shrink-0">{a.time}</span>
                      <span className={`shrink-0 w-7 h-7 border flex items-center justify-center ${
                        a.type === 'coach'  ? 'text-orange-300 border-orange-500/30 bg-orange-500/5' :
                        a.type === 'water' ? 'text-blue-400 border-blue-500/30 bg-blue-500/5' :
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

          {/* MUSCLE MAP */}
          <div className="mb-8 border border-stone-800/60 bg-stone-950/40 p-6">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Weekly Volume</h2>
              <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">kg·reps</span>
            </div>
            <BodyMapDual recoveryMap={MOCK_RECOVERY_MAP} growthMap={MOCK_GROWTH_MAP} mode={bodyMode} setMode={setBodyMode} />
          </div>

          {/* QUICK ACCESS TILES */}
          <div className="mb-8">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-anton text-xl uppercase tracking-tight text-stone-100">Modules</h2>
              <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">jump to</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { name: 'FORGE',    sub: 'Workout',   accent: 'from-orange-300 to-orange-600', to: '/logger' },
                { name: 'Sentinel', sub: 'Nutrition', accent: 'from-amber-300 to-orange-500',  to: '/nutrition' },
                { name: 'Vault',    sub: 'Biometric', accent: 'from-orange-300 to-red-500',    to: '/biometrics' },
                { name: 'Codex',    sub: 'Exercises', accent: 'from-stone-300 to-stone-500',   to: '/exercises' },
                { name: 'Oracle',   sub: 'Engine',    accent: 'from-orange-400 to-orange-700', to: '/coach' },
              ].map(m => (
                <Link
                  key={m.name}
                  to={m.to}
                  className="group relative overflow-hidden border border-stone-800/60 bg-stone-950/40 hover:border-orange-500/40 transition-all p-4 text-left no-underline block"
                >
                  <div className="text-[9px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-1">
                    {m.sub}
                  </div>
                  <div className={`module-card-name font-anton text-2xl uppercase tracking-tight bg-gradient-to-br ${m.accent} bg-clip-text text-transparent`}>
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

      {showBreakdown && (
        <MacroBreakdownModal
          userId={user?.id}
          onClose={() => setShowBreakdown(false)}
        />
      )}

      {showCheckinModal && (
        <CheckinModal
          onClose={() => setShowCheckinModal(false)}
          onSave={async (payload) => {
            const result = await checkin.submitCheckin(payload);
            if (result?.success) dismissCheckinBanner();
            return result;
          }}
          saving={checkin.saving}
          todayCheckin={checkin.todayCheckin}
        />
      )}
    </div>
  );
}
