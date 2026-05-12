import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import AppNav from '../components/AppNav';
import { CheckinModal } from '../components/CheckinModal';
import { useSession } from '../hooks/useSession';
import { useProfileStore } from '../store/useProfileStore';
import { useBiometricVault } from '../hooks/useBiometricVault';
import { useCheckin } from '../hooks/useCheckin';
import { useProgressPhotos } from '../hooks/useProgressPhotos';

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

// -------------------- UPLOAD ZONE --------------------
function UploadZone({ angle, signedUrl, uploading, error, onUpload, onDelete }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [localPreview, setLocalPreview]   = useState(null);
  const inputRef = useRef(null);
  const label = angle.charAt(0).toUpperCase() + angle.slice(1);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalPreview(URL.createObjectURL(file));
    onUpload(file).then(result => { if (result?.error) setLocalPreview(null); });
    e.target.value = '';
  }

  useEffect(() => { if (signedUrl) setLocalPreview(null); }, [signedUrl]);

  const display = localPreview ?? signedUrl;

  if (display) {
    return (
      <div className="relative aspect-[3/5] bg-stone-950 border border-stone-800/60 overflow-hidden group">
        <img src={display} alt={label} className="w-full h-full object-cover" />
        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-800">
            <div className="h-full bg-orange-500 animate-pulse w-3/5" />
          </div>
        )}
        {!uploading && !deleteConfirm && (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="absolute top-2 right-2 w-6 h-6 bg-stone-950/80 border border-stone-700 text-stone-400 hover:text-red-400 hover:border-red-500/40 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >×</button>
        )}
        {deleteConfirm && (
          <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center gap-3 p-3">
            <span className="text-[9px] font-mono text-stone-300 uppercase tracking-wider text-center leading-relaxed">Remove this photo?</span>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1.5 border border-stone-700 text-stone-400 font-mono text-[9px] uppercase hover:border-stone-500 transition-colors">Cancel</button>
              <button onClick={() => { setDeleteConfirm(false); setLocalPreview(null); onDelete(); }} className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-[9px] uppercase hover:bg-red-500/30 transition-colors">Remove</button>
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-stone-950/80 to-transparent px-2 pb-2 pt-6 pointer-events-none">
          <span className="text-[9px] uppercase tracking-wider font-mono text-stone-400">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[3/5] border border-dashed border-stone-700 hover:border-orange-500/50 bg-stone-950/40 transition-colors cursor-pointer group"
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        {uploading ? (
          <>
            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            <span className="text-[9px] uppercase tracking-wider font-mono text-orange-400">Uploading…</span>
          </>
        ) : (
          <>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-600 group-hover:text-orange-400 transition-colors" viewBox="0 0 24 24">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="13" r="4" strokeLinecap="round"/>
            </svg>
            <span className="text-[9px] uppercase tracking-wider font-mono text-stone-600">{label}</span>
            <span className="text-[8px] font-mono text-stone-700">jpg · png · webp</span>
          </>
        )}
      </div>
      {uploading && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-800">
          <div className="h-full bg-orange-500 transition-all" style={{ width: '65%' }} />
        </div>
      )}
      {error && (
        <div className="absolute top-1 left-1 right-1 bg-red-500/20 text-red-400 text-[8px] font-mono px-1 py-0.5 text-center">{error}</div>
      )}
    </div>
  );
}

// -------------------- PROGRESS PHOTO SECTION --------------------
function ProgressPhotoSection({ progressPhotos, date, isPro }) {
  const [photos, setPhotos] = useState({ front: null, side: null, back: null });

  useEffect(() => {
    if (!isPro || !date) return;
    progressPhotos.getPhotosForDate(date).then(result => setPhotos(result));
  }, [date, isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(file, angle) {
    const result = await progressPhotos.uploadPhoto(file, angle, date);
    if (result?.success) {
      const url = await progressPhotos.getSignedUrl(result.path);
      setPhotos(prev => ({ ...prev, [angle]: url }));
    }
    return result;
  }

  async function handleDelete(angle) {
    await progressPhotos.deletePhoto(angle, date);
    setPhotos(prev => ({ ...prev, [angle]: null }));
  }

  if (!isPro) {
    return (
      <div className="relative">
        <div className="grid grid-cols-3 gap-4 opacity-20 pointer-events-none select-none">
          {['front', 'side', 'back'].map(a => (
            <div key={a} className="aspect-[3/5] border border-dashed border-stone-700 bg-stone-950/40 flex flex-col items-center justify-center gap-3">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-600" viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="13" r="4" strokeLinecap="round"/>
              </svg>
              <span className="text-[9px] uppercase tracking-wider font-mono text-stone-600">{a}</span>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-500" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="text-center">
            <div className="font-anton text-base uppercase text-stone-200 mb-1">Pro Feature</div>
            <div className="text-[10px] font-mono text-stone-500 mb-3">Progress photos require Pro or Elite</div>
            <Link to="/settings" className="inline-block px-4 py-2 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors">
              Upgrade to Pro →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-3">
        {['front', 'side', 'back'].map(angle => (
          <UploadZone
            key={angle}
            angle={angle}
            signedUrl={photos[angle]}
            uploading={progressPhotos.uploading[angle] ?? false}
            error={progressPhotos.errors[angle] ?? null}
            onUpload={(file) => handleUpload(file, angle)}
            onDelete={() => handleDelete(angle)}
          />
        ))}
      </div>
      <div className="text-[9px] font-mono text-stone-700 uppercase tracking-wider">
        jpeg · png · webp · max 10MB · signed URLs expire in 1hr
      </div>
    </div>
  );
}

// -------------------- PHOTO COMPARISON --------------------
function PhotoComparison({ progressPhotos, photoEntries, isPro }) {
  const angles = ['front', 'side', 'back'];
  const [activeAngle, setActiveAngle] = useState('front');
  const [beforeDate, setBeforeDate]   = useState(photoEntries[0]?.logged_at ?? '');
  const [afterDate, setAfterDate]     = useState(photoEntries[photoEntries.length - 1]?.logged_at ?? '');
  const [beforeUrls, setBeforeUrls]   = useState({ front: null, side: null, back: null });
  const [afterUrls, setAfterUrls]     = useState({ front: null, side: null, back: null });
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    if (!isPro || (!beforeDate && !afterDate)) return;
    setLoading(true);
    progressPhotos.getComparisonPhotos(beforeDate || null, afterDate || null).then(({ before, after }) => {
      setBeforeUrls(before);
      setAfterUrls(after);
      setLoading(false);
    });
  }, [beforeDate, afterDate, isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isPro) return null;

  return (
    <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-8">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Before / After</h2>
        <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">comparison view</span>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-1.5">Before</label>
          <input type="date" value={beforeDate} onChange={e => setBeforeDate(e.target.value)}
            className="bg-stone-950/60 border border-stone-800 px-3 py-2 text-stone-300 font-mono text-xs focus:outline-none focus:border-orange-500/60 transition-colors" />
        </div>
        <div>
          <label className="block text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-1.5">After</label>
          <input type="date" value={afterDate} onChange={e => setAfterDate(e.target.value)}
            className="bg-stone-950/60 border border-stone-800 px-3 py-2 text-stone-300 font-mono text-xs focus:outline-none focus:border-orange-500/60 transition-colors" />
        </div>
        <div className="flex border border-stone-800">
          {angles.map(a => (
            <button key={a} onClick={() => setActiveAngle(a)}
              className={`px-4 py-2 font-mono text-[9px] uppercase tracking-wider transition-colors ${activeAngle === a ? 'bg-orange-500 text-stone-950' : 'text-stone-500 hover:text-stone-300'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-6">
          {[0, 1].map(i => <div key={i} className="aspect-[3/5] bg-stone-800/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {[{ label: 'Before', urls: beforeUrls }, { label: 'After', urls: afterUrls }].map(({ label, urls }) => (
            <div key={label} className="flex flex-col border border-stone-800/60 bg-stone-950">
              <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800/60 shrink-0">
                <span className="font-anton text-sm uppercase text-stone-300">{label}</span>
                <span className="text-[9px] uppercase tracking-wider font-mono text-stone-600">{activeAngle}</span>
              </div>
              <div className="flex-1 aspect-[3/5]">
                {urls[activeAngle] ? (
                  <img src={urls[activeAngle]} alt={`${label} ${activeAngle}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-700 font-mono text-[10px] uppercase tracking-wider">
                    No photo
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {photoEntries.length < 2 && (
        <div className="mt-5 text-center text-[10px] font-mono text-stone-600 uppercase tracking-wider">
          Upload photos on at least two different dates to use comparison
        </div>
      )}
    </div>
  );
}

// -------------------- ENTRY MODAL --------------------
function EntryModal({ mode, initialEntry, rawEntries, onClose, onSave, unit, saving, getPhotosForDate, isPro }) {
  const fixedDate = mode === 'today' ? todayLocalStr
    : mode === 'edit'  ? (initialEntry?.logged_at ?? todayLocalStr)
    : null;

  // past mode: use the date passed from calendar click (initialEntry.logged_at), else yesterday
  const defaultDate = (mode === 'past' && initialEntry?.logged_at) ? initialEntry.logged_at : yesterdayLocalStr;
  const [selectedDate, setSelectedDate] = useState(fixedDate ?? defaultDate);
  const pastRow   = mode === 'past' ? (rawEntries.find(r => r.logged_at === selectedDate) ?? null) : null;
  const sourceRow = mode === 'past' ? pastRow : initialEntry;

  const [weight, setWeight]     = useState(sourceRow ? String(toDisplay(sourceRow.weight_kg, unit)) : '');
  const [bf, setBf]             = useState(sourceRow?.body_fat_pct != null ? String(sourceRow.body_fat_pct) : '');
  const [notes, setNotes]       = useState(sourceRow?.notes ?? '');
  const [err, setErr]           = useState('');
  const [editPhotos, setEditPhotos] = useState({ front: null, side: null, back: null });

  useEffect(() => {
    if (mode !== 'edit' || !getPhotosForDate || !initialEntry?.logged_at) return;
    getPhotosForDate(initialEntry.logged_at).then(result => setEditPhotos(result));
  }, [mode, initialEntry?.logged_at]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {mode === 'edit' && isPro && (editPhotos.front || editPhotos.side || editPhotos.back) && (
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Photos</div>
            <div className="grid grid-cols-3 gap-2">
              {['front', 'side', 'back'].map(angle => (
                editPhotos[angle] ? (
                  <img key={angle} src={editPhotos[angle]} alt={angle} className="aspect-[3/5] w-full object-cover border border-stone-800/60" />
                ) : (
                  <div key={angle} className="aspect-[3/5] border border-dashed border-stone-800/40 bg-stone-950/40 flex items-center justify-center">
                    <span className="text-[9px] font-mono text-stone-700 uppercase">{angle}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
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

// -------------------- MONTH CALENDAR --------------------
function MonthCalendar({ rawEntries, calMonth, onPrev, onNext, onDayClick }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);

  const entryDates = new Set(rawEntries.map(e => e.logged_at));

  const year  = calMonth.getFullYear();
  const month = calMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Monday-anchored grid
  const startDow    = firstDay.getDay();
  const offsetStart = startDow === 0 ? 6 : startDow - 1;
  const endDow      = lastDay.getDay();
  const offsetEnd   = endDow === 0 ? 0 : 7 - endDow;

  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - offsetStart);
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + offsetEnd);

  const cells = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    cells.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const monthLabel = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div style={{ width: 280 }}>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onPrev}
          className="text-stone-400 hover:text-orange-400 transition-colors p-1"
          aria-label="Previous month"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 3L5 8L10 13" />
          </svg>
        </button>
        <span className="font-anton text-sm uppercase tracking-wide text-stone-200">{monthLabel}</span>
        <button
          onClick={onNext}
          className="text-stone-400 hover:text-orange-400 transition-colors p-1"
          aria-label="Next month"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 3L11 8L6 13" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1" style={{ gap: 3 }}>
        {DAY_HEADERS.map((d, i) => (
          <div key={i} className="flex items-center justify-center text-[9px] text-stone-500 font-mono" style={{ width: 32, height: 16 }}>{d}</div>
        ))}
      </div>

      {/* Cells — 32×32px with date numbers */}
      <div className="grid grid-cols-7" style={{ gap: 3 }}>
        {cells.map((d, i) => {
          const dateStr     = localDateStr(d);
          const isThisMonth = d.getMonth() === month;
          const isToday     = dateStr === todayStr;
          const isFuture    = d > today;
          const hasEntry    = entryDates.has(dateStr);
          const clickable   = isThisMonth && !isFuture;

          let bgStyle = {};
          let textColor = '';

          if (!isThisMonth) {
            bgStyle = { backgroundColor: 'transparent' };
            textColor = 'text-stone-800';
          } else if (isFuture) {
            bgStyle = { backgroundColor: 'rgba(41,37,36,0.5)' };
            textColor = 'text-stone-700';
          } else if (hasEntry) {
            bgStyle = { backgroundColor: 'rgba(249,115,22,0.75)' };
            textColor = 'text-stone-900';
          } else {
            bgStyle = { backgroundColor: '#292524' };
            textColor = 'text-stone-500';
          }

          const todayStyle = isToday ? { outline: '1px solid white', outlineOffset: '-1px' } : {};

          return (
            <button
              key={i}
              disabled={!clickable}
              onClick={() => clickable && onDayClick(dateStr, hasEntry, isToday)}
              title={dateStr}
              style={{ width: 32, height: 32, ...bgStyle, ...todayStyle }}
              className={`flex items-center justify-center font-mono text-[10px] tabular-nums transition-opacity ${textColor} ${clickable ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
            >
              {isThisMonth ? d.getDate() : ''}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[9px] font-mono text-stone-600 uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: 'rgba(249,115,22,0.75)' }} />
          Logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-stone-800 inline-block" />
          No entry
        </span>
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

  const vault          = useBiometricVault(userId, goalWeightKg);
  const checkin        = useCheckin(userId);
  const progressPhotos = useProgressPhotos(userId);

  const tier  = profile?.subscription_tier ?? 'basic';
  const isPro = tier === 'pro' || tier === 'elite';
  const photoEntries = vault.rawEntries.filter(e => e.photo_front_url || e.photo_side_url || e.photo_back_url);

  const [modalState, setModalState]     = useState(null);
  const [showCheckin, setShowCheckin]   = useState(false);
  const [calMonth, setCalMonth]         = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const openToday = () => setModalState({ mode: 'today', entry: vault.todayEntry });
  // dateStr — optional; when passed from calendar click, pre-selects that date in the picker
  const openPast  = (dateStr = null) => setModalState({ mode: 'past', entry: dateStr ? { logged_at: dateStr } : null });
  const openEdit  = (chartEntry) => {
    const raw = vault.rawEntries.find(r => r.logged_at === chartEntry.logged_at) ?? null;
    setModalState({ mode: 'edit', entry: raw ?? { logged_at: chartEntry.logged_at, weight_kg: chartEntry.weight, body_fat_pct: chartEntry.bodyFat, notes: null } });
  };
  const closeModal = () => setModalState(null);

  const handleCalDayClick = (dateStr, hasEntry, isToday) => {
    if (isToday) { openToday(); return; }
    if (hasEntry) {
      const raw = vault.rawEntries.find(r => r.logged_at === dateStr);
      setModalState({ mode: 'edit', entry: raw ?? { logged_at: dateStr, weight_kg: null, body_fat_pct: null, notes: null } });
    } else {
      openPast(dateStr);
    }
  };

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
        {modalState && <EntryModal mode={modalState.mode} initialEntry={modalState.entry} rawEntries={vault.rawEntries} onClose={closeModal} onSave={vault.logEntry} unit={unit} saving={vault.saving} getPhotosForDate={progressPhotos.getPhotosForDate} isPro={isPro} />}
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

        {/* CHECK-IN HISTORY — top */}
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
          <div className="pt-5 border-t border-stone-800/60 flex flex-col items-center">
            <MonthCalendar
              rawEntries={vault.rawEntries}
              calMonth={calMonth}
              onPrev={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              onNext={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              onDayClick={handleCalDayClick}
            />
          </div>
        </div>

        {/* LOG TODAY CTA */}
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

        {/* GOAL PROJECTION */}
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
          <ProgressPhotoSection progressPhotos={progressPhotos} date={todayLocalStr} isPro={isPro} />
        </div>

        {/* BEFORE / AFTER COMPARISON — last */}
        <PhotoComparison progressPhotos={progressPhotos} photoEntries={photoEntries} isPro={isPro} />

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
          getPhotosForDate={progressPhotos.getPhotosForDate}
          isPro={isPro}
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
