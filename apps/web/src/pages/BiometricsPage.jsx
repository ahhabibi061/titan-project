import React, { useState, useEffect, useMemo, useRef } from 'react';
import AppNav from '../components/AppNav';
import { CheckinModal } from '../components/CheckinModal';
import { useSession } from '../hooks/useSession';
import { useProfileStore } from '../store/useProfileStore';
import { useBiometricVault } from '../hooks/useBiometricVault';
import { useCheckin } from '../hooks/useCheckin';

const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
  .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
  .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
  .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
  body { background: #0a0908; }
`;

// -------------------- UNIT HELPERS --------------------
const KG_TO_LBS = 2.20462;
function toDisplay(kg, unit) {
  if (unit === 'lbs') return +(kg * KG_TO_LBS).toFixed(1);
  return kg;
}
function fromDisplay(val, unit) {
  if (unit === 'lbs') return +(Number(val) / KG_TO_LBS).toFixed(2);
  return Number(val);
}

// -------------------- MATH --------------------
function linearRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
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
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// -------------------- FORMATTERS --------------------
const fmt0     = (n) => Math.round(n).toLocaleString('en-US');
const fmt1     = (n) => Number(n).toFixed(1);
const fmtDate  = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDateLong = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Local-time YYYY-MM-DD — safe for date inputs (toISOString() shifts by tz offset)
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayLocalStr     = localDateStr(new Date());
const yesterdayLocalStr = localDateStr(new Date(new Date().setDate(new Date().getDate() - 1)));

// -------------------- WEIGHT CHART --------------------
function WeightChart({ data, goal, ma, reg, unit, onPointClick }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const W = 920, H = 340;
  const pad = { t: 24, r: 28, b: 40, l: 52 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const weights = data.map(d => d.weight);
  const displayWeights = weights.map(w => toDisplay(w, unit));
  const displayGoal    = goal ? toDisplay(goal, unit) : null;
  const displayMA      = ma.map(w => toDisplay(w, unit));
  const displayReg     = { slope: reg.slope * (unit === 'lbs' ? KG_TO_LBS : 1), intercept: toDisplay(reg.intercept, unit) };

  const minW = Math.min(...displayWeights, ...(displayGoal != null ? [displayGoal] : [])) - 0.6;
  const maxW = Math.max(...displayWeights) + 0.6;

  const x = (i) => pad.l + (i / Math.max(data.length - 1, 1)) * innerW;
  const y = (w) => pad.t + ((maxW - w) / Math.max(maxW - minW, 0.1)) * innerH;

  const rawPath  = displayWeights.map((w, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)},${y(w).toFixed(1)}`).join(' ');
  const maPath   = displayMA.map((w, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)},${y(w).toFixed(1)}`).join(' ');
  const regPath  = `M ${x(0).toFixed(1)},${y(displayReg.intercept).toFixed(1)} L ${x(data.length - 1).toFixed(1)},${y(displayReg.slope * (data.length - 1) + displayReg.intercept).toFixed(1)}`;
  const maFill   = `${maPath} L ${x(data.length - 1).toFixed(1)},${(pad.t + innerH).toFixed(1)} L ${x(0).toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`;

  const yTicks = [];
  const tickStep = unit === 'lbs' ? 5 : 2;
  const tickStart = Math.ceil(minW / tickStep) * tickStep;
  for (let v = tickStart; v <= maxW; v += tickStep) yTicks.push(v);

  const xTicks = data
    .map((d, i) => ({ d: d.date, i }))
    .filter(({ d }) => d.getDate() <= 7)
    .filter((v, i, arr) => arr.findIndex(a => a.d.getMonth() === v.d.getMonth()) === i);

  const getIdxFromEvent = (e) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (px < pad.l || px > pad.l + innerW) return null;
    const ratio = (px - pad.l) / innerW;
    return Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
  };

  const handleMove  = (e) => { const idx = getIdxFromEvent(e); setHover(idx != null ? { idx } : null); };
  const handleClick = (e) => { const idx = getIdxFromEvent(e); if (idx != null && onPointClick) onPointClick(data[idx]); };

  const hoverEntry = hover != null ? data[hover.idx] : null;
  const hoverMA    = hover != null ? displayMA[hover.idx] : null;
  const hoverReg   = hover != null ? displayReg.slope * hover.idx + displayReg.intercept : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
        style={{ cursor: hover != null ? 'pointer' : 'crosshair' }}
      >
        <defs>
          <linearGradient id="ma-fill-bv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ed7a2a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ed7a2a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map(v => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + innerW} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.04)" />
            <text x={pad.l - 10} y={y(v) + 3} fontSize="10" fill="#666" textAnchor="end" fontFamily="JetBrains Mono">{v}</text>
          </g>
        ))}

        {xTicks.map(({ d, i }) => (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={pad.t + innerH} y2={pad.t + innerH + 4} stroke="rgba(255,255,255,0.1)" />
            <text x={x(i)} y={pad.t + innerH + 18} fontSize="9" fill="#666" textAnchor="middle" fontFamily="JetBrains Mono" letterSpacing="0.05em">
              {d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
            </text>
          </g>
        ))}

        {displayGoal != null && (
          <>
            <line x1={pad.l} x2={pad.l + innerW} y1={y(displayGoal)} y2={y(displayGoal)} stroke="#f59e0b" strokeDasharray="3 4" strokeWidth="1" opacity="0.7" />
            <text x={pad.l + innerW - 4} y={y(displayGoal) - 4} fontSize="9" fill="#f59e0b" textAnchor="end" fontFamily="JetBrains Mono" letterSpacing="0.08em">
              GOAL · {fmt1(displayGoal)} {unit.toUpperCase()}
            </text>
          </>
        )}

        <path d={maFill} fill="url(#ma-fill-bv)" />
        {displayWeights.map((w, i) => (
          <circle key={i} cx={x(i)} cy={y(w)} r="1.4" fill="#888" opacity="0.5" />
        ))}
        <path d={maPath} fill="none" stroke="#ed7a2a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d={regPath} fill="none" stroke="#a8a29e" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.7" />

        {hover != null && hoverEntry && (
          <g>
            <line x1={x(hover.idx)} x2={x(hover.idx)} y1={pad.t} y2={pad.t + innerH} stroke="#ed7a2a" strokeWidth="1" opacity="0.4" />
            <circle cx={x(hover.idx)} cy={y(toDisplay(hoverEntry.weight, unit))} r="4" fill="#ff5a2a" stroke="#0a0908" strokeWidth="2" />
            <text x={x(hover.idx) + 7} y={y(toDisplay(hoverEntry.weight, unit)) - 6} fontSize="10" fill="#ed7a2a" fontFamily="JetBrains Mono" style={{ userSelect: 'none' }}>✎</text>
          </g>
        )}

        {data.length > 0 && (
          <circle cx={x(data.length - 1)} cy={y(toDisplay(data[data.length - 1].weight, unit))} r="4" fill="#ed7a2a" stroke="#0a0908" strokeWidth="2" />
        )}
      </svg>

      {hoverEntry && (
        <div
          className="absolute pointer-events-none bg-stone-950 border border-orange-500/40 px-3 py-2 backdrop-blur-sm text-[11px] font-mono"
          style={{ left: `${(x(hover.idx) / W) * 100}%`, top: 0, transform: 'translate(-50%, -8px) translateY(-100%)' }}
        >
          <div className="text-stone-500 uppercase tracking-wider text-[9px] mb-0.5">{fmtDateLong(hoverEntry.date)}</div>
          <div className="font-anton text-orange-300 text-lg tabular-nums leading-none">
            {fmt1(toDisplay(hoverEntry.weight, unit))} <span className="text-stone-500 text-xs">{unit}</span>
          </div>
          <div className="text-[10px] text-stone-400 tabular-nums mt-0.5">MA: {fmt1(hoverMA)} {unit}</div>
          <div className="text-[10px] text-stone-500 tabular-nums">Trend: {fmt1(hoverReg)} {unit}</div>
          {hoverEntry.bodyFat != null && (
            <div className="text-[10px] text-stone-500 tabular-nums">{fmt1(hoverEntry.bodyFat)}% bf</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-5 text-[10px] uppercase tracking-wider text-stone-500 font-mono mt-3 pt-3 border-t border-stone-800/60">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stone-500 opacity-50" />Daily weigh-in</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-px bg-orange-400" />7-day moving avg</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-px bg-stone-400" style={{ borderTop: '1px dashed #a8a29e' }} />Linear regression</span>
        {displayGoal != null && (
          <span className="flex items-center gap-1.5"><span className="w-4 h-px bg-amber-400" style={{ borderTop: '1px dashed #f59e0b' }} />Goal weight</span>
        )}
      </div>
    </div>
  );
}

// -------------------- BODY COMPOSITION --------------------
function BodyComposition({ compEntries, unit }) {
  if (compEntries.length < 1) return null;
  const first = compEntries[0];
  const last  = compEntries[compEntries.length - 1];
  const firstFat  = first.weight * (first.bodyFat / 100);
  const firstLean = first.weight - firstFat;
  const lastFat   = last.weight  * (last.bodyFat  / 100);
  const lastLean  = last.weight  - lastFat;
  const fatDelta  = firstFat  - lastFat;
  const leanDelta = firstLean - lastLean;
  const maxW      = Math.max(first.weight, last.weight);

  const Bar = ({ lean, fat, total, label, date }) => (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">{label}</span>
        <span className="text-[10px] text-stone-600 font-mono">{date}</span>
      </div>
      <div className="flex h-7" style={{ width: `${(total / maxW) * 100}%` }}>
        <div className="bg-stone-400 flex items-center justify-end pr-2 text-[10px] font-mono tabular-nums text-stone-900 font-medium" style={{ width: `${(lean / total) * 100}%` }}>
          {fmt1(toDisplay(lean, unit))} {unit}
        </div>
        <div className="bg-orange-500 flex items-center justify-end pr-2 text-[10px] font-mono tabular-nums text-stone-950 font-medium" style={{ width: `${(fat / total) * 100}%` }}>
          {fmt1(toDisplay(fat, unit))} {unit}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Bar lean={firstLean} fat={firstFat} total={first.weight} label="First entry" date={fmtDate(first.date)} />
      <Bar lean={lastLean}  fat={lastFat}  total={last.weight}  label="Latest"      date={fmtDate(last.date)} />
      <div className="pt-3 border-t border-stone-800/60 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-1">Fat change</div>
          <div className="font-anton text-2xl text-orange-400 tabular-nums">
            {fatDelta >= 0 ? '−' : '+'}{fmt1(toDisplay(Math.abs(fatDelta), unit))}<span className="text-stone-500 text-base ml-1">{unit}</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-1">Lean change</div>
          <div className={`font-anton text-2xl tabular-nums ${leanDelta > 0.5 ? 'text-red-400' : 'text-stone-300'}`}>
            {leanDelta > 0 ? '−' : '+'}{fmt1(toDisplay(Math.abs(leanDelta), unit))}<span className="text-stone-500 text-base ml-1">{unit}</span>
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

// -------------------- PHOTO PLACEHOLDER --------------------
function PhotoPlaceholder() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {['Front', 'Side', 'Back'].map(pose => (
          <div key={pose} className="border border-stone-800/60 bg-stone-950/40 p-3 flex flex-col items-center justify-center aspect-[3/5]">
            <div className="text-[9px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-3">{pose}</div>
            <div className="w-10 h-10 border border-dashed border-stone-700 flex items-center justify-center mb-3">
              <span className="text-stone-700 text-lg">+</span>
            </div>
            <div className="text-[9px] text-stone-700 font-mono text-center leading-relaxed">Upload<br />photo</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border border-stone-800/40 bg-stone-900/20">
        <span className="text-[9px] uppercase tracking-wider font-mono text-stone-600">Pro feature</span>
        <span className="text-stone-700">·</span>
        <span className="text-[10px] font-mono text-stone-500">Photo upload coming soon — progress photos stored encrypted with signed-URL access</span>
      </div>
    </div>
  );
}

// -------------------- ENTRY MODAL --------------------
function EntryModal({ mode, initialEntry, rawEntries, onClose, onSave, unit, saving }) {
  const fixedDate = mode === 'today' ? todayLocalStr
    : mode === 'edit'  ? (initialEntry?.logged_at ?? todayLocalStr)
    : null;

  const [selectedDate, setSelectedDate] = useState(fixedDate ?? yesterdayLocalStr);
  const pastRow   = mode === 'past' ? (rawEntries.find(r => r.logged_at === selectedDate) ?? null) : null;
  const sourceRow = mode === 'past' ? pastRow : initialEntry;

  const [weight, setWeight] = useState(sourceRow ? String(toDisplay(sourceRow.weight_kg, unit)) : '');
  const [bf, setBf]         = useState(sourceRow?.body_fat_pct != null ? String(sourceRow.body_fat_pct) : '');
  const [notes, setNotes]   = useState(sourceRow?.notes ?? '');
  const [err, setErr]       = useState('');

  useEffect(() => {
    if (mode !== 'past') return;
    const row = rawEntries.find(r => r.logged_at === selectedDate) ?? null;
    setWeight(row ? String(toDisplay(row.weight_kg, unit)) : '');
    setBf(row?.body_fat_pct != null ? String(row.body_fat_pct) : '');
    setNotes(row?.notes ?? '');
    setErr('');
  }, [selectedDate, mode, rawEntries, unit]);

  async function handleSave() {
    const w   = parseFloat(weight);
    const wKg = fromDisplay(w, unit);
    if (!w || wKg < 30 || wKg > 300) {
      setErr(`Weight must be ${fmt1(toDisplay(30, unit))}–${fmt1(toDisplay(300, unit))} ${unit}`);
      return;
    }
    const result = await onSave({ logged_at: selectedDate, weight_kg: wKg, body_fat_pct: bf !== '' ? parseFloat(bf) : null, notes });
    if (result?.error) { setErr(result.error); return; }
    onClose();
  }

  const hasExisting = mode === 'past' ? !!rawEntries.find(r => r.logged_at === selectedDate) : !!initialEntry;
  const title = mode === 'today' ? 'Log Today'
    : mode === 'past' ? 'Log Previous Day'
    : `Edit — ${fmtDate(new Date(initialEntry.logged_at + 'T12:00:00'))}`;
  const saveLabel = saving ? 'Saving…' : hasExisting ? 'Update' : 'Log';

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 flex items-center justify-center backdrop-blur-sm px-4">
      <div className="w-full max-w-sm border border-stone-800 bg-[#0a0908] p-6 space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">{title}</h2>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 font-mono text-xs">✕</button>
        </div>
        {mode === 'past' ? (
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Date</label>
            <input type="date" value={selectedDate} max={yesterdayLocalStr} onChange={e => setSelectedDate(e.target.value)}
              className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors" />
          </div>
        ) : (
          <div className="text-[10px] uppercase tracking-[0.18em] text-stone-600 font-mono">
            {fmtDateLong(new Date(selectedDate + 'T12:00:00'))}
          </div>
        )}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Weight ({unit})</label>
          <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'lbs' ? '185.0' : '84.0'}
            className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Body fat % <span className="text-stone-700">(optional)</span></label>
          <input type="number" step="0.1" min="3" max="60" value={bf} onChange={e => setBf(e.target.value)} placeholder="18.5"
            className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Notes <span className="text-stone-700">(optional)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Heavy sodium day, refeed…"
            className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors resize-none" />
        </div>
        {err && <div className="text-red-400 font-mono text-xs">{err}</div>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-stone-500 hover:text-stone-200 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50">{saveLabel}</button>
        </div>
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

// -------------------- 12-WEEK HEATMAP --------------------
function WeekHeatmap({ rawEntries }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Align to Monday of this week, then go back 11 more weeks = 12 total
  const todayDay = today.getDay(); // 0=Sun
  const daysSinceMonday = todayDay === 0 ? 6 : todayDay - 1;
  const startMonday = new Date(today);
  startMonday.setDate(today.getDate() - daysSinceMonday - 11 * 7);

  const entryDates = new Set(rawEntries.map(e => e.logged_at));
  const todayStr   = localDateStr(today);

  const weeks = [];
  const cursor = new Date(startMonday);
  for (let w = 0; w < 12; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr  = localDateStr(cursor);
      const isFuture = cursor > today;
      week.push({ dateStr, hasEntry: entryDates.has(dateStr), isToday: dateStr === todayStr, isFuture });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <div className="flex flex-col gap-1.5 mr-1 pt-0.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
            <div key={i} className="w-3 h-3 flex items-center justify-center text-[8px] text-stone-600 font-mono leading-none">{l}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1.5">
            {week.map((day, di) => (
              <div
                key={di}
                title={day.dateStr}
                className={[
                  'w-3 h-3',
                  day.isFuture  ? 'bg-transparent'  :
                  day.hasEntry  ? 'bg-orange-500'    : 'bg-stone-800',
                  day.isToday   ? 'outline outline-1 outline-white outline-offset-[-1px]' : '',
                ].join(' ')}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[9px] font-mono text-stone-600 uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-orange-500 inline-block" />Logged</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-stone-800 inline-block" />No entry</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-stone-800 outline outline-1 outline-white outline-offset-[-1px] inline-block" />Today</span>
      </div>
    </div>
  );
}

// -------------------- CHECK-IN HISTORY --------------------
const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😊'];

function CheckinHistory({ checkins }) {
  const [expanded, setExpanded] = useState(null);
  if (checkins.length === 0) {
    return (
      <div className="py-8 text-center text-stone-600 font-mono text-xs uppercase tracking-wider">
        No check-ins yet — use the button above to log your first one
      </div>
    );
  }
  return (
    <div className="space-y-0">
      {checkins.map((c, i) => (
        <div key={c.id} className="border-b border-stone-800/40 last:border-b-0">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center gap-4 py-3 text-left hover:bg-stone-950/40 transition-colors px-2 -mx-2"
          >
            <span className="text-[10px] font-mono text-stone-600 w-20 shrink-0">
              {new Date(c.checked_in_at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span className="text-lg w-7 text-center shrink-0">{MOOD_EMOJI[c.mood] ?? '—'}</span>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[9px] font-mono text-stone-600 uppercase">E</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, j) => (
                  <span key={j} className={`w-2 h-2 rounded-full ${j < c.energy ? 'bg-orange-400' : 'bg-stone-800'}`} />
                ))}
              </div>
              <span className="text-[9px] font-mono text-stone-600 uppercase ml-1">S</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, j) => (
                  <span key={j} className={`w-2 h-2 rounded-full ${j < c.sleep_quality ? 'bg-blue-400' : 'bg-stone-800'}`} />
                ))}
              </div>
            </div>
            {c.notes && <span className="text-[10px] text-stone-600 font-mono flex-shrink truncate max-w-[120px]">{c.notes}</span>}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`shrink-0 text-stone-700 transition-transform ${expanded === i ? 'rotate-180' : ''}`}>
              <path d="M2 3.5l3 3 3-3" strokeLinecap="round" />
            </svg>
          </button>
          {expanded === i && c.notes && (
            <div className="pb-3 pl-[6.5rem] pr-2">
              <div className="text-[11px] font-mono text-stone-400 leading-relaxed">{c.notes}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// -------------------- MAIN --------------------
export default function BiometricVault() {
  const { session, loading: sessionLoading } = useSession();
  const userId  = sessionLoading ? undefined : (session?.user?.id ?? null);
  const profile = useProfileStore(s => s.profile);

  const goalWeightKg   = profile?.goal_weight_kg ?? null;
  const unit           = profile?.settings?.weight_unit ?? 'kg';
  const currentStreak  = profile?.current_streak  ?? 0;
  const longestStreak  = profile?.longest_streak  ?? 0;

  const vault   = useBiometricVault(userId, goalWeightKg);
  const checkin = useCheckin(userId);

  const [modalState, setModalState]     = useState(null);
  const [showCheckin, setShowCheckin]   = useState(false);

  const openToday = () => setModalState({ mode: 'today', entry: vault.todayEntry });
  const openPast  = () => setModalState({ mode: 'past',  entry: null });
  const openEdit  = (chartEntry) => {
    const raw = vault.rawEntries.find(r => r.logged_at === chartEntry.logged_at) ?? null;
    setModalState({ mode: 'edit', entry: raw ?? { logged_at: chartEntry.logged_at, weight_kg: chartEntry.weight, body_fat_pct: chartEntry.bodyFat, notes: null } });
  };
  const closeModal = () => setModalState(null);

  const { chartData, ma, reg, slopePerWeek, slope30PerWeek, projection, compEntries, paceStatus } = vault;

  const first = chartData[0] ?? null;
  const last  = chartData[chartData.length - 1] ?? null;

  const totalChange  = first && last ? last.weight - first.weight : null;
  const last30Data   = chartData.slice(-30);
  const change30     = last30Data.length >= 2 ? last30Data[last30Data.length - 1].weight - last30Data[0].weight : null;
  const dTotalChange = totalChange != null ? toDisplay(totalChange, unit) : null;
  const dChange30    = change30 != null    ? toDisplay(change30, unit)    : null;
  const dSlope30     = toDisplay(slope30PerWeek, unit);

  if (vault.loading) {
    return (
      <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 flex items-center justify-center">
        <style>{FONT_STYLE}</style>
        <div className="space-y-3 w-full max-w-md px-6">
          {[80, 60, 70, 50].map((w, i) => <div key={i} className="h-4 bg-stone-800/60 animate-pulse" style={{ width: `${w}%` }} />)}
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
        <style>{FONT_STYLE}</style>
        <AppNav />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-8">
          <header className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-stone-800/60">
            <div className="flex items-baseline gap-3">
              <span className="font-anton text-5xl uppercase tracking-tight text-stone-100">Biometric</span>
              <span className="font-anton text-5xl uppercase tracking-tight bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent">Vault</span>
            </div>
          </header>
          <div className="border border-stone-800/60 bg-stone-950/40 p-12 text-center space-y-6">
            <div className="text-[10px] uppercase tracking-[0.25em] text-stone-600 font-mono">No data yet</div>
            <h2 className="font-anton text-3xl uppercase tracking-tight text-stone-300">Start logging your weight daily to unlock trends</h2>
            <div className="flex gap-3 justify-center">
              <button onClick={openToday} className="px-8 py-4 bg-orange-500 text-stone-950 font-anton text-xl uppercase tracking-wider hover:bg-orange-400 transition-colors">+ Log Today's Weight</button>
              <button onClick={openPast} className="px-5 py-4 border border-stone-700 text-stone-400 font-anton text-lg uppercase tracking-wider hover:border-stone-500 hover:text-stone-200 transition-colors">Log Previous Day</button>
            </div>
          </div>
        </div>
        {modalState && <EntryModal mode={modalState.mode} initialEntry={modalState.entry} rawEntries={vault.rawEntries} onClose={closeModal} onSave={vault.logEntry} unit={unit} saving={vault.saving} />}
      </div>
    );
  }

  const needsMoreData = chartData.length < 7;

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
      <style>{FONT_STYLE}</style>
      <AppNav />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)' }} />
        <div className="absolute bottom-0 right-0 w-[60vw] h-[40vh] opacity-[0.06] blur-3xl" style={{ background: 'radial-gradient(ellipse, #ff5a2a 0%, transparent 60%)' }} />
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
              <span>90-day window</span>
              <span className="text-stone-700">·</span>
              <span>{chartData.length} weigh-ins</span>
              {goalWeightKg && (
                <><span className="text-stone-700">·</span><span>Goal {fmt1(toDisplay(goalWeightKg, unit))} {unit}</span></>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={() => setShowCheckin(true)} className="px-4 py-2.5 border border-stone-700 text-stone-400 font-anton text-sm uppercase tracking-wider hover:border-orange-500/50 hover:text-orange-300 transition-colors">
              📋 Check-In
            </button>
            <button onClick={openPast} className="px-4 py-2.5 border border-stone-700 text-stone-400 font-anton text-sm uppercase tracking-wider hover:border-stone-500 hover:text-stone-200 transition-colors">
              Log Previous Day
            </button>
            <button onClick={openToday} className="px-5 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors">
              {vault.todayEntry ? '✓ Update Today' : '+ Log Today'}
            </button>
          </div>
        </header>

        {/* STATS BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-8 border border-stone-800/60 bg-stone-950/40">
          <StatBlock label="Current Weight" value={last ? fmt1(toDisplay(last.weight, unit)) : '—'} sub={`${unit}${last?.bodyFat != null ? ` · ${fmt1(last.bodyFat)}% bf` : ''}`} accent="text-orange-300" />
          <StatBlock label="Total Change" value={dTotalChange != null ? `${dTotalChange > 0 ? '+' : ''}${fmt1(dTotalChange)}` : '—'} sub={first ? `since ${fmtDate(first.date)}` : ''} accent={dTotalChange != null && dTotalChange < 0 ? 'text-orange-300' : 'text-stone-300'} />
          <StatBlock label="30d Trend" value={dChange30 != null ? `${dChange30 > 0 ? '+' : ''}${fmt1(dChange30)}` : '—'} sub={`${fmt1(Math.abs(dSlope30))} ${unit}/wk`} />
          <StatBlock label="Goal ETA" value={projection?.daysToGoal ? `${projection.daysToGoal}d` : projection?.reached ? 'Reached' : '—'} sub={projection?.date ? fmtDate(projection.date) : needsMoreData ? 'needs 7+ entries' : 'projection'} accent="text-orange-300" />
        </div>

        {/* STREAK + HEATMAP */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-8">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">🔥 Streak</h2>
            <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">consecutive daily logs</span>
          </div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Current</div>
              <div className={`font-anton text-5xl tabular-nums leading-none ${currentStreak >= 7 ? 'text-amber-400' : 'text-stone-100'}`}>
                {currentStreak}
                <span className="text-stone-500 text-2xl ml-1.5">days</span>
                {currentStreak >= 30 && (
                  <span className="ml-2 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 font-mono uppercase tracking-wider">ELITE</span>
                )}
              </div>
              {currentStreak === 0 && (
                <div className="text-[11px] font-mono text-stone-500 mt-2">Log today to start your streak</div>
              )}
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-1">Best</div>
              <div className="font-anton text-5xl tabular-nums leading-none text-stone-400">
                {longestStreak}<span className="text-stone-600 text-2xl ml-1.5">days</span>
              </div>
            </div>
          </div>
          <div className="pt-5 border-t border-stone-800/60">
            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-3">12-week log</div>
            <WeekHeatmap rawEntries={vault.rawEntries} />
          </div>
        </div>

        {/* HEADLINE PROJECTION */}
        {projection?.date && !needsMoreData && (
          <div className="mb-10">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-2">Trajectory projection</div>
            <h1 className="font-anton text-4xl md:text-5xl uppercase tracking-tight leading-[0.95] text-stone-100 max-w-4xl">
              At your current rate, you'll hit{' '}
              <span className="text-orange-400">{fmt1(toDisplay(goalWeightKg, unit))} {unit}</span> by{' '}
              <span className="text-orange-400">{fmtDateLong(projection.date)}</span>
              <span className="text-stone-600"> — about {projection.daysToGoal} days from today.</span>
            </h1>
          </div>
        )}

        {projection?.unreachable && !needsMoreData && (
          <div className="mb-10 border border-orange-500/30 bg-orange-500/5 px-5 py-4">
            <span className="font-mono text-xs text-orange-400 uppercase tracking-wider">
              Trend going wrong way — current slope won't reach goal weight. Check your deficit.
            </span>
          </div>
        )}

        {needsMoreData && (
          <div className="mb-8 border border-stone-800/60 bg-stone-900/20 px-5 py-4 flex items-center justify-between">
            <span className="font-mono text-xs text-stone-500">
              Log <span className="text-stone-300">{7 - chartData.length} more {7 - chartData.length === 1 ? 'day' : 'days'}</span> to unlock projections and trend analysis
            </span>
            <button onClick={openToday} className="px-4 py-2 border border-orange-500/40 text-orange-300 font-mono text-[10px] uppercase tracking-wider hover:bg-orange-500/10 transition-colors">+ Log Today</button>
          </div>
        )}

        {/* WEIGHT CHART */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-8">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Weight Timeline</h2>
            <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">interactive · click to edit</span>
          </div>
          <WeightChart data={chartData} goal={goalWeightKg} ma={ma} reg={reg} unit={unit} onPointClick={openEdit} />
        </div>

        {/* BODY COMP + DERIVED METRICS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-7 border border-stone-800/60 bg-stone-950/40 p-6">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Body Composition</h2>
              <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">lean vs fat mass</span>
            </div>
            {compEntries.length >= 1 ? (
              <BodyComposition compEntries={compEntries} unit={unit} />
            ) : (
              <div className="py-10 text-center text-stone-600 font-mono text-xs uppercase tracking-wider">
                Log body fat % with your weigh-in to unlock composition tracking
              </div>
            )}
          </div>

          <div className="lg:col-span-5 border border-stone-800/60 bg-stone-950/40 p-6">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Derived</h2>
              <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">computed</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline pb-3 border-b border-stone-800/60">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Regression slope</span>
                <span className="font-anton text-xl text-orange-300 tabular-nums">{fmt1(toDisplay(slopePerWeek, unit))} <span className="text-stone-500 text-xs">{unit}/wk</span></span>
              </div>
              <div className="flex justify-between items-baseline pb-3 border-b border-stone-800/60">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">% bw / wk</span>
                <span className="font-anton text-xl text-stone-200 tabular-nums">{first ? fmt1((slopePerWeek / first.weight) * 100) : '—'}<span className="text-stone-500 text-xs">%</span></span>
              </div>
              <div className="flex justify-between items-baseline pb-3 border-b border-stone-800/60">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Est. daily deficit</span>
                <span className="font-anton text-xl text-stone-200 tabular-nums">~{fmt0(Math.abs(slopePerWeek) * 7700 / 7)}<span className="text-stone-500 text-xs"> kcal/d</span></span>
              </div>
              <div className="flex justify-between items-baseline pb-3 border-b border-stone-800/60">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Days to goal</span>
                <span className="font-anton text-xl text-orange-300 tabular-nums">{projection?.daysToGoal ?? (projection?.reached ? '✓' : '—')}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Pace status</span>
                {paceStatus ? (
                  <span className={`font-anton text-xl tabular-nums ${paceStatus.color}`}>{paceStatus.label}</span>
                ) : (
                  <span className="font-mono text-xs text-stone-600">7+ entries needed</span>
                )}
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-stone-800/60 text-[10px] font-mono text-stone-600 leading-relaxed">
              These metrics feed Oracle every 7 days. Aggressive pace triggers macro adjustments; flat slope flags the cut as stalled.
            </div>
          </div>
        </div>

        {/* PHOTO TIMELINE */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-8">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Visual Progress</h2>
            <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">private · encrypted at rest</span>
          </div>
          <PhotoPlaceholder />
        </div>

        {/* CHECK-IN HISTORY */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-8">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Weekly Check-Ins</h2>
            <button
              onClick={() => setShowCheckin(true)}
              className="text-[9px] uppercase tracking-[0.18em] text-orange-400 font-mono hover:text-orange-300 transition-colors"
            >
              + New Check-In
            </button>
          </div>
          <CheckinHistory checkins={checkin.checkins} />
        </div>

        <footer className="mt-12 pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>Biometric Vault v0.5 · Module 4 · Longitudinal tracking</span>
          <span>Regression: ordinary least squares · MA window 7d</span>
        </footer>
      </div>

      {/* MODALS */}
      {modalState && (
        <EntryModal
          mode={modalState.mode}
          initialEntry={modalState.entry}
          rawEntries={vault.rawEntries}
          onClose={closeModal}
          onSave={vault.logEntry}
          unit={unit}
          saving={vault.saving}
        />
      )}
      {showCheckin && (
        <CheckinModal
          onClose={() => setShowCheckin(false)}
          onSave={checkin.submitCheckin}
          saving={checkin.saving}
          todayCheckin={checkin.todayCheckin}
        />
      )}
    </div>
  );
}
