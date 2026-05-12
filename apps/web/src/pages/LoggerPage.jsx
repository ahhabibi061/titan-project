import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useLogger } from '../hooks/useLogger';
import { useProfileStore } from '../store/useProfileStore';
import { useBodyMap } from '../hooks/useBodyMap';
import { useWorkoutTemplates } from '../hooks/useWorkoutTemplates';
import { supabase } from '../lib/supabase';
import AppNav from '../components/AppNav';

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

function overloadStatus(s) {
  const cur = setVolume(s), prev = setPrevVolume(s);
  if (prev === 0) return { kind: 'new',   label: 'NEW' };
  if (cur >  prev) return { kind: 'pr',    label: 'PR' };
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

// -------------------- SVG MUSCLE PATHS --------------------
// ViewBox 220x460. Stylized but anatomically positioned.
// ─── ANATOMICAL SVG PATHS ────────────────────────────────────────────────────
// Anterior muscles — viewBox 0 0 220 460, body centered at x=110
const FRONT_PATHS = {
  // Two pectoral masses with curved lower border
  chest: [
    'M 108,96 C 102,90 90,88 76,92 C 62,96 60,108 62,120 C 64,132 72,140 86,144 C 96,146 106,142 108,134 Z',
    'M 112,96 C 118,90 130,88 144,92 C 158,96 160,108 158,120 C 156,132 148,140 134,144 C 124,146 114,142 112,134 Z',
  ].join(' '),

  // Anterior deltoid caps — rounded mass at front shoulder
  front_delts: [
    'M 66,86 C 54,84 46,92 44,106 C 42,118 46,130 56,136 C 62,140 70,138 74,128 C 78,118 76,104 72,94 C 70,88 68,86 66,86 Z',
    'M 154,86 C 166,84 174,92 176,106 C 178,118 174,130 164,136 C 158,140 150,138 146,128 C 142,118 144,104 148,94 C 150,88 152,86 154,86 Z',
  ].join(' '),

  // Lateral deltoid — narrow band at outermost shoulder
  side_delts: [
    'M 42,100 C 34,106 32,120 34,132 C 36,142 44,144 52,138 C 46,130 44,116 46,104 Z',
    'M 178,100 C 186,106 188,120 186,132 C 184,142 176,144 168,138 C 174,130 176,116 174,104 Z',
  ].join(' '),

  // Biceps — peaked two-head contour
  biceps: [
    'M 42,132 C 32,142 28,160 30,178 C 32,194 40,202 52,202 C 62,202 68,192 68,176 C 68,158 62,138 54,130 C 48,124 44,126 42,132 Z',
    'M 178,132 C 188,142 192,160 190,178 C 188,194 180,202 168,202 C 158,202 152,192 152,176 C 152,158 158,138 166,130 C 172,124 176,126 178,132 Z',
  ].join(' '),

  // Forearms anterior — pronator/flexor mass, wider at elbow
  forearms: [
    'M 28,204 C 20,220 18,246 20,264 C 22,276 32,282 44,280 C 54,278 58,264 58,246 C 58,226 54,206 46,200 C 38,196 30,198 28,204 Z',
    'M 192,204 C 200,220 202,246 200,264 C 198,276 188,282 176,280 C 166,278 162,264 162,246 C 162,226 166,206 174,200 C 182,196 190,198 192,204 Z',
  ].join(' '),

  // Abs — 3×2 grid, slightly organic curves
  abs: [
    'M 96,146 C 100,144 106,144 108,146 L 108,164 C 106,166 100,166 96,164 Z',
    'M 112,146 C 116,144 120,144 124,146 L 124,164 C 120,166 116,166 112,164 Z',
    'M 94,169 C 99,167 105,167 108,169 L 108,187 C 105,189 99,189 94,187 Z',
    'M 112,169 C 116,167 121,167 126,169 L 126,187 C 121,189 116,189 112,187 Z',
    'M 93,192 C 98,190 107,190 109,192 L 109,210 C 107,212 98,212 93,210 Z',
    'M 111,192 C 116,190 122,190 127,192 L 127,210 C 122,212 116,212 111,210 Z',
  ].join(' '),

  // Obliques — diagonal sweep lower ribs to hip
  obliques: [
    'M 80,144 C 74,168 70,194 70,216 C 70,232 76,242 86,246 C 92,248 96,244 96,230 L 94,206 C 88,204 84,188 84,168 C 84,154 86,146 82,142 Z',
    'M 140,144 C 146,168 150,194 150,216 C 150,232 144,242 134,246 C 128,248 124,244 124,230 L 126,206 C 132,204 136,188 136,168 C 136,154 134,146 138,142 Z',
  ].join(' '),

  // Quads — vastus lateralis (outer) + rectus femoris (center) per leg
  quads: [
    // Left vastus lateralis
    'M 76,258 C 66,296 64,334 68,362 C 72,374 80,378 90,374 C 94,370 94,352 92,332 C 90,306 86,276 84,260 C 82,252 78,252 76,258 Z',
    // Left rectus femoris + VMO teardrop
    'M 96,256 C 92,292 92,330 94,360 C 96,372 104,376 110,372 L 110,256 C 106,248 98,250 96,256 Z',
    // Right rectus femoris + VMO
    'M 124,256 C 128,292 128,330 126,360 C 124,372 116,376 110,372 L 110,256 C 114,248 122,250 124,256 Z',
    // Right vastus lateralis
    'M 144,258 C 154,296 156,334 152,362 C 148,374 140,378 130,374 C 126,370 126,352 128,332 C 130,306 134,276 136,260 C 138,252 142,252 144,258 Z',
  ].join(' '),

  // Tibialis anterior — outer shin line
  tibialis: [
    'M 80,378 C 76,402 74,428 76,448 L 90,448 C 90,428 92,404 92,380 C 90,374 82,374 80,378 Z',
    'M 140,378 C 144,402 146,428 144,448 L 130,448 C 130,428 128,404 128,380 C 130,374 138,374 140,378 Z',
  ].join(' '),
};

// Posterior muscles
const BACK_PATHS = {
  // Trapezius — diamond drape from neck base to mid-back
  traps: [
    'M 110,68 C 96,76 78,90 68,108 C 60,120 60,134 68,142 C 74,148 84,146 96,136 C 104,128 108,118 108,108 L 108,68 Z',
    'M 110,68 C 124,76 142,90 152,108 C 160,120 160,134 152,142 C 146,148 136,146 124,136 C 116,128 112,118 112,108 L 112,68 Z',
    // Lower trapezius meeting at spine
    'M 108,108 C 108,126 106,148 104,162 C 108,164 112,164 116,162 C 114,148 112,126 112,108 Z',
  ].join(' '),

  // Posterior deltoid
  rear_delts: [
    'M 66,86 C 54,84 46,92 44,106 C 42,118 46,130 56,136 C 62,140 70,138 74,128 C 78,116 76,102 72,92 C 70,88 68,86 66,86 Z',
    'M 154,86 C 166,84 174,92 176,106 C 178,118 174,130 164,136 C 158,140 150,138 146,128 C 142,116 144,102 148,92 C 150,88 152,86 154,86 Z',
  ].join(' '),

  // Latissimus dorsi — sweeping wing from armpit to waist
  lats: [
    'M 70,122 C 56,148 52,178 56,208 C 58,224 66,234 78,236 L 96,226 C 92,210 90,190 92,170 C 94,152 100,138 96,126 C 86,118 76,116 70,122 Z',
    'M 150,122 C 164,148 168,178 164,208 C 162,224 154,234 142,236 L 124,226 C 128,210 130,190 128,170 C 126,152 120,138 124,126 C 134,118 144,116 150,122 Z',
  ].join(' '),

  // Rhomboids — inner scapular between traps
  rhomboids: [
    'M 108,108 C 104,120 102,138 104,156 C 108,160 110,158 110,154 L 110,108 Z',
    'M 112,108 C 116,120 118,138 116,156 C 112,160 110,158 110,154 L 110,108 Z',
  ].join(' '),

  // Lower back / erectors — lumbar region
  lower_back: 'M 92,228 C 88,244 88,260 92,272 C 96,280 104,284 110,284 C 116,284 124,280 128,272 C 132,260 132,244 128,228 C 122,220 98,220 92,228 Z',

  // Triceps — horseshoe shape, three heads
  triceps: [
    'M 40,130 C 30,142 26,162 28,182 C 30,198 40,208 52,206 C 62,204 68,192 68,176 C 68,158 62,138 54,130 C 48,124 42,124 40,130 Z',
    'M 180,130 C 190,142 194,162 192,182 C 190,198 180,208 168,206 C 158,204 152,192 152,176 C 152,158 158,138 166,130 C 172,124 178,124 180,130 Z',
  ].join(' '),

  // Posterior forearms — extensor group
  forearms: [
    'M 26,208 C 18,226 16,252 18,270 C 20,282 30,288 44,286 C 56,284 62,268 62,250 C 62,230 56,208 46,202 C 38,196 28,200 26,208 Z',
    'M 194,208 C 202,226 204,252 202,270 C 200,282 190,288 176,286 C 164,284 158,268 158,250 C 158,230 164,208 174,202 C 182,196 192,200 194,208 Z',
  ].join(' '),

  // Glutes — two large rounded masses, gluteal fold defined
  glutes: [
    'M 84,260 C 72,272 66,294 68,316 C 70,330 80,338 92,336 C 102,334 108,324 108,310 C 108,290 106,268 100,260 C 94,252 86,254 84,260 Z',
    'M 136,260 C 148,272 154,294 152,316 C 150,330 140,338 128,336 C 118,334 112,324 112,310 C 112,290 114,268 120,260 C 126,252 134,254 136,260 Z',
  ].join(' '),

  // Hamstrings — biceps femoris + semimembranosus, separation line visible
  hamstrings: [
    // Left biceps femoris (outer)
    'M 78,308 C 68,338 66,368 70,392 C 72,404 80,410 90,408 C 100,406 106,392 108,374 C 110,352 108,318 102,306 C 96,296 80,298 78,308 Z',
    // Right biceps femoris (outer)
    'M 142,308 C 152,338 154,368 150,392 C 148,404 140,410 130,408 C 120,406 114,392 112,374 C 110,352 112,318 118,306 C 124,296 140,298 142,308 Z',
  ].join(' '),

  // Calves — medial + lateral gastrocnemius heads per leg
  calves: [
    // Left lateral head
    'M 72,386 C 66,410 64,434 68,452 L 82,452 C 84,436 86,412 86,390 C 84,382 76,380 72,386 Z',
    // Left medial head
    'M 88,390 C 88,372 94,366 102,372 C 108,382 108,410 106,436 L 92,452 C 92,432 90,410 88,392 Z',
    // Right medial head
    'M 132,390 C 132,372 126,366 118,372 C 112,382 112,410 114,436 L 128,452 C 128,432 130,410 132,392 Z',
    // Right lateral head
    'M 148,386 C 154,410 156,434 152,452 L 138,452 C 136,436 134,412 134,390 C 136,382 144,380 148,386 Z',
  ].join(' '),
};

// Head and neck — shared between front and back views
const HEAD_FRONT = (
  <>
    <ellipse cx="110" cy="42" rx="21" ry="26" fill="#1a1714" stroke="#57534e" strokeWidth="1.2" />
    <ellipse cx="89" cy="44" rx="4" ry="6" fill="#161412" stroke="#57534e" strokeWidth="0.8" />
    <ellipse cx="131" cy="44" rx="4" ry="6" fill="#161412" stroke="#57534e" strokeWidth="0.8" />
    <path d="M 102,68 C 100,72 100,78 102,84 L 118,84 C 120,78 120,72 118,68 Z" fill="#1a1714" stroke="#57534e" strokeWidth="0.8" />
  </>
);
const HEAD_BACK = (
  <>
    <ellipse cx="110" cy="42" rx="21" ry="26" fill="#1a1714" stroke="#57534e" strokeWidth="1.2" />
    <ellipse cx="89" cy="44" rx="4" ry="6" fill="#161412" stroke="#57534e" strokeWidth="0.8" />
    <ellipse cx="131" cy="44" rx="4" ry="6" fill="#161412" stroke="#57534e" strokeWidth="0.8" />
    <path d="M 102,68 C 100,72 100,78 102,84 L 118,84 C 120,78 120,72 118,68 Z" fill="#1a1714" stroke="#57534e" strokeWidth="0.8" />
  </>
);
const NECK = null; // neck included in HEAD_FRONT / HEAD_BACK above

// -------------------- UI PRIMITIVES --------------------
const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtKg = (n) => `${n}${Number.isInteger(n) ? '' : ''}`;

function StatBlock({ label, value, sub, accent }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 border-r border-stone-800/60 last:border-r-0 first:pl-0">
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
function SetRow({ set, idx, onChange, onRemove, isLast }) {
  const status = overloadStatus(set);
  const vol = setVolume(set);
  const prevVol = setPrevVolume(set);

  return (
    <tr className="group transition-colors hover:bg-stone-900/40">
      <td className="px-3 py-2 w-10">
        <span className="font-mono text-[11px] text-stone-500 tabular-nums">{String(idx + 1).padStart(2,'0')}</span>
      </td>
      <td className="px-3 py-2 w-28">
        <div className="font-mono text-[11px] text-stone-500 tabular-nums">
          {set.prevReps} × {set.prevWeight}<span className="text-stone-600 ml-0.5">kg</span>
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
            step="0.5"
            value={set.weight}
            onChange={(e) => onChange({ ...set, weight: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full bg-stone-950/60 border border-stone-800 px-2 py-1.5 pr-7 text-stone-100 font-mono text-sm tabular-nums text-right focus:outline-none focus:border-orange-500/60 focus:bg-stone-950"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-600 font-mono pointer-events-none">kg</span>
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
function ExerciseCard({ we, exercise, onUpdate, onRemove, onAddSet, index }) {
  const [showTimer, setShowTimer] = useState(false);
  const totalVol = exerciseVolume(we);

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

// -------------------- BODY MAP (RECOVERY / GROWTH) --------------------
const RECOVERY_COLORS = {
  ready:   '#4ade80',
  almost:  '#a3e635',
  partial: '#fbbf24',
  resting: '#f87171',
  no_data: null,
};

const GROWTH_COLORS = {
  pr:        '#fb923c',
  improved:  '#4ade80',
  regressed: '#fbbf24',
  dropped:   '#f87171',
  first:     '#60a5fa',
};

// Female chest: smooth bust silhouette instead of two pec masses
const CHEST_FEMALE = 'M 78,96 C 72,106 72,120 78,132 C 84,140 96,146 110,146 C 124,146 136,140 142,132 C 148,120 148,106 142,96 C 132,88 88,88 78,96 Z';

function BodyMapDual({ recoveryMap, growthMap, mode, setMode, gender = 'male' }) {
  const [hover, setHover] = useState(null);

  function getActiveFill(key) {
    if (mode === 'recovery') {
      const e = recoveryMap[key];
      if (!e || e.status === 'no_data') return null;
      return RECOVERY_COLORS[e.status] ?? null;
    }
    const e = growthMap[key];
    if (!e) return null;
    return GROWTH_COLORS[e.status] ?? null;
  }

  function getTooltip(key) {
    if (mode === 'recovery') {
      const e = recoveryMap[key];
      if (!e || e.status === 'no_data') return { name: MUSCLES[key], line1: 'No data', line2: null };
      const line1 = e.status === 'ready' ? 'Fully recovered' : `${e.pct}% recovered`;
      const line2 = e.hoursRemaining > 0 ? `${e.hoursRemaining}h remaining` : 'Ready to train';
      return { name: MUSCLES[key], line1, line2 };
    }
    const e = growthMap[key];
    if (!e) return { name: MUSCLES[key], line1: 'Not trained today', line2: null };
    const line1 = e.growthPct !== null ? `${e.growthPct > 0 ? '+' : ''}${e.growthPct}% vs last session` : 'First session';
    const line2 = e.prevVol !== null ? `${fmt(e.currentVol)} vs ${fmt(e.prevVol)} kg·reps` : `${fmt(e.currentVol)} kg·reps`;
    return { name: MUSCLES[key], line1, line2 };
  }

  // Render a single muscle group as <g id> with outline-only style
  const renderMuscle = (key, pathData, suffix = '') => {
    const activeFill = getActiveFill(key);
    const isHovered  = hover === key;
    const stroke     = (activeFill || isHovered) ? '#ed7a2a' : '#6b5a52';
    const fill       = isHovered
      ? 'rgba(237,122,42,0.25)'
      : activeFill
        ? `${activeFill}59`   // 35% opacity via hex alpha
        : 'transparent';

    return (
      <g
        key={`${key}${suffix}`}
        id={`${key}${suffix}`}
        onMouseEnter={() => setHover(key)}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: 'pointer' }}
      >
        <path
          d={pathData}
          fill={fill}
          stroke={stroke}
          strokeWidth="0.8"
          style={{ transition: 'fill 200ms ease, stroke 200ms ease' }}
        />
      </g>
    );
  };

  const tooltip = hover ? getTooltip(hover) : null;

  const summaryItems = mode === 'recovery'
    ? Object.entries(recoveryMap)
        .filter(([, v]) => v.status !== 'no_data' && v.status !== 'ready')
        .sort(([, a], [, b]) => (a.pct ?? 100) - (b.pct ?? 100))
        .slice(0, 3)
        .map(([k, v]) => ({ key: k, label: MUSCLES[k], value: `${v.pct}%`, sub: `${v.hoursRemaining}h left`, color: RECOVERY_COLORS[v.status] }))
    : Object.entries(growthMap)
        .filter(([, v]) => v.growthPct !== null)
        .sort(([, a], [, b]) => (b.growthPct ?? 0) - (a.growthPct ?? 0))
        .slice(0, 3)
        .map(([k, v]) => ({ key: k, label: MUSCLES[k], value: `${v.growthPct > 0 ? '+' : ''}${v.growthPct}%`, sub: `${fmt(v.currentVol)} kg·reps`, color: GROWTH_COLORS[v.status] }));

  // Head elements (shared, positioned in the group's local coordinates)
  const HeadAnterior = () => (
    <>
      <ellipse cx="110" cy="42" rx="21" ry="26" fill="#161412" stroke="#6b5a52" strokeWidth="1.2" />
      <ellipse cx="92"  cy="44" rx="3.5" ry="5" fill="#0a0908" stroke="#57534e" strokeWidth="0.7" />
      <ellipse cx="128" cy="44" rx="3.5" ry="5" fill="#0a0908" stroke="#57534e" strokeWidth="0.7" />
      <path d="M 103,68 C 101,73 101,79 103,84 L 117,84 C 119,79 119,73 117,68 Z" fill="#161412" stroke="#6b5a52" strokeWidth="0.8" />
    </>
  );
  const HeadPosterior = () => (
    <>
      <ellipse cx="110" cy="42" rx="21" ry="26" fill="#161412" stroke="#6b5a52" strokeWidth="1.2" />
      <path d="M 103,68 C 101,73 101,79 103,84 L 117,84 C 119,79 119,73 117,68 Z" fill="#161412" stroke="#6b5a52" strokeWidth="0.8" />
    </>
  );

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex gap-1 mb-4">
        {['recovery', 'growth'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider border transition-colors ${
              mode === m
                ? 'border-orange-500/60 text-orange-300 bg-orange-500/10'
                : 'border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-600'
            }`}
          >
            {m}
          </button>
        ))}
        <span className="ml-auto text-[9px] font-mono text-stone-700 uppercase tracking-wider self-center">
          {gender}
        </span>
      </div>

      {/* Single 480×560 SVG — anterior left, posterior right */}
      <div className="relative">
        <svg viewBox="0 0 480 560" className="w-full" style={{ maxHeight: 400 }}>
          {/* ── ANTERIOR figure — local coords same as FRONT_PATHS ─────────── */}
          <g transform="translate(0, 46)">
            <HeadAnterior />
            {/* Female: substitute chest path */}
            {gender === 'female'
              ? renderMuscle('chest', CHEST_FEMALE, '_f')
              : renderMuscle('chest', FRONT_PATHS.chest, '_f')
            }
            {renderMuscle('front_delts', FRONT_PATHS.front_delts, '_f')}
            {renderMuscle('side_delts',  FRONT_PATHS.side_delts,  '_f')}
            {renderMuscle('biceps',      FRONT_PATHS.biceps,      '_f')}
            {renderMuscle('forearms',    FRONT_PATHS.forearms,    '_f')}
            {renderMuscle('abs',         FRONT_PATHS.abs,         '_f')}
            {renderMuscle('obliques',    FRONT_PATHS.obliques,    '_f')}
            {renderMuscle('quads',       FRONT_PATHS.quads,       '_f')}
            {renderMuscle('tibialis',    FRONT_PATHS.tibialis,    '_f')}
            <line x1="60" y1="455" x2="160" y2="455" stroke="#3c3633" strokeWidth="0.6" />
            <text x="110" y="470" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" fill="#4a4540" letterSpacing="3">ANTERIOR</text>
          </g>

          {/* ── POSTERIOR figure — same paths, shifted +240 in x ────────────── */}
          <g transform="translate(240, 46)">
            <HeadPosterior />
            {renderMuscle('traps',      BACK_PATHS.traps,      '_b')}
            {renderMuscle('rear_delts', BACK_PATHS.rear_delts, '_b')}
            {renderMuscle('lats',       BACK_PATHS.lats,       '_b')}
            {renderMuscle('rhomboids',  BACK_PATHS.rhomboids,  '_b')}
            {renderMuscle('lower_back', BACK_PATHS.lower_back, '_b')}
            {renderMuscle('triceps',    BACK_PATHS.triceps,    '_b')}
            {renderMuscle('forearms',   BACK_PATHS.forearms,   '_b2')}
            {renderMuscle('glutes',     BACK_PATHS.glutes,     '_b')}
            {renderMuscle('hamstrings', BACK_PATHS.hamstrings, '_b')}
            {renderMuscle('calves',     BACK_PATHS.calves,     '_b')}
            <line x1="60" y1="455" x2="160" y2="455" stroke="#3c3633" strokeWidth="0.6" />
            <text x="110" y="470" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" fill="#4a4540" letterSpacing="3">POSTERIOR</text>
          </g>
        </svg>

        {/* Tooltip */}
        <div className="absolute top-0 right-0 pointer-events-none">
          {tooltip && (
            <div className="bg-stone-950/95 border border-stone-700/50 px-3 py-2 backdrop-blur-sm">
              <div className="text-[9px] uppercase tracking-wider text-stone-500 font-mono">{tooltip.name}</div>
              <div className="font-mono text-xs text-stone-100 mt-0.5">{tooltip.line1}</div>
              {tooltip.line2 && <div className="text-[9px] text-stone-500 font-mono">{tooltip.line2}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-stone-800/60">
        {mode === 'recovery' ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[['ready','#4ade80','Ready'],['almost','#a3e635','Almost'],['partial','#fbbf24','Partial'],['resting','#f87171','Resting']].map(([s, c, label]) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[['pr','#fb923c','PR'],['improved','#4ade80','Improved'],['regressed','#fbbf24','Regressed'],['first','#60a5fa','First']].map(([s, c, label]) => (
              <div key={s} className="flex items-center gap-1.5">
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

  // Reset workout confirm
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Body map gender
  const [bodyMapGender, setBodyMapGender] = useState('male');

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

  // Body map gender: settings.body_map_gender > profile.sex > 'male'
  useEffect(() => {
    if (!userId) return;
    supabase.from('settings')
      .select('body_map_gender')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const override = data?.body_map_gender;
        setBodyMapGender(override ?? profileData?.sex ?? 'male');
      });
  }, [userId, profileData?.sex]); // eslint-disable-line

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

  // Reset: wipe all exercises/sets for this workout, then reload
  const handleReset = async () => {
    if (!logger.workout?.id) return;
    setResetting(true);
    await supabase
      .from('workout_exercises')
      .delete()
      .eq('workout_id', logger.workout.id);
    setResetting(false);
    setResetConfirm(false);
    navigate(0); // refresh current route
  };

  const handleComplete = async () => {
    const topEntry    = Object.entries(volumes).sort(([, a], [, b]) => b - a)[0];
    const prsHit      = workout.reduce(
      (acc, we) => acc + we.sets.filter(s => overloadStatus(s).kind === 'pr').length, 0
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
  if (logger.loading) {
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
    // Non-blocking start screen with bottom banner
    const startNewWorkout = () => {
      const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
      logger.startWorkout(`Workout — ${day}`);
    };
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

          {/* CENTER — timer */}
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
                className="px-3 py-1.5 border border-stone-700 text-stone-500 font-mono text-[10px] uppercase tracking-wider hover:border-red-500/40 hover:text-red-400 transition-colors"
                title="Reset workout — clears all sets"
              >
                ↺ Reset
              </button>
            )}
            {!workoutId && resetConfirm && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-stone-400 uppercase tracking-wider whitespace-nowrap">
                  Clears all sets —
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
                  className="px-2 py-1 border border-red-500/40 text-red-400 font-mono text-[10px] uppercase tracking-wider hover:bg-red-500/10 transition-colors disabled:opacity-40"
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
          <StatBlock label="Total Volume"  value={fmt(totalVolume)}            sub="kg · reps"                         accent="text-orange-300" />
          <StatBlock label="Sets"          value={totalSets}                   sub="logged" />
          <StatBlock label="Reps"          value={fmt(totalReps)}              sub="working sets" />
          <StatBlock label="Muscles Hit"   value={Object.keys(volumes).length} sub={`/ ${Object.keys(MUSCLES).length} total`} />
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
                gender={bodyMapGender}
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
    </div>
  );
}
