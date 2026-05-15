import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';

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
  // CHEST
  { id: 'bench',               name: 'Barbell Bench Press',        primary: ['chest'],         secondary: ['front_delts','triceps'] },
  { id: 'incline_db',          name: 'Incline DB Press',           primary: ['chest'],         secondary: ['front_delts','triceps'] },
  { id: 'cable_fly',           name: 'Cable Crossover',            primary: ['chest'],         secondary: ['front_delts'] },
  { id: 'dips',                name: 'Weighted Dips',              primary: ['chest'],         secondary: ['triceps','front_delts'] },
  { id: 'pushup',              name: 'Push-Up',                    primary: ['chest'],         secondary: ['front_delts','triceps','abs'] },
  { id: 'chest_press',         name: 'Machine Chest Press',        primary: ['chest'],         secondary: ['front_delts','triceps'] },
  // SHOULDERS
  { id: 'ohp',                 name: 'Standing Overhead Press',    primary: ['front_delts'],   secondary: ['side_delts','triceps'] },
  { id: 'lateral_raise',       name: 'DB Lateral Raise',           primary: ['side_delts'],    secondary: [] },
  { id: 'cable_lateral',       name: 'Cable Lateral Raise',        primary: ['side_delts'],    secondary: [] },
  { id: 'rear_delt_fly',       name: 'Reverse Pec Deck',           primary: ['rear_delts'],    secondary: ['traps'] },
  { id: 'face_pull',           name: 'Cable Face Pull',            primary: ['rear_delts'],    secondary: ['traps'] },
  { id: 'pike_pushup',         name: 'Pike Push-Up',               primary: ['front_delts'],   secondary: ['triceps','traps'] },
  { id: 'smith_ohp',           name: 'Smith Machine OHP',          primary: ['front_delts'],   secondary: ['side_delts','triceps'] },
  { id: 'kb_press',            name: 'Kettlebell Overhead Press',  primary: ['front_delts'],   secondary: ['side_delts','triceps','abs'] },
  { id: 'shrug',               name: 'DB Shrug',                   primary: ['traps'],         secondary: [] },
  // BACK
  { id: 'pullup',              name: 'Pull-Up',                    primary: ['lats'],          secondary: ['biceps','rear_delts'] },
  { id: 'chin_up',             name: 'Chin-Up',                    primary: ['biceps'],        secondary: ['lats','rear_delts'] },
  { id: 'row',                 name: 'Barbell Row',                primary: ['lats'],          secondary: ['biceps','rear_delts','traps'] },
  { id: 'lat_pulldown',        name: 'Lat Pulldown',               primary: ['lats'],          secondary: ['biceps'] },
  { id: 'tbar_row',            name: 'T-Bar Row',                  primary: ['lats'],          secondary: ['biceps','traps'] },
  { id: 'cable_row',           name: 'Seated Cable Row',           primary: ['lats'],          secondary: ['biceps','rear_delts','traps'] },
  { id: 'inverted_row',        name: 'Inverted Row',               primary: ['lats'],          secondary: ['biceps','rear_delts','traps'] },
  { id: 'kb_row',              name: 'Kettlebell Single-Arm Row',  primary: ['lats'],          secondary: ['biceps','rear_delts'] },
  { id: 'cable_machine_pullover', name: 'Machine Pullover',        primary: ['lats'],          secondary: ['chest','abs'] },
  // ARMS
  { id: 'curl',                name: 'Barbell Curl',               primary: ['biceps'],        secondary: ['forearms'] },
  { id: 'hammer_curl',         name: 'Hammer Curl',                primary: ['biceps'],        secondary: ['forearms'] },
  { id: 'preacher_curl',       name: 'Preacher Curl',              primary: ['biceps'],        secondary: [] },
  { id: 'cable_curl',          name: 'Cable Curl',                 primary: ['biceps'],        secondary: ['forearms'] },
  { id: 'tricep_pushdown',     name: 'Cable Tricep Pushdown',      primary: ['triceps'],       secondary: [] },
  { id: 'skullcrusher',        name: 'Skullcrusher',               primary: ['triceps'],       secondary: [] },
  { id: 'dip_bw',              name: 'Bodyweight Dip',             primary: ['triceps'],       secondary: ['chest','front_delts'] },
  { id: 'diamond_pushup',      name: 'Diamond Push-Up',            primary: ['triceps'],       secondary: ['chest','front_delts'] },
  // LEGS
  { id: 'squat',               name: 'Back Squat',                 primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'front_squat',         name: 'Front Squat',                primary: ['quads'],         secondary: ['glutes','abs'] },
  { id: 'leg_press',           name: 'Leg Press',                  primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'hack_squat',          name: 'Hack Squat Machine',         primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'bodyweight_squat',    name: 'Bodyweight Squat',           primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'pistol_squat',        name: 'Pistol Squat',               primary: ['quads'],         secondary: ['glutes','abs'] },
  { id: 'bulgarian',           name: 'Bulgarian Split Squat',      primary: ['quads'],         secondary: ['glutes'] },
  { id: 'kb_goblet_squat',     name: 'Kettlebell Goblet Squat',    primary: ['quads'],         secondary: ['glutes','abs'] },
  { id: 'kb_lunge',            name: 'Kettlebell Lunge',           primary: ['quads'],         secondary: ['glutes','hamstrings'] },
  { id: 'rdl',                 name: 'Romanian Deadlift',          primary: ['hamstrings'],    secondary: ['glutes','lower_back'] },
  { id: 'deadlift',            name: 'Conventional Deadlift',      primary: ['hamstrings'],    secondary: ['glutes','lower_back','traps'] },
  { id: 'leg_curl',            name: 'Lying Leg Curl',             primary: ['hamstrings'],    secondary: [] },
  { id: 'nordic_curl',         name: 'Nordic Hamstring Curl',      primary: ['hamstrings'],    secondary: ['glutes','calves'] },
  { id: 'kb_deadlift',         name: 'Kettlebell Deadlift',        primary: ['hamstrings'],    secondary: ['glutes','lower_back','traps'] },
  { id: 'hip_thrust',          name: 'Barbell Hip Thrust',         primary: ['glutes'],        secondary: ['hamstrings'] },
  { id: 'glute_bridge',        name: 'Glute Bridge',               primary: ['glutes'],        secondary: ['hamstrings','lower_back'] },
  { id: 'adductor_machine',    name: 'Hip Adduction Machine',      primary: ['glutes'],        secondary: ['hamstrings'] },
  { id: 'cable_pull_through',  name: 'Cable Pull-Through',         primary: ['glutes'],        secondary: ['hamstrings','lower_back'] },
  { id: 'calf_raise',          name: 'Standing Calf Raise',        primary: ['calves'],        secondary: [] },
  { id: 'seated_calf',         name: 'Seated Calf Raise',          primary: ['calves'],        secondary: [] },
  // CORE
  { id: 'crunch',              name: 'Cable Crunch',               primary: ['abs'],           secondary: [] },
  { id: 'plank',               name: 'Plank',                      primary: ['abs'],           secondary: ['obliques'] },
  { id: 'leg_raise',           name: 'Hanging Leg Raise',          primary: ['abs'],           secondary: ['obliques'] },
  { id: 'situp',               name: 'Sit-Up',                     primary: ['abs'],           secondary: ['obliques'] },
  { id: 'ab_wheel',            name: 'Ab Wheel Rollout',           primary: ['abs'],           secondary: ['obliques','lats','lower_back'] },
  { id: 'dead_bug',            name: 'Dead Bug',                   primary: ['abs'],           secondary: ['obliques'] },
  { id: 'dragon_flag',         name: 'Dragon Flag',                primary: ['abs'],           secondary: ['obliques','lower_back'] },
  { id: 'pallof_press',        name: 'Pallof Press',               primary: ['abs'],           secondary: ['obliques'] },
  { id: 'cable_woodchop',      name: 'Cable Woodchop',             primary: ['obliques'],      secondary: ['abs','front_delts'] },
  { id: 'russian_twist',       name: 'Russian Twist',              primary: ['obliques'],      secondary: ['abs'] },
  // KETTLEBELL / CARRIES
  { id: 'kb_swing',            name: 'Kettlebell Swing',           primary: ['glutes'],        secondary: ['hamstrings','lower_back','traps'] },
  { id: 'kb_clean',            name: 'Kettlebell Clean',           primary: ['glutes'],        secondary: ['traps','hamstrings','forearms'] },
  { id: 'kb_turkish_getup',    name: 'Turkish Get-Up',             primary: ['abs'],           secondary: ['front_delts','glutes','traps'] },
  { id: 'farmers_carry',       name: "Farmer's Carry",             primary: ['traps'],         secondary: ['forearms','abs','glutes','calves'] },
  // CARDIO / CONDITIONING
  { id: 'rowing_machine',      name: 'Rowing Machine',             primary: ['lats'],          secondary: ['hamstrings','glutes','biceps','abs'] },
  { id: 'assault_bike',        name: 'Assault Bike',               primary: ['quads'],         secondary: ['glutes','hamstrings','chest','lats'] },
  { id: 'sled_push',           name: 'Sled Push',                  primary: ['quads'],         secondary: ['glutes','hamstrings','calves','abs'] },
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

function exerciseVolume(we, completedOnly = true) {
  return we.sets
    .filter(s => !completedOnly || s.done)
    .reduce((acc, s) => acc + setVolume(s), 0);
}

function muscleVolumes(workout, library) {
  const v = {};
  for (const we of workout) {
    const ex = library.find(e => e.id === we.exerciseId);
    if (!ex) continue;
    const vol = exerciseVolume(we, true);
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
const FRONT_PATHS = {
  chest: 'M 76,96 Q 90,88 108,90 L 108,138 Q 96,144 84,140 Q 76,134 74,124 Z M 144,96 Q 130,88 112,90 L 112,138 Q 124,144 136,140 Q 144,134 146,124 Z',
  front_delts: 'M 64,86 Q 56,88 52,102 Q 50,116 56,124 Q 66,124 74,118 Q 76,104 74,94 Q 70,86 64,86 Z M 156,86 Q 164,88 168,102 Q 170,116 164,124 Q 154,124 146,118 Q 144,104 146,94 Q 150,86 156,86 Z',
  side_delts: 'M 50,100 Q 42,104 40,118 Q 40,128 46,134 Q 52,132 56,124 Q 50,116 52,102 Z M 170,100 Q 178,104 180,118 Q 180,128 174,134 Q 168,132 164,124 Q 170,116 168,102 Z',
  traps: 'M 102,68 Q 98,76 100,84 Q 106,86 110,84 L 110,68 Z M 118,68 Q 122,76 120,84 Q 114,86 110,84 L 110,68 Z',
  biceps: 'M 46,128 Q 38,134 38,158 Q 42,176 50,178 Q 56,176 56,156 Q 56,138 52,130 Z M 174,128 Q 182,134 182,158 Q 178,176 170,178 Q 164,176 164,156 Q 164,138 168,130 Z',
  forearms: 'M 38,182 Q 32,196 32,222 Q 36,238 44,236 Q 50,234 52,218 Q 52,200 50,184 Z M 182,182 Q 188,196 188,222 Q 184,238 176,236 Q 170,234 168,218 Q 168,200 170,184 Z',
  abs: 'M 96,144 L 124,144 L 124,160 L 96,160 Z M 96,164 L 124,164 L 124,180 L 96,180 Z M 96,184 L 124,184 L 124,200 L 96,200 Z M 96,204 L 124,204 L 124,220 L 96,220 Z M 96,224 L 124,224 L 124,238 L 96,238 Z',
  obliques: 'M 78,150 Q 76,180 86,224 L 96,222 L 96,148 Q 86,146 78,150 Z M 142,150 Q 144,180 134,224 L 124,222 L 124,148 Q 134,146 142,150 Z',
  quads: 'M 78,250 Q 70,290 76,348 L 104,348 L 104,250 Q 90,246 78,250 Z M 142,250 Q 150,290 144,348 L 116,348 L 116,250 Q 130,246 142,250 Z',
  calves: 'M 84,388 Q 80,408 84,438 L 102,438 L 102,388 Z M 136,388 Q 140,408 136,438 L 118,438 L 118,388 Z',
};

const BACK_PATHS = {
  traps: 'M 110,72 L 90,86 Q 84,108 92,124 L 110,118 L 128,124 Q 136,108 130,86 Z',
  rear_delts: 'M 64,90 Q 56,96 52,110 Q 52,124 60,128 Q 70,126 76,118 Q 78,104 74,94 Z M 156,90 Q 164,96 168,110 Q 168,124 160,128 Q 150,126 144,118 Q 142,104 146,94 Z',
  triceps: 'M 46,132 Q 40,144 40,166 Q 44,180 52,180 Q 58,178 58,158 Q 58,140 52,132 Z M 174,132 Q 180,144 180,166 Q 176,180 168,180 Q 162,178 162,158 Q 162,140 168,132 Z',
  forearms: 'M 38,184 Q 32,200 32,224 Q 36,238 44,236 Q 50,234 52,218 Q 52,200 50,186 Z M 182,184 Q 188,200 188,224 Q 184,238 176,236 Q 170,234 168,218 Q 168,200 170,186 Z',
  lats: 'M 76,118 Q 60,150 64,200 L 102,206 L 102,134 Q 88,124 76,118 Z M 144,118 Q 160,150 156,200 L 118,206 L 118,134 Q 132,124 144,118 Z',
  lower_back: 'M 100,206 L 120,206 L 122,244 Q 110,248 98,244 Z',
  glutes: 'M 86,250 Q 76,272 88,300 Q 102,304 108,294 L 108,254 Q 96,248 86,250 Z M 134,250 Q 144,272 132,300 Q 118,304 112,294 L 112,254 Q 124,248 134,250 Z',
  hamstrings: 'M 80,300 Q 72,340 78,386 L 104,386 L 104,300 Q 92,296 80,300 Z M 140,300 Q 148,340 142,386 L 116,386 L 116,300 Q 128,296 140,300 Z',
  calves: 'M 76,388 Q 72,416 80,442 L 104,442 L 104,388 Z M 144,388 Q 148,416 140,442 L 116,442 L 116,388 Z',
};

const HEAD_FRONT  = <circle cx="110" cy="44" r="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
const HEAD_BACK   = <circle cx="110" cy="44" r="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
const NECK        = <rect x="100" y="62" width="20" height="14" fill="rgba(255,255,255,0.04)" />;

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
function SetRow({ set, idx, onChange, onToggle, onRemove, isLast }) {
  const status = overloadStatus(set);
  const vol = setVolume(set);
  const prevVol = setPrevVolume(set);

  return (
    <tr className={`group transition-colors ${set.done ? 'bg-orange-950/20' : 'hover:bg-stone-900/40'}`}>
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
          disabled={set.done}
          onChange={(e) => onChange({ ...set, reps: e.target.value === '' ? '' : Number(e.target.value) })}
          className="w-full bg-stone-950/60 border border-stone-800 px-2 py-1.5 text-stone-100 font-mono text-sm tabular-nums text-right focus:outline-none focus:border-orange-500/60 focus:bg-stone-950 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </td>
      <td className="px-2 py-2 w-24">
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={set.weight}
            disabled={set.done}
            onChange={(e) => onChange({ ...set, weight: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full bg-stone-950/60 border border-stone-800 px-2 py-1.5 pr-7 text-stone-100 font-mono text-sm tabular-nums text-right focus:outline-none focus:border-orange-500/60 focus:bg-stone-950 disabled:opacity-60 disabled:cursor-not-allowed"
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
      <td className="px-3 py-2 w-16 text-right">
        <button
          onClick={() => onToggle(set.id)}
          className={`w-7 h-7 inline-flex items-center justify-center border transition-all ${
            set.done
              ? 'bg-orange-500 border-orange-500 text-stone-950'
              : 'border-stone-700 hover:border-orange-500/60 hover:bg-orange-500/10'
          }`}
          aria-label={set.done ? 'Mark incomplete' : 'Complete set'}
        >
          {set.done ? <CheckIcon /> : null}
        </button>
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

// -------------------- EXERCISE CARD --------------------
function ExerciseCard({ we, exercise, onUpdate, onRemove, onAddSet, index }) {
  const totalVol = exerciseVolume(we, false);
  const doneVol = exerciseVolume(we, true);
  const completedSets = we.sets.filter(s => s.done).length;
  const allMuscles = [...exercise.primary, ...exercise.secondary];

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
            <div className="font-mono text-sm text-stone-300 tabular-nums">{completedSets}/{we.sets.length}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-stone-600">Vol</div>
            <div className="font-mono text-sm text-orange-300 tabular-nums">{fmt(doneVol)}</div>
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
              <th className="px-3 py-2 text-right font-medium">Done</th>
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
                onToggle={(id) => onUpdate({
                  ...we,
                  sets: we.sets.map(x => x.id === id ? { ...x, done: !x.done } : x),
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

      <footer className="px-3 py-2 border-t border-stone-800/60 bg-stone-950/40 flex justify-between items-center">
        <button
          onClick={onAddSet}
          className="text-[10px] uppercase tracking-wider font-mono text-stone-500 hover:text-orange-300 px-3 py-1 border border-stone-800 hover:border-orange-500/40 transition-colors"
        >
          + Add Set
        </button>
        <div className="text-[10px] font-mono tabular-nums text-stone-600">
          PROJECTED <span className="text-stone-400">{fmt(totalVol)}</span> KG·REPS
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

// -------------------- MUSCLE MAP --------------------
function MuscleMap({ volumes, max }) {
  const [hover, setHover] = useState(null);

  const renderMuscle = (key, d) => (
    <path
      key={key}
      d={d}
      fill={volumeToFill(volumes[key] || 0, max)}
      stroke="rgba(255,255,255,0.05)"
      strokeWidth="0.5"
      style={{ transition: 'fill 320ms ease', cursor: 'pointer' }}
      onMouseEnter={() => setHover({ key, vol: volumes[key] || 0 })}
      onMouseLeave={() => setHover(null)}
    />
  );

  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-2">
        {/* FRONT */}
        <div className="relative">
          <div className="text-[9px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-1 text-center">Anterior</div>
          <svg viewBox="0 0 220 460" className="w-full">
            {HEAD_FRONT}{NECK}
            {Object.entries(FRONT_PATHS).map(([k, d]) => renderMuscle(k, d))}
          </svg>
        </div>
        {/* BACK */}
        <div className="relative">
          <div className="text-[9px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-1 text-center">Posterior</div>
          <svg viewBox="0 0 220 460" className="w-full">
            {HEAD_BACK}{NECK}
            {Object.entries(BACK_PATHS).map(([k, d]) => renderMuscle(k, d))}
          </svg>
        </div>
      </div>
      <div className="absolute top-0 right-0 min-h-[42px] text-right">
        {hover && (
          <div className="bg-stone-950/95 border border-orange-500/30 px-3 py-2 backdrop-blur-sm">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 font-mono">{MUSCLES[hover.key]}</div>
            <div className="font-anton text-lg text-orange-300 tabular-nums leading-none mt-0.5">{fmt(hover.vol)}</div>
            <div className="text-[9px] text-stone-600 font-mono">kg·reps</div>
          </div>
        )}
      </div>
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

// -------------------- MAIN --------------------
export default function TitanLogger() {
  const [workout, setWorkout] = useState(INITIAL_WORKOUT);
  const [name, setName] = useState('Push Day · Week 4');
  const [seconds, setSeconds] = useState(1842); // ~30 min into session

  // session timer
  useEffect(() => {
    const i = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const volumes = useMemo(() => muscleVolumes(workout, EXERCISE_LIBRARY), [workout]);
  const maxVol = useMemo(() => Math.max(800, ...Object.values(volumes)), [volumes]);

  const totalVolume = useMemo(
    () => workout.reduce((acc, we) => acc + exerciseVolume(we, true), 0),
    [workout]
  );
  const doneSets = workout.reduce((a, we) => a + we.sets.filter(s => s.done).length, 0);
  const totalSets = workout.reduce((a, we) => a + we.sets.length, 0);
  const totalReps = workout.reduce(
    (a, we) => a + we.sets.filter(s => s.done).reduce((b, s) => b + (Number(s.reps) || 0), 0),
    0
  );

  const updateExercise = useCallback((id, updater) => {
    setWorkout(w => w.map(we => we.id === id ? updater(we) : we));
  }, []);

  const addSet = useCallback((weId) => {
    setWorkout(w => w.map(we => {
      if (we.id !== weId) return we;
      const last = we.sets[we.sets.length - 1];
      return {
        ...we,
        sets: [...we.sets, {
          id: `s-${Date.now()}`,
          reps: last?.reps || 8,
          weight: last?.weight || 0,
          done: false,
          prevReps: last?.prevReps || 0,
          prevWeight: last?.prevWeight || 0,
        }],
      };
    }));
  }, []);

  const removeExercise = useCallback((id) => {
    setWorkout(w => w.filter(we => we.id !== id));
  }, []);

  const addExercise = useCallback((ex) => {
    setWorkout(w => [...w, {
      id: `we-${Date.now()}`,
      exerciseId: ex.id,
      sets: [
        { id: `s-${Date.now()}-1`, reps: 8, weight: 0, done: false, prevReps: 0, prevWeight: 0 },
        { id: `s-${Date.now()}-2`, reps: 8, weight: 0, done: false, prevReps: 0, prevWeight: 0 },
        { id: `s-${Date.now()}-3`, reps: 8, weight: 0, done: false, prevReps: 0, prevWeight: 0 },
      ],
    }]);
  }, []);

  const usedIds = new Set(workout.map(we => we.exerciseId));

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
        .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
        .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        body { background: #0a0908; }
      `}</style>

      {/* AMBIENT BACKDROP */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)'
        }} />
        <div className="absolute top-0 right-0 w-[60vw] h-[60vh] opacity-[0.08] blur-3xl" style={{
          background: 'radial-gradient(circle, #ff5a2a 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8">

        {/* HEADER */}
        <header className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-stone-800/60">
          <div className="flex items-baseline gap-4">
            <div className="flex items-baseline gap-2">
              <span className="font-anton text-5xl uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">IRONLAB</span>
              <span className="font-anton text-5xl uppercase tracking-tight text-stone-100">Logger</span>
            </div>
            <span className="hidden md:inline-block w-px h-8 bg-stone-800" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hidden md:block bg-transparent text-lg text-stone-300 focus:outline-none focus:text-stone-100 font-mono px-2 py-1 border-b border-transparent focus:border-orange-500/40"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.2em] text-stone-600 font-mono">Session</div>
              <div className="font-anton text-2xl tabular-nums text-stone-200">{mins}:{secs}</div>
            </div>
            <button className="px-5 py-2.5 bg-orange-500 text-stone-950 font-anton text-lg uppercase tracking-wider hover:bg-orange-400 transition-colors">
              Save Workout
            </button>
          </div>
        </header>

        {/* STATS BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-8 border border-stone-800/60 bg-stone-950/40">
          <StatBlock
            label="Total Volume"
            value={fmt(totalVolume)}
            sub="kg · reps"
            accent="text-orange-300"
          />
          <StatBlock
            label="Sets Completed"
            value={`${doneSets}/${totalSets}`}
            sub={`${Math.round((doneSets/Math.max(totalSets,1))*100)}% complete`}
          />
          <StatBlock
            label="Reps Logged"
            value={fmt(totalReps)}
            sub="working sets"
          />
          <StatBlock
            label="Muscles Hit"
            value={Object.keys(volumes).length}
            sub={`/ ${Object.keys(MUSCLES).length} total`}
          />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT — EXERCISE GRID */}
          <main className="col-span-12 lg:col-span-7 xl:col-span-8 space-y-4">
            {workout.map((we, idx) => {
              const ex = EXERCISE_LIBRARY.find(e => e.id === we.exerciseId);
              if (!ex) return null;
              return (
                <ExerciseCard
                  key={we.id}
                  index={idx}
                  we={we}
                  exercise={ex}
                  onUpdate={(updated) => updateExercise(we.id, () => updated)}
                  onRemove={() => removeExercise(we.id)}
                  onAddSet={() => addSet(we.id)}
                />
              );
            })}
            <AddExercisePicker library={EXERCISE_LIBRARY} onAdd={addExercise} used={usedIds} />
          </main>

          {/* RIGHT — MUSCLE MAP + BREAKDOWN */}
          <aside className="col-span-12 lg:col-span-5 xl:col-span-4 space-y-6">
            <div className="border border-stone-800/60 bg-stone-950/40 p-5 lg:sticky lg:top-6">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Muscle Map</h2>
                <span className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">live · volume-weighted</span>
              </div>
              <MuscleMap volumes={volumes} max={maxVol} />
              {/* legend */}
              <div className="mt-4 pt-4 border-t border-stone-800/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Volume</span>
                  <span className="text-[9px] uppercase tracking-wider text-stone-600 font-mono tabular-nums">0 → {fmt(maxVol)}</span>
                </div>
                <div className="h-1.5 w-full" style={{
                  background: 'linear-gradient(to right, rgba(255,255,255,0.025), rgb(98,42,18), rgb(186,74,28), rgb(240,110,38), rgb(255,78,38))'
                }} />
              </div>
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
          <span>IRONLAB v0.3 · Module 3 · Workout Engine</span>
          <span>Vol formula: Σ(reps × weight) · primary 1.0 · secondary 0.5</span>
        </footer>
      </div>
    </div>
  );
}
