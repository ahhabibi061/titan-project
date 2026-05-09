import React, { useState, useEffect } from 'react';

/* =========================================================================
 * INVESTOR PITCH DECK — 12 navigable slides
 * Arrow keys to advance, on-screen controls, slide counter.
 * ========================================================================= */

function SlideShell({ children, label }) {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 flex flex-col px-10 py-12 md:px-16 md:py-16 max-w-[1200px] mx-auto w-full">
        {label && <div className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-mono mb-6">{label}</div>}
        {children}
      </div>
    </div>
  );
}

// 1. COVER
function SlideCover() {
  return (
    <SlideShell>
      <div className="flex-1 flex flex-col justify-center">
        <div className="font-anton text-3xl uppercase tracking-tight text-stone-100 mb-6">
          <span className="text-orange-500">▲</span> IRONLAB
        </div>
        <h1 className="font-anton text-7xl md:text-9xl uppercase tracking-tight leading-[0.88] text-stone-100 mb-8">
          Train like an<br />athlete. Eat like<br />a <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">scientist.</span>
        </h1>
        <span className="text-stone-400 text-base">A feedback-loop fitness app for serious athletes.</span>
      </div>
      <div className="flex items-end justify-between text-[11px] uppercase tracking-wider text-stone-600 font-mono">
        <span>Pitch Deck · Seed Round · 2026</span><span>IRONLAB.app</span>
      </div>
    </SlideShell>
  );
}

// 2. PROBLEM
function SlideProblem() {
  return (
    <SlideShell label="01 · The Problem">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-10">
        Most fitness apps are<br /><span className="text-stone-600 line-through">food diaries.</span><br />
        <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">None of them adapt.</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-auto">
        {[
          { stat: '73%', label: 'of users abandon fitness apps in the first 30 days' },
          { stat: '8%',  label: 'actually hit their stated body composition goal' },
          { stat: '$0',  label: 'value extracted from the data they collect' },
        ].map((s, i) => (
          <div key={i} className="border border-stone-800/60 bg-stone-950/40 p-6">
            <div className="font-anton text-5xl tabular-nums text-orange-300">{s.stat}</div>
            <div className="text-stone-400 text-sm mt-3">{s.label}</div>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

// 3. WHY NOW
function SlideWhyNow() {
  return (
    <SlideShell label="02 · Why Now">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-10">
        Three forces just<br /><span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">collided.</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1">
        {[
          { num: '01', title: 'Vision AI matured', body: 'Meal-image-to-macros went from research project to $0.008/scan in 18 months.' },
          { num: '02', title: 'LLMs ate explanation', body: 'GPT-class models now write Coach-quality narrative for fractions of a cent.' },
          { num: '03', title: 'Wearables hit ubiquity', body: '~60% of US athletes now wear a smartwatch daily.' },
        ].map(p => (
          <div key={p.num} className="border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col">
            <div className="text-[10px] uppercase tracking-[0.3em] text-stone-600 font-mono mb-3">{p.num}</div>
            <h3 className="font-anton text-2xl uppercase tracking-tight text-orange-300 mb-3">{p.title}</h3>
            <p className="text-stone-400 text-sm leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

// 4. SOLUTION
function SlideSolution() {
  return (
    <SlideShell label="03 · Solution">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-4">
        A <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">closed feedback loop</span>
      </h2>
      <p className="text-stone-400 text-lg max-w-2xl mb-12">
        IRONLAB turns daily logs into weekly intelligence. Five modules feed one Coach Engine that adapts the plan in real time.
      </p>
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-3 max-w-3xl w-full items-center">
          <div className="border border-orange-500/30 bg-orange-500/5 p-4 text-center">
            <div className="text-[9px] uppercase tracking-wider text-orange-400 font-mono">Input</div>
            <div className="font-anton text-lg uppercase tracking-tight text-stone-100">Vision · Logger · Vault</div>
            <div className="text-[10px] text-stone-500 mt-1">3 capture modules</div>
          </div>
          <div className="flex justify-center">
            <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
              <path d="M5 20 L70 20 M65 13 L72 20 L65 27" stroke="#ed7a2a" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="border-2 border-orange-500/60 bg-orange-500/10 p-4 text-center">
            <div className="text-[9px] uppercase tracking-wider text-orange-400 font-mono">Synthesis</div>
            <div className="font-anton text-lg uppercase tracking-tight text-stone-100">Coach Engine</div>
            <div className="text-[10px] text-stone-500 mt-1">deterministic + AI</div>
          </div>
        </div>
      </div>
      <div className="mt-auto pt-6 border-t border-stone-800/60 text-stone-500 text-sm max-w-3xl">
        <span className="text-orange-400">Critical detail:</span> the rule gate makes the decisions, AI only writes the explanation. Predictable, auditable, cheap to run at scale.
      </div>
    </SlideShell>
  );
}

// 5. PRODUCT
function SlideProduct() {
  const modules = [
    { num: '01', name: 'Vision', sub: 'Nutrition',  body: 'Camera-scan meal logging via vision AI. 1.4s response.', accent: 'from-amber-300 to-orange-500' },
    { num: '02', name: 'Library', sub: 'Exercises', body: '100+ curated exercises with form cues + video.',         accent: 'from-stone-300 to-stone-500' },
    { num: '03', name: 'IRONLAB',   sub: 'Logger',    body: 'Excel-grid workout logger with PR detection.',           accent: 'from-orange-300 to-orange-600' },
    { num: '04', name: 'Vault',   sub: 'Biometric', body: '90-day weight regression + private photo timeline.',     accent: 'from-orange-300 to-red-500' },
    { num: '05', name: 'Coach',   sub: 'Engine',    body: 'Weekly macro adjustments via rule gate + Claude.',       accent: 'from-orange-400 to-orange-700' },
  ];
  return (
    <SlideShell label="04 · Product">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-4">
        <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Five modules.</span><br />Built. Shipped. Working.
      </h2>
      <p className="text-stone-400 text-base mb-10 max-w-2xl">Web app live. Mobile (React Native) on track for Q3.</p>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 flex-1">
        {modules.map(m => (
          <div key={m.num} className="border border-stone-800/60 bg-stone-950/40 p-5 flex flex-col">
            <div className="text-[10px] uppercase tracking-[0.3em] text-stone-600 font-mono mb-3">{m.num}</div>
            <div className="text-[9px] uppercase tracking-wider text-stone-500 font-mono">{m.sub}</div>
            <div className={`font-anton text-2xl uppercase tracking-tight bg-gradient-to-br ${m.accent} bg-clip-text text-transparent`}>{m.name}</div>
            <p className="text-stone-400 text-[11px] leading-relaxed mt-3 flex-1">{m.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-stone-800/60 grid grid-cols-3 gap-6 text-[11px] font-mono">
        <div className="flex justify-between"><span className="text-stone-500">Tech stack</span><span className="text-stone-300">React · Supabase</span></div>
        <div className="flex justify-between"><span className="text-stone-500">Time to ship</span><span className="text-stone-300 tabular-nums">8 months</span></div>
        <div className="flex justify-between"><span className="text-stone-500">Burn to date</span><span className="text-stone-300 tabular-nums">$48k</span></div>
      </div>
    </SlideShell>
  );
}

// 6. MOAT
function SlideMoat() {
  return (
    <SlideShell label="05 · Defensibility">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-4">
        The moat is<br /><span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">cross-module data.</span>
      </h2>
      <p className="text-stone-400 text-lg max-w-2xl mb-12">Any competitor can clone a single module. None can clone the integration — because that requires the user's history.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        <div className="border border-stone-800/60 bg-stone-950/40 p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-3">What competitors offer</div>
          <ul className="space-y-3 text-stone-400 text-sm">
            {['Workout logging (Strong, Hevy)', 'Meal tracking (MyFitnessPal)', 'Photo progress (Macrofactor)', 'Pre-built programs (Caliber, Future)'].map((t,i) => (
              <li key={i} className="flex gap-3"><span className="text-stone-700">·</span> {t}</li>
            ))}
          </ul>
          <div className="mt-5 pt-4 border-t border-stone-800/60 text-stone-500 text-xs">All siloed. No competitor combines all four with cross-module synthesis.</div>
        </div>
        <div className="border border-orange-500/40 bg-gradient-to-b from-orange-500/10 to-stone-950/40 p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-orange-400 font-mono mb-3">What IRONLAB offers</div>
          <ul className="space-y-3 text-stone-200 text-sm">
            {['All four data streams in one schema', 'Coach Engine that synthesizes them', '60+ days of integrated history per user', 'Switching cost grows weekly'].map((t,i) => (
              <li key={i} className="flex gap-3"><span className="text-orange-400">→</span> {t}</li>
            ))}
          </ul>
          <div className="mt-5 pt-4 border-t border-orange-500/30 text-orange-300 text-xs font-mono">The longer they use it, the harder it is to leave.</div>
        </div>
      </div>
    </SlideShell>
  );
}

// 7. BUSINESS MODEL
function SlideBusinessModel() {
  return (
    <SlideShell label="06 · Business Model">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-12">
        Three tiers.<br /><span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Margin compounds.</span>
      </h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { name: 'Basic', price: 'Free', sub: 'forever', role: 'Acquisition' },
          { name: 'Pro', price: '$9.99', sub: '/ month', role: 'Core revenue', popular: true },
          { name: 'Elite', price: '$19.99', sub: '/ month', role: 'High-margin' },
        ].map(t => (
          <div key={t.name} className={`border p-5 ${t.popular ? 'border-orange-500/60 bg-orange-500/10' : 'border-stone-800/60 bg-stone-950/40'}`}>
            <div className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-mono">{t.role}</div>
            <div className="font-anton text-2xl uppercase tracking-tight text-stone-100">{t.name}</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-anton text-3xl tabular-nums text-orange-300">{t.price}</span>
              <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">{t.sub}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-stone-800/60 bg-stone-950/40 mb-6">
        {[
          { l: 'Gross margin', v: '~92%', accent: true },
          { l: 'Avg revenue / user', v: '$11.20' },
          { l: 'Target CAC', v: '$28' },
          { l: 'LTV / CAC', v: '5.4×', accent: true },
        ].map((s, i) => (
          <div key={i} className="px-5 py-4 border-r border-stone-800/60 last:border-r-0">
            <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono">{s.l}</div>
            <div className={`font-anton text-3xl tabular-nums mt-1 ${s.accent ? 'text-orange-300' : 'text-stone-100'}`}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto text-stone-500 text-sm max-w-3xl">
        <span className="text-orange-400">Cost gating:</span> the expensive APIs (vision + Claude) are Pro-only. Basic users cost effectively zero — they're acquisition surface.
      </div>
    </SlideShell>
  );
}

// 8. MARKET
function SlideMarket() {
  return (
    <SlideShell label="07 · Market">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-12">
        Big & growing.<br /><span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Underserved at the top.</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1">
        {[
          { tier: 'TAM', val: '$31', unit: 'B', sub: 'Global fitness app market', body: 'Saturated at the bottom (free trackers), wide-open at the prosumer top.', accent: false },
          { tier: 'SAM', val: '$4.2', unit: 'B', sub: 'Serious-lifter segment', body: 'Adults training 3+ days/week. ~42M in NA + EU. Median WTP: $15/mo.', accent: false },
          { tier: 'SOM (5yr)', val: '$120', unit: 'M ARR', sub: '~1M paid users', body: 'Realistic 5-year capture. ~2.4% of SAM. Conservative path to $1B+ outcome.', accent: true },
        ].map((m, i) => (
          <div key={i} className={`border p-6 ${m.accent ? 'border-orange-500/40 bg-gradient-to-b from-orange-500/10 to-stone-950/40' : 'border-stone-800/60 bg-stone-950/40'}`}>
            <div className={`text-[10px] uppercase tracking-[0.3em] font-mono mb-2 ${m.accent ? 'text-orange-400' : 'text-stone-500'}`}>{m.tier}</div>
            <div className={`font-anton text-5xl tabular-nums leading-none ${m.accent ? 'text-orange-300' : 'text-stone-100'}`}>{m.val}<span className="text-stone-500 text-2xl ml-1">{m.unit}</span></div>
            <div className="text-[11px] text-stone-500 font-mono mt-1">{m.sub}</div>
            <p className={`text-sm mt-4 leading-relaxed ${m.accent ? 'text-stone-300' : 'text-stone-400'}`}>{m.body}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

// 9. TRACTION
function SlideTraction() {
  const stats = [
    { v: '12.8', u: 'K', l: 'Beta users' },
    { v: '4.2', u: 'K', l: 'Paid users (33%)', accent: true },
    { v: '$47', u: 'K', l: 'MRR', accent: true },
    { v: '11', u: '%', l: 'MoM growth' },
  ];
  return (
    <SlideShell label="08 · Traction">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-12">
        Eight months.<br /><span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Hand-built. Profitable unit.</span>
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-stone-800/60 bg-stone-950/40 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="px-5 py-5 border-r border-stone-800/60 last:border-r-0">
            <div className={`font-anton text-4xl tabular-nums leading-none ${s.accent ? 'text-orange-300' : 'text-stone-100'}`}>{s.v}<span className="text-stone-500 text-base ml-1">{s.u}</span></div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mt-2">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
        {[
          { l: 'Retention', v: '68%', body: 'D30 retention on Pro. ~3× the industry baseline.' },
          { l: 'Engagement', v: '5.4', body: 'Avg sessions per active day. Daily-driver category.' },
          { l: 'NPS', v: '72', body: 'Pro tier. Top quartile for SaaS.' },
        ].map((c,i) => (
          <div key={i} className="border border-stone-800/60 bg-stone-950/40 p-5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-2">{c.l}</div>
            <div className="font-anton text-3xl tabular-nums text-orange-300">{c.v}</div>
            <p className="text-stone-400 text-xs mt-2 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
      <p className="text-stone-500 text-xs mt-6 font-mono">All metrics are placeholder targets — replace with actuals before sending</p>
    </SlideShell>
  );
}

// 10. TEAM
function SlideTeam() {
  return (
    <SlideShell label="09 · Team">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-12">
        Founder-led.<br /><span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Athlete-built.</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <div className="border border-stone-800/60 bg-stone-950/40 p-6 flex gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-anton text-stone-950 text-3xl shrink-0">▲</div>
          <div>
            <div className="font-anton text-2xl uppercase tracking-tight text-stone-100">Founder</div>
            <div className="text-[10px] uppercase tracking-wider text-orange-400 font-mono mb-2">CEO · Product</div>
            <p className="text-stone-400 text-sm leading-relaxed">Lifelong athlete. Built IRONLAB after a decade of fighting fragmented fitness tools.</p>
          </div>
        </div>
        <div className="border border-stone-800/60 bg-stone-950/40 p-6 flex gap-4 opacity-60">
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-stone-700 flex items-center justify-center text-stone-600 text-2xl shrink-0">+</div>
          <div>
            <div className="font-anton text-2xl uppercase tracking-tight text-stone-400">Open</div>
            <div className="text-[10px] uppercase tracking-wider text-stone-600 font-mono mb-2">CTO / Lead Engineer</div>
            <p className="text-stone-500 text-sm leading-relaxed">First seed-round hire. React Native + ML systems experience.</p>
          </div>
        </div>
      </div>
      <div className="border border-stone-800/60 bg-stone-950/40 p-5 mt-auto">
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-3">Advisors</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-stone-300 font-medium">Sports Nutrition PhD</span> <span className="text-stone-500">· macro logic</span></div>
          <div><span className="text-stone-300 font-medium">CSCS Strength Coach</span> <span className="text-stone-500">· programming</span></div>
          <div><span className="text-stone-300 font-medium">Ex-Strava PM</span> <span className="text-stone-500">· consumer growth</span></div>
        </div>
      </div>
    </SlideShell>
  );
}

// 11. ASK
function SlideAsk() {
  return (
    <SlideShell label="10 · Ask">
      <h2 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.92] text-stone-100 mb-4">Raising</h2>
      <div className="font-anton text-7xl md:text-9xl tabular-nums leading-[0.85] mb-12">
        <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">$1.5M</span><span className="text-stone-100"> seed</span>
      </div>
      <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-6">
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-4">Use of capital · 18 months runway</div>
        <div className="space-y-3">
          {[
            { pct: 50, label: 'Engineering — mobile launch + 2 hires', color: '#ed7a2a' },
            { pct: 25, label: 'Growth — paid acquisition + content', color: '#fbbf24' },
            { pct: 15, label: 'Infra — vision/AI API spend at scale', color: '#7eb6ff' },
            { pct: 10, label: 'Reserve — opportunistic + buffer', color: '#94a3b8' },
          ].map(item => (
            <div key={item.label}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-stone-200">{item.label}</span>
                <span className="font-anton text-base tabular-nums text-stone-100">{item.pct}%</span>
              </div>
              <div className="h-1.5 bg-stone-900">
                <div className="h-full" style={{ width: `${item.pct}%`, background: item.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-stone-800/60 bg-stone-950/40 p-4">
          <div className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-mono">Milestone</div>
          <div className="font-anton text-base text-stone-100 mt-1">$1M ARR</div>
        </div>
        <div className="border border-stone-800/60 bg-stone-950/40 p-4">
          <div className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-mono">Mobile launch</div>
          <div className="font-anton text-base text-stone-100 mt-1">Q3 2026</div>
        </div>
        <div className="border border-orange-500/40 bg-orange-500/10 p-4">
          <div className="text-[9px] uppercase tracking-[0.2em] text-orange-400 font-mono">Series A target</div>
          <div className="font-anton text-base text-orange-300 mt-1">Q1 2028</div>
        </div>
      </div>
    </SlideShell>
  );
}

// 12. CLOSE
function SlideClose() {
  return (
    <SlideShell>
      <div className="flex-1 flex flex-col justify-center">
        <div className="font-anton text-2xl uppercase tracking-tight text-stone-100 mb-8">
          <span className="text-orange-500">▲</span> IRONLAB
        </div>
        <h2 className="font-anton text-7xl md:text-9xl uppercase tracking-tight leading-[0.88] text-stone-100 mb-8">
          Let's <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">build it.</span>
        </h2>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-stone-400">
          <div><div className="text-[10px] uppercase tracking-[0.18em] text-stone-600 font-mono">Email</div><div className="text-stone-200">founders@IRONLAB.app</div></div>
          <div><div className="text-[10px] uppercase tracking-[0.18em] text-stone-600 font-mono">Web</div><div className="text-stone-200">IRONLAB.app</div></div>
          <div><div className="text-[10px] uppercase tracking-[0.18em] text-stone-600 font-mono">Demo</div><div className="text-stone-200">IRONLAB.app/demo</div></div>
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-wider text-stone-600 font-mono">Confidential · 2026</div>
    </SlideShell>
  );
}

const SLIDES = [
  { component: SlideCover, title: 'Cover' },
  { component: SlideProblem, title: 'Problem' },
  { component: SlideWhyNow, title: 'Why Now' },
  { component: SlideSolution, title: 'Solution' },
  { component: SlideProduct, title: 'Product' },
  { component: SlideMoat, title: 'Moat' },
  { component: SlideBusinessModel, title: 'Business Model' },
  { component: SlideMarket, title: 'Market' },
  { component: SlideTraction, title: 'Traction' },
  { component: SlideTeam, title: 'Team' },
  { component: SlideAsk, title: 'Ask' },
  { component: SlideClose, title: 'Close' },
];

export default function PitchDeck() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setCurrent(c => Math.min(c + 1, SLIDES.length - 1));
      if (e.key === 'ArrowLeft') setCurrent(c => Math.max(c - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const Slide = SLIDES[current].component;

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased relative overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
        .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
        .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
        body { background: #0a0908; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .slide-in { animation: slideIn 350ms ease-out both; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] opacity-[0.06] blur-3xl" style={{ background: 'radial-gradient(ellipse, #ff5a2a 0%, transparent 60%)' }} />
      </div>

      <div className="relative w-full h-screen min-h-[640px]">
        <div key={current} className="slide-in absolute inset-0"><Slide /></div>
      </div>

      <div className="fixed top-0 left-0 right-0 z-30 px-6 py-4 flex items-center justify-between pointer-events-none">
        <div className="font-anton text-base uppercase tracking-tight text-stone-500">{SLIDES[current].title}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono">← → keys · {current + 1} / {SLIDES.length}</div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 h-0.5 bg-stone-900">
        <div className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500" style={{ width: `${((current + 1) / SLIDES.length) * 100}%` }} />
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-stone-950/80 backdrop-blur-sm border border-stone-800 px-4 py-2.5">
        <button onClick={() => setCurrent(c => Math.max(c - 1, 0))} disabled={current === 0} className="text-stone-400 hover:text-orange-300 disabled:opacity-30 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3L5 8L10 13" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="flex gap-1">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-orange-400 w-4' : 'bg-stone-700 hover:bg-stone-500'}`} />
          ))}
        </div>
        <button onClick={() => setCurrent(c => Math.min(c + 1, SLIDES.length - 1))} disabled={current === SLIDES.length - 1} className="text-stone-400 hover:text-orange-300 disabled:opacity-30 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3L11 8L6 13" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}
