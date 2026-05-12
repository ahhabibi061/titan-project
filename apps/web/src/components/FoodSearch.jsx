import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/* =========================================================================
 * FoodSearch — USDA FoodData Central text search + OFF barcode scan
 * Text search: USDA only (browser-safe, no auth, no CORS issues).
 * Barcode scan: Open Food Facts product lookup (unchanged).
 * Serving size selector with live macro preview.
 * ========================================================================= */

// ---- USDA FoodData Central ----
const USDA_URL = (q) => {
  const key = import.meta.env.VITE_USDA_API_KEY ?? '';
  return `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&api_key=${key}&pageSize=10&dataType=Branded%2CFoundation%2CSR%20Legacy`;
};

const getNutrient = (nutrients, id) =>
  nutrients?.find(n => n.nutrientId === id)?.value || 0;

function normalizeUsda(food) {
  return {
    id:               'usda_' + food.fdcId,
    source:           'USDA',
    name:             food.description?.trim() || 'Unknown Food',
    brand:            food.brandOwner || food.brandName || '',
    servingSize:      food.servingSize || 100,
    servingSizeUnit:  (food.servingSizeUnit || 'g').toLowerCase(),
    kcalPerServing:   Math.round(getNutrient(food.foodNutrients, 1008)),
    proteinPerServing: Math.round(getNutrient(food.foodNutrients, 1003) * 10) / 10,
    carbsPerServing:  Math.round(getNutrient(food.foodNutrients, 1005) * 10) / 10,
    fatPerServing:    Math.round(getNutrient(food.foodNutrients, 1004) * 10) / 10,
    // Micronutrients
    fiberG:         Math.round(getNutrient(food.foodNutrients, 1079) * 10) / 10,
    sugarG:         Math.round(getNutrient(food.foodNutrients, 2000) * 10) / 10,
    sodiumMg:       Math.round(getNutrient(food.foodNutrients, 1093)),
    potassiumMg:    Math.round(getNutrient(food.foodNutrients, 1092)),
    cholesterolMg:  Math.round(getNutrient(food.foodNutrients, 1253)),
    saturatedFatG:  Math.round(getNutrient(food.foodNutrients, 1258) * 10) / 10,
    vitaminAIu:     Math.round(getNutrient(food.foodNutrients, 1104)),
    vitaminCMg:     Math.round(getNutrient(food.foodNutrients, 1162) * 10) / 10,
    calciumMg:      Math.round(getNutrient(food.foodNutrients, 1087)),
    ironMg:         Math.round(getNutrient(food.foodNutrients, 1089) * 10) / 10,
  };
}

// ---- Serving unit conversion ----
const UNIT_TO_G = { g: 1, oz: 28.35, cup: 240, tbsp: 15, tsp: 5, ml: 1 };

function computeNutrition(product, amount, unit) {
  const qty = parseFloat(amount) || 0;
  let factor;
  if (unit === 'serving') {
    factor = qty;
    return {
      kcal:            Math.round((product.kcalPerServing    || 0) * factor),
      protein:         Math.round((product.proteinPerServing || 0) * factor * 10) / 10,
      carbs:           Math.round((product.carbsPerServing   || 0) * factor * 10) / 10,
      fat:             Math.round((product.fatPerServing     || 0) * factor * 10) / 10,
      fiber_g:         Math.round((product.fiberG        || 0) * factor * 10) / 10,
      sugar_g:         Math.round((product.sugarG        || 0) * factor * 10) / 10,
      sodium_mg:       Math.round((product.sodiumMg      || 0) * factor),
      potassium_mg:    Math.round((product.potassiumMg   || 0) * factor),
      cholesterol_mg:  Math.round((product.cholesterolMg || 0) * factor),
      saturated_fat_g: Math.round((product.saturatedFatG || 0) * factor * 10) / 10,
      vitamin_a_iu:    Math.round((product.vitaminAIu    || 0) * factor),
      vitamin_c_mg:    Math.round((product.vitaminCMg    || 0) * factor * 10) / 10,
      calcium_mg:      Math.round((product.calciumMg     || 0) * factor),
      iron_mg:         Math.round((product.ironMg        || 0) * factor * 10) / 10,
    };
  }
  const grams = qty * (UNIT_TO_G[unit] || 1);
  const servingSizeG = (product.servingSizeUnit === 'g' || product.servingSizeUnit === 'ml')
    ? (product.servingSize || 100) : 100;
  factor = servingSizeG > 0 ? grams / servingSizeG : 0;
  return {
    kcal:            Math.round((product.kcalPerServing    || 0) * factor),
    protein:         Math.round((product.proteinPerServing || 0) * factor * 10) / 10,
    carbs:           Math.round((product.carbsPerServing   || 0) * factor * 10) / 10,
    fat:             Math.round((product.fatPerServing     || 0) * factor * 10) / 10,
    fiber_g:         Math.round((product.fiberG        || 0) * factor * 10) / 10,
    sugar_g:         Math.round((product.sugarG        || 0) * factor * 10) / 10,
    sodium_mg:       Math.round((product.sodiumMg      || 0) * factor),
    potassium_mg:    Math.round((product.potassiumMg   || 0) * factor),
    cholesterol_mg:  Math.round((product.cholesterolMg || 0) * factor),
    saturated_fat_g: Math.round((product.saturatedFatG || 0) * factor * 10) / 10,
    vitamin_a_iu:    Math.round((product.vitaminAIu    || 0) * factor),
    vitamin_c_mg:    Math.round((product.vitaminCMg    || 0) * factor * 10) / 10,
    calcium_mg:      Math.round((product.calciumMg     || 0) * factor),
    iron_mg:         Math.round((product.ironMg        || 0) * factor * 10) / 10,
  };
}

async function searchUsda(query, signal) {
  const res  = await fetch(USDA_URL(query), { signal });
  const json = await res.json();
  return (json.foods ?? []).filter(f => f.description).map(normalizeUsda);
}

// ---- Personal food history (nutrition_logs) ----
async function searchHistory(q, userId) {
  const { data } = await supabase
    .from('nutrition_logs')
    .select('meal_name, kcal, protein_g, carbs_g, fat_g, logged_at')
    .eq('user_id', userId)
    .ilike('meal_name', `%${q}%`)
    .order('logged_at', { ascending: false })
    .limit(100);

  const map = new Map();
  for (const row of data ?? []) {
    if (!map.has(row.meal_name)) {
      map.set(row.meal_name, { ...row, count: 1 });
    } else {
      map.get(row.meal_name).count++;
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(row => ({
      id:                'hist_' + row.meal_name,
      source:            'history',
      name:              row.meal_name,
      brand:             '',
      servingSize:       1,
      servingSizeUnit:   'serving',
      kcalPerServing:    row.kcal,
      proteinPerServing: row.protein_g,
      carbsPerServing:   row.carbs_g,
      fatPerServing:     row.fat_g,
    }));
}

// ---- Deduplication by name+brand ----
function dedup(arr) {
  const seen = new Set();
  return arr.filter(f => {
    const key = (f.name + '|' + f.brand).toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---- Open Food Facts (barcode only) ----
const OFF_BARCODE = (code) =>
  `https://world.openfoodfacts.org/api/v0/product/${code}.json`;

function parseServingG(raw) {
  if (!raw) return null;
  const m = raw.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function normalizeOff(product, source = 'barcode') {
  const n = product.nutriments ?? {};
  const servingG = parseServingG(product.serving_size) ?? 100;
  const factor = servingG / 100;
  return {
    id:               'off_' + (product.code || product.id || Date.now()),
    source,
    name:             product.product_name?.trim() || 'Unknown Food',
    brand:            product.brands?.split(',')[0]?.trim() ?? '',
    servingSize:      servingG,
    servingSizeUnit:  'g',
    kcalPerServing:   Math.round((n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0) * factor),
    proteinPerServing: Math.round((n['proteins_100g']       ?? 0) * factor * 10) / 10,
    carbsPerServing:  Math.round((n['carbohydrates_100g']   ?? 0) * factor * 10) / 10,
    fatPerServing:    Math.round((n['fat_100g']             ?? 0) * factor * 10) / 10,
  };
}

// -------------------- HELPERS --------------------
const Sk = ({ w = 'w-full', h = 'h-8' }) => (
  <div className={`${w} ${h} bg-stone-800 animate-pulse rounded-sm`} />
);

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
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
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

        <div className="relative aspect-square bg-stone-950 border border-stone-800 overflow-hidden mb-4">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-0 pointer-events-none">
            {[
              { top: 12, left: 12, rot: 0 }, { top: 12, right: 12, rot: 90 },
              { bottom: 12, right: 12, rot: 180 }, { bottom: 12, left: 12, rot: 270 },
            ].map((p, i) => (
              <div key={i} className="absolute w-8 h-8" style={{ ...p, transform: `rotate(${p.rot}deg)` }}>
                <div className="absolute top-0 left-0 w-full h-px bg-orange-400" />
                <div className="absolute top-0 left-0 w-px h-full bg-orange-400" />
              </div>
            ))}
          </div>
          {ready && !error && (
            <div className="absolute inset-x-0 pointer-events-none" style={{
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #ed7a2a, transparent)',
              animation: 'scanLine 2s ease-in-out infinite',
            }} />
          )}
          <div className="absolute top-3 left-3 bg-stone-950/80 border border-orange-500/40 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-orange-300">
            {!ready && !error ? '◌ starting camera…' : error ? '✕ error' : '◉ scanning'}
          </div>
        </div>

        {error ? (
          <div className="text-center">
            <div className="text-[11px] font-mono text-red-400 uppercase tracking-wider mb-3">{error}</div>
            <button onClick={onClose} className="px-4 py-2 border border-stone-700 text-stone-300 font-anton text-sm uppercase tracking-wider hover:bg-stone-800 transition-colors">Close</button>
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
  return (
    <button
      onClick={() => onSelect(food)}
      className="w-full text-left px-4 py-3 border-b border-stone-800/60 last:border-b-0 hover:bg-stone-900/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {food.brand && (
            <div className="text-[9px] uppercase tracking-wider text-orange-400 font-mono mb-0.5 truncate">
              {food.brand}
            </div>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-stone-200 text-sm truncate group-hover:text-stone-100 transition-colors">
              {food.name}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[11px] tabular-nums text-stone-400">
            <span className="text-stone-200">{food.kcalPerServing}</span>
            <span className="text-stone-600"> kcal</span>
          </div>
          <div className="text-[9px] font-mono text-stone-700 mt-0.5">
            per {food.servingSize}{food.servingSizeUnit}
          </div>
        </div>
      </div>
    </button>
  );
}

// -------------------- SERVING SELECTOR --------------------
function ServingSelector({ product, onConfirm, onBack, confirmLabel = 'Log Meal →' }) {
  const canUseWeight = product.servingSizeUnit === 'g' || product.servingSizeUnit === 'ml';
  const [amount, setAmount] = useState('1');
  const [unit,   setUnit]   = useState('serving');

  const nutrition = computeNutrition(product, amount, unit);

  const inputClass = 'bg-stone-900/60 border border-stone-700 px-3 py-2 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors';

  const handleConfirm = () => {
    const mealName = (product.name || 'Unknown Food') +
      (product.brand ? ' - ' + product.brand : '');
    onConfirm({
      name:      mealName,
      kcal:      isNaN(nutrition.kcal)    ? 0 : nutrition.kcal,
      protein_g: isNaN(nutrition.protein) ? 0 : nutrition.protein,
      carbs_g:   isNaN(nutrition.carbs)   ? 0 : nutrition.carbs,
      fat_g:     isNaN(nutrition.fat)     ? 0 : nutrition.fat,
      source:             'manual',
      serving_amount:     parseFloat(amount) || 1,
      serving_unit:       unit,
      fiber_g:            nutrition.fiber_g,
      sugar_g:            nutrition.sugar_g,
      sodium_mg:          nutrition.sodium_mg,
      potassium_mg:       nutrition.potassium_mg,
      cholesterol_mg:     nutrition.cholesterol_mg,
      saturated_fat_g:    nutrition.saturated_fat_g,
      vitamin_a_iu:       nutrition.vitamin_a_iu,
      vitamin_c_mg:       nutrition.vitamin_c_mg,
      calcium_mg:         nutrition.calcium_mg,
      iron_mg:            nutrition.iron_mg,
    });
  };

  return (
    <div className="p-6">
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
            {product.source === 'barcode' && (
              <span className="inline-block mt-1 text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-stone-700/40 text-stone-400 border border-stone-700/50 font-mono">
                ▣ barcode scan
              </span>
            )}
          </div>
        </div>
      </div>

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

      <div className="mb-5">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-2">Amount</div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={`${inputClass} w-28 tabular-nums`}
          />
          <select
            value={unit}
            onChange={e => setUnit(e.target.value)}
            className={`${inputClass} cursor-pointer bg-stone-900/60`}
          >
            <option value="serving">serving</option>
            {canUseWeight && (
              <>
                <option value="g">g</option>
                <option value="oz">oz</option>
                <option value="cup">cup</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
                <option value="ml">ml</option>
              </>
            )}
          </select>
          {unit === 'serving' && (
            <span className="text-[11px] font-mono text-stone-600">
              × {product.servingSize}{product.servingSizeUnit}
            </span>
          )}
        </div>
      </div>

      <div className="mb-6 border border-orange-500/20 bg-orange-500/5 p-4">
        <div className="text-[9px] uppercase tracking-[0.2em] text-orange-400 font-mono mb-3">
          Macros for {amount || '0'} {unit}
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { l: 'kcal',    v: nutrition.kcal,    unit: '',  color: 'text-stone-100' },
            { l: 'Protein', v: nutrition.protein,  unit: 'g', color: 'text-orange-300' },
            { l: 'Carbs',   v: nutrition.carbs,    unit: 'g', color: 'text-stone-300' },
            { l: 'Fat',     v: nutrition.fat,      unit: 'g', color: 'text-stone-300' },
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

      <div className="flex items-center gap-3">
        <button
          onClick={handleConfirm}
          disabled={!amount || parseFloat(amount) <= 0}
          className="px-6 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {confirmLabel}
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
function ManualFallback({ onAdd, onBack, initialName = '' }) {
  const [name,    setName]    = useState(initialName);
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
export function FoodSearch({ onAdd, onCancel, confirmLabel, userId, isPro = false }) {
  const [query,          setQuery]          = useState('');
  const [historyResults, setHistoryResults] = useState([]);
  const [usdaResults,    setUsdaResults]    = useState([]);
  const [usdaSearching,  setUsdaSearching]  = useState(false);
  const [selected,       setSelected]       = useState(null);
  const [showCamera,     setShowCamera]     = useState(false);
  const [barcodeError,   setBarcodeError]   = useState(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [view,           setView]           = useState('search'); // 'search' | 'serving' | 'manual' | 'scan_result'
  const [cameraAvail]   = useState(() => !!navigator.mediaDevices?.getUserMedia);
  const [showTip, setShowTip] = useState(() => {
    try { return !localStorage.getItem('food_search_tip_dismissed'); } catch { return true; }
  });

  // AI Meal Scanner state
  const [scanLoading,  setScanLoading]  = useState(false);
  const [scanResult,   setScanResult]   = useState(null);
  const [scanError,    setScanError]    = useState(null);
  const [scanToast,    setScanToast]    = useState('');
  const cameraInputRef = useRef(null);

  function dismissTip() {
    try { localStorage.setItem('food_search_tip_dismissed', '1'); } catch {}
    setShowTip(false);
  }

  async function handleCameraCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    setScanLoading(true);
    setScanResult(null);
    try {
      // Step 1 — convert to pure base64 (strip data URL prefix)
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          // Remove "data:image/jpeg;base64," prefix
          const b64 = result.split(',')[1];
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      console.log('[SCANNER] image captured, base64 length:', base64?.length, 'type:', file.type);

      // Step 2 — get live session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated — please sign in again');
      console.log('[SCANNER] session token present, calling Edge Function...');

      // Step 3 — call Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/analyze-meal-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || 'image/jpeg',
        }),
      });

      // Step 4 — handle response
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Server returned an invalid response');
      }
      console.log('[SCANNER] response status:', res.status, 'data:', data);

      if (!res.ok) {
        console.error('[SCANNER] error from Edge Function:', data);
        setScanError(data);
        return;
      }

      // Step 5 — show result
      setScanResult(data);
      setView('scan_result');
    } catch (err) {
      console.error('[SCANNER] caught error:', err);
      setScanError({ error: 'general', message: err.message || 'Scan failed — try again or log manually' });
    } finally {
      setScanLoading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }

  async function handleLogScan() {
    if (!scanResult) return;
    await onAdd({
      name:      scanResult.meal_name,
      kcal:      scanResult.totals.kcal,
      protein_g: scanResult.totals.protein_g,
      carbs_g:   scanResult.totals.carbs_g,
      fat_g:     scanResult.totals.fat_g,
      source:    'vision_api',
    });
    onCancel();
  }

  const timerRef        = useRef(null);
  const abortRef        = useRef(null);
  const usdaCacheRef    = useRef(new Map());
  const historyCacheRef = useRef(new Map());

  useEffect(() => {
    const q = query.trim();

    if (!q || q.length < 2) {
      setHistoryResults([]); setUsdaResults([]); setUsdaSearching(false);
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      clearTimeout(timerRef.current);
      return;
    }

    // History: fire immediately, no debounce
    if (userId) {
      if (historyCacheRef.current.has(q)) {
        setHistoryResults(historyCacheRef.current.get(q));
      } else {
        searchHistory(q, userId).then(items => {
          historyCacheRef.current.set(q, items);
          setHistoryResults(items);
        });
      }
    }

    // USDA: cache hit is instant, otherwise debounce 250ms
    if (usdaCacheRef.current.has(q)) {
      setUsdaResults(usdaCacheRef.current.get(q));
      setUsdaSearching(false);
      return;
    }

    setUsdaSearching(true);
    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      searchUsda(q, signal)
        .then(items => {
          if (signal.aborted) return;
          usdaCacheRef.current.set(q, items);
          setUsdaResults(items);
          setUsdaSearching(false);
        })
        .catch(() => {
          if (!signal.aborted) {
            setUsdaResults([]); setUsdaSearching(false);
          }
        });
    }, 250);

    return () => clearTimeout(timerRef.current);
  }, [query, userId]);

  const handleSelectFood = (food) => {
    setSelected(food);
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

  // ---- SCAN RESULT VIEW ----
  if (view === 'scan_result' && scanResult) {
    const scansLabel = scanResult.scans_limit >= 999
      ? 'Unlimited'
      : `${scanResult.scans_used}/${scanResult.scans_limit} scans today`;
    return (
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-orange-300 bg-orange-500/10 border border-orange-500/25 px-1.5 py-0.5">📷 Scan Result</span>
              <span className="text-[9px] font-mono text-stone-500">{scanResult.confidence}% confidence</span>
              <span className="text-[9px] font-mono text-stone-600">{scansLabel}</span>
            </div>
            <div className="font-anton text-lg uppercase tracking-tight text-stone-100">{scanResult.meal_name}</div>
          </div>
          <button onClick={() => { setView('search'); setScanResult(null); }} className="text-stone-600 hover:text-stone-300 font-mono text-sm ml-3 shrink-0">✕</button>
        </div>

        {/* Low confidence warning */}
        {scanResult.confidence < 60 && (
          <div className="mb-3 px-3 py-2 border border-orange-500/30 bg-orange-500/5 text-[10px] font-mono text-orange-400 uppercase tracking-wider">
            ⚠ Low confidence — please verify
          </div>
        )}

        {/* Items */}
        {scanResult.items?.length > 0 && (
          <div className="mb-4">
            <div className="text-[9px] font-mono uppercase tracking-wider text-stone-500 mb-2">Identified:</div>
            <div className="space-y-1.5">
              {scanResult.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-stone-800/40 last:border-0">
                  <span className="text-stone-300 text-sm">• {item.name}</span>
                  <span className="font-mono text-[10px] text-stone-500 shrink-0 ml-2">~{item.estimated_grams}g · {item.kcal} kcal</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="mb-4 border border-orange-500/20 bg-orange-500/5 px-4 py-3">
          <div className="font-mono text-sm tabular-nums text-stone-200">
            <span className="text-orange-300 font-anton text-xl">{scanResult.totals.kcal}</span>
            <span className="text-stone-500 text-xs ml-1">kcal</span>
            <span className="text-stone-500 mx-2">·</span>
            <span className="text-orange-300">{scanResult.totals.protein_g}</span><span className="text-stone-500 text-xs">p</span>
            <span className="text-stone-500 mx-1">·</span>
            <span className="text-stone-300">{scanResult.totals.carbs_g}</span><span className="text-stone-500 text-xs">c</span>
            <span className="text-stone-500 mx-1">·</span>
            <span className="text-stone-300">{scanResult.totals.fat_g}</span><span className="text-stone-500 text-xs">f</span>
          </div>
        </div>

        {/* Notes */}
        {scanResult.notes && (
          <div className="mb-4 text-[10px] font-mono text-stone-600 italic">{scanResult.notes}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleLogScan}
            className="flex-1 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors"
          >
            Log This Meal →
          </button>
          <button
            onClick={() => { setView('search'); setScanResult(null); }}
            className="px-4 py-2.5 border border-stone-700 text-stone-400 font-mono text-[10px] uppercase tracking-wider hover:border-stone-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ---- SERVING VIEW ----
  if (view === 'serving' && selected) {
    return (
      <ServingSelector
        product={selected}
        onConfirm={handleConfirm}
        onBack={() => { setSelected(null); setView('search'); }}
        confirmLabel={confirmLabel}
      />
    );
  }

  // ---- MANUAL FALLBACK VIEW ----
  if (view === 'manual') {
    return <ManualFallback onAdd={handleConfirm} onBack={() => setView('search')} initialName={query} />;
  }

  // ---- SEARCH VIEW ----
  return (
    <>
      {showCamera && (
        <BarcodeOverlay onResult={handleBarcodeResult} onClose={() => setShowCamera(false)} />
      )}

      <div className="p-6">
        {/* Guidance tip */}
        {showTip && (
          <div className="mb-3 flex items-start gap-2 bg-stone-900/60 border border-stone-800 px-3 py-2.5">
            <span className="text-orange-400 font-mono text-[9px] mt-px shrink-0">ⓘ</span>
            <div className="flex-1 min-w-0 text-[11px] text-stone-500 leading-relaxed">
              Scan barcode for packaged products<br />
              Search by name for whole foods &amp; ingredients
            </div>
            <button
              onClick={dismissTip}
              className="shrink-0 text-stone-700 hover:text-stone-400 font-mono text-sm leading-none transition-colors"
            >×</button>
          </div>
        )}

        {/* Search bar */}
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
              placeholder="Search databases…"
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 bg-stone-900/60 border border-stone-700 text-stone-100 font-mono text-sm placeholder-stone-600 focus:outline-none focus:border-orange-500/60 transition-colors"
            />
            {usdaSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono uppercase tracking-wider text-stone-600">
                searching…
              </div>
            )}
          </div>

          {/* AI camera button — 36×36px */}
          <button
            type="button"
            onClick={() => {
              if (!isPro) {
                setScanToast('AI Meal Scanner — Pro Feature');
                setTimeout(() => setScanToast(''), 2500);
                return;
              }
              setScanError(null);
              cameraInputRef.current?.click();
            }}
            disabled={scanLoading}
            title={isPro ? 'AI Meal Scanner' : 'AI Meal Scanner — Pro Feature'}
            className="relative w-9 h-9 shrink-0 border border-stone-700 bg-stone-950 text-stone-400 hover:text-orange-400 hover:border-orange-500/40 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {scanLoading ? (
              <div className="w-4 h-4 border border-stone-600 border-t-orange-400 rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            )}
            {!isPro && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-stone-900 border border-stone-700 flex items-center justify-center">
                <svg width="7" height="7" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="1" y="5" width="8" height="6" rx="0.5"/>
                  <path d="M3 5V3.5a2 2 0 0 1 4 0V5"/>
                </svg>
              </span>
            )}
          </button>
          {/* Hidden file input for camera */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraCapture}
          />

          {/* Barcode button — 36×36px */}
          {cameraAvail && (
            <button
              type="button"
              onClick={() => { setBarcodeError(null); setShowCamera(true); }}
              disabled={barcodeLoading}
              title="Scan barcode"
              className="w-9 h-9 shrink-0 border border-stone-700 bg-stone-950 text-stone-400 hover:text-orange-400 hover:border-orange-500/40 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {barcodeLoading ? (
                <div className="w-4 h-4 border border-stone-600 border-t-orange-400 rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8V6a2 2 0 0 1 2-2h2"/>
                  <path d="M3 16v2a2 2 0 0 0 2 2h2"/>
                  <path d="M16 3h2a2 2 0 0 1 2 2v2"/>
                  <path d="M16 21h2a2 2 0 0 0 2-2v-2"/>
                  <line x1="7" y1="12" x2="17" y2="12" strokeDasharray="2 1"/>
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

        {/* Pro-gate toast */}
        {scanToast && (
          <div className="mb-3 px-3 py-2 border border-orange-500/30 bg-orange-500/5 text-[11px] font-mono text-orange-400 uppercase tracking-wider flex items-center justify-between">
            <span>{scanToast}</span>
            <a href="/settings" className="text-orange-300 hover:underline ml-3">Upgrade →</a>
          </div>
        )}

        {/* Scan error banners */}
        {scanError && scanError.error === 'upgrade_required' && (
          <div className="mb-3 px-3 py-2.5 border border-orange-500/30 bg-orange-500/5 flex items-center justify-between">
            <span className="text-[11px] font-mono text-orange-400 uppercase tracking-wider">AI Meal Scanner is a Pro feature</span>
            <a href="/settings" className="text-[10px] font-mono uppercase tracking-wider text-orange-300 hover:underline ml-3">Upgrade to Pro →</a>
          </div>
        )}
        {scanError && scanError.error === 'rate_limit_exceeded' && (
          <div className="mb-3 px-3 py-2.5 border border-stone-700 bg-stone-900/40 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-stone-300 uppercase tracking-wider">{scanError.message}</div>
              <div className="text-[9px] font-mono text-stone-600 mt-0.5">Resets at midnight</div>
            </div>
            <button onClick={() => setScanError(null)} className="text-stone-600 hover:text-stone-400 font-mono text-sm ml-3">✕</button>
          </div>
        )}
        {scanError && scanError.error !== 'upgrade_required' && scanError.error !== 'rate_limit_exceeded' && (
          <div className="mb-3 px-3 py-2.5 border border-stone-700 bg-stone-900/40 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono text-stone-300 uppercase tracking-wider">
                Could not analyze image
              </div>
              <div className="text-[9px] font-mono text-stone-600 mt-0.5">
                Search manually instead — or try a clearer photo
              </div>
            </div>
            <button
              onClick={() => { setScanError(null); setView('search'); }}
              className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 border border-stone-600 text-stone-400 hover:text-stone-200 hover:border-stone-500 transition-colors shrink-0"
            >
              Search →
            </button>
          </div>
        )}

        {/* Barcode error */}
        {barcodeError && (
          <div className="mb-3 px-3 py-2 border border-red-500/30 bg-red-500/5 text-[11px] font-mono text-red-400 uppercase tracking-wider">
            {barcodeError}
          </div>
        )}

        {/* MY FOODS — personal history, appears instantly */}
        {historyResults.length > 0 && (
          <div className="border border-stone-800/60 bg-stone-950/60 mb-3">
            <div className="px-4 py-1.5 border-b border-stone-800/60 bg-orange-500/5">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-orange-400">My Foods</span>
            </div>
            {historyResults.map(f => (
              <ResultRow key={f.id} food={f} onSelect={handleSelectFood} />
            ))}
          </div>
        )}

        {/* USDA results */}
        {usdaResults.length > 0 && (
          <div className="border border-stone-800/60 bg-stone-950/60 mb-3">
            <div className="px-4 py-1.5 border-b border-stone-800/60">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-stone-600">Food Database</span>
            </div>
            {usdaResults.map(f => (
              <ResultRow key={f.id} food={f} onSelect={handleSelectFood} />
            ))}
          </div>
        )}

        {/* USDA skeleton while loading */}
        {usdaSearching && usdaResults.length === 0 && (
          <div className="border border-stone-800/60 bg-stone-950/60 mb-3">
            <div className="px-4 py-1.5 border-b border-stone-800/60">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-stone-600">Food Database</span>
            </div>
            <div className="p-3 space-y-2">
              <Sk h="h-12" />
              <Sk h="h-12" />
              <Sk h="h-12" />
            </div>
          </div>
        )}

        {/* No results — both sources empty and USDA done */}
        {!usdaSearching && usdaResults.length === 0 && historyResults.length === 0 && query.trim().length >= 2 && (
          <div className="border border-stone-800/60 bg-stone-950/40 p-5 mb-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-700 font-mono mb-3">Not found</div>
            <button
              onClick={() => setView('manual')}
              className="w-full py-3 border border-orange-500/40 text-orange-300 font-mono text-[11px] uppercase tracking-wider hover:bg-orange-500/10 transition-colors"
            >
              Add manually: {query.trim()}
            </button>
          </div>
        )}

        {/* Idle state */}
        {!query && historyResults.length === 0 && usdaResults.length === 0 && !usdaSearching && (
          <div className="text-center py-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-700 font-mono mb-1">
              Search databases · your logged foods appear first
            </div>
            <div className="text-stone-700 text-xs">
              Type 2+ characters to search
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
