import React, { useState, useMemo } from 'react';
import { useSession } from '../hooks/useSession';
import { useSentinel } from '../hooks/useSentinel';
import { FoodSearch } from '../components/FoodSearch';
import { MacroBreakdownModal } from '../components/MacroBreakdownModal';
import AppNav from '../components/AppNav';
import { useProfileStore } from '../store/useProfileStore';
import { useMealTemplates } from '../hooks/useMealTemplates';
import { useWaterTracker } from '../hooks/useWaterTracker';
import { useUnits } from '../hooks/useUnits';
import { supabase } from '../lib/supabase';

/* =========================================================================
 * SENTINEL — Module 1
 * Camera scan flow + live meal log wired to Supabase nutrition_logs.
 * Manual entry, date navigation, delete with inline confirm.
 * ========================================================================= */

// -------------------- HELPERS --------------------
const fmt0 = (n) => Math.round(n).toLocaleString('en-US');

// -------------------- SKELETON --------------------
const Sk = ({ w = 'w-16', h = 'h-3' }) => (
  <div className={`${w} ${h} bg-stone-800 animate-pulse rounded-sm`} />
);

// -------------------- FOOD ILLUSTRATION --------------------
function MealIllustration() {
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full">
      <defs>
        <radialGradient id="bowl-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3a342e" />
          <stop offset="80%" stopColor="#1f1c19" />
          <stop offset="100%" stopColor="#0f0d0b" />
        </radialGradient>
        <radialGradient id="rice-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e8d4a8" />
          <stop offset="100%" stopColor="#c4a878" />
        </radialGradient>
        <radialGradient id="chicken-grad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#c47a3d" />
          <stop offset="100%" stopColor="#7a4520" />
        </radialGradient>
        <radialGradient id="avo-grad" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#9bc46a" />
          <stop offset="100%" stopColor="#5a7c3a" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="178" fill="url(#bowl-grad)" stroke="#2a2622" strokeWidth="2" />
      <circle cx="200" cy="200" r="160" fill="none" stroke="#3a342e" strokeWidth="1" opacity="0.6" />
      <g opacity="0.95">
        {Array.from({ length: 32 }).map((_, i) => {
          const angle = (i / 32) * Math.PI * 2;
          const r = 60 + (i % 4) * 18;
          const cx = 230 + Math.cos(angle) * r * 0.4;
          const cy = 220 + Math.sin(angle) * r * 0.4;
          return <ellipse key={i} cx={cx} cy={cy} rx="6" ry="3.2" fill="url(#rice-grad)" transform={`rotate(${(i * 23) % 180} ${cx} ${cy})`} />;
        })}
      </g>
      <ellipse cx="148" cy="148" rx="34" ry="22" fill="url(#chicken-grad)" transform="rotate(-25 148 148)" />
      <ellipse cx="172" cy="120" rx="30" ry="18" fill="url(#chicken-grad)" transform="rotate(20 172 120)" />
      <ellipse cx="120" cy="178" rx="28" ry="18" fill="url(#chicken-grad)" transform="rotate(-50 120 178)" />
      <ellipse cx="200" cy="148" rx="26" ry="16" fill="url(#chicken-grad)" transform="rotate(45 200 148)" />
      <path d="M 84,260 Q 100,234 132,250 Q 124,288 88,288 Z" fill="url(#avo-grad)" />
      <path d="M 96,266 Q 108,258 122,266" fill="none" stroke="#3a5028" strokeWidth="1" opacity="0.5" />
      <g fill="#2a1a14">
        {[[220,280],[240,270],[260,282],[232,296],[252,300],[276,286],[212,296],[248,266]].map(([cx,cy],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="6" ry="4.5" />
        ))}
      </g>
      <g fill="#c83a28" opacity="0.85">
        {[[280,138],[290,154],[272,156],[296,130],[306,144],[284,124]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="3.5" />
        ))}
      </g>
      <path d="M 138,238 Q 120,238 122,256 Q 138,254 144,244 Z" fill="#b8c84a" />
      <path d="M 138,240 L 138,254" stroke="#7a8a2a" strokeWidth="0.5" />
    </svg>
  );
}

// -------------------- CALORIE RING --------------------
function CalorieRing({ consumed, target }) {
  const { displayEnergy, energyLabel } = useUnits();
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const radius = 76;
  const c = 2 * Math.PI * radius;
  const remaining = Math.max(target - consumed, 0);
  return (
    <div className="relative w-48 h-48">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle cx="100" cy="100" r={radius} fill="none" stroke="url(#ring-grad)" strokeWidth="10"
          strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 800ms ease' }} />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ff5a2a" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-mono">Consumed</div>
        <div className="font-anton text-4xl tabular-nums text-stone-100 leading-none mt-1">{displayEnergy(consumed, { noUnit: true })}</div>
        <div className="text-[10px] text-stone-500 font-mono mt-1">/ {displayEnergy(target, { noUnit: true })} {energyLabel}</div>
        <div className="mt-2 px-2 py-0.5 border border-stone-800 text-[9px] font-mono tabular-nums uppercase tracking-wider">
          <span className="text-stone-600">left</span> <span className="text-orange-300">{displayEnergy(remaining, { noUnit: true })}</span>
        </div>
      </div>
    </div>
  );
}

// -------------------- MACRO BAR --------------------
function MacroBar({ label, consumed, target, color }) {
  const pct = Math.min((consumed / Math.max(target, 1)) * 100, 100);
  const remaining = Math.max(target - consumed, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-stone-400">
          <span className="text-stone-200">{fmt0(consumed)}</span>
          <span className="text-stone-600"> / {fmt0(target)} g</span>
          <span className="text-stone-700"> · </span>
          <span className="text-stone-500">{fmt0(remaining)} left</span>
        </span>
      </div>
      <div className="relative h-1.5 bg-stone-900/80">
        <div className="absolute inset-y-0 left-0 transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// -------------------- MEAL ENTRY --------------------
function MealEntry({ meal, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const time = new Date(meal.logged_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  return (
    <div className="flex items-center gap-3 py-3 border-b border-stone-800/40 last:border-b-0">
      <span className="font-mono text-[10px] tabular-nums text-stone-600 w-12 shrink-0">{time}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-stone-200 text-sm truncate">{meal.name}</span>
          {meal.source === 'vision_api' && (
            <span className="text-[8px] uppercase tracking-wider px-1 py-0.5 bg-orange-500/15 text-orange-300 border border-orange-500/25 font-mono shrink-0">
              ◌ vision
            </span>
          )}
          {meal.source === 'barcode' && (
            <span className="text-[8px] uppercase tracking-wider px-1 py-0.5 bg-stone-700/40 text-stone-400 border border-stone-700/50 font-mono shrink-0">
              ▣ barcode
            </span>
          )}
          {meal.source === 'manual' && (
            <span className="text-[8px] uppercase tracking-wider px-1 py-0.5 bg-stone-900/60 text-stone-600 border border-stone-800/60 font-mono shrink-0">
              ✎ manual
            </span>
          )}
        </div>
        <div className="flex gap-3 text-[10px] font-mono tabular-nums mt-0.5">
          <span className="text-stone-500">{meal.kcal} kcal</span>
          <span className="text-stone-600">{meal.protein_g}p · {meal.carbs_g}c · {meal.fat_g}f</span>
        </div>
      </div>
      {confirming ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">Delete?</span>
          <button
            onClick={() => onDelete(meal.id)}
            className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 border border-stone-700 text-stone-500 hover:bg-stone-800 transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="shrink-0 text-stone-700 hover:text-stone-400 transition-colors p-1"
          aria-label="Delete meal"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3.5h10M5.5 3.5V2.5h3v1M11 3.5l-.75 8.5H3.75L3 3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// -------------------- ADD MEAL FORM --------------------
// AddMealForm replaced by FoodSearch component (Open Food Facts + barcode)

// -------------------- MEAL SECTION --------------------
const MEAL_COLORS = { breakfast: '#fbbf24', lunch: '#ed7a2a', dinner: '#f87171', snacks: '#78716c' };

function MealSection({ type, section, activeAddSection, setActiveAddSection, addMeal, deleteMeal, userId, isPro }) {
  const [collapsed, setCollapsed] = useState(false);
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  const color = MEAL_COLORS[type];
  const { meals: sectionMeals, totals } = section;

  function handleAdd(item) {
    addMeal({ ...item, meal_type: type });
    setActiveAddSection(null);
  }

  return (
    <div className="border-b border-stone-800/60 last:border-0">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-900/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 shrink-0" style={{ backgroundColor: color }} />
          <span className="font-anton text-base uppercase tracking-tight text-stone-100">{label}</span>
          {sectionMeals.length > 0 && (
            <span className="font-mono text-[10px] text-stone-500 tabular-nums">
              {sectionMeals.length} item{sectionMeals.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {totals.kcal > 0 && (
            <span className="font-mono text-xs tabular-nums text-stone-400">{Math.round(totals.kcal)} kcal</span>
          )}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
            className={`text-stone-600 transition-transform ${collapsed ? '' : 'rotate-180'}`}>
            <path d="M2 4L6 8L10 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
      {!collapsed && (
        <div className="px-5 pb-4">
          {sectionMeals.length > 0 && (
            <div className="mb-3">
              {sectionMeals.map(m => <MealEntry key={m.id} meal={m} onDelete={deleteMeal} />)}
            </div>
          )}
          {activeAddSection === type ? (
            <FoodSearch
              onAdd={handleAdd}
              onCancel={() => setActiveAddSection(null)}
              confirmLabel="Add →"
              userId={userId}
              isPro={isPro}
            />
          ) : (
            <button
              onClick={() => setActiveAddSection(type)}
              className="w-full py-2.5 border border-dashed border-stone-700 text-stone-600 font-mono text-xs uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors"
            >
              + Add Food
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------- TEMPLATE PANEL (MEAL BUNDLES) --------------------
function TemplatePanel({ templates, loading, onClose, onLogAll, onSave, onDelete, isPro, userId }) {
  const [tab, setTab]                     = useState('list');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [bundleName, setBundleName]       = useState('');
  const [bundleItems, setBundleItems]     = useState([]);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState('');

  const bundleTotals = bundleItems.reduce(
    (acc, item) => ({
      kcal:      acc.kcal      + (item.kcal      ?? 0),
      protein_g: acc.protein_g + (item.protein_g ?? 0),
      carbs_g:   acc.carbs_g   + (item.carbs_g   ?? 0),
      fat_g:     acc.fat_g     + (item.fat_g     ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  function addToBundle(item) {
    setBundleItems(prev => [...prev, { name: item.name, kcal: item.kcal, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g }]);
    setShowFoodSearch(false);
  }

  async function handleSave() {
    if (!bundleName.trim() || bundleItems.length === 0) return;
    setSaving(true);
    await onSave({ name: bundleName.trim(), items: bundleItems, ...bundleTotals });
    setSaving(false);
    setBundleName('');
    setBundleItems([]);
    setTab('list');
    setToast('Bundle saved ✓');
    setTimeout(() => setToast(''), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-950/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0a0908] border-t border-stone-800 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Meal Templates</h2>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 font-mono text-sm">✕</button>
        </div>

        {!isPro ? (
          <div className="flex-1 flex items-center justify-center py-16 text-center px-6">
            <div>
              <div className="font-anton text-2xl uppercase text-stone-300 mb-2">Pro Feature</div>
              <div className="text-[11px] font-mono text-stone-500 mb-4">Meal templates require a Pro or Elite subscription</div>
              <a href="/settings" className="inline-block px-5 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors">
                Upgrade to Pro →
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-stone-800">
              {['list', 'build'].map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setShowFoodSearch(false); }}
                  className={`flex-1 py-3 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
                    tab === t
                      ? 'text-orange-300 border-b-2 border-orange-500'
                      : 'text-stone-600 hover:text-stone-400'
                  }`}
                >
                  {t === 'list' ? 'My Templates' : 'Build New'}
                </button>
              ))}
            </div>

            {/* MY TEMPLATES tab */}
            {tab === 'list' && (
              loading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="text-stone-600 font-mono text-xs uppercase tracking-wider">Loading…</div>
                </div>
              ) : templates.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-6 gap-4">
                  <div className="text-stone-600 font-mono text-xs uppercase tracking-wider leading-relaxed">
                    No bundles yet<br />
                    <span className="text-stone-700">Build one in the Build New tab</span>
                  </div>
                  <button
                    onClick={() => setTab('build')}
                    className="px-5 py-2.5 border border-orange-500/40 text-orange-300 font-mono text-xs uppercase tracking-wider hover:bg-orange-500/10 transition-colors"
                  >
                    Build New Bundle →
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {templates.map(tmpl => (
                    <div key={tmpl.id} className="flex items-center gap-4 px-6 py-4 border-b border-stone-800/40 hover:bg-stone-900/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-stone-100 text-sm">{tmpl.name}</span>
                          {tmpl.times_used > 0 && (
                            <span className="text-[8px] font-mono text-stone-600 uppercase tracking-wider">{tmpl.times_used}×</span>
                          )}
                        </div>
                        <div className="flex gap-3 text-[10px] font-mono tabular-nums text-stone-500 mb-1">
                          <span className="text-stone-400">{tmpl.kcal} kcal</span>
                          <span>{tmpl.protein_g}g P</span>
                          <span>{tmpl.carbs_g}g C</span>
                          <span>{tmpl.fat_g}g F</span>
                        </div>
                        {tmpl.items?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tmpl.items.map((item, i) => (
                              <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 bg-stone-800/60 text-stone-600 border border-stone-700/50">
                                {item.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { onLogAll(tmpl); setToast('Logged ✓'); setTimeout(() => setToast(''), 2000); }}
                          className="px-3 py-2 border border-orange-500/40 text-orange-300 font-mono text-[10px] uppercase tracking-wider hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                        >
                          Log All →
                        </button>
                        {deleteConfirm === tmpl.id ? (
                          <>
                            <button onClick={() => { onDelete(tmpl.id); setDeleteConfirm(null); }}
                              className="text-[9px] font-mono px-2 py-1.5 border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors">Del</button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="text-[9px] font-mono px-2 py-1.5 border border-stone-700 text-stone-500 hover:bg-stone-800 transition-colors">✕</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(tmpl.id)}
                            className="p-1.5 text-stone-700 hover:text-red-400 transition-colors">
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M2 3.5h10M5.5 3.5V2.5h3v1M11 3.5l-.75 8.5H3.75L3 3.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* BUILD NEW tab */}
            {tab === 'build' && (
              <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="p-6 space-y-4 flex-1">
                  <div>
                    <label className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono block mb-1.5">Bundle Name</label>
                    <input
                      type="text"
                      value={bundleName}
                      onChange={e => setBundleName(e.target.value)}
                      placeholder="e.g. Pre-Workout Meal"
                      className="w-full bg-stone-900/60 border border-stone-700 px-3 py-2.5 text-stone-100 font-sans text-sm focus:outline-none focus:border-orange-500/60 transition-colors placeholder-stone-700"
                    />
                  </div>

                  {bundleItems.length > 0 && (
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-2">Items</div>
                      <div className="space-y-1">
                        {bundleItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 py-2 border-b border-stone-800/40 last:border-0">
                            <div className="flex-1 min-w-0">
                              <div className="text-stone-200 text-sm truncate">{item.name}</div>
                              <div className="text-[10px] font-mono text-stone-600">
                                {item.kcal} kcal · {item.protein_g}p · {item.carbs_g}c · {item.fat_g}f
                              </div>
                            </div>
                            <button onClick={() => setBundleItems(prev => prev.filter((_, i) => i !== idx))}
                              className="text-stone-700 hover:text-red-400 transition-colors p-1">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M2 2L10 10M10 2L2 10" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-stone-800/60 flex gap-4 text-[10px] font-mono tabular-nums">
                        <span className="text-stone-400">{Math.round(bundleTotals.kcal)} kcal</span>
                        <span className="text-stone-500">{Math.round(bundleTotals.protein_g)}g P</span>
                        <span className="text-stone-500">{Math.round(bundleTotals.carbs_g)}g C</span>
                        <span className="text-stone-500">{Math.round(bundleTotals.fat_g)}g F</span>
                      </div>
                    </div>
                  )}

                  {showFoodSearch ? (
                    <FoodSearch
                      onAdd={addToBundle}
                      onCancel={() => setShowFoodSearch(false)}
                      confirmLabel="Add to Bundle →"
                      userId={userId}
                      isPro={isPro}
                    />
                  ) : (
                    <button
                      onClick={() => setShowFoodSearch(true)}
                      className="w-full py-3 border border-dashed border-stone-700 text-stone-600 font-mono text-xs uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors"
                    >
                      + Add Food
                    </button>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-stone-800 bg-stone-950/60">
                  <button
                    onClick={handleSave}
                    disabled={!bundleName.trim() || bundleItems.length === 0 || saving}
                    className="w-full py-3 bg-orange-500 text-stone-950 font-anton text-base uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : 'Save Bundle →'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {toast && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-stone-900/95 border border-orange-500/30 px-5 py-2.5 pointer-events-none">
            <span className="text-orange-300 font-mono text-xs uppercase tracking-wider">{toast}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------- WATER TRACKER --------------------
const ML_TO_OZ = 0.033814;
function mlToDisplay(ml, unit) {
  return unit === 'lbs' ? +(ml * ML_TO_OZ).toFixed(1) : ml;
}
function displayLabel(unit) { return unit === 'lbs' ? 'fl oz' : 'ml'; }

function WaterLogEntry({ entry, unit, onUpdate, onDelete }) {
  const [editing, setEditing]       = useState(false);
  const [editVal, setEditVal]       = useState('');
  const [delConfirm, setDelConfirm] = useState(false);

  const isFlOz = unit === 'floz' || unit === 'lbs'; // 'lbs' kept for legacy compat
  const displayAmt = isFlOz ? +(entry.amount_ml * ML_TO_OZ).toFixed(0) : entry.amount_ml;
  const lbl = isFlOz ? 'oz' : 'ml';
  const time = new Date(entry.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  function startEdit() {
    setEditVal(String(displayAmt));
    setEditing(true);
    setDelConfirm(false);
  }

  function confirmEdit() {
    const val = parseFloat(editVal);
    if (isNaN(val) || val <= 0) { setEditing(false); return; }
    const ml = isFlOz ? Math.round(val / ML_TO_OZ) : Math.round(val);
    onUpdate(entry.id, ml);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2.5 border-b border-stone-800/40 last:border-b-0">
        <input
          type="number"
          autoFocus
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-20 bg-stone-950/60 border border-blue-500/60 px-2 py-1 text-stone-100 font-mono text-sm focus:outline-none"
        />
        <span className="text-stone-600 font-mono text-xs">{lbl}</span>
        <button
          onClick={confirmEdit}
          className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors"
        >✓</button>
        <button
          onClick={() => setEditing(false)}
          className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 border border-stone-700 text-stone-500 hover:bg-stone-800 transition-colors"
        >✕</button>
      </div>
    );
  }

  if (delConfirm) {
    return (
      <div className="flex items-center gap-2 py-2.5 border-b border-stone-800/40 last:border-b-0">
        <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider flex-1">Remove this entry?</span>
        <button
          onClick={() => { onDelete(entry.id); setDelConfirm(false); }}
          className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
        >Remove</button>
        <button
          onClick={() => setDelConfirm(false)}
          className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 border border-stone-700 text-stone-500 hover:bg-stone-800 transition-colors"
        >Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-stone-800/40 last:border-b-0 group">
      <span className="font-mono text-[11px] tabular-nums text-blue-300/80 w-16 shrink-0">
        {displayAmt}{lbl}
      </span>
      <span className="font-mono text-[10px] text-stone-600 flex-1">— {time}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={startEdit}
          className="p-1.5 text-stone-700 hover:text-blue-400 transition-colors"
          aria-label="Edit entry"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => setDelConfirm(true)}
          className="p-1.5 text-stone-700 hover:text-red-400 transition-colors"
          aria-label="Delete entry"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1.5 3h9M4 3V2h4v1M9.5 3L9 10H3L2.5 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function WaterTracker({ water }) {
  const { displayVolume, parseVolume, volumeUnit, volumeLabel } = useUnits();

  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput]     = useState('');
  const [customInput, setCustomInput]     = useState('');
  const [editingCustom, setEditingCustom] = useState(false);
  const [showSetTotal, setShowSetTotal]   = useState(false);
  const [setTotalInput, setSetTotalInput] = useState('');

  const { logs, totalMl, targetMl, loading, addWater, updateWater, deleteWater, setTotal, setTarget } = water;
  const pct = Math.min(totalMl / Math.max(targetMl, 1), 1.0);

  const barColor = pct >= 1.0
    ? '#4ade80'
    : pct >= 0.75
    ? '#93c5fd'
    : pct >= 0.50
    ? '#60a5fa'
    : '#1e40af';

  const isFlOz    = volumeUnit === 'floz';
  const dispTotal  = isFlOz ? Math.round(totalMl  * ML_TO_OZ) : totalMl;
  const dispTarget = isFlOz ? Math.round(targetMl * ML_TO_OZ) : targetMl;
  const lbl        = isFlOz ? 'fl oz' : 'ml';

  const quickAdds = [250, 500, 750, 1000];

  function handleTargetSave() {
    const val = parseFloat(targetInput);
    const ml  = Math.round(parseVolume(val));
    if (ml >= 500 && ml <= 10000) setTarget(ml);
    setEditingTarget(false);
  }

  function handleCustomAdd() {
    const val = parseFloat(customInput);
    const ml  = Math.round(parseVolume(val));
    if (ml > 0 && ml <= 5000) addWater(ml);
    setCustomInput('');
    setEditingCustom(false);
  }

  function handleSetTotal() {
    const val = parseFloat(setTotalInput);
    const ml  = Math.round(parseVolume(val));
    if (!isNaN(ml) && ml >= 0) setTotal(ml);
    setShowSetTotal(false);
    setSetTotalInput('');
  }

  return (
    <div className="border border-stone-800/60 bg-stone-950/40 p-6 mb-8">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Water Intake</h2>
        <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">resets at midnight</span>
      </div>

      <div className="flex items-center gap-6 mb-5">
        {/* Drop icon */}
        <svg width="40" height="52" viewBox="0 0 40 52" fill="none" className="shrink-0">
          <path d="M20 4 C20 4 4 22 4 34 C4 44.5 11.2 50 20 50 C28.8 50 36 44.5 36 34 C36 22 20 4 20 4Z"
            fill={pct >= 1.0 ? '#4ade80' : pct >= 0.75 ? '#93c5fd' : pct >= 0.5 ? '#60a5fa' : '#1e40af'}
            opacity={0.15 + pct * 0.6}
            stroke={pct >= 1.0 ? '#4ade80' : '#60a5fa'}
            strokeWidth="1.5"
          />
          <clipPath id="water-clip">
            <path d="M20 4 C20 4 4 22 4 34 C4 44.5 11.2 50 20 50 C28.8 50 36 44.5 36 34 C36 22 20 4 20 4Z" />
          </clipPath>
          <rect x="4" y={50 - (46 * pct)} width="32" height={46 * pct} fill={barColor} opacity="0.5" clipPath="url(#water-clip)" />
        </svg>

        {/* Current / Target */}
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <button
              className="font-anton text-4xl tabular-nums text-blue-300 hover:text-blue-200 transition-colors"
              onClick={() => { setSetTotalInput(String(dispTotal)); setShowSetTotal(true); }}
              title="Tap to set total"
            >
              {loading ? '—' : dispTotal.toLocaleString()}
            </button>
            <span className="text-stone-500 font-mono text-base">/ </span>
            <button
              className="font-anton text-2xl tabular-nums text-stone-500 hover:text-stone-300 transition-colors"
              onClick={() => { setTargetInput(String(dispTarget)); setEditingTarget(true); }}
              title="Tap to edit target"
            >
              {dispTarget.toLocaleString()}
            </button>
            <span className="text-stone-600 font-mono text-sm">{lbl}</span>
          </div>
          {/* Progress bar */}
          <div className="relative h-2 bg-stone-900 rounded-full overflow-hidden mb-1">
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 1) * 100}%`, backgroundColor: barColor }} />
          </div>
          <div className="font-mono text-[10px] text-stone-500 uppercase tracking-wider">
            {pct >= 1.0
              ? <span className="text-green-400">Goal reached! 💧</span>
              : `${Math.round(pct * 100)}% of daily goal`}
          </div>
        </div>
      </div>

      {/* Quick add buttons */}
      <div className="flex gap-2 flex-wrap">
        {quickAdds.map(ml => {
          const display = isFlOz ? `+${Math.round(ml * ML_TO_OZ)}oz` : `+${ml}ml`;
          return (
            <button
              key={ml}
              onClick={() => addWater(ml)}
              className="px-4 py-2.5 border border-stone-700 text-stone-400 font-mono text-[11px] uppercase tracking-wider hover:border-blue-500/60 hover:text-blue-300 hover:bg-blue-500/5 transition-colors"
            >
              {display}
            </button>
          );
        })}
        <button
          onClick={() => setEditingCustom(true)}
          className="px-4 py-2.5 border border-dashed border-stone-700 text-stone-600 font-mono text-[11px] uppercase tracking-wider hover:border-stone-500 hover:text-stone-400 transition-colors"
        >
          Custom
        </button>
      </div>

      {/* Custom amount input */}
      {editingCustom && (
        <div className="mt-4 flex items-center gap-2">
          <input
            type="number"
            autoFocus
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomAdd()}
            placeholder={lbl}
            className="w-32 bg-stone-950/60 border border-stone-800 px-3 py-2 text-stone-100 font-mono text-sm focus:outline-none focus:border-blue-500/60 transition-colors"
          />
          <span className="text-stone-600 font-mono text-xs">{lbl}</span>
          <button onClick={handleCustomAdd} className="px-4 py-2 bg-blue-600 text-stone-950 font-anton text-sm uppercase hover:bg-blue-500 transition-colors">Add</button>
          <button onClick={() => { setEditingCustom(false); setCustomInput(''); }} className="text-stone-600 font-mono text-xs hover:text-stone-400 transition-colors">Cancel</button>
        </div>
      )}

      {/* Today's log entries */}
      {!loading && logs.length > 0 && (
        <div className="mt-5 pt-5 border-t border-stone-800/60">
          <div className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono mb-1">Today's entries</div>
          {logs.map(entry => (
            <WaterLogEntry
              key={entry.id}
              entry={entry}
              unit={volumeUnit}
              onUpdate={updateWater}
              onDelete={deleteWater}
            />
          ))}
        </div>
      )}

      {/* Edit target inline */}
      {editingTarget && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">Daily target:</span>
          <input
            type="number"
            autoFocus
            value={targetInput}
            onChange={e => setTargetInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTargetSave()}
            className="w-28 bg-stone-950/60 border border-stone-800 px-3 py-2 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors"
          />
          <span className="text-stone-600 font-mono text-xs">{lbl}</span>
          <button onClick={handleTargetSave} className="px-4 py-2 bg-orange-500 text-stone-950 font-anton text-sm uppercase hover:bg-orange-400 transition-colors">Save</button>
          <button onClick={() => setEditingTarget(false)} className="text-stone-600 font-mono text-xs hover:text-stone-400 transition-colors">Cancel</button>
        </div>
      )}

      {/* Set Total Modal */}
      {showSetTotal && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/90 flex items-center justify-center px-4"
          onClick={() => setShowSetTotal(false)}
        >
          <div
            className="w-full max-w-xs border border-stone-800 bg-[#0a0908] p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div className="font-anton text-xl uppercase tracking-tight text-stone-100">Set Total</div>
              <div className="text-[10px] font-mono text-stone-600 uppercase tracking-wider mt-0.5">
                Replaces all today's entries with one
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                autoFocus
                value={setTotalInput}
                onChange={e => setSetTotalInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetTotal()}
                placeholder="0"
                className="flex-1 bg-stone-900/60 border border-stone-700 px-3 py-2 text-stone-100 font-mono text-sm focus:outline-none focus:border-blue-500/60 transition-colors"
              />
              <span className="text-stone-500 font-mono text-sm">{lbl}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSetTotal(false)}
                className="flex-1 px-4 py-2.5 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-stone-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetTotal}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-blue-500 transition-colors"
              >
                Set →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------- MAIN --------------------
export default function VisionNutrition() {
  const { user } = useSession();
  const {
    meals, totals, targets, loading,
    addMeal, deleteMeal, sections,
    selectedDate, setSelectedDate,
    calsBurned, eatBackCalories,
  } = useSentinel(user?.id);

  const profile       = useProfileStore(s => s.profile);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const isPro         = ['pro', 'elite'].includes(profile?.subscription_tier ?? '');
  const mealTemplates = useMealTemplates(user?.id);
  const water         = useWaterTracker(user?.id);
  const { displayEnergy, energyLabel, displayVolume, parseVolume, volumeUnit, volumeLabel } = useUnits();

  const [activeAddSection, setActiveAddSection] = useState(null);
  const [showBreakdown, setShowBreakdown]       = useState(false);
  const [showTemplates, setShowTemplates]       = useState(false);

  // Inline macro editing state
  const [editingMacros,    setEditingMacros]    = useState(false);
  const [draftKcal,        setDraftKcal]        = useState('');
  const [draftProteinPct,  setDraftProteinPct]  = useState('');
  const [draftCarbsPct,    setDraftCarbsPct]    = useState('');
  const [draftFatPct,      setDraftFatPct]      = useState('');
  const [macroSaving,      setMacroSaving]      = useState(false);

  // Date helpers
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const selMidnight = new Date(selectedDate);
  selMidnight.setHours(0, 0, 0, 0);
  const isToday = selMidnight.getTime() === todayMidnight.getTime();

  const baseTgt = {
    kcal:    targets?.kcal    ?? 2200,
    protein: targets?.protein ?? 180,
    carbs:   targets?.carbs   ?? 220,
    fat:     targets?.fat     ?? 70,
  };
  const tgt = {
    ...baseTgt,
    kcal: isToday && eatBackCalories && calsBurned
      ? baseTgt.kcal + Math.round(calsBurned)
      : baseTgt.kcal,
  };

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const nextDay = () => {
    if (isToday) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };
  const fmtDate = () => {
    if (isToday) return 'Today';
    const yest = new Date(todayMidnight);
    yest.setDate(yest.getDate() - 1);
    if (selMidnight.getTime() === yest.getTime()) return 'Yesterday';
    return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const visionCount = meals.filter(m => m.source === 'vision_api').length;
  const remaining   = Math.max(0, tgt.kcal - totals.kcal);
  const kcalPct     = Math.round((remaining / Math.max(tgt.kcal, 1)) * 100);

  // Each macro's calorie contribution as % of the daily calorie TARGET
  // e.g. 50g protein = 200 cal, target 2000 cal → protein shows 10%
  const macroSplit = useMemo(() => {
    const t = tgt.kcal || 1;
    return {
      p: Math.round((totals.protein * 4 / t) * 100),
      c: Math.round((totals.carbs   * 4 / t) * 100),
      f: Math.round((totals.fat     * 9 / t) * 100),
    };
  }, [totals, tgt.kcal]);

  // Live draft calculations for inline macro editor
  const draftKcalNum   = parseFloat(draftKcal)       || 0;
  const draftPPct      = parseFloat(draftProteinPct)  || 0;
  const draftCPct      = parseFloat(draftCarbsPct)    || 0;
  const draftFPct      = parseFloat(draftFatPct)      || 0;
  const draftPctSum    = Math.round(draftPPct + draftCPct + draftFPct);
  const draftProteinG  = Math.round(draftKcalNum * draftPPct / 100 / 4);
  const draftCarbsG    = Math.round(draftKcalNum * draftCPct / 100 / 4);
  const draftFatG      = Math.round(draftKcalNum * draftFPct / 100 / 9);

  function openMacroEdit() {
    setDraftKcal(String(tgt.kcal));
    const k = tgt.kcal || 1;
    setDraftProteinPct(String(Math.round(tgt.protein * 4 / k * 100)));
    setDraftCarbsPct(String(Math.round(tgt.carbs   * 4 / k * 100)));
    setDraftFatPct(String(Math.round(tgt.fat       * 9 / k * 100)));
    setEditingMacros(true);
  }

  async function saveMacroTargets() {
    if (draftKcalNum < 500 || draftKcalNum > 10000) return;
    if (draftPctSum < 99 || draftPctSum > 101) return;
    setMacroSaving(true);
    const newMacros = {
      kcal:    Math.round(draftKcalNum),
      protein: draftProteinG,
      carbs:   draftCarbsG,
      fat:     draftFatG,
    };
    const newSettings = { ...(profile?.settings ?? {}), macro_mode: 'custom' };
    const { error } = await supabase
      .from('profiles')
      .update({ current_macros: newMacros, settings: newSettings })
      .eq('id', user.id);
    setMacroSaving(false);
    if (!error) {
      updateProfile({ current_macros: newMacros, settings: newSettings });
      setEditingMacros(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-stone-100 font-sans antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');
        .font-sans  { font-family: 'Manrope', system-ui, sans-serif; }
        .font-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; }
        body { background: #0a0908; }
        @keyframes scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes boxIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <AppNav />

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 38px, #fff 38px, #fff 39px)'
        }} />
        <div className="absolute top-0 right-0 w-[60vw] h-[50vh] opacity-[0.07] blur-3xl" style={{
          background: 'radial-gradient(ellipse, #fbbf24 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-8">

        {/* HEADER */}
        <header className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-stone-800/60">
          <div>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-anton text-5xl uppercase tracking-tight text-stone-100">Sentinel</span>
              <span className="font-anton text-5xl uppercase tracking-tight bg-gradient-to-br from-amber-300 to-orange-500 bg-clip-text text-transparent">Nutrition</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-stone-500">
              <span className="px-2 py-1 bg-orange-500/15 text-orange-300 border border-orange-500/30 uppercase tracking-wider">PRO</span>
              {loading ? (
                <>
                  <Sk w="w-20" h="h-3" />
                  <Sk w="w-16" h="h-3" />
                </>
              ) : (
                <>
                  <span>{meals.length} meals {isToday ? 'today' : fmtDate()}</span>
                  <span className="text-stone-700">·</span>
                  <span>{visionCount} via vision</span>
                  <span className="text-stone-700">·</span>
                  <span>{kcalPct}% under target</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTemplates(true)}
              className="px-4 py-2.5 border border-stone-700 text-stone-400 font-mono text-sm uppercase tracking-wider hover:border-orange-500/40 hover:text-orange-300 transition-colors"
            >
              Meal Templates
            </button>
          </div>
        </header>

        {/* WORKOUT BURN BANNER */}
        {isToday && calsBurned != null && (
          <div className="flex items-center gap-3 flex-wrap border border-orange-500/30 bg-orange-500/08 px-5 py-3 mb-6">
            <span className="text-base">🔥</span>
            <span className="font-mono text-sm tabular-nums text-stone-200">
              {Math.round(calsBurned)} cal burned today
            </span>
            {eatBackCalories ? (
              <span className="font-mono text-[10px] text-orange-300">— eating back included</span>
            ) : (
              <span className="font-mono text-[10px] text-stone-600">
                · <a href="/settings" className="text-orange-400 hover:underline">Enable eat-back</a> to add to target
              </span>
            )}
          </div>
        )}

        {/* HEADLINE */}
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-600 font-mono mb-2">
            {isToday ? "Today's intake" : `${fmtDate()}'s intake`}
          </div>
          {loading ? (
            <Sk w="w-2/3" h="h-14" />
          ) : (
            <h1 className="font-anton text-5xl md:text-6xl uppercase tracking-tight leading-[0.95] text-stone-100 max-w-4xl">
              <span className="sentinel-calories-consumed text-orange-400 tabular-nums">{displayEnergy(totals.kcal, { noUnit: true })}</span>{' '}
              <span className="text-stone-500">/</span>{' '}
              {displayEnergy(tgt.kcal, { noUnit: true })} <span className="text-stone-500">{energyLabel}</span>
              <span className="sentinel-calories-remaining text-stone-600"> — {displayEnergy(remaining, { noUnit: true })} remaining for the day.</span>
            </h1>
          )}
        </div>

        {/* DASHBOARD — 2 cols: CalorieRing + MacroBars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* Calorie ring */}
          <div
            className="border border-stone-800/60 bg-stone-950/40 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-stone-700 transition-colors"
            onClick={() => setShowBreakdown(true)}
          >
            {loading ? (
              <div className="w-48 h-48 flex items-center justify-center">
                <Sk w="w-40" h="h-40" />
              </div>
            ) : (
              <CalorieRing consumed={totals.kcal} target={tgt.kcal} />
            )}
            <div className="text-[9px] font-mono uppercase tracking-wider text-stone-600 mt-2">tap for breakdown</div>
            <div className="mt-4 grid grid-cols-3 gap-2 w-full">
              <div className="text-center border border-stone-800/60 py-2">
                <div className="text-[9px] font-mono uppercase text-stone-600 tracking-wider">Goal</div>
                <div className="font-anton text-orange-300 text-sm">CUT</div>
              </div>
              <div className="text-center border border-stone-800/60 py-2">
                <div className="text-[9px] font-mono uppercase text-stone-600 tracking-wider">Burn</div>
                <div className="font-anton text-stone-300 text-sm tabular-nums">~2.6k</div>
              </div>
              <div className="text-center border border-stone-800/60 py-2">
                <div className="text-[9px] font-mono uppercase text-stone-600 tracking-wider">Streak</div>
                <div className="font-anton text-stone-300 text-sm tabular-nums">—</div>
              </div>
            </div>
          </div>

          {/* Macro bars */}
          <div
            className={`border border-stone-800/60 bg-stone-950/40 p-6 transition-colors ${editingMacros ? '' : 'cursor-pointer hover:border-stone-700'}`}
            onClick={editingMacros ? undefined : () => setShowBreakdown(true)}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-anton text-xl uppercase tracking-tight text-stone-100">Macros</h2>
              <div className="flex items-center gap-3">
                {!editingMacros && (
                  <span className="text-[9px] uppercase tracking-[0.18em] text-stone-600 font-mono">% of cal target</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); editingMacros ? setEditingMacros(false) : openMacroEdit(); }}
                  className={`flex items-center gap-1 px-2 py-1 border font-mono text-[9px] uppercase tracking-wider transition-colors ${
                    editingMacros
                      ? 'border-stone-700 text-stone-500 hover:text-stone-300'
                      : 'border-stone-800 text-stone-600 hover:border-orange-500/40 hover:text-orange-300'
                  }`}
                >
                  {editingMacros ? 'Cancel' : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M7 1L9 3L3.5 8.5L1 9L1.5 6.5L7 1Z" strokeLinejoin="round" />
                      </svg>
                      Edit
                    </>
                  )}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-5">
                <Sk w="w-full" h="h-7" />
                <Sk w="w-full" h="h-7" />
                <Sk w="w-full" h="h-7" />
              </div>
            ) : (
              <div className="space-y-4">
                <MacroBar label="Protein" consumed={totals.protein} target={tgt.protein} color="rgb(237, 122, 42)" />
                <MacroBar label="Carbs"   consumed={totals.carbs}   target={tgt.carbs}   color="rgb(126, 182, 255)" />
                <MacroBar label="Fat"     consumed={totals.fat}     target={tgt.fat}     color="rgb(251, 191, 36)" />
              </div>
            )}

            {/* Inline macro editor — shown instead of P/C/F % strip */}
            {editingMacros ? (
              <div className="mt-5 pt-4 border-t border-stone-800/60" onClick={e => e.stopPropagation()}>
                <div className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-3">Set daily targets</div>

                {/* Calories */}
                <div className="mb-3">
                  <label className="text-[9px] uppercase tracking-wider text-stone-600 font-mono block mb-1">Total calories</label>
                  <div className="relative max-w-[160px]">
                    <input
                      type="number"
                      value={draftKcal}
                      onChange={e => setDraftKcal(e.target.value)}
                      min="500" max="10000"
                      className="w-full bg-stone-950/60 border border-stone-800 px-3 py-2 pr-10 text-stone-100 font-mono text-sm tabular-nums focus:outline-none focus:border-orange-500/60 transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 font-mono text-[10px]">kcal</span>
                  </div>
                </div>

                {/* Macro % inputs */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Protein', pct: draftProteinPct, setPct: setDraftProteinPct, g: draftProteinG, color: '#ed7a2a' },
                    { label: 'Carbs',   pct: draftCarbsPct,   setPct: setDraftCarbsPct,   g: draftCarbsG,   color: '#7eb6ff' },
                    { label: 'Fat',     pct: draftFatPct,     setPct: setDraftFatPct,     g: draftFatG,     color: '#fbbf24' },
                  ].map(m => (
                    <div key={m.label}>
                      <label className="text-[9px] uppercase tracking-wider text-stone-600 font-mono block mb-1">{m.label}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={m.pct}
                          onChange={e => m.setPct(e.target.value)}
                          min="0" max="100"
                          className="w-full bg-stone-950/60 border border-stone-800 px-2 py-2 pr-5 text-stone-100 font-mono text-sm tabular-nums focus:outline-none focus:border-orange-500/60 transition-colors"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-600 font-mono text-[10px]">%</span>
                      </div>
                      {m.pct && draftKcal && (
                        <div className="mt-0.5 text-[9px] font-mono tabular-nums" style={{ color: m.color }}>{m.g}g</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Sum indicator + Save */}
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[9px] font-mono ${
                    draftPctSum === 100 ? 'text-green-400' :
                    Math.abs(draftPctSum - 100) <= 1 ? 'text-orange-300' : 'text-red-400'
                  }`}>
                    {draftPctSum === 0 ? 'enter % above' : `${draftPctSum}% total ${draftPctSum === 100 ? '✓' : `(need ${100 - draftPctSum > 0 ? '+' : ''}${100 - draftPctSum}%)`}`}
                  </span>
                  <button
                    disabled={macroSaving || draftPctSum < 99 || draftPctSum > 101 || draftKcalNum < 500}
                    onClick={saveMacroTargets}
                    className="px-4 py-1.5 bg-orange-500 text-stone-950 font-anton text-xs uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {macroSaving ? 'Saving…' : 'Save →'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 pt-4 border-t border-stone-800/60 grid grid-cols-3 gap-2 text-center">
                {[
                  { l: 'P', v: macroSplit.p },
                  { l: 'C', v: macroSplit.c },
                  { l: 'F', v: macroSplit.f },
                ].map(x => (
                  <div key={x.l}>
                    <div className="text-[9px] font-mono uppercase text-stone-600 tracking-wider">{x.l}</div>
                    {loading
                      ? <Sk w="w-8 mx-auto" h="h-4" />
                      : <div className="font-anton text-stone-300 text-base tabular-nums">{x.v}%</div>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MEAL LOG — full width */}
        <div className="border border-stone-800/60 bg-stone-950/40 mb-8">
          <div className="flex items-center justify-between p-6 pb-4 border-b border-stone-800/60">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">{fmtDate()}</h2>
                <div className="flex items-center gap-1">
                  <button onClick={prevDay} className="p-1.5 text-stone-500 hover:text-stone-300 border border-stone-800 hover:border-stone-700 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 2L4 6L8 10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {!isToday && (
                    <button onClick={() => setSelectedDate(new Date())}
                      className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-1 border border-stone-800 text-stone-600 hover:text-stone-400 transition-colors">
                      today
                    </button>
                  )}
                  <button onClick={nextDay} disabled={isToday}
                    className="p-1.5 text-stone-500 hover:text-stone-300 border border-stone-800 hover:border-stone-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 2L8 6L4 10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-600">daily meal log</div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              <Sk w="w-full" h="h-10" />
              <Sk w="w-full" h="h-10" />
              <Sk w="w-4/5"  h="h-10" />
            </div>
          ) : (
            <div>
              {['breakfast', 'lunch', 'dinner', 'snacks'].map(type => (
                <MealSection
                  key={type}
                  type={type}
                  section={sections[type] ?? { meals: [], totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 } }}
                  activeAddSection={activeAddSection}
                  setActiveAddSection={setActiveAddSection}
                  addMeal={addMeal}
                  deleteMeal={deleteMeal}
                  userId={user?.id}
                  isPro={isPro}
                />
              ))}
              {sections.uncategorized?.meals?.length > 0 && (
                <div className="border-t border-stone-800/60 px-5 py-3">
                  <div className="text-[9px] font-mono uppercase tracking-wider text-stone-600 mb-2">Other</div>
                  {sections.uncategorized.meals.map(m => <MealEntry key={m.id} meal={m} onDelete={deleteMeal} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* WATER TRACKER */}
        <WaterTracker water={water} />

        {/* SAFETY NOTE */}
        <div className="border border-stone-800/60 bg-stone-950/40 p-5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] font-mono text-stone-500 leading-relaxed">
            <div>
              <div className="text-orange-300 uppercase tracking-wider text-[10px] mb-1">Confidence threshold</div>
              Auto-confirm above 90%. Below, user must select.
            </div>
            <div>
              <div className="text-orange-300 uppercase tracking-wider text-[10px] mb-1">Manual fallback</div>
              ~20% of scans need correction. Manual log path always available.
            </div>
            <div>
              <div className="text-orange-300 uppercase tracking-wider text-[10px] mb-1">Cost gating</div>
              Sentinel is Pro-only. Each scan ~$0.008. Free tier = manual log.
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-stone-800/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 font-mono">
          <span>Sentinel v0.4 · Module 1 · Camera-driven macro logging</span>
          <span>Provider: LogMeal · Fallback: Bite AI · Manual: anytime</span>
        </footer>
      </div>

      {/* MACRO BREAKDOWN MODAL */}
      {showBreakdown && (
        <MacroBreakdownModal
          userId={user?.id}
          onClose={() => setShowBreakdown(false)}
        />
      )}

      {/* TEMPLATE PANEL */}
      {showTemplates && (
        <TemplatePanel
          templates={mealTemplates.templates}
          loading={mealTemplates.loading}
          onClose={() => setShowTemplates(false)}
          onLogAll={tmpl => mealTemplates.logFromTemplate(tmpl, addMeal)}
          onSave={mealTemplates.saveTemplate}
          onDelete={mealTemplates.deleteTemplate}
          isPro={isPro}
          userId={user?.id}
        />
      )}
    </div>
  );
}
