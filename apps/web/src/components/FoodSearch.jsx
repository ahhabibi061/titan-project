import React, { useState, useEffect, useRef, useCallback } from 'react';

/* =========================================================================
 * FoodSearch — USDA FoodData Central powered meal-add flow
 * Search by name (debounced) or barcode scan (BarcodeDetector / @zxing).
 * Serving size selector with live macro preview.
 * Matches Sentinel page design exactly.
 * ========================================================================= */

const USDA_SEARCH = (q) => {
  const key = import.meta.env.VITE_USDA_API_KEY ?? '';
  return `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&api_key=${key}&pageSize=10&dataType=Branded,Survey(FNDDS)`;
};

const OFF_BARCODE = (code) =>
  `https://world.openfoodfacts.org/api/v0/product/${code}.json`;

// -------------------- HELPERS --------------------
const Sk = ({ w = 'w-full', h = 'h-8' }) => (
  <div className={`${w} ${h} bg-stone-800 animate-pulse rounded-sm`} />
);

// USDA: look up a nutrient by ID from the foodNutrients array
const getNutrient = (nutrients, id) =>
  nutrients?.find(n => n.nutrientId === id)?.value || 0;

// Normalize a USDA food object into a standard shape for ServingSelector
function normalizeUsda(food) {
  return {
    name:             food.description?.trim() || 'Unknown Food',
    brand:            food.brandOwner || food.brandName || '',
    servingSize:      food.servingSize || 100,
    servingSizeUnit:  (food.servingSizeUnit || 'g').toLowerCase(),
    kcalPerServing:    getNutrient(food.foodNutrients, 1008),
    proteinPerServing: getNutrient(food.foodNutrients, 1003),
    carbsPerServing:   getNutrient(food.foodNutrients, 1005),
    fatPerServing:     getNutrient(food.foodNutrients, 1004),
  };
}

// Normalize an Open Food Facts barcode product into the same shape
function parseServingG(raw) {
  if (!raw) return null;
  const m = raw.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function normalizeOff(product) {
  const n = product.nutriments ?? {};
  const servingG = parseServingG(product.serving_size) ?? 100;
  const factor = servingG / 100;
  return {
    name:             product.product_name?.trim() || 'Unknown Food',
    brand:            product.brands?.split(',')[0]?.trim() ?? '',
    servingSize:      servingG,
    servingSizeUnit:  'g',
    kcalPerServing:    Math.round((n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0) * factor),
    proteinPerServing: Math.round((n['proteins_100g'] ?? 0) * factor * 10) / 10,
    carbsPerServing:   Math.round((n['carbohydrates_100g'] ?? 0) * factor * 10) / 10,
    fatPerServing:     Math.round((n['fat_100g'] ?? 0) * factor * 10) / 10,
  };
}

// -------------------- BARCODE SCANNER --------------------
async function scanWithBarcodeDetector(videoEl, signal) {
  const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    let rafId;
    const tick = async () => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      try {
        const barcodes = await detector.detect(videoEl);
        if (barcodes.length > 0) return resolve(barcodes[0].rawValue);
      } catch (_) {}
      rafId = requestAnimationFrame(tick);
    };
    signal.addEventListener('abort', () => { cancelAnimationFrame(rafId); reject(new DOMException('Aborted', 'AbortError')); });
    tick();
  });
}

async function scanWithZxing(videoEl, signal) {
  const { BrowserMultiFormatReader } = await import('@zxing/library');
  const reader = new BrowserMultiFormatReader();
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    reader.decodeFromVideoElement(videoEl, (result, err) => {
      if (signal.aborted) { reader.reset(); return reject(new DOMException('Aborted', 'AbortError')); }
      if (result) { reader.reset(); resolve(result.getText()); }
    });
    signal.addEventListener('abort', () => { reader.reset(); reject(new DOMException('Aborted', 'AbortError')); });
  });
}

// -------------------- CAMERA SCANNER OVERLAY --------------------
function BarcodeOverlay({ onResult, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [error, setError]   = useState(null);
  const [ready, setReady]   = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);

        const scan = 'BarcodeDetector' in window ? scanWithBarcodeDetector : scanWithZxing;
        const code = await scan(videoRef.current, ac.signal);
        if (!mounted) return;
        onResult(code);
      } catch (e) {
        if (e.name !== 'AbortError' && mounted) setError(e.message ?? 'Camera error');
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/95 flex flex-col items-center justify-center">
      <div className="w-full max-w-md px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-anton text-2xl uppercase tracking-tight text-stone-100">Barcode Scanner</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-stone-600 mt-0.5">point camera at product barcode</div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors border border-stone-800 p-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3L13 13M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative aspect-square bg-stone-950 border border-stone-800 overflow-hidden mb-4">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

          {/* Corner brackets */}
          <div className="absolute inset-0 pointer-events-none">
            {[
              { top: 12, left: 12, rot: 0 },
              { top: 12, right: 12, rot: 90 },
              { bottom: 12, right: 12, rot: 180 },
              { bottom: 12, left: 12, rot: 270 },
            ].map((p, i) => (
              <div key={i} className="absolute w-8 h-8" style={{ ...p, transform: `rotate(${p.rot}deg)` }}>
                <div className="absolute top-0 left-0 w-full h-px bg-orange-400" />
                <div className="absolute top-0 left-0 w-px h-full bg-orange-400" />
              </div>
            ))}
          </div>

          {/* Scan line */}
          {ready && !error && (
            <div className="absolute inset-x-0 pointer-events-none" style={{
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #ed7a2a, transparent)',
              animation: 'scanLine 2s ease-in-out infinite',
            }} />
          )}

          {/* Status */}
          <div className="absolute top-3 left-3 bg-stone-950/80 border border-orange-500/40 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-orange-300">
            {!ready && !error ? '◌ starting camera…' : error ? '✕ error' : '◉ scanning'}
          </div>
        </div>

        {error ? (
          <div className="text-center">
            <div className="text-[11px] font-mono text-red-400 uppercase tracking-wider mb-3">{error}</div>
            <button onClick={onClose} className="px-4 py-2 border border-stone-700 text-stone-300 font-anton text-sm uppercase tracking-wider hover:bg-stone-800 transition-colors">
              Close
            </button>
          </div>
        ) : (
          <div className="text-center text-[10px] font-mono uppercase tracking-[0.18em] text-stone-600">
            Scanning automatically · hold steady
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { top: 10%; }
          50%  { top: 85%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}

// -------------------- SEARCH RESULT ROW --------------------
function ResultRow({ food, onSelect }) {
  const kcal = getNutrient(food.foodNutrients, 1008);
  const brand = food.brandOwner || food.brandName || '';
  const serving = food.servingSize
    ? `${food.servingSize}${(food.servingSizeUnit || 'g').toLowerCase()}`
    : null;
  return (
    <button
      onClick={() => onSelect(food)}
      className="w-full text-left px-4 py-3 border-b border-stone-800/60 last:border-b-0 hover:bg-stone-900/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {brand && (
            <div className="text-[9px] uppercase tracking-wider text-orange-400 font-mono mb-0.5 truncate">
              {brand}
            </div>
          )}
          <div className="text-stone-200 text-sm truncate group-hover:text-stone-100 transition-colors">
            {food.description ?? 'Unknown product'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[11px] tabular-nums text-stone-400">
            <span className="text-stone-200">{Math.round(kcal)}</span>
            <span className="text-stone-600"> kcal</span>
          </div>
          {serving && (
            <div className="text-[9px] font-mono text-stone-700 mt-0.5">per {serving}</div>
          )}
        </div>
      </div>
    </button>
  );
}

// -------------------- SERVING SELECTOR --------------------
// Receives a normalized product (from normalizeUsda or normalizeOff)
function ServingSelector({ product, source, onConfirm, onBack }) {
  const [qty, setQty] = useState('1');

  const numQty = parseFloat(qty) || 0;
  const macros = {
    kcal:    Math.round((product.kcalPerServing    || 0) * numQty),
    protein: Math.round((product.proteinPerServing || 0) * numQty * 10) / 10,
    carbs:   Math.round((product.carbsPerServing   || 0) * numQty * 10) / 10,
    fat:     Math.round((product.fatPerServing     || 0) * numQty * 10) / 10,
  };

  const inputClass = 'bg-stone-900/60 border border-stone-700 px-3 py-2 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors';

  const handleConfirm = () => {
    onConfirm({
      name:      product.name || 'Unknown Food',
      kcal:      isNaN(macros.kcal)    ? 0 : macros.kcal,
      protein_g: isNaN(macros.protein) ? 0 : macros.protein,
      carbs_g:   isNaN(macros.carbs)   ? 0 : macros.carbs,
      fat_g:     isNaN(macros.fat)     ? 0 : macros.fat,
      source,
    });
  };

  return (
    <div className="p-6">
      {/* Product header */}
      <div className="mb-5 pb-5 border-b border-stone-800/60">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="shrink-0 mt-1 text-stone-600 hover:text-stone-300 transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 2L4 7L9 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            {product.brand && (
              <div className="text-[9px] uppercase tracking-wider text-orange-400 font-mono mb-0.5 truncate max-w-xs">
                {product.brand}
              </div>
            )}
            <div className="font-anton text-lg uppercase tracking-tight text-stone-100 leading-tight">
              {product.name}
            </div>
            {source === 'barcode' && (
              <span className="inline-block mt-1 text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-stone-700/40 text-stone-400 border border-stone-700/50 font-mono">
                ▣ barcode scan
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Per-serving reference */}
      <div className="mb-5 p-3 bg-stone-900/40 border border-stone-800/60">
        <div className="text-[9px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-2">
          Per serving ({product.servingSize}{product.servingSizeUnit})
        </div>
        <div className="flex gap-4 text-[11px] font-mono tabular-nums">
          <span className="text-stone-300">{Math.round(product.kcalPerServing || 0)} <span className="text-stone-600">kcal</span></span>
          <span className="text-orange-300">{(product.proteinPerServing || 0).toFixed(1)}g <span className="text-stone-600">P</span></span>
          <span className="text-stone-400">{(product.carbsPerServing || 0).toFixed(1)}g <span className="text-stone-600">C</span></span>
          <span className="text-stone-400">{(product.fatPerServing || 0).toFixed(1)}g <span className="text-stone-600">F</span></span>
        </div>
      </div>

      {/* Servings input */}
      <div className="mb-5">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-2">Number of servings</div>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min="0.25"
            step="0.25"
            value={qty}
            onChange={e => setQty(e.target.value)}
            className={`${inputClass} w-28 tabular-nums`}
          />
          <span className="text-[11px] font-mono text-stone-500">
            × {product.servingSize}{product.servingSizeUnit} per serving
          </span>
        </div>
      </div>

      {/* Live macro preview */}
      <div className="mb-6 border border-orange-500/20 bg-orange-500/5 p-4">
        <div className="text-[9px] uppercase tracking-[0.2em] text-orange-400 font-mono mb-3">
          Macros for {qty || '0'} serving{parseFloat(qty) !== 1 ? 's' : ''}
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { l: 'kcal',    v: macros.kcal,    unit: '',  color: 'text-stone-100' },
            { l: 'Protein', v: macros.protein,  unit: 'g', color: 'text-orange-300' },
            { l: 'Carbs',   v: macros.carbs,    unit: 'g', color: 'text-stone-300' },
            { l: 'Fat',     v: macros.fat,      unit: 'g', color: 'text-stone-300' },
          ].map(m => (
            <div key={m.l}>
              <div className={`font-anton text-xl tabular-nums ${m.color}`}>
                {m.v}<span className="text-stone-600 text-sm">{m.unit}</span>
              </div>
              <div className="text-[9px] font-mono uppercase text-stone-600 tracking-wider mt-0.5">{m.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleConfirm}
          disabled={!qty || parseFloat(qty) <= 0}
          className="px-6 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Log Meal →
        </button>
        <button
          onClick={onBack}
          className="text-[10px] uppercase tracking-wider font-mono text-stone-500 hover:text-stone-300 px-3 py-2 border border-stone-800 hover:border-stone-700 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}

// -------------------- MANUAL FALLBACK FORM --------------------
function ManualFallback({ onAdd, onBack }) {
  const [name,    setName]    = useState('');
  const [kcal,    setKcal]    = useState('');
  const [protein, setProtein] = useState('');
  const [carbs,   setCarbs]   = useState('');
  const [fat,     setFat]     = useState('');
  const [error,   setError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const field = 'w-full bg-stone-900/60 border border-stone-700 px-4 py-2.5 text-stone-100 font-mono text-sm placeholder-stone-600 focus:outline-none focus:border-orange-500/60 transition-colors';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim())                               return setError('Meal name is required.');
    if (!kcal || isNaN(kcal) || Number(kcal) <= 0) return setError('kcal must be a positive number.');
    setError('');
    setSubmitting(true);
    await onAdd({
      name:      name.trim(),
      kcal:      Number(kcal),
      protein_g: Number(protein) || 0,
      carbs_g:   Number(carbs)   || 0,
      fat_g:     Number(fat)     || 0,
      source:    'manual',
    });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <button type="button" onClick={onBack} className="text-stone-600 hover:text-stone-300 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 2L4 7L9 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <div className="font-anton text-lg uppercase tracking-tight text-stone-100">Manual Entry</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-600">not in database · enter macros directly</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="md:col-span-2">
          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1.5">Meal name *</label>
          <input className={field} placeholder="e.g. Chicken and rice" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1.5">kcal *</label>
          <input className={field} type="number" min="1" placeholder="500" value={kcal} onChange={e => setKcal(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1.5">Protein (g)</label>
          <input className={field} type="number" min="0" placeholder="40" value={protein} onChange={e => setProtein(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1.5">Carbs (g)</label>
          <input className={field} type="number" min="0" placeholder="50" value={carbs} onChange={e => setCarbs(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1.5">Fat (g)</label>
          <input className={field} type="number" min="0" placeholder="15" value={fat} onChange={e => setFat(e.target.value)} />
        </div>
      </div>
      {error && <div className="mb-4 text-[11px] font-mono text-red-400 uppercase tracking-wider">{error}</div>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Logging…' : 'Log Meal →'}
        </button>
        <button type="button" onClick={onBack} className="text-[10px] uppercase tracking-wider font-mono text-stone-500 hover:text-stone-300 px-3 py-2 border border-stone-800 hover:border-stone-700 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// -------------------- MAIN FOOD SEARCH --------------------
export function FoodSearch({ onAdd, onCancel }) {
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [noResults,  setNoResults]  = useState(false);
  const [selected,   setSelected]   = useState(null);   // product object
  const [scanSource, setScanSource] = useState('manual'); // 'manual' | 'barcode'
  const [showCamera, setShowCamera] = useState(false);
  const [cameraAvail] = useState(() => !!navigator.mediaDevices?.getUserMedia);
  const [view, setView] = useState('search'); // 'search' | 'serving' | 'manual'
  const [barcodeError, setBarcodeError] = useState(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const timerRef  = useRef(null);
  const abortRef  = useRef(null);
  const cacheRef  = useRef(new Map());

  // Debounced search with abort controller and session cache
  useEffect(() => {
    if (!query.trim()) {
      setResults([]); setNoResults(false); setSearching(false);
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      clearTimeout(timerRef.current);
      return;
    }
    // Instant cache hit — no spinner
    if (cacheRef.current.has(query)) {
      const cached = cacheRef.current.get(query);
      setResults(cached); setNoResults(cached.length === 0); setSearching(false);
      return;
    }
    // Show skeleton immediately while debounce ticks
    setSearching(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res   = await fetch(USDA_SEARCH(query), { signal: controller.signal });
        const json  = await res.json();
        const foods = (json.foods ?? []).filter(f => f.description);
        cacheRef.current.set(query, foods);
        setResults(foods);
        setNoResults(foods.length === 0);
      } catch (e) {
        if (e.name !== 'AbortError') { setResults([]); setNoResults(true); }
      }
      setSearching(false);
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const handleSelectProduct = (food) => {
    setScanSource('search');
    setSelected(normalizeUsda(food));
    setView('serving');
  };

  const handleBarcodeResult = useCallback(async (code) => {
    setShowCamera(false);
    setBarcodeLoading(true);
    setBarcodeError(null);
    try {
      const res  = await fetch(OFF_BARCODE(code));
      const json = await res.json();
      if (json.status === 1 && json.product?.product_name) {
        setScanSource('barcode');
        setSelected(normalizeOff(json.product));
        setView('serving');
      } else {
        setBarcodeError(`Barcode ${code} not found in database.`);
      }
    } catch {
      setBarcodeError('Network error fetching barcode data.');
    }
    setBarcodeLoading(false);
  }, []);

  const handleConfirm = async (mealData) => {
    await onAdd(mealData);
    onCancel();
  };

  // ---- SERVING VIEW ----
  if (view === 'serving' && selected) {
    return (
      <ServingSelector
        product={selected}
        source={scanSource}
        onConfirm={handleConfirm}
        onBack={() => { setSelected(null); setScanSource('manual'); setView('search'); }}
      />
    );
  }

  // ---- MANUAL FALLBACK VIEW ----
  if (view === 'manual') {
    return (
      <ManualFallback
        onAdd={handleConfirm}
        onBack={() => setView('search')}
      />
    );
  }

  // ---- SEARCH VIEW ----
  return (
    <>
      {showCamera && (
        <BarcodeOverlay
          onResult={handleBarcodeResult}
          onClose={() => setShowCamera(false)}
        />
      )}

      <div className="p-6">
        {/* Search bar row */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6" cy="6" r="4.5" />
                <path d="M10 10L13 13" strokeLinecap="round" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search food database…"
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 bg-stone-900/60 border border-stone-700 text-stone-100 font-mono text-sm placeholder-stone-600 focus:outline-none focus:border-orange-500/60 transition-colors"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono uppercase tracking-wider text-stone-600">
                searching…
              </div>
            )}
          </div>

          {cameraAvail && (
            <button
              type="button"
              onClick={() => { setBarcodeError(null); setShowCamera(true); }}
              disabled={barcodeLoading}
              title="Scan barcode"
              className="px-3 py-2.5 border border-stone-700 text-stone-400 hover:text-orange-300 hover:border-orange-500/40 transition-colors disabled:opacity-50"
            >
              {barcodeLoading ? (
                <div className="w-4 h-4 border border-stone-600 border-t-orange-400 rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="1" width="4" height="14" rx="0.5" />
                  <rect x="7" y="1" width="2" height="14" rx="0.5" />
                  <rect x="11" y="1" width="1" height="14" rx="0.5" />
                  <rect x="13" y="1" width="2" height="14" rx="0.5" />
                </svg>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-stone-500 hover:text-stone-300 border border-stone-800 hover:border-stone-700 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Barcode error */}
        {barcodeError && (
          <div className="mb-3 px-3 py-2 border border-red-500/30 bg-red-500/5 text-[11px] font-mono text-red-400 uppercase tracking-wider">
            {barcodeError}
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div className="border border-stone-800/60 bg-stone-950/60 mb-3">
            {results.map((f, i) => (
              <ResultRow key={f.fdcId ?? i} food={f} onSelect={handleSelectProduct} />
            ))}
          </div>
        )}

        {/* Skeleton while searching */}
        {searching && results.length === 0 && (
          <div className="space-y-2 mb-3">
            <Sk h="h-12" />
            <Sk h="h-12" />
            <Sk h="h-12" />
          </div>
        )}

        {/* No results state */}
        {noResults && !searching && (
          <div className="border border-stone-800/60 bg-stone-950/40 p-5 mb-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-700 font-mono mb-1">Not found in database</div>
            <div className="text-stone-600 text-xs mb-4">
              "{query}" returned no matches in USDA FoodData Central.
            </div>
            <button
              onClick={() => setView('manual')}
              className="px-4 py-2 border border-stone-700 text-stone-300 font-anton text-sm uppercase tracking-wider hover:bg-stone-800 transition-colors"
            >
              Enter manually →
            </button>
          </div>
        )}

        {/* Empty / idle state */}
        {!query && !searching && results.length === 0 && (
          <div className="text-center py-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-700 font-mono mb-1">
              Search USDA FoodData Central database
            </div>
            <div className="text-stone-700 text-xs">
              Type to search or{cameraAvail ? ' scan a barcode.' : ' type a product name.'}
            </div>
            <button
              onClick={() => setView('manual')}
              className="mt-4 text-[10px] font-mono uppercase tracking-wider text-stone-600 hover:text-stone-400 transition-colors border-b border-stone-800 hover:border-stone-600 pb-px"
            >
              Skip — enter macros manually
            </button>
          </div>
        )}
      </div>
    </>
  );
}
