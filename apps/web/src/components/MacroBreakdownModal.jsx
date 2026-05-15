import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/* =========================================================================
 * MacroBreakdownModal
 * Self-fetching modal: accepts userId + optional date, fetches its own
 * nutrition_logs data. Used in both NutritionPage and DashboardPage.
 * ========================================================================= */

const MICRO_CONFIG = [
  { key: 'fiber',        label: 'Fiber',         target: 25,   unit: 'g',  cap: false },
  { key: 'sugar',        label: 'Sugar',          target: 50,   unit: 'g',  cap: true  },
  { key: 'sodium',       label: 'Sodium',         target: 2300, unit: 'mg', cap: true  },
  { key: 'potassium',    label: 'Potassium',      target: 3500, unit: 'mg', cap: false },
  { key: 'cholesterol',  label: 'Cholesterol',    target: 300,  unit: 'mg', cap: true  },
  { key: 'saturatedFat', label: 'Saturated Fat',  target: 20,   unit: 'g',  cap: true  },
  { key: 'vitaminA',     label: 'Vitamin A',      target: 900,  unit: 'IU', cap: false },
  { key: 'vitaminC',     label: 'Vitamin C',      target: 90,   unit: 'mg', cap: false },
  { key: 'calcium',      label: 'Calcium',        target: 1000, unit: 'mg', cap: false },
  { key: 'iron',         label: 'Iron',           target: 18,   unit: 'mg', cap: false },
];

const MEAL_COLORS = {
  breakfast: '#fbbf24',
  lunch:     '#ed7a2a',
  dinner:    '#f87171',
  snacks:    '#78716c',
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

function StackedBar({ values, total }) {
  return (
    <div className="h-4 flex overflow-hidden bg-stone-900/60 border border-stone-800/40">
      {MEAL_TYPES.map(type => {
        const val = values[type] ?? 0;
        const pct = total > 0 ? (val / total) * 100 : 0;
        return pct > 0.5 ? (
          <div key={type} style={{ width: `${pct}%`, backgroundColor: MEAL_COLORS[type] }} />
        ) : null;
      })}
    </div>
  );
}

export function MacroBreakdownModal({ userId, date, onClose }) {
  const [tab, setTab]     = useState('macros');
  const [rows, setRows]   = useState(null);
  const [loading, setLoading] = useState(true);

  const targetDate = date ?? new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  const nextStr = new Date(new Date(dateStr + 'T00:00:00').getTime() + 86400000).toISOString().split('T')[0];

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabase
      .from('nutrition_logs')
      .select(`
        meal_name, kcal, protein_g, carbs_g, fat_g, meal_type,
        fiber_g, sugar_g, sodium_mg, potassium_mg, cholesterol_mg, saturated_fat_g,
        vitamin_a_iu, vitamin_c_mg, calcium_mg, iron_mg
      `)
      .eq('user_id', userId)
      .gte('logged_at', dateStr)
      .lt('logged_at', nextStr)
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [userId, dateStr]);

  if (loading || !rows) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-950/90 flex items-center justify-center" onClick={onClose}>
        <div className="border border-stone-800 bg-[#0a0908] p-8">
          <div className="text-stone-600 font-mono text-xs uppercase tracking-wider">Loading…</div>
        </div>
      </div>
    );
  }

  // Group macros by meal_type
  const sectionMacros = {};
  for (const type of MEAL_TYPES) {
    const typeMeals = rows.filter(m => (m.meal_type ?? 'uncategorized') === type);
    sectionMacros[type] = typeMeals.reduce((acc, m) => ({
      kcal:    acc.kcal    + (m.kcal      ?? 0),
      protein: acc.protein + (m.protein_g ?? 0),
      carbs:   acc.carbs   + (m.carbs_g   ?? 0),
      fat:     acc.fat     + (m.fat_g     ?? 0),
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }

  // Daily totals (macros + micros)
  const totals = rows.reduce((acc, m) => ({
    kcal:         acc.kcal         + (m.kcal            ?? 0),
    protein:      acc.protein      + (m.protein_g       ?? 0),
    carbs:        acc.carbs        + (m.carbs_g         ?? 0),
    fat:          acc.fat          + (m.fat_g           ?? 0),
    fiber:        acc.fiber        + (m.fiber_g         ?? 0),
    sugar:        acc.sugar        + (m.sugar_g         ?? 0),
    sodium:       acc.sodium       + (m.sodium_mg       ?? 0),
    potassium:    acc.potassium    + (m.potassium_mg    ?? 0),
    cholesterol:  acc.cholesterol  + (m.cholesterol_mg  ?? 0),
    saturatedFat: acc.saturatedFat + (m.saturated_fat_g ?? 0),
    vitaminA:     acc.vitaminA     + (m.vitamin_a_iu    ?? 0),
    vitaminC:     acc.vitaminC     + (m.vitamin_c_mg    ?? 0),
    calcium:      acc.calcium      + (m.calcium_mg      ?? 0),
    iron:         acc.iron         + (m.iron_mg         ?? 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0, cholesterol: 0, saturatedFat: 0, vitaminA: 0, vitaminC: 0, calcium: 0, iron: 0 });

  const MACRO_ROWS = [
    { key: 'kcal',    label: 'Calories', unit: 'kcal', getter: s => s.kcal,    total: totals.kcal    },
    { key: 'protein', label: 'Protein',  unit: 'g',    getter: s => s.protein, total: totals.protein },
    { key: 'carbs',   label: 'Carbs',    unit: 'g',    getter: s => s.carbs,   total: totals.carbs   },
    { key: 'fat',     label: 'Fat',      unit: 'g',    getter: s => s.fat,     total: totals.fat     },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0a0908] border border-stone-800 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div>
            <div className="font-anton text-xl uppercase tracking-tight text-stone-100">Today's Breakdown</div>
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-stone-600 mt-0.5">{dateStr}</div>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors font-mono text-sm">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800">
          {['macros', 'micros'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
                tab === t ? 'text-orange-300 border-b-2 border-orange-500' : 'text-stone-600 hover:text-stone-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="px-6 py-2 flex gap-4 border-b border-stone-800/60 bg-stone-950/40">
          {MEAL_TYPES.map(type => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5" style={{ backgroundColor: MEAL_COLORS[type] }} />
              <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">{type}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* MACROS TAB */}
          {tab === 'macros' && (
            <div className="space-y-6">
              {MACRO_ROWS.map(macro => {
                const values = Object.fromEntries(
                  MEAL_TYPES.map(type => [type, macro.getter(sectionMacros[type])])
                );
                return (
                  <div key={macro.key}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 font-mono">{macro.label}</span>
                      <span className="font-mono text-sm tabular-nums text-stone-200">
                        {Math.round(macro.total)}<span className="text-stone-600 text-[10px]"> {macro.unit}</span>
                      </span>
                    </div>
                    <StackedBar values={values} total={macro.total} />
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                      {MEAL_TYPES.map(type => (
                        <span key={type} className="font-mono text-[10px] text-stone-500 tabular-nums">
                          {type.charAt(0).toUpperCase() + type.slice(1)}{' '}
                          {Math.round(values[type] ?? 0)}{macro.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MICROS TAB */}
          {tab === 'micros' && (
            <div>
              {MICRO_CONFIG.map(cfg => {
                const value = totals[cfg.key] ?? 0;
                const pct = Math.min((value / cfg.target) * 100, 100);
                const isOver = cfg.cap && value > cfg.target;
                const barColor = isOver ? '#f87171' : pct >= 80 ? '#fb923c' : '#4ade80';
                const displayVal = value % 1 === 0 ? Math.round(value) : value.toFixed(1);
                return (
                  <div key={cfg.key} className="flex items-center gap-3 py-2.5 border-b border-stone-800/40 last:border-0">
                    <div className="w-28 shrink-0 text-[10px] font-mono uppercase tracking-wider text-stone-500">{cfg.label}</div>
                    <div className="flex-1 h-1.5 bg-stone-900/80">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                    <div className="w-28 shrink-0 text-right font-mono text-[10px] tabular-nums">
                      <span className={isOver ? 'text-red-400' : 'text-stone-300'}>{displayVal}</span>
                      <span className="text-stone-600"> / {cfg.target}{cfg.unit}</span>
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && (
                <div className="py-8 text-center text-[10px] font-mono uppercase tracking-wider text-stone-700">
                  No data logged yet today
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
