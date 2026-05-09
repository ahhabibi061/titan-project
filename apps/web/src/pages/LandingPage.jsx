import React, { useState, useEffect } from 'react';

/* =========================================================================
 * MARKETING LANDING PAGE
 * Public-facing sales surface. Lives at IRONLAB.app (root).
 * Goal: convert cold traffic to free signup or Pro trial.
 * Story arc: hook → proof → mechanism → social proof → vs competitors
 *            → pricing teaser → final CTA.
 *
 * Production notes:
 *   - Static-rendered via Next.js or Astro for SEO + speed.
 *   - Above-the-fold under 80KB compressed.
 *   - Conversion tracked via Plausible (privacy-first analytics).
 * ========================================================================= */

// -------------------- LIVE METRICS (faked counters) --------------------
function useLiveCounter(start, increment, intervalMs = 4000) {
  const [val, setVal] = useState(start);
  useEffect(() => {
    const timer = setInterval(() => setVal(v => v + increment), intervalMs);
    return () => clearInterval(timer);
  }, []);
  return val;
}

// -------------------- HERO MINI MOCKUP --------------------
// Stylized "phone screen" showing a snippet of the dashboard
function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent blur-3xl scale-110 -z-10" />

      {/* Phone frame */}
      <div className="relative mx-auto w-[280px] h-[560px] bg-stone-950 border border-stone-700 rounded-[2.5rem] p-3 shadow-2xl">
        {/* Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-stone-950 rounded-b-2xl border-x border-b border-stone-800 z-10" />

        {/* Screen */}
        <div className="w-full h-full bg-[#0a0908] rounded-[2rem] overflow-hidden relative">
          {/* Status bar */}
          <div className="absolute top-2 left-4 right-4 flex items-center justify-between text-[9px] font-mono text-stone-500 z-10">
            <span className="tabular-nums">9:41</span>
            <span className="flex items-center gap-1">
              <span>●●●●</span>
              <span>5G</span>
            </span>
          </div>

          {/* Content */}
          <div className="pt-10 px-4">
            <div className="text-[8px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-1">May 8 · Cut · Wk 5</div>
            <div className="font-anton text-xl uppercase tracking-tight text-stone-100 mb-4 leading-tight">
              Morning,<br/>
              <span className="text-orange-400">Marcus.</span>
            </div>

            {/* Coach alert */}
            <div className="border border-orange-500/40 bg-orange-500/10 p-2.5 mb-3">
              <div className="text-[7px] uppercase tracking-wider text-orange-400 font-mono">New from Coach</div>
              <div className="font-anton text-sm uppercase tracking-tight text-stone-100">+100 kcal</div>
              <div className="text-[8px] text-stone-500">Cut too aggressive</div>
            </div>

            {/* Today's workout card */}
            <div className="border border-stone-800 bg-stone-950/40 p-3 mb-3">
              <div className="text-[7px] uppercase tracking-wider text-stone-600 font-mono">Today</div>
              <div className="font-anton text-base uppercase tracking-tight text-stone-100">Push Day</div>
              <div className="text-[8px] font-mono text-stone-500">5 ex · 65 min</div>
            </div>

            {/* Macros mini */}
            <div className="border border-stone-800 bg-stone-950/40 p-3">
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 60 60" className="w-12 h-12 -rotate-90">
                  <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                  <circle cx="30" cy="30" r="24" fill="none" stroke="#ed7a2a" strokeWidth="4" strokeDasharray="90 150" strokeLinecap="round" />
                </svg>
                <div>
                  <div className="font-anton text-base text-stone-100 leading-none tabular-nums">1,310</div>
                  <div className="text-[7px] uppercase tracking-wider text-stone-500 font-mono">/2,200 kcal</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-stone-800 bg-stone-950/80 backdrop-blur-sm py-2 flex justify-around">
            {['◯','◐','▣','◇','▲'].map((s, i) => (
              <span key={i} className={`text-xs ${i === 0 ? 'text-orange-400' : 'text-stone-600'}`}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------- PILLAR CARD --------------------
function PillarCard({ num, title, body, accent }) {
  return (
    <div className="relative border border-stone-800/60 bg-stone-950/40 p-6 group hover:border-orange-500/40 transition-all">
      <div className="text-[9px] uppercase tracking-[0.3em] text-stone-600 font-mono mb-3">{num}</div>
      <h3 className={`font-anton text-3xl uppercase tracking-tight mb-3 bg-gradient-to-br bg-clip-text text-transparent`} style={{ backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}>
        {title}
      </h3>
      <p className="text-stone-400 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

// -------------------- MODULE TILE --------------------
function ModuleTile({ name, sub, desc, accent, icon }) {
  return (
    <div className="border border-stone-800/60 bg-stone-950/40 p-5 group hover:border-orange-500/40 transition-all flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-stone-600 font-mono">{sub}</div>
          <div className={`font-anton text-2xl uppercase tracking-tight bg-gradient-to-br bg-clip-text text-transparent`} style={{ backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}>
            {name}
          </div>
        </div>
        <div className="text-stone-700 group-hover:text-orange-400 transition-colors">{icon}</div>
      </div>
      <p className="text-stone-500 text-[13px] leading-relaxed flex-1">{desc}</p>
    </div>
  );
}

// -------------------- TESTIMONIAL --------------------
function Testimonial({ quote, name, role, initials }) {
  return (
    <div className="border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col">
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none" className="text-orange-500/60 mb-4">
        <path d="M0 12c0-6 4-10 10-10v4c-3 0-6 2-6 6h6v8H0v-8zm14 0c0-6 4-10 10-10v4c-3 0-6 2-6 6h6v8h-10v-8z" fill="currentColor"/>
      </svg>
      <p className="text-stone-300 text-base leading-relaxed flex-1 mb-4">"{quote}"</p>
      <div className="flex items-center gap-3 pt-4 border-t border-stone-800/60">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-anton text-stone-950 text-sm">
          {initials}
        </div>
        <div>
          <div className="font-anton text-sm uppercase tracking-tight text-stone-100">{name}</div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">{role}</div>
        </div>
      </div>
    </div>
  );
}

// -------------------- COMPARISON ROW --------------------
function ComparisonRow({ feature, IRONLAB, mfp, strong, trainer, last }) {
  const cell = (v) => {
    if (v === true) return <span className="text-orange-400 text-base">✓</span>;
    if (v === false) return <span className="text-stone-700">—</span>;
    return <span className="text-stone-400 text-[11px] font-mono tabular-nums">{v}</span>;
  };
  return (
    <div className={`grid grid-cols-12 gap-4 px-5 py-3 ${last ? '' : 'border-b border-stone-800/40'} hover:bg-stone-900/20 transition-colors`}>
      <div className="col-span-4 text-sm text-stone-300">{feature}</div>
      <div className="col-span-2 text-center">{cell(IRONLAB)}</div>
      <div className="col-span-2 text-center">{cell(mfp)}</div>
      <div className="col-span-2 text-center">{cell(strong)}</div>
      <div className="col-span-2 text-center">{cell(trainer)}</div>
    </div>
  );
}

// -------------------- MAIN --------------------
export default function Landing() {
  const usersTrained = useLiveCounter(12847, 1);
  const mealsScanned = useLiveCounter(3426891, 7);
  const setsLogged   = useLiveCounter(8419264, 12);

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap');
        .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
        .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
        body { background: #0a0908; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .float { animation: float 6s ease-in-out infinite; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)'
        }} />
      </div>

      {/* TOP NAV */}
      <nav className="relative z-30 border-b border-stone-800/60 backdrop-blur-sm sticky top-0 bg-stone-950/60">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-anton text-2xl uppercase tracking-tight text-stone-100">
            <span className="text-orange-500">▲</span> IRONLAB
          </div>
          <div className="hidden md:flex items-center gap-6 text-[11px] uppercase tracking-wider font-mono text-stone-500">
            <a href="#how"      className="hover:text-orange-300 transition-colors">How it works</a>
            <a href="#modules"  className="hover:text-orange-300 transition-colors">Modules</a>
            <a href="#pricing"  className="hover:text-orange-300 transition-colors">Pricing</a>
            <a href="#faq"      className="hover:text-orange-300 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden md:inline-block px-3 py-2 text-[11px] uppercase tracking-wider font-mono text-stone-400 hover:text-stone-100 transition-colors">
              Sign in
            </button>
            <button className="px-4 py-2 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors">
              Start free
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100vw] h-[60vh] opacity-[0.12] blur-3xl" style={{
          background: 'radial-gradient(ellipse at top, #ff5a2a 0%, transparent 60%)'
        }} />

        <div className="relative max-w-[1280px] mx-auto px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <div className="inline-block text-[10px] uppercase tracking-[0.3em] text-orange-400 font-mono px-3 py-1 bg-orange-500/10 border border-orange-500/30 mb-6">
              ● The serious lifter's stack
            </div>

            <h1 className="font-anton text-6xl md:text-7xl lg:text-8xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-6">
              Train like an<br />
              athlete. Eat like a<br />
              <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">scientist.</span>
            </h1>

            <p className="text-stone-400 text-lg md:text-xl max-w-xl leading-relaxed mb-8">
              IRONLAB is a fitness app built around the math that actually drives results — progressive overload, regression analysis, and an AI Coach that adjusts your macros every week based on how your body is actually responding.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10">
              <button className="px-7 py-3.5 bg-orange-500 text-stone-950 font-anton text-base uppercase tracking-wider hover:bg-orange-400 transition-colors">
                Start free →
              </button>
              <button className="px-7 py-3.5 border border-stone-700 text-stone-300 font-anton text-base uppercase tracking-wider hover:bg-stone-800 hover:text-stone-100 transition-colors">
                See it in action
              </button>
            </div>

            {/* Live counters */}
            <div className="grid grid-cols-3 gap-4 max-w-lg">
              {[
                { n: usersTrained.toLocaleString(), l: 'Athletes training' },
                { n: setsLogged.toLocaleString(), l: 'Sets logged' },
                { n: mealsScanned.toLocaleString(), l: 'Meals scanned' },
              ].map(s => (
                <div key={s.l} className="border-l border-stone-800/60 pl-4">
                  <div className="font-anton text-2xl tabular-nums text-stone-100 leading-none">{s.n}</div>
                  <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-1.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="float">
              <HeroMockup />
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM STATEMENT */}
      <section className="relative border-y border-stone-800/60 bg-stone-950/40">
        <div className="max-w-[1080px] mx-auto px-6 py-16 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500 font-mono mb-4">The problem</div>
          <h2 className="font-anton text-4xl md:text-5xl uppercase tracking-tight leading-[0.95] text-stone-100 max-w-3xl mx-auto">
            Most fitness apps are <span className="text-stone-500 line-through">food diaries</span>.
            <br />
            IRONLAB is a <span className="text-orange-400">feedback loop</span>.
          </h2>
          <p className="text-stone-400 text-base mt-6 max-w-2xl mx-auto leading-relaxed">
            Logging is table stakes. Real progress comes from a system that analyzes the data, spots when your cut is too aggressive or your bench is regressing, and adjusts the plan before you stall out.
          </p>
        </div>
      </section>

      {/* PILLARS */}
      <section id="how" className="relative">
        <div className="max-w-[1280px] mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <div className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-mono mb-3">How it works</div>
            <h2 className="font-anton text-5xl md:text-6xl uppercase tracking-tight text-stone-100 leading-[0.95]">
              Three steps. One feedback loop.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <PillarCard
              num="01"
              title="Track"
              accent={{ from: '#fbbf24', to: '#ed7a2a' }}
              body="Log workouts in a single tap, scan meals with your camera, capture progress photos. Friction-free input is the only way you'll actually do this every day."
            />
            <PillarCard
              num="02"
              title="Analyze"
              accent={{ from: '#ed7a2a', to: '#7a2410' }}
              body="Linear regression on weight, volume tracking per muscle group, body composition trends. The math runs every time you log — no waiting, no manual spreadsheets."
            />
            <PillarCard
              num="03"
              title="Adapt"
              accent={{ from: '#fbbf24', to: '#7a2410' }}
              body="The Coach Engine reviews your last 14 days every Sunday and adjusts your macros. Cutting too fast? Add 100 kcal. Volume regressing? Schedule a deload. No static plans."
            />
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="relative border-t border-stone-800/60 bg-stone-950/40">
        <div className="max-w-[1280px] mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <div className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-mono mb-3">The stack</div>
            <h2 className="font-anton text-5xl md:text-6xl uppercase tracking-tight text-stone-100 leading-[0.95]">
              Five modules.<br />
              One unified athlete.
            </h2>
            <p className="text-stone-400 text-base mt-6 max-w-2xl mx-auto">
              Each module is sharp on its own. Together, they share data — and that's where the magic is. Your training stress, nutrition intake, and body composition all feed the Coach Engine.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleTile
              name="Vision" sub="Module 1 · Nutrition"
              accent={{ from: '#fbbf24', to: '#ed7a2a' }}
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M8 6l1-2h6l1 2"/></svg>}
              desc="Point your camera at any meal. The vision model identifies food, estimates portion, returns macros — all in 1.4 seconds."
            />
            <ModuleTile
              name="Library" sub="Module 2 · Exercises"
              accent={{ from: '#94a3b8', to: '#475569' }}
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>}
              desc="100+ curated exercises with form cues, video demos, and split tagging. PPL, Upper/Lower, Bro split — filter for whatever program you run."
            />
            <ModuleTile
              name="IRONLAB" sub="Module 3 · Logger"
              accent={{ from: '#ed7a2a', to: '#7a2410' }}
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12h4M18 12h4M4 8v8M20 8v8M7 6h10v12H7z"/></svg>}
              desc="Excel-grade workout grid with progressive-overload tracking, live muscle volume heatmap, and PR detection on every set."
            />
            <ModuleTile
              name="Vault" sub="Module 4 · Biometric"
              accent={{ from: '#ed7a2a', to: '#fbbf24' }}
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 17l5-5 4 4 8-8M21 8v6M21 8h-6"/></svg>}
              desc="90-day weight timeline with linear regression projection, body comp split, and a private photo timeline encrypted at rest."
            />
            <ModuleTile
              name="Coach" sub="Module 5 · Engine"
              accent={{ from: '#ff5a2a', to: '#7a2410' }}
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
              desc="Reads from every other module. Deterministic rule-gate makes the call, AI explains the reasoning. Macros adjust weekly, automatically."
            />
            <div className="border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-stone-950/40 p-5 flex flex-col justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-orange-400 font-mono">All five</div>
                <div className="font-anton text-2xl uppercase tracking-tight text-stone-100">Together →</div>
              </div>
              <p className="text-stone-400 text-[13px] leading-relaxed mt-3">
                Cross-module data is the moat. No competitor can replicate weeks of integrated training, nutrition, and biometric history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative">
        <div className="max-w-[1280px] mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <div className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-mono mb-3">Word from the trenches</div>
            <h2 className="font-anton text-5xl md:text-6xl uppercase tracking-tight text-stone-100 leading-[0.95]">
              Built by lifters,<br />
              used by athletes.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Testimonial
              quote="I've been lifting for 12 years. The Coach Engine caught my cut was too aggressive a week before I would have noticed myself. Saved me from another stalled cut."
              name="Marcus T."
              role="Powerlifter · 220 club"
              initials="MT"
            />
            <Testimonial
              quote="Vision scan is borderline magic. Logged a curry I would have skipped because it was too annoying to break down. Macros came back in under 2 seconds."
              name="Aisha K."
              role="CrossFit athlete · L1 coach"
              initials="AK"
            />
            <Testimonial
              quote="Finally an app that treats lifting like a real engineering problem. The volume regression alerts caught my OHP plateau three weeks early."
              name="Diego R."
              role="Bodybuilder · NPC competitor"
              initials="DR"
            />
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="relative border-y border-stone-800/60 bg-stone-950/40">
        <div className="max-w-[1280px] mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <div className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-mono mb-3">Why IRONLAB</div>
            <h2 className="font-anton text-5xl md:text-6xl uppercase tracking-tight text-stone-100 leading-[0.95]">
              vs. everything else
            </h2>
          </div>

          <div className="border border-stone-800/60 bg-stone-950/60 overflow-hidden max-w-4xl mx-auto">
            <div className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-stone-800/60 bg-stone-950/80">
              <div className="col-span-4 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Feature</div>
              <div className="col-span-2 text-center font-anton text-base uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">IRONLAB</div>
              <div className="col-span-2 text-center text-[11px] uppercase tracking-wider text-stone-500 font-mono">MyFitnessPal</div>
              <div className="col-span-2 text-center text-[11px] uppercase tracking-wider text-stone-500 font-mono">Strong</div>
              <div className="col-span-2 text-center text-[11px] uppercase tracking-wider text-stone-500 font-mono">PT in person</div>
            </div>
            <ComparisonRow feature="Workout logging"          IRONLAB={true}            mfp={false}             strong={true}             trainer={true} />
            <ComparisonRow feature="Nutrition tracking"       IRONLAB={true}            mfp={true}              strong={false}            trainer={true} />
            <ComparisonRow feature="AI vision meal scan"      IRONLAB={true}            mfp={false}             strong={false}            trainer={false} />
            <ComparisonRow feature="Auto macro adjustments"   IRONLAB={true}            mfp={false}             strong={false}            trainer={true} />
            <ComparisonRow feature="Volume regression alerts" IRONLAB={true}            mfp={false}             strong={false}            trainer="Sometimes" />
            <ComparisonRow feature="Body comp + photos"       IRONLAB={true}            mfp={false}             strong={false}            trainer={true} />
            <ComparisonRow feature="Goal projection math"     IRONLAB={true}            mfp={false}             strong={false}            trainer="Manual" />
            <ComparisonRow feature="Cost / month"             IRONLAB="$9.99"           mfp="$19.99"            strong="$4.99"            trainer="$200+"  last />
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section id="pricing" className="relative">
        <div className="max-w-[1080px] mx-auto px-6 py-20 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-mono mb-3">Pricing</div>
          <h2 className="font-anton text-5xl md:text-6xl uppercase tracking-tight text-stone-100 leading-[0.95] mb-4">
            Free to start.<br />
            <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">$9.99 to get serious.</span>
          </h2>
          <p className="text-stone-400 text-base max-w-xl mx-auto mb-10">
            No credit card for Basic. 14-day free Pro trial — cancel in two clicks if it's not for you.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-10">
            {[
              { name: 'Basic',  price: 'Free',     sub: 'forever',                  feat: 'Manual logging · 30 exercises · 30d history' },
              { name: 'Pro',    price: '$9.99',    sub: '/ month',                  feat: 'Vision scan · Coach Engine · full library', popular: true },
              { name: 'Elite',  price: '$19.99',   sub: '/ month',                  feat: 'Pro + AI form check · custom programming · monthly call' },
            ].map(p => (
              <div key={p.name} className={`border p-5 ${p.popular ? 'border-orange-500/60 bg-orange-500/5' : 'border-stone-800/60 bg-stone-950/40'}`}>
                <div className="font-anton text-2xl uppercase tracking-tight text-stone-100">{p.name}</div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-anton text-3xl tabular-nums text-orange-300">{p.price}</span>
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">{p.sub}</span>
                </div>
                <div className="text-[11px] text-stone-500 leading-relaxed">{p.feat}</div>
              </div>
            ))}
          </div>

          <button className="px-7 py-3.5 bg-orange-500 text-stone-950 font-anton text-base uppercase tracking-wider hover:bg-orange-400 transition-colors">
            See full pricing →
          </button>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative border-t border-stone-800/60 bg-gradient-to-b from-stone-950/40 to-orange-500/5">
        <div className="max-w-[900px] mx-auto px-6 py-24 text-center">
          <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight text-stone-100 leading-[0.95] mb-6">
            Stop guessing.<br />
            <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Start adapting.</span>
          </h2>
          <p className="text-stone-400 text-lg max-w-xl mx-auto mb-8">
            Your training deserves a system that actually pays attention.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button className="px-8 py-4 bg-orange-500 text-stone-950 font-anton text-lg uppercase tracking-wider hover:bg-orange-400 transition-colors">
              Start free →
            </button>
            <button className="px-8 py-4 border border-stone-700 text-stone-300 font-anton text-lg uppercase tracking-wider hover:bg-stone-800 hover:text-stone-100 transition-colors">
              See pricing
            </button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-[10px] uppercase tracking-wider text-stone-600 font-mono">
            <span>● No card required</span>
            <span>● 14d free Pro</span>
            <span>● Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-stone-800/60 bg-stone-950">
        <div className="max-w-[1280px] mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2">
              <div className="font-anton text-2xl uppercase tracking-tight text-stone-100 mb-3">
                <span className="text-orange-500">▲</span> IRONLAB
              </div>
              <p className="text-stone-500 text-sm max-w-sm leading-relaxed">
                A serious fitness app for serious athletes. Built in public.
              </p>
            </div>
            {[
              { title: 'Product', links: ['Modules', 'Pricing', 'Roadmap', 'Changelog'] },
              { title: 'Company', links: ['About', 'Manifesto', 'Press', 'Contact'] },
              { title: 'Legal',   links: ['Privacy', 'Terms', 'Security', 'DPA'] },
            ].map(c => (
              <div key={c.title}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-3">{c.title}</div>
                <ul className="space-y-2">
                  {c.links.map(l => (
                    <li key={l}><a href="#" className="text-sm text-stone-400 hover:text-orange-300 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-6 border-t border-stone-800/60 flex flex-wrap items-center justify-between gap-4 text-[10px] uppercase tracking-wider text-stone-600 font-mono">
            <span>© 2026 IRONLAB Labs · All rights reserved</span>
            <span>Made for athletes · Built for the long haul</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
