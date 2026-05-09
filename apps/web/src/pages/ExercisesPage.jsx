import React, { useState, useMemo } from 'react';

/* =========================================================================
 * EXERCISE LIBRARY — Module 2 Proof-of-Concept
 * Demonstrates: filterable exercise database with split-aware filters
 *               (PPL, Upper/Lower, Bro Split), muscle group filtering,
 *               equipment filter, sort options, detail modal with
 *               Pro-gated content (form-check videos, advanced variations).
 *
 * Production notes:
 *   - `exercises` table is global, read-only, seeded from curated CSV.
 *   - Premium content (form-check videos, advanced variations) gated via
 *     RLS: SELECT allowed only when profiles.subscription_tier IN ('pro','elite').
 *   - Video URLs point to private CDN bucket; signed URLs expire in 1h.
 * ========================================================================= */

// -------------------- DATA --------------------
const MUSCLES = {
  chest: 'Chest',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  lats: 'Lats',
  traps: 'Traps',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  lower_back: 'Lower Back',
};

const EXERCISES = [
  // CHEST
  { id: 'bench',        name: 'Barbell Bench Press',     primary: 'chest',  secondary: ['front_delts','triceps'], equipment: 'barbell',    pattern: 'push',      difficulty: 3, splits: ['push','upper','bro_chest'],     premium: false, popular: 92, cues: ['Tuck elbows ~45°','Bar to lower chest','Squeeze glutes','Drive feet into floor'] },
  { id: 'incline_db',   name: 'Incline DB Press',        primary: 'chest',  secondary: ['front_delts','triceps'], equipment: 'dumbbell',   pattern: 'push',      difficulty: 2, splits: ['push','upper','bro_chest'],     premium: false, popular: 88, cues: ['Bench at 30°','Wrists stacked over elbows','Lower until chest stretches','Drive up & in'] },
  { id: 'cable_fly',    name: 'Cable Crossover',         primary: 'chest',  secondary: ['front_delts'],            equipment: 'cable',      pattern: 'push',      difficulty: 2, splits: ['push','upper','bro_chest'],     premium: false, popular: 75, cues: ['Soft elbow throughout','Squeeze at midline','Forward step for stretch'] },
  { id: 'dips',         name: 'Weighted Dips',           primary: 'chest',  secondary: ['triceps','front_delts'],  equipment: 'bodyweight', pattern: 'push',      difficulty: 4, splits: ['push','upper','bro_chest'],     premium: true,  popular: 68, cues: ['Lean forward 30°','Lower until shoulder = elbow','Lock out at top'] },

  // SHOULDERS
  { id: 'ohp',          name: 'Standing Overhead Press', primary: 'front_delts', secondary: ['side_delts','triceps'], equipment: 'barbell', pattern: 'push',     difficulty: 3, splits: ['push','upper','bro_shoulders'], premium: false, popular: 85, cues: ['Brace core hard','Bar path over mid-foot','Shrug at lockout','Glutes squeezed'] },
  { id: 'lateral_raise',name: 'DB Lateral Raise',        primary: 'side_delts',  secondary: [],                       equipment: 'dumbbell', pattern: 'isolation', difficulty: 1, splits: ['push','upper','bro_shoulders'], premium: false, popular: 90, cues: ['Slight elbow bend','Lead with pinkies','Stop at shoulder height'] },
  { id: 'rear_delt_fly',name: 'Reverse Pec Deck',        primary: 'rear_delts',  secondary: ['traps'],                equipment: 'machine',  pattern: 'pull',      difficulty: 1, splits: ['pull','upper','bro_shoulders'], premium: false, popular: 72, cues: ['Chest against pad','Pull with rear delts not arms','Pause briefly'] },
  { id: 'face_pull',    name: 'Cable Face Pull',         primary: 'rear_delts',  secondary: ['traps'],                equipment: 'cable',    pattern: 'pull',      difficulty: 1, splits: ['pull','upper','bro_shoulders'], premium: false, popular: 78, cues: ['Rope to forehead','External rotation at end','High elbows'] },

  // BACK
  { id: 'pullup',       name: 'Pull-Up',                 primary: 'lats', secondary: ['biceps','rear_delts'],         equipment: 'bodyweight', pattern: 'pull',  difficulty: 4, splits: ['pull','upper','bro_back'],     premium: false, popular: 88, cues: ['Hollow body position','Drive elbows down','Chin over bar','Control descent'] },
  { id: 'row',          name: 'Barbell Row',             primary: 'lats', secondary: ['biceps','rear_delts','traps'], equipment: 'barbell',   pattern: 'pull',  difficulty: 3, splits: ['pull','upper','bro_back'],     premium: false, popular: 90, cues: ['Hinge to ~45°','Pull to belly button','Squeeze shoulder blades','Don\'t round back'] },
  { id: 'lat_pulldown', name: 'Lat Pulldown',            primary: 'lats', secondary: ['biceps'],                       equipment: 'cable',     pattern: 'pull',  difficulty: 2, splits: ['pull','upper','bro_back'],     premium: false, popular: 85, cues: ['Slight backward lean','Bar to upper chest','Pull with elbows','No momentum'] },
  { id: 'tbar_row',     name: 'T-Bar Row',               primary: 'lats', secondary: ['biceps','traps'],               equipment: 'machine',   pattern: 'pull',  difficulty: 3, splits: ['pull','upper','bro_back'],     premium: true,  popular: 70, cues: ['Neutral spine','Pull bar to sternum','Drive elbows back & high'] },
  { id: 'shrug',        name: 'DB Shrug',                primary: 'traps', secondary: [],                              equipment: 'dumbbell',  pattern: 'isolation', difficulty: 1, splits: ['pull','upper','bro_back','bro_shoulders'], premium: false, popular: 65, cues: ['Straight up, not rolling','Pause at top','Full ROM down'] },

  // ARMS
  { id: 'curl',         name: 'Barbell Curl',            primary: 'biceps',  secondary: ['forearms'], equipment: 'barbell',  pattern: 'pull', difficulty: 1, splits: ['pull','upper','bro_arms'], premium: false, popular: 92, cues: ['Elbows pinned to sides','No swinging','Squeeze at top'] },
  { id: 'hammer_curl',  name: 'Hammer Curl',             primary: 'biceps',  secondary: ['forearms'], equipment: 'dumbbell', pattern: 'pull', difficulty: 1, splits: ['pull','upper','bro_arms'], premium: false, popular: 80, cues: ['Neutral grip throughout','Slow eccentric','Strict form'] },
  { id: 'preacher_curl',name: 'Preacher Curl',           primary: 'biceps',  secondary: [],            equipment: 'machine',  pattern: 'pull', difficulty: 2, splits: ['pull','upper','bro_arms'], premium: true,  popular: 60, cues: ['Armpits at pad top','Don\'t fully extend','Control descent'] },
  { id: 'tricep_pushdown',name: 'Cable Tricep Pushdown', primary: 'triceps', secondary: [],            equipment: 'cable',    pattern: 'push', difficulty: 1, splits: ['push','upper','bro_arms'], premium: false, popular: 88, cues: ['Elbows pinned','Full lockout','Slight lean forward'] },
  { id: 'skullcrusher', name: 'Skullcrusher',            primary: 'triceps', secondary: [],            equipment: 'barbell',  pattern: 'push', difficulty: 2, splits: ['push','upper','bro_arms'], premium: false, popular: 70, cues: ['Lower toward forehead','Elbows fixed','Strong grip on bar'] },

  // LEGS
  { id: 'squat',        name: 'Back Squat',              primary: 'quads', secondary: ['glutes','hamstrings'],          equipment: 'barbell',   pattern: 'squat', difficulty: 4, splits: ['legs','lower','bro_legs'], premium: false, popular: 95, cues: ['Brace before unrack','Knees track toes','Hip below parallel','Drive through mid-foot'] },
  { id: 'front_squat',  name: 'Front Squat',             primary: 'quads', secondary: ['glutes','abs'],                 equipment: 'barbell',   pattern: 'squat', difficulty: 4, splits: ['legs','lower','bro_legs'], premium: true,  popular: 70, cues: ['Elbows high throughout','Upright torso','Bar on front delts'] },
  { id: 'leg_press',    name: 'Leg Press',               primary: 'quads', secondary: ['glutes','hamstrings'],          equipment: 'machine',   pattern: 'squat', difficulty: 2, splits: ['legs','lower','bro_legs'], premium: false, popular: 88, cues: ['Feet shoulder width','Lower back stays glued','Don\'t lock knees'] },
  { id: 'rdl',          name: 'Romanian Deadlift',       primary: 'hamstrings', secondary: ['glutes','lower_back'],     equipment: 'barbell',   pattern: 'hinge', difficulty: 3, splits: ['legs','lower','bro_legs'], premium: false, popular: 82, cues: ['Soft knees, hip hinge','Bar drags down legs','Stop at mid-shin','Drive hips through'] },
  { id: 'deadlift',     name: 'Conventional Deadlift',   primary: 'hamstrings', secondary: ['glutes','lower_back','traps'], equipment: 'barbell', pattern: 'hinge', difficulty: 5, splits: ['pull','lower','bro_legs','bro_back'], premium: false, popular: 92, cues: ['Bar over mid-foot','Lats engaged before pull','Push the floor away','Lockout glutes'] },
  { id: 'leg_curl',     name: 'Lying Leg Curl',          primary: 'hamstrings', secondary: [],                          equipment: 'machine',   pattern: 'isolation', difficulty: 1, splits: ['legs','lower','bro_legs'], premium: false, popular: 75, cues: ['Hips down on pad','Full ROM','Pause at peak'] },
  { id: 'hip_thrust',   name: 'Barbell Hip Thrust',      primary: 'glutes', secondary: ['hamstrings'],                  equipment: 'barbell',   pattern: 'hinge', difficulty: 2, splits: ['legs','lower','bro_legs'], premium: false, popular: 80, cues: ['Upper back on bench','Chin tucked','Squeeze glutes hard at top'] },
  { id: 'bulgarian',    name: 'Bulgarian Split Squat',   primary: 'quads', secondary: ['glutes'],                       equipment: 'dumbbell',  pattern: 'squat', difficulty: 3, splits: ['legs','lower','bro_legs'], premium: true,  popular: 72, cues: ['Long stride length','Front foot flat','Vertical shin at depth'] },
  { id: 'calf_raise',   name: 'Standing Calf Raise',     primary: 'calves', secondary: [],                              equipment: 'machine',   pattern: 'isolation', difficulty: 1, splits: ['legs','lower','bro_legs'], premium: false, popular: 70, cues: ['Full stretch at bottom','Pause 1s at top','Slow eccentric'] },

  // CORE
  { id: 'crunch',       name: 'Cable Crunch',            primary: 'abs', secondary: [],                                  equipment: 'cable',     pattern: 'isolation', difficulty: 1, splits: ['legs','upper'], premium: false, popular: 65, cues: ['Curl spine, not hip','Elbows lead','Squeeze hard'] },
  { id: 'plank',        name: 'Plank',                   primary: 'abs', secondary: ['obliques'],                        equipment: 'bodyweight',pattern: 'isolation', difficulty: 1, splits: ['legs','upper'], premium: false, popular: 75, cues: ['Glutes squeezed','Hips level','Breath through brace'] },
  { id: 'leg_raise',    name: 'Hanging Leg Raise',       primary: 'abs', secondary: ['obliques'],                        equipment: 'bodyweight',pattern: 'isolation', difficulty: 3, splits: ['legs','upper'], premium: false, popular: 70, cues: ['Posterior pelvic tilt','Don\'t swing','Lower under control'] },
];

const SPLITS = [
  { id: 'all',           label: 'All',          group: 'all' },
  { id: 'push',          label: 'Push',         group: 'PPL' },
  { id: 'pull',          label: 'Pull',         group: 'PPL' },
  { id: 'legs',          label: 'Legs',         group: 'PPL' },
  { id: 'upper',         label: 'Upper',        group: 'U/L' },
  { id: 'lower',         label: 'Lower',        group: 'U/L' },
  { id: 'bro_chest',     label: 'Chest',        group: 'Bro' },
  { id: 'bro_back',      label: 'Back',         group: 'Bro' },
  { id: 'bro_legs',      label: 'Legs',         group: 'Bro' },
  { id: 'bro_shoulders', label: 'Shoulders',    group: 'Bro' },
  { id: 'bro_arms',      label: 'Arms',         group: 'Bro' },
];

const EQUIPMENT = [
  { id: 'barbell',    label: 'Barbell' },
  { id: 'dumbbell',   label: 'Dumbbell' },
  { id: 'cable',      label: 'Cable' },
  { id: 'machine',    label: 'Machine' },
  { id: 'bodyweight', label: 'Bodyweight' },
];

const SORTS = [
  { id: 'popular',  label: 'Most logged' },
  { id: 'alpha',    label: 'A → Z' },
  { id: 'compound', label: 'Compound first' },
  { id: 'difficulty', label: 'Hardest first' },
];

// Movement-pattern accent colors
const PATTERN_ACCENTS = {
  push:      { from: '#ed7a2a', to: '#7a2410' },
  pull:      { from: '#7eb6ff', to: '#1e3a5f' },
  squat:     { from: '#fbbf24', to: '#7a4a10' },
  hinge:     { from: '#c084fc', to: '#3a1e5f' },
  isolation: { from: '#94a3b8', to: '#1e293b' },
};

// -------------------- MOVEMENT ICONS --------------------
function MotionIcon({ pattern, className = '' }) {
  const props = { className, viewBox: '0 0 60 60', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' };
  switch (pattern) {
    case 'push':
      return (
        <svg {...props}>
          <circle cx="14" cy="30" r="3" fill="currentColor" />
          <path d="M 18,30 Q 30,18 42,30" />
          <path d="M 38,26 L 46,30 L 38,34" />
          <path d="M 14,42 L 14,46 M 14,14 L 14,18" opacity="0.4" />
        </svg>
      );
    case 'pull':
      return (
        <svg {...props}>
          <circle cx="46" cy="30" r="3" fill="currentColor" />
          <path d="M 42,30 Q 30,42 18,30" />
          <path d="M 22,26 L 14,30 L 22,34" />
          <path d="M 46,42 L 46,46 M 46,14 L 46,18" opacity="0.4" />
        </svg>
      );
    case 'squat':
      return (
        <svg {...props}>
          <line x1="12" y1="20" x2="48" y2="20" strokeWidth="3" />
          <path d="M 30,22 L 30,40" />
          <path d="M 22,40 L 30,32 L 38,40" />
          <path d="M 22,46 L 30,38 L 38,46" opacity="0.5" />
          <path d="M 26,52 L 34,52" />
        </svg>
      );
    case 'hinge':
      return (
        <svg {...props}>
          <circle cx="30" cy="14" r="3" fill="currentColor" />
          <path d="M 30,18 L 30,28 Q 30,32 36,32 L 46,38" />
          <path d="M 30,28 L 24,42" />
          <line x1="14" y1="46" x2="50" y2="46" strokeWidth="3" />
        </svg>
      );
    case 'isolation':
      return (
        <svg {...props}>
          <circle cx="30" cy="30" r="14" strokeDasharray="3 3" />
          <circle cx="30" cy="30" r="5" fill="currentColor" />
          <path d="M 30,12 L 30,8 M 30,52 L 30,48 M 12,30 L 8,30 M 52,30 L 48,30" opacity="0.5" />
        </svg>
      );
    default:
      return null;
  }
}

// -------------------- CARD --------------------
function ExerciseCard({ ex, onOpen }) {
  const accent = PATTERN_ACCENTS[ex.pattern];

  return (
    <button
      onClick={() => onOpen(ex)}
      className="group text-left bg-stone-950/40 border border-stone-800/60 hover:border-orange-500/40 transition-all overflow-hidden"
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accent.from}22, ${accent.to}aa, #0a0908)` }}
      >
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 14px, rgba(255,255,255,0.04) 14px, rgba(255,255,255,0.04) 15px), repeating-linear-gradient(90deg, transparent 0, transparent 14px, rgba(255,255,255,0.04) 14px, rgba(255,255,255,0.04) 15px)'
        }} />

        {/* Motion icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <MotionIcon pattern={ex.pattern} className="w-20 h-20 text-stone-100/80 group-hover:scale-110 transition-transform duration-500" />
        </div>

        {/* Play indicator */}
        <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-stone-950/80 backdrop-blur-sm border border-stone-700 flex items-center justify-center group-hover:bg-orange-500 group-hover:border-orange-500 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2L11 7L3 12V2Z" fill="currentColor" className="text-stone-300 group-hover:text-stone-950" />
          </svg>
        </div>

        {/* Difficulty dots */}
        <div className="absolute top-3 left-3 flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i < ex.difficulty ? 'bg-orange-400' : 'bg-stone-600/50'}`}
            />
          ))}
        </div>

        {/* Premium badge */}
        {ex.premium && (
          <div className="absolute top-3 right-3 text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-orange-500 text-stone-950 font-mono font-bold">
            PRO
          </div>
        )}

        {/* Pattern label */}
        <div className="absolute bottom-3 left-3 text-[9px] uppercase tracking-[0.2em] text-stone-300 font-mono">
          {ex.pattern}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 leading-tight mb-2 group-hover:text-orange-300 transition-colors">
          {ex.name}
        </h3>
        <div className="flex flex-wrap gap-1 mb-3">
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-orange-500/15 text-orange-300 border border-orange-500/25 font-mono">
            {MUSCLES[ex.primary]}
          </span>
          {ex.secondary.slice(0, 2).map(m => (
            <span key={m} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-stone-800/60 text-stone-500 border border-stone-700/50 font-mono">
              {MUSCLES[m]}
            </span>
          ))}
          {ex.secondary.length > 2 && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 text-stone-600 font-mono">
              +{ex.secondary.length - 2}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-stone-500">
          <span>{ex.equipment}</span>
          <span className="text-stone-600 tabular-nums">★ {ex.popular}</span>
        </div>
      </div>
    </button>
  );
}

// -------------------- DETAIL MODAL --------------------
function ExerciseDetail({ ex, onClose, isPro }) {
  if (!ex) return null;
  const accent = PATTERN_ACCENTS[ex.pattern];

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#0d0c0a] border border-stone-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header video placeholder */}
        <div
          className="relative aspect-video overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accent.from}22, ${accent.to}aa, #0a0908)` }}
        >
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 18px, rgba(255,255,255,0.04) 18px, rgba(255,255,255,0.04) 19px), repeating-linear-gradient(90deg, transparent 0, transparent 18px, rgba(255,255,255,0.04) 18px, rgba(255,255,255,0.04) 19px)'
          }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <MotionIcon pattern={ex.pattern} className="w-32 h-32 text-stone-100/70" />
          </div>
          <div className="absolute bottom-4 right-4 w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center hover:bg-orange-400 transition-colors cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
              <path d="M3 2L11 7L3 12V2Z" fill="#0a0908" />
            </svg>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-stone-950/80 border border-stone-700 hover:border-orange-500/60 flex items-center justify-center text-stone-400 hover:text-stone-100 transition-colors"
          >
            ✕
          </button>
          <div className="absolute top-4 left-4 text-[9px] uppercase tracking-[0.2em] text-stone-300 font-mono px-2 py-1 bg-stone-950/80 border border-stone-700">
            {ex.pattern} · demo loop
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="font-anton text-3xl uppercase tracking-tight text-stone-100 leading-tight">{ex.name}</h2>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono">
                  {MUSCLES[ex.primary]} · primary
                </span>
                {ex.secondary.map(m => (
                  <span key={m} className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-stone-800/60 text-stone-400 border border-stone-700/50 font-mono">
                    {MUSCLES[m]}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Difficulty</div>
              <div className="flex gap-1 mt-1 justify-end">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={`w-2 h-2 rounded-full ${i < ex.difficulty ? 'bg-orange-400' : 'bg-stone-700'}`} />
                ))}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mt-1">{ex.equipment}</div>
            </div>
          </div>

          {/* Cues */}
          <div className="mb-5">
            <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 mb-2">Form Cues</h3>
            <ul className="space-y-2">
              {ex.cues.map((c, i) => (
                <li key={i} className="flex gap-3 text-sm text-stone-300">
                  <span className="font-mono text-[10px] tabular-nums text-orange-500/60 shrink-0 mt-1">{String(i + 1).padStart(2, '0')}</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro-gated section */}
          <div className={`relative border ${isPro ? 'border-stone-800/60 bg-stone-950/40' : 'border-orange-500/30 bg-orange-500/5'} p-4 mb-5`}>
            {!isPro && (
              <div className="absolute top-3 right-3 text-[9px] uppercase tracking-wider px-2 py-0.5 bg-orange-500 text-stone-950 font-mono font-bold">
                PRO
              </div>
            )}
            <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 mb-2">Form Check Video</h3>
            {isPro ? (
              <p className="text-sm text-stone-300">Slow-motion form demo with annotated coaching points. Tap the video above to play.</p>
            ) : (
              <>
                <p className="text-sm text-stone-400 mb-3">Slow-motion form demonstration with annotated coaching points, common mistake breakdowns, and progressive variations.</p>
                <button className="text-xs uppercase tracking-wider font-anton text-orange-300 hover:text-orange-200 border-b border-orange-500/40 pb-0.5">
                  Upgrade to Pro to unlock →
                </button>
              </>
            )}
          </div>

          {/* Splits compatibility */}
          <div className="mb-5">
            <h3 className="font-anton text-lg uppercase tracking-tight text-stone-100 mb-2">Programs This Fits</h3>
            <div className="flex flex-wrap gap-2">
              {ex.splits.map(s => {
                const split = SPLITS.find(x => x.id === s);
                return (
                  <span key={s} className="text-[10px] uppercase tracking-wider px-2 py-1 bg-stone-900/60 text-stone-400 border border-stone-800 font-mono">
                    {split?.group} · {split?.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-5 border-t border-stone-800/60">
            <button className="flex-1 px-4 py-2.5 border border-stone-700 text-stone-400 font-anton text-sm uppercase tracking-wider hover:bg-stone-800 hover:text-stone-200 transition-colors">
              View History
            </button>
            <button className="flex-1 px-4 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors">
              + Add to Today's Workout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------- FILTER CHIP --------------------
function Chip({ active, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] uppercase tracking-wider px-2.5 py-1.5 border font-mono transition-colors whitespace-nowrap ${
        active
          ? 'bg-orange-500/15 text-orange-300 border-orange-500/40'
          : 'bg-stone-950/40 text-stone-500 border-stone-800 hover:border-stone-700 hover:text-stone-300'
      }`}
    >
      {children}
      {badge !== undefined && <span className="ml-1.5 text-stone-600 tabular-nums">{badge}</span>}
    </button>
  );
}

// -------------------- MAIN --------------------
export default function ExerciseLibrary() {
  const [search, setSearch] = useState('');
  const [activeSplit, setActiveSplit] = useState('all');
  const [activeMuscles, setActiveMuscles] = useState(new Set());
  const [activeEquipment, setActiveEquipment] = useState(new Set());
  const [sortBy, setSortBy] = useState('popular');
  const [selected, setSelected] = useState(null);
  const [isPro] = useState(false); // demo: free tier

  const toggleSet = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const filtered = useMemo(() => {
    let result = EXERCISES.filter(ex => {
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeSplit !== 'all' && !ex.splits.includes(activeSplit)) return false;
      if (activeMuscles.size > 0 && !activeMuscles.has(ex.primary) && !ex.secondary.some(m => activeMuscles.has(m))) return false;
      if (activeEquipment.size > 0 && !activeEquipment.has(ex.equipment)) return false;
      return true;
    });

    switch (sortBy) {
      case 'alpha':
        result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'popular':
        result.sort((a, b) => b.popular - a.popular); break;
      case 'compound':
        result.sort((a, b) => (b.secondary.length - a.secondary.length) || (b.popular - a.popular)); break;
      case 'difficulty':
        result.sort((a, b) => b.difficulty - a.difficulty); break;
    }

    return result;
  }, [search, activeSplit, activeMuscles, activeEquipment, sortBy]);

  // Group splits by category for cleaner display
  const splitGroups = SPLITS.reduce((acc, s) => {
    if (s.id === 'all') { acc.all = [s]; return acc; }
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  const totalActive = (activeSplit !== 'all' ? 1 : 0) + activeMuscles.size + activeEquipment.size;

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
        <div className="absolute top-0 left-0 w-[60vw] h-[40vh] opacity-[0.06] blur-3xl" style={{
          background: 'radial-gradient(ellipse, #ed7a2a 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8">

        {/* HEADER */}
        <header className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-stone-800/60">
          <div>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-anton text-5xl uppercase tracking-tight text-stone-100">Exercise</span>
              <span className="font-anton text-5xl uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Codex</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-stone-500">
              <span>{EXERCISES.length} exercises</span>
              <span className="text-stone-700">·</span>
              <span>{EXERCISES.filter(e => e.premium).length} pro-gated</span>
              <span className="text-stone-700">·</span>
              <span className="text-orange-400">{filtered.length} matching</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercise…"
                className="bg-stone-950/60 border border-stone-800 px-3 py-2.5 pl-9 text-stone-100 font-mono text-sm placeholder:text-stone-600 focus:outline-none focus:border-orange-500/60 w-64"
              />
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-stone-950/60 border border-stone-800 px-3 py-2.5 text-stone-300 font-mono text-xs uppercase tracking-wider focus:outline-none focus:border-orange-500/60 cursor-pointer"
            >
              {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </header>

        {/* FILTERS */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-5 mb-6 space-y-4">
          {/* SPLIT */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Training Split</span>
              <span className="text-[9px] text-stone-700 font-mono">single select</span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {Object.entries(splitGroups).map(([group, splits]) => (
                <React.Fragment key={group}>
                  {group !== 'all' && (
                    <span className="text-[9px] uppercase tracking-wider text-stone-700 font-mono ml-2 first:ml-0">
                      {group} ·
                    </span>
                  )}
                  {splits.map(s => (
                    <Chip key={s.id} active={activeSplit === s.id} onClick={() => setActiveSplit(s.id)}>
                      {s.label}
                    </Chip>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* MUSCLES */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Muscle Group</span>
              <span className="text-[9px] text-stone-700 font-mono">multi · {activeMuscles.size} selected</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(MUSCLES).slice(0, 14).map(([id, label]) => (
                <Chip
                  key={id}
                  active={activeMuscles.has(id)}
                  onClick={() => setActiveMuscles(s => toggleSet(s, id))}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          {/* EQUIPMENT */}
          <div className="flex items-baseline gap-4 flex-wrap">
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mr-3">Equipment</span>
              <span className="text-[9px] text-stone-700 font-mono">multi</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map(e => (
                <Chip
                  key={e.id}
                  active={activeEquipment.has(e.id)}
                  onClick={() => setActiveEquipment(s => toggleSet(s, e.id))}
                >
                  {e.label}
                </Chip>
              ))}
            </div>
            {totalActive > 0 && (
              <button
                onClick={() => {
                  setActiveSplit('all');
                  setActiveMuscles(new Set());
                  setActiveEquipment(new Set());
                  setSearch('');
                }}
                className="ml-auto text-[10px] uppercase tracking-wider text-stone-500 hover:text-orange-300 font-mono transition-colors"
              >
                Clear all ({totalActive})
              </button>
            )}
          </div>
        </div>

        {/* RESULTS GRID */}
        {filtered.length === 0 ? (
          <div className="border border-stone-800/60 bg-stone-950/40 p-16 text-center">
            <div className="font-anton text-3xl uppercase tracking-tight text-stone-700 mb-2">No matches</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-600">try widening your filters</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(ex => (
              <ExerciseCard key={ex.id} ex={ex} onOpen={setSelected} />
            ))}
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>Exercise Codex v0.4 · Module 2 · Curated database</span>
          <span>{EXERCISES.length} entries · global · read-only · {EXERCISES.filter(e => e.premium).length} pro</span>
        </footer>
      </div>

      {/* DETAIL MODAL */}
      <ExerciseDetail ex={selected} onClose={() => setSelected(null)} isPro={isPro} />
    </div>
  );
}
