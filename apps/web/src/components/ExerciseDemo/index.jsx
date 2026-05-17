import React, { useState, useEffect } from 'react';
import Model from 'react-body-highlighter';
import './ExerciseDemo.css';
import { EXERCISE_DEMOS, NO_ANIMATION_IDS } from './exercises';

// ── Main export ───────────────────────────────────────────────────────────────
export default function ExerciseDemo({ exerciseId }) {
  const demo = EXERCISE_DEMOS[exerciseId];
  const [cueIndex, setCueIndex] = useState(0);
  const isAnimated = !NO_ANIMATION_IDS.has(exerciseId);

  useEffect(() => {
    if (!demo) return;
    const id = setInterval(
      () => setCueIndex(i => (i + 1) % demo.cues.length),
      4000,
    );
    return () => clearInterval(id);
  }, [demo]);

  if (!demo) return <DemoPlaceholder exerciseId={exerciseId} />;

  const modelData = [
    ...(demo.primaryMuscles.length
      ? [{ name: 'Primary', muscles: demo.primaryMuscles, frequency: 2 }]
      : []),
    ...(demo.secondaryMuscles.length
      ? [{ name: 'Secondary', muscles: demo.secondaryMuscles, frequency: 1 }]
      : []),
  ];

  return (
    <div className="flex flex-col bg-[#0a0908]">

      {isAnimated ? (
        /* ── Animated layout: GIF left, muscle map right ── */
        <div className="flex min-h-[300px]">

          {/* Left — exercise GIF */}
          <div className="flex-1 relative border-r border-stone-800/60 bg-[#0d0c0b] flex items-center justify-center overflow-hidden">
            <GifPanel exerciseId={exerciseId} name={demo.name} mechanics={demo.mechanics} />
          </div>

          {/* Right — muscle activation maps */}
          <div className="w-[196px] shrink-0 flex flex-col bg-[#0a0908] p-3 gap-3">
            <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-stone-600">
              Muscles Activated
            </p>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[7px] font-mono text-stone-700 uppercase tracking-widest">Front</span>
                <Model
                  data={modelData}
                  highlightedColors={['#fbbf2499', '#ed7a2a']}
                  bodyColor="#2a2420"
                  type="anterior"
                  svgStyle={{ width: '100%' }}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[7px] font-mono text-stone-700 uppercase tracking-widest">Back</span>
                <Model
                  data={modelData}
                  highlightedColors={['#fbbf2499', '#ed7a2a']}
                  bodyColor="#2a2420"
                  type="posterior"
                  svgStyle={{ width: '100%' }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <MuscleTags demo={demo} />
            <div className="border-t border-stone-800/60 pt-2">
              <p className="text-[7px] font-mono uppercase tracking-[0.18em] text-stone-600 mb-1">Joints</p>
              <div className="flex flex-wrap gap-1">
                {demo.joints.map(j => (
                  <span key={j} className="text-[7px] font-mono px-1.5 py-0.5 bg-stone-900 text-stone-500 border border-stone-800">
                    {j}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* ── Static layout: muscle maps full-width ── */
        <div className="flex flex-col items-center gap-4 px-5 pt-5 pb-4 bg-[#0a0908]">
          <div className="flex items-center justify-between w-full">
            <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-stone-600">
              Muscles Activated
            </p>
            <div className="flex flex-wrap gap-1 justify-end">
              {demo.joints.map(j => (
                <span key={j} className="text-[7px] font-mono px-1.5 py-0.5 bg-stone-900 text-stone-500 border border-stone-800">
                  {j}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-8 justify-center">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[7px] font-mono text-stone-700 uppercase tracking-widest">Front</span>
              <Model
                data={modelData}
                highlightedColors={['#fbbf2499', '#ed7a2a']}
                bodyColor="#2a2420"
                type="anterior"
                svgStyle={{ width: '100%' }}
                style={{ width: '120px' }}
              />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[7px] font-mono text-stone-700 uppercase tracking-widest">Back</span>
              <Model
                data={modelData}
                highlightedColors={['#fbbf2499', '#ed7a2a']}
                bodyColor="#2a2420"
                type="posterior"
                svgStyle={{ width: '100%' }}
                style={{ width: '120px' }}
              />
            </div>
          </div>
          <MuscleTags demo={demo} centered />
        </div>
      )}

      {/* ── Mechanics bar ── */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-stone-800/60 bg-stone-950/40">
        <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-orange-400/80">
          {demo.mechanics}
        </span>
        <span className="text-[8px] font-mono text-stone-600 uppercase tracking-wider">
          {demo.joints.join(' · ')}
        </span>
      </div>

      {/* ── Coaching cue ticker ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-stone-800/60">
        <button
          onClick={() => setCueIndex(i => (i - 1 + demo.cues.length) % demo.cues.length)}
          className="w-5 h-5 flex items-center justify-center text-stone-600 hover:text-stone-300 shrink-0 text-base leading-none"
        >
          ‹
        </button>
        <p
          key={cueIndex}
          className="flex-1 text-[10px] font-mono text-stone-300 text-center leading-snug"
          style={{ animation: 'cueFadeIn 0.3s ease-out' }}
        >
          {demo.cues[cueIndex]}
        </p>
        <div className="flex gap-0.5 shrink-0">
          {demo.cues.map((_, i) => (
            <button
              key={i}
              onClick={() => setCueIndex(i)}
              className={`w-1 h-1 rounded-full transition-colors ${
                i === cueIndex ? 'bg-orange-400' : 'bg-stone-700 hover:bg-stone-500'
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setCueIndex(i => (i + 1) % demo.cues.length)}
          className="w-5 h-5 flex items-center justify-center text-stone-600 hover:text-stone-300 shrink-0 text-base leading-none"
        >
          ›
        </button>
      </div>

    </div>
  );
}

// ── GIF animation panel ───────────────────────────────────────────────────────
function GifPanel({ exerciseId, name, mechanics }) {
  const [status, setStatus] = useState('loading'); // loading | loaded | missing

  const src = `/animations/exercises/${exerciseId}.gif`;

  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center bg-[#0d0c0b]">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border border-stone-700/50 border-t-orange-500/60 rounded-full animate-spin" />
        </div>
      )}
      {status === 'missing' && (
        <AnimationPlaceholder name={name} mechanics={mechanics} />
      )}
      <img
        src={src}
        alt={name}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('missing')}
        className="w-full h-full object-contain"
        style={{ display: status === 'loaded' ? 'block' : 'none', minHeight: '300px' }}
      />
    </div>
  );
}

// ── Muscle tag legend ─────────────────────────────────────────────────────────
function MuscleTags({ demo, centered = false }) {
  return (
    <div className={`flex flex-col gap-1 ${centered ? 'items-center w-full' : ''}`}>
      <div className={`flex flex-wrap gap-1 ${centered ? 'justify-center' : ''}`}>
        {[...new Set(demo.primaryMuscles)].map(fmt).map(n => (
          <span key={n} className="text-[7px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-orange-500/15 text-orange-300 border border-orange-500/25">
            {n}
          </span>
        ))}
        {[...new Set(demo.secondaryMuscles)].map(fmt).map(n => (
          <span key={n} className="text-[7px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-stone-800 text-stone-500 border border-stone-700/50">
            {n}
          </span>
        ))}
      </div>
      <div className={`flex items-center gap-3 text-[7px] font-mono text-stone-700 uppercase tracking-wider pt-0.5 ${centered ? 'justify-center' : ''}`}>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-orange-500/70 inline-block" />Primary
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-yellow-500/40 inline-block" />Secondary
        </span>
      </div>
    </div>
  );
}

// ── Placeholder for animated exercises not yet delivered ──────────────────────
function AnimationPlaceholder({ name, mechanics }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
      <div className="relative w-28 h-28 border border-dashed border-stone-700/50 flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(237,122,42,0.3) 50%, transparent 100%)',
            animation: 'shimmer 2.4s ease-in-out infinite',
          }}
        />
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="7" r="5" fill="none" stroke="#44403c" strokeWidth="1.5" />
          <line x1="24" y1="12" x2="24" y2="28" stroke="#44403c" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="18" x2="34" y2="18" stroke="#44403c" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="24" y1="28" x2="16" y2="42" stroke="#44403c" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="24" y1="28" x2="32" y2="42" stroke="#44403c" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M18 30 L30 36 L18 42 Z" fill="#ed7a2a" opacity="0.6" />
        </svg>
      </div>
      <div className="text-center space-y-1">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-stone-400">{name}</p>
        <p className="text-[9px] font-mono text-stone-600">{mechanics}</p>
      </div>
    </div>
  );
}

// ── Fallback for unknown exercise IDs ─────────────────────────────────────────
function DemoPlaceholder({ exerciseId }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center min-h-[280px]">
      <div className="w-12 h-12 border border-stone-700/60 border-dashed flex items-center justify-center text-stone-700 text-2xl">◎</div>
      <p className="text-[9px] font-mono uppercase tracking-wider text-stone-700">
        Demo not configured<br />
        <span className="opacity-50 normal-case">{exerciseId}</span>
      </p>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
