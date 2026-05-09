import React, { useState, useMemo, useRef } from 'react';

/* =========================================================================
 * BIOMETRIC VAULT — Module 4 Proof-of-Concept
 * Demonstrates: 90-day weight timeline, linear regression trendline,
 *               7-day moving average, goal-date projection,
 *               body composition split, photo timeline scrubber.
 *
 * Production notes:
 *   - Data hydrates from Supabase `biometric_entries` table (RLS-gated).
 *   - Photos stored in private Storage bucket; signed URLs expire in 1h.
 *   - Body-fat estimates accept manual or BIA scale integrations later.
 * ========================================================================= */

// -------------------- DATA --------------------
const GOAL_WEIGHT = 80.0;
const START_DATE = new Date('2026-02-01');

// Deterministic noisy weight series — mimics real daily fluctuation
// (water, sodium, glycogen) overlaid on a steady cut trajectory.
function generateTimeline() {
  const days = 90;
  const startWeight = 88.2;
  const slope = -0.072; // kg/day → roughly -0.5kg/week
  const startBF = 22.0;
  const endBF = 18.6;
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(START_DATE);
    d.setDate(START_DATE.getDate() + i);
    // multi-frequency noise so the chart looks organic
    const noise =
      Math.sin(i * 0.71) * 0.45 +
      Math.sin(i * 1.37) * 0.28 +
      Math.sin(i * 2.13) * 0.18;
    const weekend = (d.getDay() === 0 || d.getDay() === 6) ? 0.25 : 0;
    const weight = +(startWeight + slope * i + noise + weekend).toFixed(1);
    const bf = +(startBF + (endBF - startBF) * (i / (days - 1)) + Math.sin(i * 0.5) * 0.15).toFixed(1);
    out.push({ idx: i, date: d, weight, bodyFat: bf });
  }
  return out;
}

const TIMELINE = generateTimeline();
// Photo capture cadence — every ~12 days
const PHOTO_INDICES = [0, 12, 24, 36, 48, 60, 72, 84, 89];

// -------------------- LOGIC --------------------
function linearRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

function movingAverage(values, window = 7) {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function projectGoalDate(data, goalWeight) {
  const reg = linearRegression(data.map(d => d.weight));
  const last = data[data.length - 1];
  if (reg.slope >= -0.005) return { unreachable: true };
  if (last.weight <= goalWeight) return { reached: true };
  const daysToGoal = (last.weight - goalWeight) / -reg.slope;
  const projected = new Date(last.date);
  projected.setDate(last.date.getDate() + Math.ceil(daysToGoal));
  return { date: projected, daysToGoal: Math.ceil(daysToGoal), slopePerWeek: reg.slope * 7 };
}

const fmt0 = (n) => Math.round(n).toLocaleString('en-US');
const fmt1 = (n) => n.toFixed(1);
const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDateLong = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// -------------------- WEIGHT CHART --------------------
function WeightChart({ data, goal }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const W = 920, H = 340;
  const pad = { t: 24, r: 28, b: 40, l: 52 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const weights = data.map(d => d.weight);
  const ma = useMemo(() => movingAverage(weights, 7), [data]);
  const reg = useMemo(() => linearRegression(weights), [data]);

  const minW = Math.min(...weights, goal) - 0.6;
  const maxW = Math.max(...weights) + 0.6;

  const x = (i) => pad.l + (i / (data.length - 1)) * innerW;
  const y = (w) => pad.t + ((maxW - w) / (maxW - minW)) * innerH;

  const rawPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)},${y(d.weight).toFixed(1)}`).join(' ');
  const maPath = ma.map((w, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)},${y(w).toFixed(1)}`).join(' ');
  const regPath = `M ${x(0).toFixed(1)},${y(reg.intercept).toFixed(1)} L ${x(data.length - 1).toFixed(1)},${y(reg.slope * (data.length - 1) + reg.intercept).toFixed(1)}`;
  const maFill = `${maPath} L ${x(data.length - 1).toFixed(1)},${(pad.t + innerH).toFixed(1)} L ${x(0).toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`;

  // Y axis ticks
  const yTicks = [];
  const tickStep = 2;
  const tickStart = Math.ceil(minW / tickStep) * tickStep;
  for (let v = tickStart; v <= maxW; v += tickStep) yTicks.push(v);

  // X axis ticks — first of each month
  const xTicks = data
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.getDate() <= 7 && data.findIndex(x => x.date.getMonth() === d.getMonth() && x.date.getDate() <= d.getDate()) >= 0)
    .filter((v, i, arr) => arr.findIndex(x => x.d.getMonth() === v.d.getMonth()) === i);

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (px < pad.l || px > pad.l + innerW) { setHover(null); return; }
    const ratio = (px - pad.l) / innerW;
    const idx = Math.round(ratio * (data.length - 1));
    setHover({ idx: Math.max(0, Math.min(data.length - 1, idx)) });
  };

  const hoverData = hover ? data[hover.idx] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: 'crosshair' }}
      >
        <defs>
          <linearGradient id="ma-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ed7a2a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ed7a2a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid + ticks */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + innerW} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.04)" />
            <text x={pad.l - 10} y={y(v) + 3} fontSize="10" fill="#666" textAnchor="end" fontFamily="JetBrains Mono">
              {v}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {xTicks.map(({ d, i }) => (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={pad.t + innerH} y2={pad.t + innerH + 4} stroke="rgba(255,255,255,0.1)" />
            <text x={x(i)} y={pad.t + innerH + 18} fontSize="9" fill="#666" textAnchor="middle" fontFamily="JetBrains Mono" letterSpacing="0.05em">
              {d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
            </text>
          </g>
        ))}

        {/* Goal reference line */}
        <line x1={pad.l} x2={pad.l + innerW} y1={y(goal)} y2={y(goal)} stroke="#7eb6ff" strokeDasharray="3 4" strokeWidth="1" opacity="0.6" />
        <text x={pad.l + innerW - 4} y={y(goal) - 4} fontSize="9" fill="#7eb6ff" textAnchor="end" fontFamily="JetBrains Mono" letterSpacing="0.08em">
          GOAL · {goal} KG
        </text>

        {/* MA fill */}
        <path d={maFill} fill="url(#ma-fill)" />

        {/* Raw daily points */}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.weight)} r="1.4" fill="#888" opacity="0.5" />
        ))}

        {/* MA line */}
        <path d={maPath} fill="none" stroke="#ed7a2a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* Regression line */}
        <path d={regPath} fill="none" stroke="#ff5a2a" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.85" />

        {/* Photo markers along x-axis */}
        {PHOTO_INDICES.map(idx => (
          <g key={idx}>
            <line x1={x(idx)} x2={x(idx)} y1={pad.t} y2={pad.t + innerH} stroke="rgba(237,122,42,0.14)" strokeWidth="1" />
            <circle cx={x(idx)} cy={pad.t - 6} r="3" fill="#ed7a2a" />
          </g>
        ))}

        {/* Hover crosshair */}
        {hoverData && (
          <g>
            <line x1={x(hover.idx)} x2={x(hover.idx)} y1={pad.t} y2={pad.t + innerH} stroke="#ed7a2a" strokeWidth="1" opacity="0.4" />
            <circle cx={x(hover.idx)} cy={y(hoverData.weight)} r="4" fill="#ff5a2a" stroke="#0a0908" strokeWidth="2" />
          </g>
        )}

        {/* Last point marker */}
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].weight)} r="4" fill="#ed7a2a" stroke="#0a0908" strokeWidth="2" />
      </svg>

      {/* Hover tooltip */}
      {hoverData && (
        <div
          className="absolute pointer-events-none bg-stone-950 border border-orange-500/40 px-3 py-2 backdrop-blur-sm text-[11px] font-mono"
          style={{
            left: `${(x(hover.idx) / W) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -8px) translateY(-100%)',
          }}
        >
          <div className="text-stone-500 uppercase tracking-wider text-[9px] mb-0.5">{fmtDateLong(hoverData.date)}</div>
          <div className="font-anton text-orange-300 text-lg tabular-nums leading-none">{fmt1(hoverData.weight)} <span className="text-stone-500 text-xs">kg</span></div>
          <div className="text-[10px] text-stone-500 tabular-nums mt-0.5">{fmt1(hoverData.bodyFat)}% body fat</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-3 pt-3 border-t border-stone-800/60">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-stone-500 opacity-50" />
          Daily weigh-in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-orange-400" />
          7-day moving avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-orange-500" style={{ borderTop: '1px dashed #ff5a2a' }} />
          Linear regression
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-blue-400" style={{ borderTop: '1px dashed #7eb6ff' }} />
          Goal weight
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          Photo logged
        </span>
      </div>
    </div>
  );
}

// -------------------- BODY COMP STACKED --------------------
function BodyComposition({ data }) {
  // Estimate lean and fat mass for first vs latest entry
  const first = data[0];
  const last = data[data.length - 1];
  const firstFat = first.weight * (first.bodyFat / 100);
  const firstLean = first.weight - firstFat;
  const lastFat = last.weight * (last.bodyFat / 100);
  const lastLean = last.weight - lastFat;
  const fatLost = firstFat - lastFat;
  const leanLost = firstLean - lastLean;
  const max = Math.max(first.weight, last.weight);

  const Bar = ({ lean, fat, total, label, date }) => (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">{label}</span>
        <span className="text-[10px] text-stone-600 font-mono">{date}</span>
      </div>
      <div className="flex h-7 w-full" style={{ width: `${(total / max) * 100}%` }}>
        <div
          className="bg-stone-400 flex items-center justify-end pr-2 text-[10px] font-mono tabular-nums text-stone-900 font-medium"
          style={{ width: `${(lean / total) * 100}%` }}
        >
          {fmt1(lean)} kg
        </div>
        <div
          className="bg-orange-500 flex items-center justify-end pr-2 text-[10px] font-mono tabular-nums text-stone-950 font-medium"
          style={{ width: `${(fat / total) * 100}%` }}
        >
          {fmt1(fat)} kg
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Bar lean={firstLean} fat={firstFat} total={first.weight} label="Cut start" date={fmtDate(first.date)} />
      <Bar lean={lastLean} fat={lastFat} total={last.weight} label="Today" date={fmtDate(last.date)} />

      <div className="pt-3 border-t border-stone-800/60 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-1">Fat lost</div>
          <div className="font-anton text-2xl text-orange-400 tabular-nums">−{fmt1(fatLost)}<span className="text-stone-500 text-base ml-1">kg</span></div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-1">Lean change</div>
          <div className={`font-anton text-2xl tabular-nums ${leanLost > 0.5 ? 'text-red-400' : 'text-stone-300'}`}>
            {leanLost > 0 ? '−' : '+'}{fmt1(Math.abs(leanLost))}<span className="text-stone-500 text-base ml-1">kg</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[9px] uppercase tracking-wider text-stone-600 font-mono">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-stone-400" />Lean</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-orange-500" />Fat</span>
      </div>
    </div>
  );
}

// -------------------- PHOTO SILHOUETTE --------------------
// Stylized body silhouettes — placeholders for actual user photos.
// Simplified anterior, lateral, posterior poses.
const SILHOUETTE_PATHS = {
  front: 'M 60,18 Q 50,18 47,28 Q 47,38 53,42 L 53,48 Q 38,52 32,68 L 28,98 Q 26,116 30,128 L 36,124 L 40,108 L 44,102 Q 44,140 42,170 L 40,228 L 38,250 L 50,250 L 52,228 L 56,180 L 60,180 L 64,228 L 66,250 L 78,250 L 76,228 L 74,170 Q 72,140 72,102 L 76,108 L 80,124 L 86,128 Q 90,116 88,98 L 84,68 Q 78,52 63,48 L 63,42 Q 69,38 69,28 Q 66,18 60,18 Z',
  side: 'M 60,18 Q 52,18 50,28 Q 50,40 58,44 L 58,52 Q 50,56 48,72 L 48,108 Q 50,114 56,114 L 60,128 Q 60,168 56,200 L 54,250 L 64,250 L 66,200 Q 68,168 68,128 L 70,112 L 76,108 Q 78,84 70,68 L 64,52 L 64,44 Q 70,40 70,28 Q 68,18 60,18 Z',
  back: 'M 60,18 Q 50,18 47,28 Q 47,38 53,42 L 53,48 Q 38,52 32,68 L 28,98 Q 26,116 30,128 L 36,124 L 40,108 L 44,102 Q 44,140 42,170 L 40,228 L 38,250 L 50,250 L 52,228 L 56,180 L 60,180 L 64,228 L 66,250 L 78,250 L 76,228 L 74,170 Q 72,140 72,102 L 76,108 L 80,124 L 86,128 Q 90,116 88,98 L 84,68 Q 78,52 63,48 L 63,42 Q 69,38 69,28 Q 66,18 60,18 Z',
};

function PhotoCard({ pose, entry, leaner = 0 }) {
  // Subtle scale: as body fat drops, silhouette gets very slightly narrower (visual cue).
  const scale = 1 - leaner * 0.04;
  return (
    <div className="border border-stone-800/60 bg-stone-950/40 p-3 flex flex-col">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-mono">{pose}</span>
        <span className="text-[9px] text-stone-700 font-mono tabular-nums">{fmtDate(entry.date)}</span>
      </div>
      <div className="flex-1 relative aspect-[3/5] bg-gradient-to-b from-stone-900/60 to-stone-950 overflow-hidden">
        <svg viewBox="0 0 120 268" className="w-full h-full">
          <defs>
            <linearGradient id={`silhouette-${pose}-${entry.idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a342e" />
              <stop offset="100%" stopColor="#1a1815" />
            </linearGradient>
          </defs>
          <g transform={`translate(60 130) scale(${scale}) translate(-60 -130)`}>
            <path d={SILHOUETTE_PATHS[pose.toLowerCase()]} fill={`url(#silhouette-${pose}-${entry.idx})`} stroke="rgba(237,122,42,0.2)" strokeWidth="0.5" />
          </g>
        </svg>
        <div className="absolute bottom-1.5 left-2 right-2 flex justify-between text-[9px] font-mono text-stone-500 tabular-nums">
          <span>{fmt1(entry.weight)} kg</span>
          <span>{fmt1(entry.bodyFat)}%</span>
        </div>
      </div>
    </div>
  );
}

// -------------------- PHOTO COMPARISON --------------------
function PhotoComparison({ start, current }) {
  const leanProgress = (start.bodyFat - current.bodyFat) / (start.bodyFat - 14); // 14% as theoretical floor
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Start</span>
          <span className="text-[10px] text-stone-600 font-mono">{fmtDateLong(start.date)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <PhotoCard pose="Front" entry={start} leaner={0} />
          <PhotoCard pose="Side" entry={start} leaner={0} />
          <PhotoCard pose="Back" entry={start} leaner={0} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-orange-400 font-mono">Current</span>
          <span className="text-[10px] text-stone-600 font-mono">{fmtDateLong(current.date)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <PhotoCard pose="Front" entry={current} leaner={leanProgress} />
          <PhotoCard pose="Side" entry={current} leaner={leanProgress} />
          <PhotoCard pose="Back" entry={current} leaner={leanProgress} />
        </div>
      </div>
    </div>
  );
}

// -------------------- PHOTO TIMELINE SCRUBBER --------------------
function PhotoTimeline({ photos, selectedIdx, onSelect }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">Photo Timeline · {photos.length} captures</span>
        <span className="text-[9px] text-stone-700 font-mono">tap a marker to compare</span>
      </div>
      <div className="relative h-12">
        {/* Track */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-stone-800" />
        {/* Markers */}
        {photos.map((p, i) => {
          const isSelected = i === selectedIdx;
          const left = (p.idx / 89) * 100;
          return (
            <button
              key={p.idx}
              onClick={() => onSelect(i)}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
              style={{ left: `${left}%` }}
            >
              <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                isSelected
                  ? 'bg-orange-500 border-orange-300 scale-150'
                  : 'bg-stone-900 border-stone-600 group-hover:border-orange-400 group-hover:scale-125'
              }`} />
              <div className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono tabular-nums ${
                isSelected ? 'text-orange-300' : 'text-stone-600 group-hover:text-stone-400'
              }`}>
                {fmtDate(p.date)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// -------------------- STAT BLOCK --------------------
function StatBlock({ label, value, sub, accent }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 border-r border-stone-800/60 last:border-r-0 first:pl-0">
      <span className="text-[10px] uppercase tracking-[0.18em] text-stone-500 font-medium">{label}</span>
      <span className={`text-3xl font-anton tracking-tight tabular-nums ${accent || 'text-stone-100'}`}>{value}</span>
      {sub && <span className="text-[11px] text-stone-500 tabular-nums">{sub}</span>}
    </div>
  );
}

// -------------------- MAIN --------------------
export default function BiometricVault() {
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(PHOTO_INDICES.length - 1);
  const photos = PHOTO_INDICES.map(idx => TIMELINE[idx]);
  const startEntry = photos[0];
  const currentPhoto = photos[selectedPhotoIdx];

  const projection = useMemo(() => projectGoalDate(TIMELINE, GOAL_WEIGHT), []);
  const last = TIMELINE[TIMELINE.length - 1];
  const first = TIMELINE[0];
  const totalChange = last.weight - first.weight;
  const last30 = TIMELINE.slice(-30);
  const change30 = last30[last30.length - 1].weight - last30[0].weight;
  const reg = linearRegression(TIMELINE.map(d => d.weight));
  const slopePerWeek = reg.slope * 7;

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
        <div className="absolute bottom-0 right-0 w-[60vw] h-[40vh] opacity-[0.06] blur-3xl" style={{
          background: 'radial-gradient(ellipse, #ff5a2a 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-8">

        {/* HEADER */}
        <header className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-stone-800/60">
          <div>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-anton text-5xl uppercase tracking-tight text-stone-100">Biometric</span>
              <span className="font-anton text-5xl uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Vault</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-stone-500">
              <span className="px-2 py-1 bg-orange-500/15 text-orange-300 border border-orange-500/30 uppercase tracking-wider">Cut</span>
              <span>90-day window</span>
              <span className="text-stone-700">·</span>
              <span>{TIMELINE.length} weigh-ins</span>
              <span className="text-stone-700">·</span>
              <span>{photos.length} photo sessions</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2.5 border border-stone-700 text-stone-400 font-anton text-sm uppercase tracking-wider hover:bg-stone-800 hover:text-stone-200 transition-colors">
              Export CSV
            </button>
            <button className="px-5 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors">
              + Log Today
            </button>
          </div>
        </header>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-8 border border-stone-800/60 bg-stone-950/40">
          <StatBlock
            label="Current Weight"
            value={fmt1(last.weight)}
            sub={`kg · ${fmt1(last.bodyFat)}% bf`}
            accent="text-orange-300"
          />
          <StatBlock
            label="Total Change"
            value={`${totalChange > 0 ? '+' : ''}${fmt1(totalChange)}`}
            sub={`since ${fmtDate(first.date)}`}
            accent={totalChange < 0 ? 'text-orange-300' : 'text-stone-300'}
          />
          <StatBlock
            label="30d Trend"
            value={`${change30 > 0 ? '+' : ''}${fmt1(change30)}`}
            sub={`${fmt1(Math.abs(slopePerWeek))} kg / wk`}
          />
          <StatBlock
            label="Goal ETA"
            value={projection.daysToGoal ? `${projection.daysToGoal}d` : '—'}
            sub={projection.date ? fmtDate(projection.date) : 'projection'}
            accent="text-orange-300"
          />
        </div>

        {/* HEADLINE PROJECTION */}
        {projection.date && (
          <div className="mb-10">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-2">Trajectory projection</div>
            <h1 className="font-anton text-4xl md:text-5xl uppercase tracking-tight leading-[0.95] text-stone-100 max-w-4xl">
              At your current rate, you'll hit <span className="text-orange-400">{GOAL_WEIGHT} kg</span> by{' '}
              <span className="text-orange-400">{fmtDateLong(projection.date)}</span>
              <span className="text-stone-600"> — about {projection.daysToGoal} days from today.</span>
            </h1>
          </div>
        )}

        {/* WEIGHT CHART */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-8">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Weight Timeline</h2>
            <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">interactive · hover for details</span>
          </div>
          <WeightChart data={TIMELINE} goal={GOAL_WEIGHT} />
        </div>

        {/* TWO-COL: BODY COMP + DERIVED METRICS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-7 border border-stone-800/60 bg-stone-950/40 p-6">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Body Composition</h2>
              <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">lean vs fat mass</span>
            </div>
            <BodyComposition data={TIMELINE} />
          </div>

          <div className="lg:col-span-5 border border-stone-800/60 bg-stone-950/40 p-6">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Derived</h2>
              <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">computed</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline pb-3 border-b border-stone-800/60">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Regression slope</span>
                <span className="font-anton text-xl text-orange-300 tabular-nums">{fmt1(slopePerWeek)} <span className="text-stone-500 text-xs">kg/wk</span></span>
              </div>
              <div className="flex justify-between items-baseline pb-3 border-b border-stone-800/60">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">% bw / wk</span>
                <span className="font-anton text-xl text-stone-200 tabular-nums">{fmt1((slopePerWeek / first.weight) * 100)}<span className="text-stone-500 text-xs">%</span></span>
              </div>
              <div className="flex justify-between items-baseline pb-3 border-b border-stone-800/60">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Avg deficit</span>
                <span className="font-anton text-xl text-stone-200 tabular-nums">~{fmt0(Math.abs(slopePerWeek) * 7700 / 7)}<span className="text-stone-500 text-xs"> kcal/d</span></span>
              </div>
              <div className="flex justify-between items-baseline pb-3 border-b border-stone-800/60">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Days remaining</span>
                <span className="font-anton text-xl text-orange-300 tabular-nums">{projection.daysToGoal}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Pace status</span>
                <span className={`font-anton text-xl tabular-nums ${Math.abs((slopePerWeek / first.weight) * 100) > 0.7 ? 'text-red-400' : 'text-orange-300'}`}>
                  {Math.abs((slopePerWeek / first.weight) * 100) > 0.7 ? 'AGGRESSIVE' : 'ON TARGET'}
                </span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-stone-800/60 text-[10px] font-mono text-stone-600 leading-relaxed">
              These metrics feed the Coach Engine every 7 days. Aggressive pace triggers macro adjustments; flat slope flags the cut as stalled.
            </div>
          </div>
        </div>

        {/* PHOTO TIMELINE */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-8">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Visual Progress</h2>
            <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">private · encrypted at rest</span>
          </div>
          <div className="mb-8">
            <PhotoTimeline photos={photos} selectedIdx={selectedPhotoIdx} onSelect={setSelectedPhotoIdx} />
          </div>
          <PhotoComparison start={startEntry} current={currentPhoto} />
        </div>

        <footer className="mt-12 pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>Biometric Vault v0.4 · Module 4 · Longitudinal tracking</span>
          <span>Regression: ordinary least squares · MA window 7d</span>
        </footer>
      </div>
    </div>
  );
}
