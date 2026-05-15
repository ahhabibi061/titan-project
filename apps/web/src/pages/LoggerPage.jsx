import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useLogger } from '../hooks/useLogger';
import { useProfileStore } from '../store/useProfileStore';
import { useBodyMap } from '../hooks/useBodyMap';
import { useWorkoutTemplates } from '../hooks/useWorkoutTemplates';
import { useUnits } from '../hooks/useUnits';
import { supabase } from '../lib/supabase';
import AppNav from '../components/AppNav';
import Model from 'react-body-highlighter';

/* =========================================================================
 * IRONLAB LOGGER — Module 3 Proof-of-Concept
 * Demonstrates: grid logger, progressive overload, live muscle heatmap.
 * In production: state hydrates from Supabase, mutations write through
 *                TanStack Query, volumes persist to a server-computed view.
 * ========================================================================= */

// -------------------- DOMAIN MODEL --------------------
const MUSCLES = {
  chest: 'Chest',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  traps: 'Traps',
  lats: 'Lats',
  lower_back: 'Lower Back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
};

const EXERCISE_LIBRARY = [
  { id: 'bench',           name: 'Barbell Bench Press',     primary: ['chest'],        secondary: ['front_delts','triceps'] },
  { id: 'incline_db',      name: 'Incline DB Press',        primary: ['chest'],        secondary: ['front_delts','triceps'] },
  { id: 'cable_fly',       name: 'Cable Crossover',         primary: ['chest'],        secondary: ['front_delts'] },
  { id: 'ohp',             name: 'Standing Overhead Press', primary: ['front_delts'],  secondary: ['side_delts','triceps'] },
  { id: 'lateral_raise',   name: 'DB Lateral Raise',        primary: ['side_delts'],   secondary: [] },
  { id: 'rear_delt_fly',   name: 'Reverse Pec Deck',        primary: ['rear_delts'],   secondary: ['traps'] },
  { id: 'pullup',          name: 'Pull-Up',                 primary: ['lats'],         secondary: ['biceps','rear_delts'] },
  { id: 'row',             name: 'Barbell Row',             primary: ['lats'],         secondary: ['biceps','rear_delts','traps'] },
  { id: 'lat_pulldown',    name: 'Lat Pulldown',            primary: ['lats'],         secondary: ['biceps'] },
  { id: 'shrug',           name: 'DB Shrug',                primary: ['traps'],        secondary: [] },
  { id: 'curl',            name: 'Barbell Curl',            primary: ['biceps'],       secondary: ['forearms'] },
  { id: 'tricep_pushdown', name: 'Cable Tricep Pushdown',   primary: ['triceps'],      secondary: [] },
  { id: 'squat',           name: 'Back Squat',              primary: ['quads'],        secondary: ['glutes','hamstrings'] },
  { id: 'leg_press',       name: 'Leg Press',               primary: ['quads'],        secondary: ['glutes','hamstrings'] },
  { id: 'rdl',             name: 'Romanian Deadlift',       primary: ['hamstrings'],   secondary: ['glutes','lower_back'] },
  { id: 'leg_curl',        name: 'Lying Leg Curl',          primary: ['hamstrings'],   secondary: [] },
  { id: 'hip_thrust',      name: 'Barbell Hip Thrust',      primary: ['glutes'],       secondary: ['hamstrings'] },
  { id: 'calf_raise',      name: 'Standing Calf Raise',     primary: ['calves'],       secondary: [] },
  { id: 'crunch',          name: 'Cable Crunch',            primary: ['abs'],          secondary: [] },
];

// Push day — reps/weight reflect today's plan; prev fields are last session's actuals.
const INITIAL_WORKOUT = [
  { id: 'we1', exerciseId: 'bench', sets: [
    { id: 's11', reps: 10, weight: 60,   done: false, prevReps: 10, prevWeight: 57.5 },
    { id: 's12', reps: 10, weight: 60,   done: false, prevReps: 9,  prevWeight: 57.5 },
    { id: 's13', reps: 8,  weight: 60,   done: false, prevReps: 8,  prevWeight: 57.5 },
  ]},
  { id: 'we2', exerciseId: 'incline_db', sets: [
    { id: 's21', reps: 10, weight: 22.5, done: false, prevReps: 10, prevWeight: 22.5 },
    { id: 's22', reps: 10, weight: 22.5, done: false, prevReps: 9,  prevWeight: 22.5 },
    { id: 's23', reps: 9,  weight: 22.5, done: false, prevReps: 8,  prevWeight: 22.5 },
  ]},
  { id: 'we3', exerciseId: 'ohp', sets: [
    { id: 's31', reps: 8,  weight: 40,   done: false, prevReps: 8,  prevWeight: 37.5 },
    { id: 's32', reps: 8,  weight: 40,   done: false, prevReps: 7,  prevWeight: 37.5 },
    { id: 's33', reps: 6,  weight: 40,   done: false, prevReps: 6,  prevWeight: 37.5 },
  ]},
  { id: 'we4', exerciseId: 'lateral_raise', sets: [
    { id: 's41', reps: 12, weight: 10,   done: false, prevReps: 12, prevWeight: 10 },
    { id: 's42', reps: 12, weight: 10,   done: false, prevReps: 12, prevWeight: 10 },
    { id: 's43', reps: 10, weight: 10,   done: false, prevReps: 10, prevWeight: 10 },
  ]},
  { id: 'we5', exerciseId: 'tricep_pushdown', sets: [
    { id: 's51', reps: 12, weight: 25,   done: false, prevReps: 12, prevWeight: 22.5 },
    { id: 's52', reps: 12, weight: 25,   done: false, prevReps: 11, prevWeight: 22.5 },
    { id: 's53', reps: 10, weight: 25,   done: false, prevReps: 10, prevWeight: 22.5 },
  ]},
];

// -------------------- LOGIC --------------------
const setVolume = (s) => (Number(s.reps) || 0) * (Number(s.weight) || 0);
const setPrevVolume = (s) => (Number(s.prevReps) || 0) * (Number(s.prevWeight) || 0);

function exerciseVolume(we) {
  return we.sets.reduce((acc, s) => acc + setVolume(s), 0);
}

function muscleVolumes(workout, library) {
  const v = {};
  for (const we of workout) {
    const ex = we._ex || library.find(e => e.id === we.exerciseId);
    if (!ex) continue;
    const vol = exerciseVolume(we);
    if (vol === 0) continue;
    ex.primary.forEach(m   => { v[m] = (v[m] || 0) + vol; });
    ex.secondary.forEach(m => { v[m] = (v[m] || 0) + vol * 0.5; });
  }
  return v;
}

// overloadStatus compares volumes in the user's display unit, rounded to
// display precision.  This prevents lbs↔kg round-trip drift (e.g. 220.5 lbs
// → 100.018... kg ≠ stored 100.000 kg) from silently breaking MATCH.
function overloadStatus(s, weightUnit = 'kg') {
  const toDispW = (kg) =>
    weightUnit === 'lbs'
      ? +(kg * KG_TO_LBS_FACTOR).toFixed(1)   // round to 0.1 lb resolution
      : Math.round(kg * 100) / 100;             // round to 0.01 kg resolution
  const cur  = (Number(s.reps)     || 0) * toDispW(Number(s.weight)     || 0);
  const prev = (Number(s.prevReps) || 0) * toDispW(Number(s.prevWeight) || 0);
  if (prev === 0) return { kind: 'new',   label: 'NEW'   };
  if (cur >  prev) return { kind: 'pr',    label: 'PR'    };
  if (cur === prev) return { kind: 'match', label: 'MATCH' };
  return { kind: 'down', label: 'DOWN' };
}

// 5-stop heat ramp: cool graphite → ember → orange → red-orange.
function volumeToFill(volume, max) {
  if (!volume || volume <= 0) return 'rgba(255,255,255,0.025)';
  const t = Math.min(volume / Math.max(max, 1), 1);
  const stops = [
    { t: 0.00, c: [44, 36, 30] },
    { t: 0.18, c: [98, 42, 18] },
    { t: 0.45, c: [186, 74, 28] },
    { t: 0.72, c: [240, 110, 38] },
    { t: 1.00, c: [255, 78, 38] },
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t <= stops[i + 1].t) {
      const local = (t - stops[i].t) / (stops[i + 1].t - stops[i].t || 1);
      const r = Math.round(stops[i].c[0] + (stops[i + 1].c[0] - stops[i].c[0]) * local);
      const g = Math.round(stops[i].c[1] + (stops[i + 1].c[1] - stops[i].c[1]) * local);
      const b = Math.round(stops[i].c[2] + (stops[i + 1].c[2] - stops[i].c[2]) * local);
      return `rgb(${r},${g},${b})`;
    }
  }
  const last = stops[stops.length - 1].c;
  return `rgb(${last[0]},${last[1]},${last[2]})`;
}


// -------------------- UI PRIMITIVES --------------------
const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtKg = (n) => `${n}${Number.isInteger(n) ? '' : ''}`;

function StatBlock({ label, value, sub, accent, className: extraClass }) {
  return (
    <div className={`flex flex-col gap-1 px-5 py-4 border-r border-stone-800/60 last:border-r-0 ${extraClass || ''}`}>
      <span className="text-[10px] uppercase tracking-[0.18em] text-stone-500 font-medium">{label}</span>
      <span className={`text-3xl font-anton tracking-tight tabular-nums ${accent || 'text-stone-100'}`}>{value}</span>
      {sub && <span className="text-[11px] text-stone-500 tabular-nums">{sub}</span>}
    </div>
  );
}

function OverloadBadge({ status }) {
  const styles = {
    pr:    'bg-orange-500/15 text-orange-300 border-orange-500/30',
    match: 'bg-stone-700/40 text-stone-300 border-stone-600/40',
    down:  'bg-red-900/20 text-red-400 border-red-800/30',
    new:   'bg-amber-500/10 text-amber-300 border-amber-500/30',
  }[status.kind];
  const arrow = { pr: '▲', match: '=', down: '▼', new: '+' }[status.kind];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-mono border ${styles}`}>
      <span className="text-[8px]">{arrow}</span>{status.label}
    </span>
  );
}

// -------------------- SET ROW --------------------
const KG_TO_LBS_FACTOR = 2.20462;

function SetRow({ set, idx, onChange, onRemove, isLast, weightUnit = 'kg' }) {
  const status = overloadStatus(set, weightUnit);
  const vol = setVolume(set);
  const prevVol = setPrevVolume(set);
  const isLbs = weightUnit === 'lbs';

  // Convert stored kg values to display unit
  const dispWeight     = isLbs ? +(set.weight * KG_TO_LBS_FACTOR).toFixed(1)     : set.weight;
  const dispPrevWeight = isLbs ? +(set.prevWeight * KG_TO_LBS_FACTOR).toFixed(1) : set.prevWeight;
  const wLabel         = isLbs ? 'lbs' : 'kg';

  const handleWeightChange = (e) => {
    if (e.target.value === '') { onChange({ ...set, weight: '' }); return; }
    const raw = Number(e.target.value);
    onChange({ ...set, weight: isLbs ? raw / KG_TO_LBS_FACTOR : raw });
  };

  return (
    <tr className="group transition-colors hover:bg-stone-900/40">
      <td className="px-3 py-2 w-10">
        <span className="font-mono text-[11px] text-stone-500 tabular-nums">{String(idx + 1).padStart(2,'0')}</span>
      </td>
      <td className="px-3 py-2 w-28">
        <div className="font-mono text-[11px] text-stone-500 tabular-nums">
          {set.prevReps} × {dispPrevWeight}<span className="text-stone-600 ml-0.5">{wLabel}</span>
        </div>
        <div className="font-mono text-[10px] text-stone-600 tabular-nums">vol {fmt(prevVol)}</div>
      </td>
      <td className="px-2 py-2 w-20">
        <input
          type="number"
          inputMode="numeric"
          value={set.reps}
          onChange={(e) => onChange({ ...set, reps: e.target.value === '' ? '' : Number(e.target.value) })}
          className="w-full bg-stone-950/60 border border-stone-800 px-2 py-1.5 text-stone-100 font-mono text-sm tabular-nums text-right focus:outline-none focus:border-orange-500/60 focus:bg-stone-950"
        />
      </td>
      <td className="px-2 py-2 w-24">
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            step={isLbs ? '1' : '0.5'}
            value={dispWeight}
            onChange={handleWeightChange}
            className="w-full bg-stone-950/60 border border-stone-800 px-2 py-1.5 pr-8 text-stone-100 font-mono text-sm tabular-nums text-right focus:outline-none focus:border-orange-500/60 focus:bg-stone-950"
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-stone-600 font-mono pointer-events-none">{wLabel}</span>
        </div>
      </td>
      <td className="px-3 py-2 w-24">
        <div className="font-mono text-sm text-stone-300 tabular-nums">{fmt(vol)}</div>
      </td>
      <td className="px-2 py-2 w-24">
        <OverloadBadge status={status} />
      </td>
      <td className="px-2 py-2 w-8">
        <button
          onClick={onRemove}
          disabled={isLast}
          className="text-stone-700 hover:text-red-500 disabled:opacity-20 disabled:hover:text-stone-700 transition-colors text-xs"
          aria-label="Remove set"
        >✕</button>
      </td>
    </tr>
  );
}

// -------------------- INLINE REST TIMER --------------------
function InlineRestTimer({ onRemove }) {
  const [seconds, setSeconds]       = useState(90);
  const [maxSeconds, setMaxSeconds] = useState(90);
  const [running, setRunning]       = useState(false);
  const [done, setDone]             = useState(false);

  useEffect(() => {
    if (!running || done) return;
    const t = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          setDone(true);
          setRunning(false);
          if (navigator.vibrate) navigator.vibrate([200]);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, done]);

  function handleStart() {
    setMaxSeconds(seconds);
    setRunning(true);
    setDone(false);
  }

  function adjust(delta) {
    if (running || done) return;
    const v = Math.max(5, seconds + delta);
    setSeconds(v);
    setMaxSeconds(v);
  }

  const pct = (running || done) ? seconds / Math.max(maxSeconds, 1) : 1;
  const r   = 20;
  const circ = 2 * Math.PI * r;

  return (
    <div className={`border-t border-stone-800/60 px-4 py-3 flex items-center gap-4 ${done ? 'bg-green-950/20' : ''}`}>
      <div className="relative w-12 h-12 shrink-0">
        <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle cx="24" cy="24" r={r} fill="none"
            stroke={done ? '#4ade80' : '#ed7a2a'} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${pct * circ} ${circ}`}
            style={{ transition: running ? 'stroke-dasharray 1s linear' : 'none' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-anton text-sm tabular-nums leading-none ${done ? 'text-green-400' : 'text-orange-400'}`}>
            {done ? '✓' : seconds}
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center gap-2">
        {!running && !done && (
          <>
            <button onClick={() => adjust(-30)} className="w-8 h-7 border border-stone-700 text-stone-400 hover:text-stone-200 font-mono text-[9px] flex items-center justify-center hover:border-stone-500 transition-colors">-30</button>
            <button onClick={() => adjust(30)}  className="w-8 h-7 border border-stone-700 text-stone-400 hover:text-stone-200 font-mono text-[9px] flex items-center justify-center hover:border-stone-500 transition-colors">+30</button>
            <button onClick={handleStart} className="px-3 h-7 bg-orange-500/80 text-stone-950 font-mono text-[9px] uppercase tracking-wider hover:bg-orange-500 transition-colors">▶ Start</button>
          </>
        )}
        {running && (
          <button onClick={() => setRunning(false)} className="px-3 h-7 border border-stone-700 text-stone-400 font-mono text-[9px] uppercase tracking-wider hover:border-stone-500 transition-colors">⏹ Stop</button>
        )}
        {done && (
          <span className="font-mono text-xs text-green-400 uppercase tracking-wider">Rest complete</span>
        )}
      </div>

      <button onClick={onRemove} className="w-7 h-7 border border-stone-700 text-stone-500 hover:text-red-400 hover:border-red-500/50 font-mono text-xs flex items-center justify-center transition-colors shrink-0">✕</button>
    </div>
  );
}

// -------------------- EXERCISE CARD --------------------
function ExerciseCard({ we, exercise, onUpdate, onRemove, onAddSet, index, weightUnit = 'kg' }) {
  const [showTimer, setShowTimer] = useState(false);
  const totalVol = exerciseVolume(we);
  const isLbs = weightUnit === 'lbs';
  const dispBestWeight = we.prevBestWeight > 0
    ? (isLbs ? +(we.prevBestWeight * KG_TO_LBS_FACTOR).toFixed(1) : we.prevBestWeight)
    : 0;

  return (
    <article className="border border-stone-800/80 bg-stone-950/40 backdrop-blur-sm">
      <header className="flex items-baseline justify-between gap-4 px-5 py-4 border-b border-stone-800/60 bg-gradient-to-r from-stone-950/80 to-transparent">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono text-[10px] text-stone-600 tabular-nums">{String(index + 1).padStart(2,'0')}</span>
          <h3 className="font-anton text-2xl tracking-tight text-stone-100 uppercase">{exercise.name}</h3>
          <div className="flex gap-1.5 flex-wrap">
            {exercise.primary.map(m => (
              <span key={m} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-orange-500/15 text-orange-300 border border-orange-500/25 font-mono">
                {MUSCLES[m]}
              </span>
            ))}
            {exercise.secondary.map(m => (
              <span key={m} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-stone-800/60 text-stone-400 border border-stone-700/60 font-mono">
                {MUSCLES[m]}
              </span>
            ))}
          </div>
          {we.prevCount > 0 && (
            <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider whitespace-nowrap">
              Last: {we.prevCount} {we.prevCount === 1 ? 'set' : 'sets'}
              {dispBestWeight > 0 && (
                <> · {dispBestWeight}{isLbs ? 'lbs' : 'kg'} × {we.prevBestReps}</>
              )}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-4 shrink-0">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-stone-600">Sets</div>
            <div className="font-mono text-sm text-stone-300 tabular-nums">{we.sets.length}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-stone-600">Vol</div>
            <div className="font-mono text-sm text-orange-300 tabular-nums">{fmt(totalVol)}</div>
          </div>
          <button
            onClick={onRemove}
            className="text-stone-700 hover:text-red-500 transition-colors p-1"
            aria-label="Remove exercise"
          >
            <TrashIcon />
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[9px] uppercase tracking-[0.15em] text-stone-600 font-medium border-b border-stone-800/60">
              <th className="px-3 py-2 text-left font-medium">Set</th>
              <th className="px-3 py-2 text-left font-medium">Last Session</th>
              <th className="px-2 py-2 text-right font-medium">Reps</th>
              <th className="px-2 py-2 text-right font-medium">Weight</th>
              <th className="px-3 py-2 text-left font-medium">Volume</th>
              <th className="px-2 py-2 text-left font-medium">Status</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-900/60">
            {we.sets.map((s, idx) => (
              <SetRow
                key={s.id}
                set={s}
                idx={idx}
                isLast={we.sets.length === 1}
                weightUnit={weightUnit}
                onChange={(updated) => onUpdate({
                  ...we,
                  sets: we.sets.map(x => x.id === s.id ? updated : x),
                })}
                onRemove={() => onUpdate({
                  ...we,
                  sets: we.sets.filter(x => x.id !== s.id),
                })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showTimer && <InlineRestTimer onRemove={() => setShowTimer(false)} />}
      <footer className="px-3 py-2 border-t border-stone-800/60 bg-stone-950/40 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            onClick={onAddSet}
            className="text-[10px] uppercase tracking-wider font-mono text-stone-500 hover:text-orange-300 px-3 py-1 border border-stone-800 hover:border-orange-500/40 transition-colors"
          >
            + Add Set
          </button>
          {!showTimer && (
            <button
              onClick={() => setShowTimer(true)}
              className="text-[9px] font-mono uppercase tracking-wider text-stone-600 hover:text-orange-300 px-2 py-1 border border-stone-800 hover:border-orange-500/30 transition-colors"
            >
              ⏱ REST TIMER
            </button>
          )}
        </div>
        <div className="text-[10px] font-mono tabular-nums text-stone-600">
          TOTAL <span className="text-stone-400">{fmt(totalVol)}</span> KG·REPS
        </div>
      </footer>
    </article>
  );
}

// -------------------- ADD EXERCISE PICKER --------------------
function AddExercisePicker({ library, onAdd, used }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const available = library.filter(e =>
    !used.has(e.id) && e.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full border border-dashed border-stone-700 hover:border-orange-500/60 hover:bg-orange-500/5 px-5 py-5 text-stone-500 hover:text-orange-300 font-anton text-xl uppercase tracking-tight transition-colors"
      >
        + Add Exercise
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-stone-950 border border-stone-800 z-20 shadow-2xl shadow-black/60">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="w-full bg-transparent border-b border-stone-800 px-4 py-3 text-stone-100 font-mono text-sm placeholder:text-stone-600 focus:outline-none"
          />
          <ul className="max-h-72 overflow-y-auto">
            {available.length === 0 && (
              <li className="px-4 py-3 text-stone-600 text-sm font-mono">No exercises found.</li>
            )}
            {available.map(ex => (
              <li key={ex.id}>
                <button
                  onClick={() => { onAdd(ex); setOpen(false); setQuery(''); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-orange-500/10 hover:text-orange-200 transition-colors flex items-center justify-between gap-3 border-b border-stone-900/50"
                >
                  <span className="text-stone-200 text-sm">{ex.name}</span>
                  <span className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">
                    {ex.primary.map(m => MUSCLES[m]).join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ================== BODY MAP (react-body-highlighter) ==================

// Internal muscle key → react-body-highlighter slug
const MUSCLE_MAP = {
  chest:       'chest',
  front_delts: 'front-deltoids',
  rear_delts:  'back-deltoids',
  biceps:      'biceps',
  triceps:     'triceps',
  forearms:    'forearm',
  abs:         'abs',
  obliques:    'obliques',
  traps:       'trapezius',
  lats:        'upper-back',
  lower_back:  'lower-back',
  glutes:      'gluteal',
  quads:       'quadriceps',
  hamstrings:  'hamstring',
  calves:      'calves',
};

// Package slug → anatomical display name
const MUSCLE_DISPLAY_NAMES = {
  'chest':          'Pectoralis Major',
  'front-deltoids': 'Anterior Deltoids',
  'back-deltoids':  'Posterior Deltoids',
  'biceps':         'Biceps Brachii',
  'triceps':        'Triceps Brachii',
  'forearm':        'Forearm Flexors',
  'abs':            'Rectus Abdominis',
  'obliques':       'Obliques',
  'trapezius':      'Trapezius',
  'upper-back':     'Latissimus Dorsi',
  'lower-back':     'Erector Spinae',
  'gluteal':        'Gluteus Maximus',
  'quadriceps':     'Quadriceps',
  'hamstring':      'Hamstrings',
  'calves':         'Gastrocnemius',
  'adductor':       'Adductors',
  'abductors':      'Abductors',
};

// Recovery hours window per slug (for tooltip estimate)
const MUSCLE_WINDOWS = {
  'chest': 72, 'front-deltoids': 48, 'back-deltoids': 48,
  'biceps': 48, 'triceps': 48, 'forearm': 36,
  'abs': 24, 'obliques': 24,
  'trapezius': 36, 'upper-back': 72, 'lower-back': 72,
  'gluteal': 72, 'quadriceps': 72, 'hamstring': 72,
  'calves': 36,
};

// Recovery: ready=1, almost=2, partial=3, resting=4
const RECOVERY_HIGHLIGHTED = ['#4ade80', '#a3e635', '#fbbf24', '#f87171'];
// Growth: pr=1, improved=2, first=3, regressed=4, dropped=5
const GROWTH_HIGHLIGHTED   = ['#fb923c', '#4ade80', '#60a5fa', '#fbbf24', '#f87171'];

function getRecoveryFreq(status) {
  return { ready: 1, almost: 2, partial: 3, resting: 4 }[status] ?? null;
}
function getGrowthFreq(status) {
  return { pr: 1, improved: 2, first: 3, regressed: 4, dropped: 5 }[status] ?? null;
}

// Build IExerciseData[] for react-body-highlighter.
// Deduplicates slugs by keeping the lowest freq (most highlighted state).
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
  return Object.entries(slugFreq).map(([slug, frequency]) => ({
    name: slug, muscles: [slug], frequency,
  }));
}

// ---- Part 2: Muscle Tooltip ----
function MuscleTooltip({ muscle, recoveryData, growthData, mode, position }) {
  if (!muscle) return null;
  const displayName = MUSCLE_DISPLAY_NAMES[muscle]
    || muscle.replace(/-/g, ' ').toUpperCase();

  const internalKey = Object.entries(MUSCLE_MAP).find(([, s]) => s === muscle)?.[0];

  let value = null;
  let line2 = null;

  if (mode === 'recovery' && internalKey) {
    const e = recoveryData?.[internalKey];
    if (e && e.status !== 'no_data') {
      value = e.pct ?? (e.status === 'ready' ? 100 : null);
      line2 = e.hoursRemaining > 0 ? `${e.hoursRemaining}h remaining` : null;
    }
  } else if (mode === 'growth' && internalKey) {
    const e = growthData?.[internalKey];
    if (e) {
      value = e.growthPct;
      line2 = e.prevVol !== null
        ? `${fmt(e.currentVol)} vs ${fmt(e.prevVol)} kg·reps`
        : e.currentVol != null ? `${fmt(e.currentVol)} kg·reps` : null;
    }
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

  // Estimate hours remaining for recovery
  let hoursEst = null;
  if (mode === 'recovery' && value !== null && value < 100) {
    const win = MUSCLE_WINDOWS[muscle] || 48;
    hoursEst = Math.round(win * (1 - value / 100));
  }

  // Clamp so tooltip doesn't overflow container edge
  const clampedX = Math.min(Math.max(position.x, 80), 260);

  return (
    <div style={{
      position: 'absolute',
      left: clampedX,
      top: Math.max(position.y, 0),
      zIndex: 50,
      background: '#0c0a09',
      border: '1px solid #292524',
      padding: '10px 14px',
      minWidth: '164px',
      pointerEvents: 'none',
      transform: 'translateX(-50%)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
    }}>
      <div style={{
        fontFamily: 'Anton, sans-serif',
        fontSize: '13px',
        color: '#f5f5f4',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        marginBottom: '6px',
      }}>{displayName}</div>

      {value !== null && (
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          color: status.color,
          marginBottom: '4px',
        }}>
          {mode === 'recovery'
            ? `${Math.round(value)}% recovered`
            : value > 0
              ? `↑ ${Math.round(value)}% vs last`
              : `↓ ${Math.abs(Math.round(value))}% vs last`
          }
        </div>
      )}

      {line2 && (
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          color: '#78716c',
          marginBottom: '6px',
          letterSpacing: '0.04em',
        }}>{line2}</div>
      )}

      <div style={{
        display: 'inline-flex',
        padding: '2px 8px',
        background: `${status.color}22`,
        border: `1px solid ${status.color}44`,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: status.color,
      }}>{status.label}</div>

      {hoursEst !== null && (
        <div style={{
          marginTop: '6px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          color: '#57534e',
          letterSpacing: '0.06em',
        }}>~{hoursEst}h until fully recovered</div>
      )}
    </div>
  );
}

// ---- BodyMapDual: mode toggle + two figures + legend + summary ----
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
    ? Object.entries(recoveryMap)
        .filter(([, v]) => v.status !== 'no_data' && v.status !== 'ready')
        .sort(([, a], [, b]) => (a.pct ?? 100) - (b.pct ?? 100))
        .slice(0, 3)
        .map(([k, v]) => ({
          key: k, label: MUSCLES[k],
          value: `${v.pct}%`, sub: `${v.hoursRemaining}h left`,
          color: RECOVERY_HIGHLIGHTED[(getRecoveryFreq(v.status) ?? 1) - 1],
        }))
    : Object.entries(growthMap)
        .filter(([, v]) => v.growthPct !== null)
        .sort(([, a], [, b]) => (b.growthPct ?? 0) - (a.growthPct ?? 0))
        .slice(0, 3)
        .map(([k, v]) => ({
          key: k, label: MUSCLES[k],
          value: `${v.growthPct > 0 ? '+' : ''}${v.growthPct}%`, sub: `${fmt(v.currentVol)} kg·reps`,
          color: GROWTH_HIGHLIGHTED[(getGrowthFreq(v.status) ?? 1) - 1],
        }));

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex gap-1 mb-4">
        {['recovery', 'growth'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider border transition-colors ${
              mode === m
                ? 'border-orange-500/60 text-orange-300 bg-orange-500/10'
                : 'border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-600'
            }`}
          >{m}</button>
        ))}
      </div>

      {/* CSS polish */}
      <style>{`
        .body-map-container svg { filter: drop-shadow(0px 0px 8px rgba(237,122,42,0.06)); }
        .body-map-container svg path, .body-map-container svg polygon { stroke-linejoin: round; stroke-linecap: round; }
        .rbh polygon { transition: fill 150ms ease; }
        .rbh polygon:hover { fill: rgba(237,122,42,0.28) !important; cursor: pointer; }
      `}</style>

      {/* Both figures side by side */}
      <div
        ref={containerRef}
        className="body-map-container flex gap-3 justify-center relative"
        onMouseMove={handleMouseMove}
        onClick={(e) => { if (e.target.tagName !== 'polygon') setTooltip(null); }}
      >
        <div>
          <Model
            type="anterior"
            data={data}
            bodyColor="#1c1917"
            highlightedColors={highlightedColors}
            onClick={handleMuscleClick}
            style={{ width: '180px', padding: '4px' }}
          />
          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', letterSpacing:'0.15em', color:'#57534e', textTransform:'uppercase', textAlign:'center', marginTop:'6px' }}>ANTERIOR</div>
        </div>
        <div>
          <Model
            type="posterior"
            data={data}
            bodyColor="#1c1917"
            highlightedColors={highlightedColors}
            onClick={handleMuscleClick}
            style={{ width: '180px', padding: '4px' }}
          />
          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'9px', letterSpacing:'0.15em', color:'#57534e', textTransform:'uppercase', textAlign:'center', marginTop:'6px' }}>POSTERIOR</div>
        </div>

        {/* Muscle tooltip */}
        {tooltip && (
          <MuscleTooltip
            muscle={tooltip}
            recoveryData={recoveryMap}
            growthData={growthMap}
            mode={mode}
            position={tooltipPos}
          />
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-stone-800/60">
        {mode === 'recovery' ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[['#4ade80','Ready'],['#a3e635','Almost'],['#fbbf24','Partial'],['#f87171','Resting']].map(([c, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[['#fb923c','PR'],['#4ade80','Improved'],['#60a5fa','First'],['#fbbf24','Regressed'],['#f87171','Dropped']].map(([c, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary list */}
      {summaryItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-800/60 space-y-2">
          <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">
            {mode === 'recovery' ? 'Most Fatigued' : 'Top Gains'}
          </div>
          {summaryItems.map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] font-mono text-stone-400">{item.label}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-stone-200">{item.value}</span>
                <span className="text-[9px] font-mono text-stone-600 ml-1.5">{item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------- VOLUME BREAKDOWN BARS --------------------
function VolumeBreakdown({ volumes, max }) {
  const sorted = Object.entries(volumes)
    .filter(([_, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-stone-700 font-mono text-xs uppercase tracking-wider">
        Complete a set to begin
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {sorted.map(([m, v]) => {
        const pct = (v / Math.max(max, 1)) * 100;
        return (
          <li key={m} className="group">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-mono">{MUSCLES[m]}</span>
              <span className="font-mono text-xs text-stone-500 tabular-nums">{fmt(v)}</span>
            </div>
            <div className="relative h-1.5 bg-stone-900 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: volumeToFill(v, max) }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// -------------------- ICONS --------------------
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 3.5h10M5 3.5V2h4v1.5M3 3.5l1 9h6l1-9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
  </svg>
);

// -------------------- SHARED STYLE --------------------
const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
  .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
  .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
  .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
  body { background: #0a0908; }
`;

// -------------------- AMBIENT BACKDROP --------------------
function Backdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none" aria-hidden>
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)'
      }} />
      <div className="absolute top-0 right-0 w-[60vw] h-[60vh] opacity-[0.08] blur-3xl" style={{
        background: 'radial-gradient(circle, #ff5a2a 0%, transparent 60%)'
      }} />
    </div>
  );
}

// -------------------- SAVE TEMPLATE MODAL --------------------
const SPLIT_TYPES = ['PPL', 'Upper-Lower', 'Full Body', 'Custom'];

function SaveTemplateModal({ workoutName, exercises, onSave, onClose, saving }) {
  const [name, setName]           = useState(workoutName || '');
  const [splitType, setSplitType] = useState('Custom');
  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm border border-stone-800 bg-[#0a0908] p-6 space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Save Template</h2>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 font-mono text-xs">✕</button>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Template Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Split Type</label>
          <div className="flex flex-wrap gap-2">
            {SPLIT_TYPES.map(s => (
              <button key={s} onClick={() => setSplitType(s)}
                className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-colors ${splitType === s ? 'border-orange-500/60 text-orange-300 bg-orange-500/10' : 'border-stone-700 text-stone-500 hover:text-stone-300'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[10px] font-mono text-stone-600 uppercase tracking-wider">
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
          {exercises.map(we => ` · ${we._ex?.name ?? we.exerciseId}`).join('')}
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-stone-500 transition-colors">Cancel</button>
          <button
            onClick={() => onSave({ name: name.trim() || workoutName, splitType, exercises })}
            disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------- LOAD TEMPLATE PICKER --------------------
function LoadTemplatePicker({ templates, loading, onLoad, onClose, onDelete }) {
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-950/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0a0908] border-t border-stone-800 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div>
            <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Load Template</h2>
            <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mt-0.5">select to pre-fill workout</div>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 font-mono text-sm">✕</button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-stone-600 font-mono text-xs uppercase tracking-wider">Loading…</div>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12 text-center px-6">
            <div className="text-stone-600 font-mono text-xs uppercase tracking-wider leading-relaxed">
              No templates yet<br />
              <span className="text-stone-700">Complete a workout and save it as a template</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="flex items-center gap-4 px-6 py-4 border-b border-stone-800/40">
                <button className="flex-1 text-left hover:bg-stone-900/40 -mx-2 px-2 py-1 transition-colors rounded" onClick={() => onLoad(tmpl)}>
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-anton text-lg uppercase text-stone-100">{tmpl.name}</span>
                    {tmpl.split_type && <span className="text-[9px] font-mono text-stone-600 uppercase">{tmpl.split_type}</span>}
                    {tmpl.times_used > 0 && <span className="text-[8px] font-mono text-stone-700">{tmpl.times_used}×</span>}
                  </div>
                  <div className="text-[10px] font-mono text-stone-500">
                    {(tmpl.exercises ?? []).length} exercise{(tmpl.exercises ?? []).length !== 1 ? 's' : ''}
                    {(tmpl.exercises ?? []).slice(0, 3).map(e => ` · ${e.name}`).join('')}
                    {(tmpl.exercises ?? []).length > 3 && ` · +${(tmpl.exercises ?? []).length - 3} more`}
                  </div>
                </button>
                {deleteConfirm === tmpl.id ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { onDelete(tmpl.id); setDeleteConfirm(null); }}
                      className="text-[9px] font-mono px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                    <button onClick={() => setDeleteConfirm(null)}
                      className="text-[9px] font-mono px-2 py-1 border border-stone-700 text-stone-500 hover:bg-stone-800 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(tmpl.id)} className="shrink-0 text-stone-700 hover:text-red-400 transition-colors p-1">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 3.5h10M5.5 3.5V2.5h3v1M11 3.5l-.75 8.5H3.75L3 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------- REST TIMER --------------------
function RestTimer({ exerciseName, initialSeconds, onSkip, onComplete }) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [total, setTotal]         = useState(initialSeconds);
  const [done, setDone]           = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    setRemaining(initialSeconds);
    setTotal(initialSeconds);
    setDone(false);
    doneRef.current = false;
  }, [exerciseName, initialSeconds]);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setRemaining(r => {
      if (r <= 1) {
        setDone(true);
        doneRef.current = true;
        if (navigator.vibrate) navigator.vibrate([200]);
        return 0;
      }
      return r - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [done, exerciseName]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onComplete, 3000);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  function adjust(delta) {
    if (done) return;
    setRemaining(r => Math.max(5, r + delta));
    setTotal(t => Math.max(5, t + delta));
  }

  const pct = total > 0 ? remaining / total : 0;
  const circumference = 2 * Math.PI * 28;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-sm transition-colors ${done ? 'bg-green-950/95 border-green-500/40' : 'bg-stone-950/95 border-orange-500/40'}`}>
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-5">
        {/* Ring */}
        <div className="relative w-14 h-14 shrink-0">
          <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            <circle cx="32" cy="32" r="28" fill="none"
              stroke={done ? '#4ade80' : '#ed7a2a'} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${pct * circumference} ${circumference}`}
              style={{ transition: 'stroke-dasharray 0.9s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-anton text-lg tabular-nums leading-none" style={{ color: done ? '#4ade80' : '#ed7a2a' }}>
              {done ? '✓' : remaining}
            </span>
          </div>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono truncate">{exerciseName}</div>
          <div className={`font-mono text-sm ${done ? 'text-green-400' : 'text-stone-300'}`}>
            {done ? 'Rest complete — log next set' : 'Rest period'}
          </div>
        </div>
        {/* Controls */}
        {!done && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => adjust(-30)} className="w-9 h-9 border border-stone-700 text-stone-400 hover:text-stone-200 font-mono text-[10px] flex items-center justify-center hover:border-stone-500 transition-colors">−30</button>
            <button onClick={() => adjust(30)} className="w-9 h-9 border border-stone-700 text-stone-400 hover:text-stone-200 font-mono text-[10px] flex items-center justify-center hover:border-stone-500 transition-colors">+30</button>
            <button onClick={onSkip} className="px-4 h-9 border border-stone-700 text-stone-500 hover:text-stone-300 font-mono text-[10px] uppercase tracking-wider hover:border-stone-500 transition-colors">Skip</button>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------- PAST SESSIONS PICKER --------------------
function PastSessionsPicker({ workouts, loading, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-950/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0a0908] border-t border-stone-800 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div>
            <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Past Sessions</h2>
            <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mt-0.5">last 90 days</div>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 font-mono text-sm">✕</button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-stone-600 font-mono text-xs uppercase tracking-wider">Loading…</div>
          </div>
        ) : workouts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12 text-center px-6">
            <div className="text-stone-600 font-mono text-xs uppercase tracking-wider leading-relaxed">
              No completed sessions<br /><span className="text-stone-700">in the last 90 days</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {workouts.map(w => (
              <Link
                key={w.id}
                to={`/logger?workoutId=${w.id}`}
                onClick={onClose}
                className="flex items-center gap-4 px-6 py-4 border-b border-stone-800/40 hover:bg-stone-900/40 transition-colors no-underline"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-anton text-lg uppercase text-stone-100 truncate">{w.name}</div>
                  <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                    {w.workout_exercises?.length ?? 0} exercise{(w.workout_exercises?.length ?? 0) !== 1 ? 's' : ''}
                    {' · '}
                    {new Date(w.completed_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}
                    {new Date(w.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-600 shrink-0">
                  <path d="M5 2l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------- MAIN --------------------
export default function IronLabLogger() {
  const { session, loading: sessionLoading } = useSession();
  // Pass undefined while session is still resolving (keeps hook in loading state).
  // Pass null once confirmed no session, real ID once confirmed logged in.
  const userId       = sessionLoading ? undefined : (session?.user?.id ?? null);
  const userWeightKg = useProfileStore((s) => Number(s.profile?.weight_kg || 0) || 80);
  const profileData  = useProfileStore((s) => s.profile);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workoutId = searchParams.get('workoutId');

  const logger   = useLogger(userId, workoutId, userWeightKg);
  const bodyMap  = useBodyMap(userId, logger.exercises);
  const workoutTemplates = useWorkoutTemplates(userId);
  const { weightUnit } = useUnits();

  const [name, setName]             = useState('New Workout');
  const [seconds, setSeconds]       = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [summary, setSummary]       = useState(null);
  const [savedToast, setSavedToast] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Template state
  const [showSaveTemplate, setShowSaveTemplate]   = useState(false);
  const [showLoadTemplate, setShowLoadTemplate]   = useState(false);
  const [savingTemplate, setSavingTemplate]       = useState(false);
  const [templateToast, setTemplateToast]         = useState(false);
  const [pendingTemplate, setPendingTemplate]     = useState(null);

  // Plateau alerts
  const [plateauAlerts, setPlateauAlerts] = useState([]);

  // Reset timer confirm
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetToast, setResetToast] = useState(false);

  // Past sessions
  const [showPastSessions, setShowPastSessions]       = useState(false);
  const [pastWorkouts, setPastWorkouts]               = useState([]);
  const [pastWorkoutsLoading, setPastWorkoutsLoading] = useState(false);

  // Today's sessions (multi-session support)
  const [todaySessions, setTodaySessions]               = useState([]);
  const [todaySessionsLoading, setTodaySessionsLoading] = useState(true);
  const [mergeSessions, setMergeSessions]               = useState(false);

  // Sync workout name from Supabase into local input
  useEffect(() => {
    if (logger.workout?.name) setName(logger.workout.name);
  }, [logger.workout?.name]);

  // Timer ticking from workout.created_at
  useEffect(() => {
    if (!logger.workout?.created_at) return;
    const start = new Date(logger.workout.created_at).getTime();
    const tick  = () => setSeconds(Math.floor((Date.now() - start) / 1000));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [logger.workout?.created_at]);

  // Dismiss hook errors automatically after 5 s
  useEffect(() => {
    if (!logger.error) return;
    const t = setTimeout(() => logger.clearError(), 5000);
    return () => clearTimeout(t);
  }, [logger.error]);

  // Show "Saved" toast for 2 s after each successful set write
  useEffect(() => {
    if (!logger.savedAt) return;
    setSavedToast(true);
    const t = setTimeout(() => setSavedToast(false), 2000);
    return () => clearTimeout(t);
  }, [logger.savedAt]);

  // Redirect 3 s after complete
  useEffect(() => {
    if (!logger.completed) return;
    const t = setTimeout(() => navigate('/dashboard'), 3000);
    return () => clearTimeout(t);
  }, [logger.completed, navigate]);

  // Load today's completed sessions for multi-session view
  useEffect(() => {
    if (!userId) return;
    loadTodaySessions();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle template load after workout starts
  useEffect(() => {
    if (!logger.workout || !pendingTemplate) return;
    (async () => {
      for (const ex of pendingTemplate.exercises ?? []) {
        const fullEx = library.find(e => e.id === ex.exercise_id);
        if (fullEx) await hookAdd(fullEx);
      }
      setPendingTemplate(null);
    })();
  }, [logger.workout?.id]); // eslint-disable-line

  // Picker library: DB exercises first, EXERCISE_LIBRARY fallback
  const library = logger.allExercises.length > 0 ? logger.allExercises : EXERCISE_LIBRARY;

  const workout    = logger.exercises;
  const volumes    = useMemo(() => muscleVolumes(workout, library), [workout, library]);
  const maxVol     = useMemo(() => Math.max(800, ...Object.values(volumes)), [volumes]);
  const totalVolume = useMemo(() => workout.reduce((acc, we) => acc + exerciseVolume(we), 0), [workout]);

  const totalSets = workout.reduce((a, we) => a + we.sets.length, 0);
  const totalReps = workout.reduce(
    (a, we) => a + we.sets.reduce((b, s) => b + (Number(s.reps) || 0), 0), 0
  );

  // Diff-based updateExercise — routes changes to hook mutation functions
  const { logSet, removeSetFromExercise, removeExercise: hookRemove, addSetToExercise, addExercise: hookAdd } = logger;

  const updateExercise = useCallback((weId, updater) => {
    const oldWe = logger.exercises.find(e => e.id === weId);
    if (!oldWe) return;
    const newWe = typeof updater === 'function' ? updater(oldWe) : updater;

    const oldMap = new Map(oldWe.sets.map(s => [s.id, s]));
    const newMap = new Map(newWe.sets.map(s => [s.id, s]));

    // Removed sets
    for (const [id] of oldMap) {
      if (!newMap.has(id)) removeSetFromExercise(weId, id);
    }
    // Changed sets
    for (const [id, ns] of newMap) {
      const os = oldMap.get(id);
      if (!os) continue;
      if (os.reps !== ns.reps || os.weight !== ns.weight) {
        logSet(weId, id, { reps: ns.reps, weight: ns.weight });
      }
    }
  }, [logger.exercises, logSet, removeSetFromExercise]);

  const usedIds = new Set(workout.map(we => we.exerciseId));
  const mins    = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs    = String(seconds % 60).padStart(2, '0');

  // Template save handler
  async function handleSaveTemplate({ name: tmplName, splitType, exercises }) {
    setSavingTemplate(true);
    const result = await workoutTemplates.saveTemplate({ name: tmplName, splitType, exercises: logger.exercises });
    setSavingTemplate(false);
    if (result?.success) {
      setShowSaveTemplate(false);
      setTemplateToast(true);
      setTimeout(() => setTemplateToast(false), 2000);
    }
  }

  // Template load handler
  async function handleLoadTemplate(tmpl) {
    setShowLoadTemplate(false);
    const loaded = await workoutTemplates.useTemplate(tmpl.id);
    if (loaded) {
      setName(loaded.name);
      setPendingTemplate(loaded);
      // If coming from the start banner (no active workout), begin one now
      if (!logger.workout) {
        logger.startWorkout(loaded.name);
      }
    }
  }

  async function loadTodaySessions() {
    if (!userId) return;
    setTodaySessionsLoading(true);
    const _d = new Date();
    const todayStart   = new Date(_d.getFullYear(), _d.getMonth(), _d.getDate()).toISOString();
    const tomorrowStart = new Date(_d.getFullYear(), _d.getMonth(), _d.getDate() + 1).toISOString();
    const { data } = await supabase
      .from('workouts')
      .select('id, name, completed_at, workout_exercises(id, exercise_id, order_index, exercises(name), sets(id))')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', todayStart)
      .lt('completed_at', tomorrowStart)
      .order('completed_at', { ascending: true });
    setTodaySessions(data ?? []);
    setTodaySessionsLoading(false);
  }

  // Reset: restarts the session timer only — sets are never touched
  async function loadPastWorkouts() {
    if (!userId) return;
    setPastWorkoutsLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 89);
    const sinceISO = new Date(since.getFullYear(), since.getMonth(), since.getDate()).toISOString();
    const { data } = await supabase
      .from('workouts')
      .select('id, name, completed_at, workout_exercises(id)')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', sinceISO)
      .order('completed_at', { ascending: false })
      .limit(30);
    setPastWorkouts(data ?? []);
    setPastWorkoutsLoading(false);
  }

  const handleReset = async () => {
    if (!logger.workout?.id) return;
    setResetting(true);
    const ok = await logger.resetTimer();
    setResetting(false);
    setResetConfirm(false);
    if (ok) {
      setResetToast(true);
      setTimeout(() => setResetToast(false), 2000);
    }
  };

  const handleComplete = async () => {
    const topEntry    = Object.entries(volumes).sort(([, a], [, b]) => b - a)[0];
    const prsHit      = workout.reduce(
      (acc, we) => acc + we.sets.filter(s => overloadStatus(s, weightUnit).kind === 'pr').length, 0
    );
    const durationMins = Math.round(seconds / 60);
    setSummary({ totalVolume, totalSets, totalReps, prsHit, topMuscle: topEntry?.[0], durationMins });
    const result = await logger.completeWorkout();
    if (result?.success) {
      setSummary(prev => ({ ...prev, calsBurned: result.calsBurned }));
      if (result.plateaus?.length) setPlateauAlerts(result.plateaus);
      setShowComplete(true);
    }
  };

  // ---- Loading ----
  if (logger.loading || (!logger.workout && !workoutId && todaySessionsLoading)) {
    return (
      <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 flex items-center justify-center">
        <style>{FONT_STYLE}</style>
        <Backdrop />
        <AppNav />
        <div className="space-y-3 w-full max-w-md px-6">
          {[80, 60, 70, 50].map((w, i) => (
            <div key={i} className="h-4 bg-stone-800/60 animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  // ---- No active workout (auto-starting via useEffect) ----
  if (!logger.workout) {
    if (workoutId) {
      return (
        <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased flex items-center justify-center">
          <style>{FONT_STYLE}</style>
          <Backdrop />
          <div className="relative z-10 text-center space-y-6 px-6 w-full max-w-sm">
            <div className="font-mono text-xs uppercase tracking-wider text-stone-600">Workout not found</div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-stone-500 hover:text-stone-200 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    const startNewWorkout = () => {
      const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
      logger.startWorkout(`Workout — ${day}`);
    };

    // ---- Today's Sessions view ----
    if (todaySessions.length > 0) {
      const mergedExercises = todaySessions.flatMap(s =>
        (s.workout_exercises ?? [])
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map(we => ({ ...we, sessionName: s.name }))
      );
      return (
        <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
          <style>{FONT_STYLE}</style>
          <Backdrop />
          <AppNav />
          <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8 pb-36">
            <header className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-stone-800/60">
              <span className="font-anton text-5xl uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">FORGE</span>
              {todaySessions.length > 1 && (
                <button
                  onClick={() => setMergeSessions(m => !m)}
                  className={`px-3 py-1.5 border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    mergeSessions
                      ? 'border-orange-500/60 text-orange-300 bg-orange-500/10'
                      : 'border-stone-700 text-stone-500 hover:border-stone-600 hover:text-stone-300'
                  }`}
                >
                  {mergeSessions ? '⊕ Merged' : '⊕ Merge Sessions'}
                </button>
              )}
            </header>

            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-5">
              {todaySessions.length} Session{todaySessions.length !== 1 ? 's' : ''} Completed Today
            </div>

            {mergeSessions ? (
              <div className="border border-stone-800/60">
                <div className="px-5 py-3 bg-stone-900/40 border-b border-stone-800/60">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-orange-400">Merged — All Today's Exercises</div>
                  <div className="text-xs font-mono text-stone-500 mt-0.5">
                    {mergedExercises.length} exercise{mergedExercises.length !== 1 ? 's' : ''} across {todaySessions.length} sessions
                  </div>
                </div>
                {mergedExercises.map((we, i) => (
                  <div key={`${we.id}-${i}`} className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800/40 last:border-b-0">
                    <div>
                      <div className="text-sm font-mono text-stone-200">{we.exercises?.name ?? we.exercise_id}</div>
                      <div className="text-[9px] font-mono text-stone-600 uppercase tracking-wider mt-0.5">{we.sessionName}</div>
                    </div>
                    <div className="text-[10px] font-mono text-stone-500">{we.sets?.length ?? 0} sets</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {todaySessions.map(s => {
                  const exCount  = s.workout_exercises?.length ?? 0;
                  const setCount = s.workout_exercises?.reduce((a, we) => a + (we.sets?.length ?? 0), 0) ?? 0;
                  return (
                    <Link
                      key={s.id}
                      to={`/logger?workoutId=${s.id}`}
                      className="block border border-stone-800/60 hover:border-stone-700 hover:bg-stone-900/20 transition-colors no-underline p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-anton text-xl uppercase text-stone-100">{s.name}</div>
                          <div className="text-[10px] font-mono text-stone-500 mt-1">
                            <span className="text-green-400">✓</span>
                            {' '}Completed {new Date(s.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}{exCount} exercise{exCount !== 1 ? 's' : ''}
                            {' · '}{setCount} sets
                          </div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-600 shrink-0 mt-1">
                          <path d="M5 2l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      {s.workout_exercises && s.workout_exercises.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {s.workout_exercises.slice(0, 5).map(we => (
                            <span key={we.id} className="px-2 py-0.5 bg-stone-900 border border-stone-800/60 text-[9px] font-mono text-stone-500 uppercase tracking-wider">
                              {we.exercises?.name ?? we.exercise_id}
                            </span>
                          ))}
                          {s.workout_exercises.length > 5 && (
                            <span className="px-2 py-0.5 text-[9px] font-mono text-stone-600">+{s.workout_exercises.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-40 bg-stone-950 border-t border-stone-800 px-6 py-4 flex items-center justify-between gap-4">
            <span className="font-mono text-xs text-stone-500 uppercase tracking-wider hidden sm:block">Add another session today</span>
            <div className="flex gap-3 ml-auto">
              <button
                onClick={() => { loadPastWorkouts(); setShowPastSessions(true); }}
                className="px-5 py-2.5 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors"
              >Past Sessions</button>
              <button
                onClick={() => setShowLoadTemplate(true)}
                className="px-5 py-2.5 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors"
              >Load Template</button>
              <button
                onClick={startNewWorkout}
                className="px-5 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors"
              >+ New Session</button>
            </div>
          </div>

          {showLoadTemplate && (
            <LoadTemplatePicker
              templates={workoutTemplates.templates}
              loading={workoutTemplates.loading}
              onLoad={handleLoadTemplate}
              onClose={() => setShowLoadTemplate(false)}
              onDelete={workoutTemplates.deleteTemplate}
            />
          )}
          {showPastSessions && (
            <PastSessionsPicker
              workouts={pastWorkouts}
              loading={pastWorkoutsLoading}
              onClose={() => setShowPastSessions(false)}
            />
          )}
        </div>
      );
    }

    // ---- Non-blocking start screen with bottom banner ----
    return (
      <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
        <style>{FONT_STYLE}</style>
        <Backdrop />
        <AppNav />
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8 pb-24">
          <header className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-stone-800/60">
            <span className="font-anton text-5xl uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">FORGE</span>
          </header>
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="font-anton text-2xl uppercase text-stone-600 tracking-wide">Ready to train?</div>
            <div className="text-xs font-mono text-stone-700 uppercase tracking-wider">Use the buttons below to begin</div>
          </div>
        </div>
        {/* NON-BLOCKING BOTTOM BANNER */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-stone-950 border-t border-stone-800 px-6 py-4 flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-stone-500 uppercase tracking-wider hidden sm:block">Start your session</span>
          <div className="flex gap-3 ml-auto">
            <button
              onClick={() => { loadPastWorkouts(); setShowPastSessions(true); }}
              className="px-5 py-2.5 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors"
            >
              Past Sessions
            </button>
            <button
              onClick={() => setShowLoadTemplate(true)}
              className="px-5 py-2.5 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors"
            >
              Load Template
            </button>
            <button
              onClick={startNewWorkout}
              className="px-5 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors"
            >
              + New Workout
            </button>
          </div>
        </div>
        {showLoadTemplate && (
          <LoadTemplatePicker
            templates={workoutTemplates.templates}
            loading={workoutTemplates.loading}
            onLoad={handleLoadTemplate}
            onClose={() => setShowLoadTemplate(false)}
            onDelete={workoutTemplates.deleteTemplate}
          />
        )}
        {showPastSessions && (
          <PastSessionsPicker
            workouts={pastWorkouts}
            loading={pastWorkoutsLoading}
            onClose={() => setShowPastSessions(false)}
          />
        )}
      </div>
    );
  }

  // ---- Active workout ----
  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
      <style>{FONT_STYLE}</style>
      <Backdrop />
      <AppNav />

      {/* ERROR TOAST */}
      {logger.error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-700/60 px-5 py-3 backdrop-blur-sm max-w-md text-center">
          <span className="text-red-200 font-mono text-xs">{logger.error}</span>
          <button onClick={logger.clearError} className="ml-4 text-red-400 hover:text-red-200 font-mono text-xs">✕</button>
        </div>
      )}

      {/* SAVED TOAST */}
      {savedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 border border-orange-500/30 px-5 py-2.5 backdrop-blur-sm pointer-events-none">
          <span className="text-orange-300 font-mono text-xs uppercase tracking-wider">Saved ✓</span>
        </div>
      )}

      {/* TIMER RESET TOAST */}
      {resetToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 border border-stone-600/40 px-5 py-2.5 backdrop-blur-sm pointer-events-none">
          <span className="text-stone-300 font-mono text-xs uppercase tracking-wider">↺ Timer reset</span>
        </div>
      )}

      {/* COMPLETION OVERLAY */}
      {showComplete && summary && (
        <div className="fixed inset-0 z-50 bg-stone-950/96 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center space-y-8 px-6 max-w-2xl w-full">
            <div className="font-anton text-6xl uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">
              Workout Complete
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1">Volume</div>
                <div className="font-anton text-4xl text-orange-300 tabular-nums">{fmt(summary.totalVolume)}</div>
                <div className="text-[10px] text-stone-600 font-mono">kg · reps</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1">Sets</div>
                <div className="font-anton text-4xl text-stone-100 tabular-nums">{summary.totalSets}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1">Total Reps</div>
                <div className="font-anton text-4xl text-stone-100 tabular-nums">{summary.totalReps}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1">PRs Hit</div>
                <div className="font-anton text-4xl text-orange-300 tabular-nums">{summary.prsHit}</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              {summary.topMuscle && (
                <div className="text-stone-400 font-mono text-xs uppercase tracking-wider">
                  Top muscle: <span className="text-orange-300">{MUSCLES[summary.topMuscle]}</span>
                </div>
              )}
              <div className="text-stone-400 font-mono text-xs uppercase tracking-wider">
                Duration: <span className="text-stone-200">{summary.durationMins} min</span>
              </div>
              {summary.calsBurned != null && (
                <div className="text-stone-400 font-mono text-xs uppercase tracking-wider">
                  Burned: <span className="text-orange-300">{summary.calsBurned} kcal</span>
                </div>
              )}
            </div>

            {/* PLATEAU ALERTS */}
            {plateauAlerts.length > 0 && (
              <div className="space-y-2 mt-4 max-w-md mx-auto">
                {plateauAlerts.map((p, i) => (
                  <div key={i} className="border border-orange-500/40 bg-orange-500/5 px-4 py-3 text-left">
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0">⚠</span>
                      <div>
                        <div className="font-anton text-base uppercase text-orange-300">{p.exerciseName} — 3 sessions without improvement</div>
                        <div className="text-[10px] font-mono text-stone-500 mt-0.5">Consider: deload, form check, or variation change</div>
                        {/* TODO: pass plateaued exercises to Oracle rule gate — plateau on compound lift = consider deload week */}
                      </div>
                      <button onClick={() => setPlateauAlerts(prev => prev.filter((_, j) => j !== i))}
                        className="shrink-0 text-stone-600 hover:text-stone-400 font-mono text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-stone-600 font-mono text-xs">Redirecting to dashboard…</p>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8">

        {/* BACK NAV */}
        <div className="mb-4 flex items-center min-h-[24px]">
          {showLeaveConfirm ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                Workout in progress — leave without saving?
              </span>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="text-[10px] font-mono text-stone-400 border border-stone-700 px-2 py-0.5 uppercase tracking-wider hover:border-stone-500 transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[10px] font-mono text-orange-400 border border-orange-500/40 px-2 py-0.5 uppercase tracking-wider hover:border-orange-400 transition-colors"
              >
                Leave
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (logger.completed || workoutId) navigate('/dashboard');
                else setShowLeaveConfirm(true);
              }}
              className="text-[10px] uppercase tracking-wider font-mono text-stone-400 hover:text-orange-400 transition-colors"
            >
              ← Dashboard
            </button>
          )}
        </div>

        {/* HEADER — 3-column: Left title | Center timer | Right actions */}
        <header className="grid grid-cols-3 items-center gap-4 mb-8 pb-6 border-b border-stone-800/60">
          {/* LEFT */}
          <div className="flex items-baseline gap-3 flex-wrap min-w-0">
            <span className="font-anton text-4xl uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">FORGE</span>
            <span className="hidden md:inline-block w-px h-7 bg-stone-800" />
            <input
              value={name}
              onChange={e => { setName(e.target.value); logger.updateWorkoutName(e.target.value); }}
              className="hidden md:block bg-transparent text-sm text-stone-400 focus:outline-none focus:text-stone-200 font-mono px-1 py-0.5 border-b border-transparent focus:border-orange-500/40 min-w-0 max-w-[160px] truncate"
            />
          </div>

          {/* CENTER — timer (hidden when viewing a specific past workout) */}
          {!workoutId && (
            <div className="flex flex-col items-center">
              <div className="text-[9px] uppercase tracking-[0.2em] text-stone-600 font-mono">Session</div>
              <div className="font-anton text-4xl tabular-nums text-orange-400 leading-tight">{mins}:{secs}</div>
            </div>
          )}
          {workoutId && <div />}

          {/* RIGHT — template buttons + reset + finish */}
          <div className="flex items-center gap-2 justify-end flex-wrap">
            {!workoutId && (
              <button
                onClick={() => setShowLoadTemplate(true)}
                className="hidden sm:block px-3 py-1.5 border border-stone-700 text-stone-500 font-mono text-[10px] uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors"
              >
                Templates
              </button>
            )}
            {!workoutId && logger.exercises.length > 0 && (
              <button
                onClick={() => setShowSaveTemplate(true)}
                className="hidden md:block px-3 py-1.5 border border-stone-700 text-stone-500 font-mono text-[10px] uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors"
              >
                Save
              </button>
            )}
            {/* Reset with inline confirm */}
            {!workoutId && !resetConfirm && (
              <button
                onClick={() => setResetConfirm(true)}
                className="px-3 py-1.5 border border-stone-700 text-stone-500 font-mono text-[10px] uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-400 transition-colors"
                title="Reset session timer — sets are untouched"
              >
                ↺ Reset Timer
              </button>
            )}
            {!workoutId && resetConfirm && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-stone-400 uppercase tracking-wider whitespace-nowrap">
                  Restart timer? Sets stay —
                </span>
                <button
                  onClick={() => setResetConfirm(false)}
                  className="px-2 py-1 border border-stone-700 text-stone-400 font-mono text-[10px] uppercase tracking-wider hover:border-stone-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="px-2 py-1 border border-orange-500/40 text-orange-400 font-mono text-[10px] uppercase tracking-wider hover:bg-orange-500/10 transition-colors disabled:opacity-40"
                >
                  {resetting ? '…' : 'Reset'}
                </button>
              </div>
            )}
            {workoutId ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 border border-stone-700 text-stone-300 font-mono text-xs uppercase tracking-wider hover:border-stone-500 hover:text-stone-100 transition-colors"
              >
                ← Dashboard
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-orange-500 text-stone-950 font-anton text-base uppercase tracking-wider hover:bg-orange-400 transition-colors"
              >
                ✓ Finish
              </button>
            )}
          </div>
        </header>

        {/* STATS BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-8 border border-stone-800/60 bg-stone-950/40">
          <StatBlock label="Total Volume"  value={fmt(totalVolume)}            sub="kg · reps"                         accent="text-orange-300" className="forge-stat-volume" />
          <StatBlock label="Sets"          value={totalSets}                   sub="logged"                                                             className="forge-stat-sets" />
          <StatBlock label="Reps"          value={fmt(totalReps)}              sub="working sets"                                                       className="forge-stat-reps" />
          <StatBlock label="Muscles Hit"   value={Object.keys(volumes).length} sub={`/ ${Object.keys(MUSCLES).length} total`}                          className="forge-stat-muscles" />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT — EXERCISE GRID */}
          <main className="col-span-12 lg:col-span-7 xl:col-span-8 space-y-4">
            {workout.map((we, idx) => {
              const ex = we._ex || library.find(e => e.id === we.exerciseId);
              if (!ex) return null;
              return (
                <ExerciseCard
                  key={we.id}
                  index={idx}
                  we={we}
                  exercise={ex}
                  weightUnit={weightUnit}
                  onUpdate={(updated) => updateExercise(we.id, () => updated)}
                  onRemove={() => hookRemove(we.id)}
                  onAddSet={() => addSetToExercise(we.id)}
                />
              );
            })}
            <AddExercisePicker library={library} onAdd={hookAdd} used={usedIds} />
          </main>

          {/* RIGHT — MUSCLE MAP + BREAKDOWN */}
          <aside className="col-span-12 lg:col-span-5 xl:col-span-4 space-y-6">
            <div className="border border-stone-800/60 bg-stone-950/40 p-5 relative overflow-hidden">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Muscle Map</h2>
                <span className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">recovery · growth</span>
              </div>
              <BodyMapDual
                recoveryMap={bodyMap.recoveryMap}
                growthMap={bodyMap.growthMap}
                mode={bodyMap.mode}
                setMode={bodyMap.setMode}
              />
            </div>

            <div className="border border-stone-800/60 bg-stone-950/40 p-5">
              <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100 mb-4">Volume Breakdown</h2>
              <VolumeBreakdown volumes={volumes} max={maxVol} />
            </div>

            <div className="border border-stone-800/60 bg-stone-950/40 p-5">
              <h2 className="font-anton text-xl uppercase tracking-tight text-stone-100 mb-2">Progressive Overload</h2>
              <p className="text-xs text-stone-500 font-mono leading-relaxed">
                Comparison vs. last session of the same exercise.
                <span className="text-orange-300"> ▲ PR</span> beat last week.
                <span className="text-stone-300"> = MATCH</span> tied.
                <span className="text-red-400"> ▼ DOWN</span> regression.
                <span className="text-amber-300"> + NEW</span> first time logged.
              </p>
            </div>
          </aside>
        </div>

        {/* FOOTER */}
        <footer className="mt-12 pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>Forge v0.4 · Module 3 · Workout Engine</span>
          <span>Vol formula: Σ(reps × weight) · primary 1.0 · secondary 0.5</span>
        </footer>
      </div>

      {/* TEMPLATE TOAST */}
      {templateToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 border border-orange-500/30 px-5 py-2.5 backdrop-blur-sm pointer-events-none">
          <span className="text-orange-300 font-mono text-xs uppercase tracking-wider">Template saved ✓</span>
        </div>
      )}

      {/* SAVE TEMPLATE MODAL */}
      {showSaveTemplate && (
        <SaveTemplateModal
          workoutName={name}
          exercises={logger.exercises}
          onSave={handleSaveTemplate}
          onClose={() => setShowSaveTemplate(false)}
          saving={savingTemplate}
        />
      )}

      {/* LOAD TEMPLATE PICKER (active workout) */}
      {showLoadTemplate && (
        <LoadTemplatePicker
          templates={workoutTemplates.templates}
          loading={workoutTemplates.loading}
          onLoad={handleLoadTemplate}
          onClose={() => setShowLoadTemplate(false)}
          onDelete={workoutTemplates.deleteTemplate}
        />
      )}

      {/* PAST SESSIONS PICKER */}
      {showPastSessions && (
        <PastSessionsPicker
          workouts={pastWorkouts}
          loading={pastWorkoutsLoading}
          onClose={() => setShowPastSessions(false)}
        />
      )}
    </div>
  );
}
