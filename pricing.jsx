import React, { useState } from 'react';

/* =========================================================================
 * PRICING — Three-tier subscription page
 * Basic (free) · Pro ($9.99) · Elite ($19.99)
 *
 * Production notes:
 *   - Stripe Checkout integration: each "Upgrade" button calls
 *     edge function `create-checkout-session` with the priceId and
 *     redirects to hosted Stripe page.
 *   - On webhook `checkout.session.completed`, Supabase function updates
 *     profiles.subscription_tier and stripe_customer_id atomically.
 *   - RevenueCat handles iOS/Android once mobile ships — same priceId
 *     mapping, different platform.
 * ========================================================================= */

// -------------------- TIERS --------------------
const TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Get the fundamentals',
    priceMonthly: 0,
    priceAnnual: 0,
    accent: { from: '#94a3b8', to: '#475569' },
    cta: 'Start free',
    ctaStyle: 'outline',
    features: [
      'Unlimited workout logging',
      'Manual nutrition tracking',
      '30 free exercises in library',
      '30-day history retention',
      'Weight & basic stats',
      'Community support',
    ],
    notIncluded: [
      'Vision-API meal scanning',
      'Coach Engine recommendations',
      'Progress photos',
      'Advanced analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For serious lifters',
    priceMonthly: 9.99,
    priceAnnual: 7.99, // billed annually
    accent: { from: '#fbbf24', to: '#ed7a2a' },
    cta: 'Start 14-day free trial',
    ctaStyle: 'primary',
    popular: true,
    features: [
      'Everything in Basic, plus:',
      'AI vision-scan for meals (unlimited)',
      'Coach Engine — weekly macro recommendations',
      'Biometric Vault with progress photos',
      'Full exercise library (100+ exercises)',
      'Unlimited history & data export',
      'Progressive overload tracking',
      'Body composition analytics',
    ],
    notIncluded: [
      'AI form-check video reviews',
      '1:1 expert coaching call',
      'Custom programming',
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    tagline: 'Coaching-grade insight',
    priceMonthly: 19.99,
    priceAnnual: 15.99,
    accent: { from: '#ed7a2a', to: '#7a2410' },
    cta: 'Apply for Elite',
    ctaStyle: 'outline',
    features: [
      'Everything in Pro, plus:',
      'AI form-check video reviews (unlimited)',
      'Custom programming based on your data',
      'Real-time Coach Engine adjustments',
      'Monthly 30-min call with a strength coach',
      'Priority support (4hr response)',
      'Advanced analytics & exports',
      'Early access to new modules',
    ],
    notIncluded: [],
  },
];

// -------------------- COMPARISON TABLE --------------------
const COMPARISON = [
  {
    section: 'Logging & Tracking',
    rows: [
      { feature: 'Workout logging',         basic: 'Unlimited',  pro: 'Unlimited',  elite: 'Unlimited' },
      { feature: 'Manual nutrition logging', basic: '✓',         pro: '✓',          elite: '✓' },
      { feature: 'AI vision meal scan',     basic: '—',           pro: 'Unlimited',  elite: 'Priority parsing' },
      { feature: 'Weight tracking',         basic: '✓',           pro: '✓',          elite: '✓' },
      { feature: 'Progress photos',         basic: '—',           pro: '✓',          elite: '✓' },
      { feature: 'Body composition est.',   basic: 'Basic',       pro: 'Advanced',   elite: 'Coach-validated' },
    ],
  },
  {
    section: 'AI Coaching',
    rows: [
      { feature: 'Coach Engine analysis',     basic: '—',         pro: 'Weekly',      elite: 'Real-time' },
      { feature: 'Macro recommendations',     basic: '—',         pro: '✓',           elite: '✓' },
      { feature: 'Volume regression alerts',  basic: '—',         pro: '✓',           elite: '✓' },
      { feature: 'AI form-check video',       basic: '—',         pro: '—',           elite: 'Unlimited' },
      { feature: 'Custom programming',        basic: '—',         pro: '—',           elite: '✓' },
      { feature: 'Human coach call',          basic: '—',         pro: '—',           elite: '30 min / mo' },
    ],
  },
  {
    section: 'Library & Content',
    rows: [
      { feature: 'Free exercises',          basic: '30',          pro: '100+',        elite: '100+' },
      { feature: 'Form cues',               basic: 'Basic',       pro: 'Detailed',    elite: 'Detailed' },
      { feature: 'Video demonstrations',    basic: '—',           pro: '✓',           elite: '✓' },
      { feature: 'Movement variations',     basic: 'Limited',     pro: '✓',           elite: '✓' },
    ],
  },
  {
    section: 'Data & Export',
    rows: [
      { feature: 'History retention',       basic: '30 days',     pro: 'Unlimited',   elite: 'Unlimited' },
      { feature: 'CSV export',              basic: '—',           pro: '✓',           elite: '✓' },
      { feature: 'Apple Health sync',       basic: '—',           pro: '✓',           elite: '✓' },
      { feature: 'API access',              basic: '—',           pro: '—',           elite: '✓' },
    ],
  },
  {
    section: 'Support',
    rows: [
      { feature: 'Community forum',         basic: '✓',           pro: '✓',           elite: '✓' },
      { feature: 'Email support',           basic: '—',           pro: '24hr',        elite: '4hr priority' },
      { feature: 'Direct line to founders', basic: '—',           pro: '—',           elite: '✓' },
    ],
  },
];

// -------------------- FAQ --------------------
const FAQ = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your account page in two clicks. Your subscription remains active until the end of the current billing period — no proration headaches, no retention calls.',
  },
  {
    q: 'What happens to my data if I downgrade?',
    a: 'Nothing is deleted. If you drop from Pro to Basic, your historical data stays accessible in read-only mode. Pro features (vision scan, Coach Engine) stop generating new outputs, but everything already logged remains visible.',
  },
  {
    q: 'Is the 14-day Pro trial really free?',
    a: 'Yes. No charge until day 15. We email you on day 12 as a heads-up. You can cancel mid-trial and keep using Basic indefinitely.',
  },
  {
    q: 'How does Elite coaching work?',
    a: 'Elite is application-only — we cap it at 100 members per coach to maintain quality. After applying, a coach reviews your training data, schedules a 30-minute intro call, and builds a custom program. Monthly calls keep it on track.',
  },
  {
    q: 'Why is the vision-API meal scan a Pro feature?',
    a: 'Each scan costs us roughly $0.008 in third-party API fees. Free unlimited scans would burn margin in a month. Pro covers the cost and funds ongoing model improvements.',
  },
  {
    q: 'Do you offer student or military discounts?',
    a: 'Yes — 30% off Pro for verified students, military, and first responders. Email support@IRONLAB.app with proof to activate.',
  },
];

// -------------------- TIER CARD --------------------
function TierCard({ tier, billing, onSelect }) {
  const price = billing === 'annual' ? tier.priceAnnual : tier.priceMonthly;
  const isFree = price === 0;
  const popular = tier.popular;

  return (
    <div
      className={`relative flex flex-col p-6 border transition-all ${
        popular
          ? 'border-orange-500/60 bg-gradient-to-b from-orange-500/10 via-stone-950/40 to-stone-950/40 lg:scale-[1.02] z-10'
          : 'border-stone-800/60 bg-stone-950/40 hover:border-stone-700'
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-orange-500 text-stone-950 text-[10px] uppercase tracking-[0.2em] font-mono font-bold whitespace-nowrap">
          Most Popular
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className={`font-anton text-3xl uppercase tracking-tight bg-gradient-to-br bg-clip-text text-transparent`} style={{ backgroundImage: `linear-gradient(135deg, ${tier.accent.from}, ${tier.accent.to})` }}>
          {tier.name}
        </div>
        <div className="text-[11px] uppercase tracking-wider text-stone-500 font-mono mt-1">
          {tier.tagline}
        </div>
      </div>

      {/* Price */}
      <div className="mb-5 pb-5 border-b border-stone-800/60">
        {isFree ? (
          <div className="flex items-baseline gap-2">
            <span className="font-anton text-5xl tabular-nums text-stone-100">Free</span>
            <span className="text-[11px] uppercase tracking-wider text-stone-500 font-mono">forever</span>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-anton text-5xl tabular-nums text-stone-100">${price.toFixed(2)}</span>
              <span className="text-[11px] uppercase tracking-wider text-stone-500 font-mono">/ mo</span>
            </div>
            {billing === 'annual' && (
              <div className="text-[10px] font-mono uppercase tracking-wider text-orange-300 mt-1">
                Billed annually · save ${((tier.priceMonthly - tier.priceAnnual) * 12).toFixed(0)}/yr
              </div>
            )}
            {billing === 'monthly' && (
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-600 mt-1">
                Billed monthly · cancel anytime
              </div>
            )}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="flex-1 mb-6">
        <ul className="space-y-2.5">
          {tier.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-stone-300">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#ed7a2a" strokeWidth="2" className="shrink-0 mt-1">
                <path d="M2.5 7L6 10.5L11.5 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className={f.endsWith(':') ? 'text-stone-500 text-[11px] uppercase tracking-wider font-mono' : ''}>
                {f}
              </span>
            </li>
          ))}
        </ul>
        {tier.notIncluded.length > 0 && (
          <ul className="space-y-2 mt-4 pt-4 border-t border-stone-800/40">
            {tier.notIncluded.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-stone-600">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 mt-1">
                  <line x1="3" y1="7" x2="11" y2="7" strokeLinecap="round" />
                </svg>
                <span className="line-through opacity-60">{f}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={() => onSelect(tier.id)}
        className={`w-full px-5 py-3 font-anton text-base uppercase tracking-wider transition-all ${
          tier.ctaStyle === 'primary'
            ? 'bg-orange-500 text-stone-950 hover:bg-orange-400'
            : 'border border-stone-700 text-stone-300 hover:bg-stone-800 hover:text-stone-100'
        }`}
      >
        {tier.cta}
      </button>
    </div>
  );
}

// -------------------- COMPARISON TABLE --------------------
function ComparisonTable() {
  const cell = (v) => {
    if (v === '✓') return <span className="text-orange-400 text-base">✓</span>;
    if (v === '—') return <span className="text-stone-700">—</span>;
    return <span className="text-stone-300 text-[11px] tabular-nums">{v}</span>;
  };

  return (
    <div className="border border-stone-800/60 bg-stone-950/40 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-stone-800/60 bg-stone-950/60">
        <div className="col-span-6 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Feature</div>
        <div className="col-span-2 text-center font-anton text-base uppercase tracking-tight text-stone-400">Basic</div>
        <div className="col-span-2 text-center font-anton text-base uppercase tracking-tight bg-gradient-to-br from-amber-300 to-orange-500 bg-clip-text text-transparent">Pro</div>
        <div className="col-span-2 text-center font-anton text-base uppercase tracking-tight bg-gradient-to-br from-orange-300 to-red-500 bg-clip-text text-transparent">Elite</div>
      </div>

      {/* Sections */}
      {COMPARISON.map((section, si) => (
        <div key={si}>
          <div className="px-5 py-2 bg-stone-900/40 border-b border-stone-800/40">
            <span className="text-[10px] uppercase tracking-[0.2em] text-orange-400 font-mono">
              {section.section}
            </span>
          </div>
          {section.rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-stone-800/40 last:border-b-0 hover:bg-stone-900/20 transition-colors">
              <div className="col-span-6 text-sm text-stone-300">{row.feature}</div>
              <div className="col-span-2 text-center font-mono">{cell(row.basic)}</div>
              <div className="col-span-2 text-center font-mono">{cell(row.pro)}</div>
              <div className="col-span-2 text-center font-mono">{cell(row.elite)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// -------------------- FAQ ITEM --------------------
function FAQItem({ q, a, open, onToggle }) {
  return (
    <div className="border-b border-stone-800/60">
      <button
        onClick={onToggle}
        className="w-full text-left py-4 flex items-center justify-between gap-4 group"
      >
        <span className="font-anton text-lg uppercase tracking-tight text-stone-100 group-hover:text-orange-300 transition-colors">
          {q}
        </span>
        <span className={`text-orange-400 font-mono text-xl transition-transform ${open ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      {open && (
        <div className="pb-4 pr-8 text-stone-400 text-sm leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

// -------------------- MAIN --------------------
export default function Pricing() {
  const [billing, setBilling] = useState('annual');
  const [openFAQ, setOpenFAQ] = useState(0);
  const [selected, setSelected] = useState(null);

  const handleSelect = (tierId) => {
    setSelected(tierId);
    setTimeout(() => setSelected(null), 1800);
  };

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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[50vh] opacity-[0.07] blur-3xl" style={{
          background: 'radial-gradient(ellipse, #ff5a2a 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-12">

        {/* HERO */}
        <header className="text-center mb-12">
          <div className="inline-block text-[10px] uppercase tracking-[0.3em] text-orange-400 font-mono px-3 py-1 bg-orange-500/10 border border-orange-500/30 mb-6">
            Pricing
          </div>
          <h1 className="font-anton text-5xl md:text-7xl uppercase tracking-tight leading-[0.95] text-stone-100 max-w-3xl mx-auto mb-4">
            Train smarter.<br />
            <span className="bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Pay for what works.</span>
          </h1>
          <p className="text-stone-400 text-lg max-w-2xl mx-auto">
            Free forever for the basics. Pro unlocks the AI tools that actually move the needle. Elite is for athletes who want a coach in the loop.
          </p>
        </header>

        {/* BILLING TOGGLE */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-stone-950/60 border border-stone-800 p-1">
            {['monthly', 'annual'].map(b => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={`px-5 py-2 text-xs uppercase tracking-wider font-mono transition-all ${
                  billing === b
                    ? 'bg-orange-500 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {b}
                {b === 'annual' && (
                  <span className={`ml-2 text-[9px] tabular-nums ${billing === 'annual' ? 'text-stone-950/70' : 'text-orange-400'}`}>
                    save 20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* TIER CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {TIERS.map(t => (
            <TierCard key={t.id} tier={t} billing={billing} onSelect={handleSelect} />
          ))}
        </div>

        {/* SELECTION TOAST */}
        {selected && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-950 border border-orange-500/60 px-5 py-3 backdrop-blur-sm shadow-2xl">
            <div className="text-[10px] uppercase tracking-wider text-orange-400 font-mono">→ stripe checkout</div>
            <div className="font-anton text-lg uppercase tracking-tight text-stone-100">
              Redirecting to {TIERS.find(t => t.id === selected)?.name} signup…
            </div>
          </div>
        )}

        {/* TRUST BAR */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { num: '14d', label: 'Free Pro trial' },
            { num: '0', label: 'Setup fees' },
            { num: '2-click', label: 'Cancel' },
            { num: '30%', label: 'Student discount' },
          ].map(t => (
            <div key={t.label}>
              <div className="font-anton text-2xl text-orange-300 tabular-nums">{t.num}</div>
              <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        {/* COMPARISON */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100 mb-3">
              Compare every feature
            </h2>
            <p className="text-stone-500 text-sm">Side-by-side breakdown across all tiers</p>
          </div>
          <ComparisonTable />
        </div>

        {/* FAQ */}
        <div className="mb-16 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100 mb-3">
              Questions
            </h2>
            <p className="text-stone-500 text-sm">No surprises, no fine-print games</p>
          </div>
          <div>
            {FAQ.map((item, i) => (
              <FAQItem
                key={i}
                q={item.q}
                a={item.a}
                open={openFAQ === i}
                onToggle={() => setOpenFAQ(openFAQ === i ? -1 : i)}
              />
            ))}
          </div>
        </div>

        {/* FINAL CTA */}
        <div className="border border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-stone-950/40 p-10 text-center">
          <h2 className="font-anton text-4xl md:text-5xl uppercase tracking-tight text-stone-100 mb-3">
            Ready to start?
          </h2>
          <p className="text-stone-400 mb-6 max-w-md mx-auto">
            Try Pro free for 14 days. No card required for Basic. Cancel anytime in two clicks.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => handleSelect('pro')}
              className="px-7 py-3 bg-orange-500 text-stone-950 font-anton text-base uppercase tracking-wider hover:bg-orange-400 transition-colors"
            >
              Start free Pro trial →
            </button>
            <button
              onClick={() => handleSelect('basic')}
              className="px-7 py-3 border border-stone-700 text-stone-300 font-anton text-base uppercase tracking-wider hover:bg-stone-800 hover:text-stone-100 transition-colors"
            >
              Continue with Basic
            </button>
          </div>
        </div>

        <footer className="mt-16 pt-6 border-t border-stone-800/60 flex flex-wrap items-center justify-between gap-4 text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>IRONLAB v0.4 · Pricing</span>
          <span>Stripe · RevenueCat · TaxJar · SOC 2 in progress</span>
          <span>All prices USD · taxes calculated at checkout</span>
        </footer>
      </div>
    </div>
  );
}
