import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'titan_tutorial_v1';

const STEPS = [
  {
    id: 'welcome',
    emoji: '⚡',
    title: 'Welcome to Titan',
    body: 'Your all-in-one serious lifting platform. This 2-minute tour covers every module so you hit the ground running.',
    link: null,
  },
  {
    id: 'dashboard',
    emoji: '🎯',
    title: 'Dashboard — Command Centre',
    body: "Your daily hub. Today's macros, workout status, weight trend, and weekly adherence at a glance. Check in here every morning.",
    link: '/dashboard',
  },
  {
    id: 'forge',
    emoji: '🔨',
    title: 'Forge — Workout Logger',
    body: 'Log every set and rep. Forge tracks progressive overload, detects plateaus, and builds your full training history. Tap any exercise to see the animated demo from Codex.',
    link: '/logger',
  },
  {
    id: 'sentinel',
    emoji: '🛡',
    title: 'Sentinel — Nutrition',
    body: 'Log meals by barcode scan or manual search. Sentinel tracks macros and calories against your daily targets. Water tracker is at the bottom of the page.',
    link: '/nutrition',
  },
  {
    id: 'vault',
    emoji: '🔐',
    title: 'Vault — Biometrics',
    body: "Log your weight and body measurements daily. Vault builds a long-term body composition trend and projects when you'll reach your goal weight.",
    link: '/biometrics',
  },
  {
    id: 'codex',
    emoji: '📖',
    title: 'Codex — Exercise Library',
    body: 'Browse 500+ exercises with animated demos, primary and secondary muscle targets, and equipment filters. Every exercise in Forge links to its Codex entry.',
    link: '/exercises',
  },
  {
    id: 'oracle',
    emoji: '🧠',
    title: 'Oracle — AI Coach',
    body: 'Every week Oracle reads your weight trend, nutrition adherence, and training volume. A rule gate makes the decision — Claude explains the why. Ask Oracle anything in the chat tab using your real data.',
    link: '/coach',
  },
  {
    id: 'done',
    emoji: '✅',
    title: "You're Ready",
    body: 'Explore the app. Come back to Oracle when you want coaching insights. Hit Settings to customise macros, units, and reminders.',
    link: null,
  },
];

// Map step link paths to human-readable module names for the "Go to X →" label
const MODULE_LABELS = {
  '/dashboard': 'Dashboard',
  '/logger':    'Forge',
  '/nutrition': 'Sentinel',
  '/biometrics':'Vault',
  '/exercises': 'Codex',
  '/coach':     'Oracle',
};

export default function TutorialOverlay() {
  const [visible, setVisible] = useState(false);
  const [index, setIndex]     = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const step      = STEPS[index];
  const total     = STEPS.length;
  const isFirst   = index === 0;
  const isLast    = index === total - 1;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  function handleBack() {
    if (!isFirst) setIndex(i => i - 1);
  }

  function handleNext() {
    if (isLast) {
      dismiss();
    } else {
      setIndex(i => i + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-lg bg-[#0a0908] border border-stone-800 p-8">

        {/* Top row: dots + skip */}
        <div className="flex items-center justify-between mb-6">
          {/* Step indicator dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`block rounded-full transition-colors ${
                  i === index
                    ? 'w-2.5 h-2.5 bg-[#ed7a2a]'
                    : 'w-2 h-2 bg-stone-700'
                }`}
              />
            ))}
          </div>

          {/* Skip */}
          <button
            onClick={dismiss}
            className="text-stone-600 hover:text-stone-400 font-mono text-xs uppercase tracking-widest transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Emoji */}
        <div className="text-5xl text-center mb-4">{step.emoji}</div>

        {/* Title */}
        <h2 className="font-anton text-3xl uppercase tracking-tight text-stone-100 text-center mb-3">
          {step.title}
        </h2>

        {/* Body */}
        <p className="text-stone-400 text-sm leading-relaxed font-sans text-center mb-6">
          {step.body}
        </p>

        {/* Module link */}
        {step.link && (
          <div className="text-center mb-6">
            <Link
              to={step.link}
              onClick={dismiss}
              className="text-[#ed7a2a] hover:text-[#ff5a2a] text-sm font-mono uppercase tracking-widest transition-colors"
            >
              Go to {MODULE_LABELS[step.link]} →
            </Link>
          </div>
        )}

        {/* Bottom nav */}
        <div className="flex items-center justify-between">
          {/* Back */}
          {!isFirst ? (
            <button
              onClick={handleBack}
              className="text-stone-600 hover:text-stone-400 text-sm font-mono uppercase tracking-widest transition-colors"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}

          {/* Step count */}
          <span className="font-mono text-xs text-stone-700 tabular-nums">
            {index + 1} / {total}
          </span>

          {/* Next / Done */}
          <button
            onClick={handleNext}
            className="bg-[#ed7a2a] hover:bg-[#ff5a2a] text-stone-950 font-mono text-xs uppercase tracking-widest px-5 py-2.5 transition-colors font-semibold"
          >
            {isLast ? 'Done →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
