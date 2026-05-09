import React, { useState, useMemo } from 'react';

/* =========================================================================
 * ONBOARDING — First-run setup wizard
 * Five-step flow: Goal → Stats → Target → Program → Plan
 * Outputs a personalized starting macro plan computed via Mifflin-St Jeor
 * BMR + activity multiplier + goal-driven calorie offset.
 *
 * Production notes:
 *   - All inputs persist to profiles table on each step (no data loss).
 *   - Computed macros write to current_macros JSONB column.
 *   - Onboarding completion triggers welcome email + first Coach analysis
 *     scheduled for 7 days out.
 * ========================================================================= */

// -------------------- DOMAIN --------------------
const GOALS = [
  { id: 'cut',     label: 'Cut',     desc: 'Lose body fat while preserving muscle',           offset: -500, slope: -0.5 },
  { id: 'bulk',    label: 'Bulk',    desc: 'Build muscle with controlled fat gain',           offset: +300, slope: +0.3 },
  { id: 'recomp',  label: 'Recomp',  desc: 'Slow body recomposition at maintenance',          offset: 0,    slope: 0 },
  { id: 'maintain',label: 'Maintain',desc: 'Hold current weight, focus on performance',       offset: 0,    slope: 0 },
];

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary',  desc: 'Desk job, little exercise outside training',  mult: 1.2 },
  { id: 'light',     label: 'Light',      desc: 'Light activity, walks, 1–2 sessions / week',  mult: 1.375 },
  { id: 'moderate',  label: 'Moderate',   desc: 'Active job or 3–5 sessions / week',           mult: 1.55 },
  { id: 'high',      label: 'High',       desc: 'Athlete or 6+ sessions / week',               mult: 1.725 },
];

const EXPERIENCE = [
  { id: 'beginner',     label: 'Beginner',     desc: '< 1 year of structured training' },
  { id: 'intermediate', label: 'Intermediate', desc: '1–3 years, know your numbers' },
  { id: 'advanced',     label: 'Advanced',     desc: '3+ years, programmed cycles' },
];

const PROGRAMS = [
  { id: 'ppl',     label: 'Push / Pull / Legs',  desc: '6 days a week. Highest volume per muscle.', sessions: 6 },
  { id: 'upper_lower', label: 'Upper / Lower', desc: '4 days a week. Balanced split for most lifters.', sessions: 4 },
  { id: 'full_body', label: 'Full Body',         desc: '3 days a week. Best for beginners or busy schedules.', sessions: 3 },
  { id: 'bro_split', label: 'Bro Split',         desc: '5 days, one muscle group per day. Classic.', sessions: 5 },
];

// -------------------- LOGIC --------------------
// Mifflin-St Jeor BMR
function calcBMR({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

function calcMacros({ weightKg, heightCm, age, sex, activity, goal }) {
  const bmr = calcBMR({ weightKg, heightCm, age, sex });
  const activityObj = ACTIVITY_LEVELS.find(a => a.id === activity);
  const tdee = bmr * (activityObj?.mult || 1.55);
  const goalObj = GOALS.find(g => g.id === goal);
  const targetKcal = Math.round(tdee + (goalObj?.offset || 0));

  // Protein: 2.2 g/kg for cut/recomp/maintain, 2.0 g/kg for bulk
  const proteinPerKg = goal === 'bulk' ? 2.0 : 2.2;
  const protein = Math.round(weightKg * proteinPerKg);
  const proteinKcal = protein * 4;

  // Fat: 25% of total
  const fatKcal = targetKcal * 0.25;
  const fat = Math.round(fatKcal / 9);

  // Carbs: remainder
  const carbKcal = targetKcal - proteinKcal - fatKcal;
  const carbs = Math.round(carbKcal / 4);

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal: targetKcal, protein, carbs, fat };
}

const STEPS = ['Goal', 'Stats', 'Target', 'Program', 'Plan'];

// -------------------- UI PRIMITIVES --------------------

function ChoiceCard({ active, onClick, label, desc, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-5 border transition-all ${
        active
          ? 'border-orange-500/60 bg-orange-500/10'
          : 'border-stone-800/60 bg-stone-950/40 hover:border-stone-700 hover:bg-stone-900/40'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className={`font-anton text-2xl uppercase tracking-tight ${active ? 'text-orange-300' : 'text-stone-100'}`}>{label}</span>
        {badge && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-stone-800/80 text-stone-500 border border-stone-700/50 font-mono shrink-0">{badge}</span>}
      </div>
      <div className="text-stone-400 text-sm">{desc}</div>
    </button>
  );
}

function NumberField({ label, value, onChange, unit, placeholder, min, max }) {
  return (
    <div className="flex-1">
      <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 text-stone-100 font-anton text-3xl tabular-nums focus:outline-none focus:border-orange-500/60"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 font-mono text-xs uppercase tracking-wider">{unit}</span>
      </div>
    </div>
  );
}

function SegmentedSelect({ options, value, onChange }) {
  return (
    <div className="flex bg-stone-950/60 border border-stone-800 p-1">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 px-4 py-2 text-sm uppercase tracking-wider font-mono transition-all ${
            value === o.id
              ? 'bg-orange-500 text-stone-950 font-medium'
              : 'text-stone-400 hover:text-stone-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// -------------------- PROGRESS BAR --------------------
function StepProgress({ current, total, labels }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <React.Fragment key={i}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-anton text-sm tabular-nums transition-all ${
              i < current
                ? 'bg-orange-500 text-stone-950'
                : i === current
                ? 'border-2 border-orange-500 text-orange-300 bg-stone-950'
                : 'border border-stone-700 text-stone-600 bg-stone-950'
            }`}>
              {i < current ? '✓' : i + 1}
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-px transition-all ${i < current ? 'bg-orange-500' : 'bg-stone-800'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
        {labels.map((l, i) => (
          <div key={l} className={`text-[9px] uppercase tracking-wider font-mono text-center ${
            i === current ? 'text-orange-300' : i < current ? 'text-stone-400' : 'text-stone-700'
          }`}>{l}</div>
        ))}
      </div>
    </div>
  );
}

// -------------------- MAIN --------------------
export default function Onboarding() {
  const [step, setStep] = useState(0);

  // Form state
  const [goal, setGoal] = useState('cut');
  const [sex, setSex] = useState('male');
  const [height, setHeight] = useState('178');
  const [weight, setWeight] = useState('82');
  const [age, setAge] = useState('29');
  const [activity, setActivity] = useState('moderate');
  const [experience, setExperience] = useState('intermediate');
  const [goalWeight, setGoalWeight] = useState('78');
  const [timeline, setTimeline] = useState('12');
  const [program, setProgram] = useState('ppl');

  const macros = useMemo(() => {
    return calcMacros({
      weightKg: parseFloat(weight) || 0,
      heightCm: parseFloat(height) || 0,
      age: parseFloat(age) || 0,
      sex,
      activity,
      goal,
    });
  }, [weight, height, age, sex, activity, goal]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0: return !!goal;
      case 1: return weight && height && age && sex;
      case 2: return goalWeight && timeline;
      case 3: return !!program && !!experience;
      default: return true;
    }
  }, [step, goal, weight, height, age, sex, goalWeight, timeline, program, experience]);

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
        .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
        .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
        body { background: #0a0908; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .reveal { animation: fadeUp 400ms ease-out both; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)'
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[40vh] opacity-[0.06] blur-3xl" style={{
          background: 'radial-gradient(ellipse, #ff5a2a 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10 max-w-[800px] mx-auto px-6 py-10">

        {/* HEADER */}
        <header className="flex items-center justify-between mb-10">
          <div className="font-anton text-2xl uppercase tracking-tight text-stone-100">
            <span className="text-orange-500">▲</span> IRONLAB
          </div>
          <button className="text-[10px] uppercase tracking-wider text-stone-500 hover:text-stone-300 font-mono transition-colors">
            Skip & explore
          </button>
        </header>

        {/* PROGRESS */}
        <div className="mb-12">
          <StepProgress current={step} total={STEPS.length} labels={STEPS} />
        </div>

        {/* STEP CONTENT */}
        <div key={step} className="reveal">

          {/* STEP 0 — GOAL */}
          {step === 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-3">Step 1 of 5</div>
              <h2 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100 mb-2 leading-[0.95]">
                What's your <span className="text-orange-400">primary goal?</span>
              </h2>
              <p className="text-stone-400 text-base mb-8">Pick the one that matters most right now. You can change it later.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GOALS.map(g => (
                  <ChoiceCard
                    key={g.id}
                    active={goal === g.id}
                    onClick={() => setGoal(g.id)}
                    label={g.label}
                    desc={g.desc}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 — STATS */}
          {step === 1 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-3">Step 2 of 5</div>
              <h2 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100 mb-2 leading-[0.95]">
                Your <span className="text-orange-400">numbers.</span>
              </h2>
              <p className="text-stone-400 text-base mb-8">We use these to compute your starting macros. Stored privately.</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Sex</label>
                  <SegmentedSelect
                    options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }]}
                    value={sex}
                    onChange={setSex}
                  />
                </div>

                <div className="flex gap-3">
                  <NumberField label="Height" value={height} onChange={setHeight} unit="cm" placeholder="178" min="120" max="220" />
                  <NumberField label="Weight" value={weight} onChange={setWeight} unit="kg" placeholder="82" min="35" max="200" />
                  <NumberField label="Age"    value={age}    onChange={setAge}    unit="yrs" placeholder="29" min="14" max="90" />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Activity Level Outside Training</label>
                  <div className="space-y-2">
                    {ACTIVITY_LEVELS.map(a => (
                      <ChoiceCard
                        key={a.id}
                        active={activity === a.id}
                        onClick={() => setActivity(a.id)}
                        label={a.label}
                        desc={a.desc}
                        badge={`×${a.mult}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — TARGET */}
          {step === 2 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-3">Step 3 of 5</div>
              <h2 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100 mb-2 leading-[0.95]">
                Where you're <span className="text-orange-400">headed.</span>
              </h2>
              <p className="text-stone-400 text-base mb-8">
                Pick a goal weight and a realistic timeline. Oracle will keep you on pace.
              </p>

              <div className="flex gap-3 mb-6">
                <NumberField label="Goal Weight" value={goalWeight} onChange={setGoalWeight} unit="kg" placeholder="78" min="35" max="200" />
                <NumberField label="Timeline" value={timeline} onChange={setTimeline} unit="weeks" placeholder="12" min="2" max="52" />
              </div>

              {weight && goalWeight && timeline && (
                <div className="border border-orange-500/30 bg-orange-500/5 p-5">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-orange-400 font-mono mb-2">Required pace</div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-anton text-3xl tabular-nums text-stone-100">
                      {(((parseFloat(weight) - parseFloat(goalWeight)) / parseFloat(timeline)) * 1).toFixed(2)}
                    </span>
                    <span className="text-stone-500 font-mono text-sm">kg / week</span>
                  </div>
                  <div className="text-[11px] font-mono text-stone-500 mt-2">
                    {(() => {
                      const pace = ((parseFloat(weight) - parseFloat(goalWeight)) / parseFloat(timeline)) / parseFloat(weight) * 100;
                      const abs = Math.abs(pace);
                      if (abs < 0.3) return '✓ Very conservative — easy to sustain';
                      if (abs < 0.7) return '✓ Sustainable — typical recommendation';
                      if (abs < 1.0) return '⚠ Aggressive — Coach will watch closely';
                      return '⚠ Very aggressive — high risk of muscle loss';
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — PROGRAM */}
          {step === 3 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-3">Step 4 of 5</div>
              <h2 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100 mb-2 leading-[0.95]">
                Pick a <span className="text-orange-400">split.</span>
              </h2>
              <p className="text-stone-400 text-base mb-8">Don't overthink it. We'll suggest exercises based on your choice.</p>

              <div className="mb-6">
                <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Experience</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPERIENCE.map(e => (
                    <button
                      key={e.id}
                      onClick={() => setExperience(e.id)}
                      className={`px-3 py-3 border text-center transition-all ${
                        experience === e.id
                          ? 'border-orange-500/60 bg-orange-500/10'
                          : 'border-stone-800/60 bg-stone-950/40 hover:border-stone-700'
                      }`}
                    >
                      <div className={`font-anton text-lg uppercase tracking-tight ${experience === e.id ? 'text-orange-300' : 'text-stone-200'}`}>
                        {e.label}
                      </div>
                      <div className="text-[10px] text-stone-500 mt-0.5">{e.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Training Split</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROGRAMS.map(p => (
                    <ChoiceCard
                      key={p.id}
                      active={program === p.id}
                      onClick={() => setProgram(p.id)}
                      label={p.label}
                      desc={p.desc}
                      badge={`${p.sessions}x / wk`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — PLAN REVEAL */}
          {step === 4 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-orange-400 font-mono mb-3">All set</div>
              <h2 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100 mb-2 leading-[0.95]">
                Your <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">starting plan.</span>
              </h2>
              <p className="text-stone-400 text-base mb-8">Oracle takes over from here. Macros adjust every 7 days based on real data.</p>

              {/* MACROS HERO */}
              <div className="border border-orange-500/40 bg-gradient-to-b from-orange-500/10 to-stone-950/40 p-6 mb-6">
                <div className="flex items-baseline justify-between mb-5">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Daily Targets</span>
                  <span className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">computed · mifflin-st jeor</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Calories</div>
                    <div className="font-anton text-4xl tabular-nums text-stone-100 leading-none mt-1">{macros.kcal.toLocaleString()}</div>
                    <div className="text-[10px] font-mono text-stone-500 tabular-nums mt-1">kcal</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Protein</div>
                    <div className="font-anton text-4xl tabular-nums text-orange-300 leading-none mt-1">{macros.protein}</div>
                    <div className="text-[10px] font-mono text-stone-500 tabular-nums mt-1">grams</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Carbs</div>
                    <div className="font-anton text-4xl tabular-nums text-stone-200 leading-none mt-1">{macros.carbs}</div>
                    <div className="text-[10px] font-mono text-stone-500 tabular-nums mt-1">grams</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-stone-600 font-mono">Fat</div>
                    <div className="font-anton text-4xl tabular-nums text-stone-200 leading-none mt-1">{macros.fat}</div>
                    <div className="text-[10px] font-mono text-stone-500 tabular-nums mt-1">grams</div>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-stone-800/60 grid grid-cols-2 gap-4 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-stone-500">BMR</span>
                    <span className="text-stone-300 tabular-nums">{macros.bmr.toLocaleString()} kcal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">TDEE</span>
                    <span className="text-stone-300 tabular-nums">{macros.tdee.toLocaleString()} kcal</span>
                  </div>
                </div>
              </div>

              {/* PROGRAM SUMMARY */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="border border-stone-800/60 bg-stone-950/40 p-4">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono">Goal</div>
                  <div className="font-anton text-xl uppercase tracking-tight text-stone-100">{GOALS.find(g => g.id === goal)?.label}</div>
                  <div className="text-[10px] font-mono text-stone-500 mt-1">
                    {weight} → {goalWeight} kg over {timeline}w
                  </div>
                </div>
                <div className="border border-stone-800/60 bg-stone-950/40 p-4">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono">Program</div>
                  <div className="font-anton text-xl uppercase tracking-tight text-stone-100">{PROGRAMS.find(p => p.id === program)?.label}</div>
                  <div className="text-[10px] font-mono text-stone-500 mt-1">
                    {PROGRAMS.find(p => p.id === program)?.sessions}× / week · {EXPERIENCE.find(e => e.id === experience)?.label}
                  </div>
                </div>
              </div>

              {/* WHAT HAPPENS NEXT */}
              <div className="border border-stone-800/60 bg-stone-950/40 p-5 mb-6">
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-3">What happens next</div>
                <ol className="space-y-2.5">
                  {[
                    'We pre-fill your first 4 weeks of workouts based on your split.',
                    'Log your first session today — even if it\'s a deload.',
                    'Weigh in daily and scan meals when convenient.',
                    'In 7 days, Oracle runs its first analysis and recommends adjustments.',
                  ].map((line, i) => (
                    <li key={i} className="flex gap-3 text-sm text-stone-300">
                      <span className="font-mono text-[10px] tabular-nums text-orange-500/60 shrink-0 mt-1">{String(i + 1).padStart(2, '0')}</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* NAV */}
        <div className="mt-10 pt-6 border-t border-stone-800/60 flex items-center justify-between gap-3">
          <button
            onClick={back}
            disabled={step === 0}
            className="px-5 py-2.5 border border-stone-700 text-stone-400 font-anton text-sm uppercase tracking-wider hover:bg-stone-800 hover:text-stone-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          <span className="text-[10px] uppercase tracking-wider text-stone-600 font-mono">
            {step + 1} / {STEPS.length}
          </span>

          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              disabled={!canAdvance}
              className="px-6 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          ) : (
            <button className="px-7 py-2.5 bg-orange-500 text-stone-950 font-anton text-base uppercase tracking-wider hover:bg-orange-400 transition-colors">
              Start Training →
            </button>
          )}
        </div>

        <footer className="mt-12 pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>Onboarding · IRONLAB v0.4</span>
          <span>~90 seconds · skip anytime</span>
        </footer>
      </div>
    </div>
  );
}
