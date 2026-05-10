import { useState } from 'react';

const MOODS = ['😞', '😕', '😐', '🙂', '😊'];

function RatingRow({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">{label}</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(v => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`w-10 h-10 font-anton text-sm border transition-colors ${
              value === v
                ? 'bg-orange-500 border-orange-500 text-stone-950'
                : 'border-stone-700 text-stone-400 hover:border-orange-500/50'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CheckinModal({ onClose, onSave, saving, todayCheckin }) {
  const [mood, setMood]     = useState(todayCheckin?.mood ?? null);
  const [energy, setEnergy] = useState(todayCheckin?.energy ?? null);
  const [sleep, setSleep]   = useState(todayCheckin?.sleep_quality ?? null);
  const [notes, setNotes]   = useState(todayCheckin?.notes ?? '');
  const [err, setErr]       = useState('');

  async function handleSave() {
    if (!mood || !energy || !sleep) { setErr('Please fill in mood, energy, and sleep'); return; }
    const result = await onSave({ mood, energy, sleep_quality: sleep, notes });
    if (result?.error) { setErr(result.error); return; }
    onClose();
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 flex items-center justify-center backdrop-blur-sm px-4">
      <div className="w-full max-w-sm border border-stone-800 bg-[#0a0908] p-6 space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-anton text-2xl uppercase tracking-tight text-stone-100">Weekly Check-In</h2>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 font-mono text-xs">✕</button>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-stone-600 font-mono">{dateLabel}</div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">Mood</label>
          <div className="flex gap-2">
            {MOODS.map((emoji, i) => (
              <button
                key={i}
                onClick={() => setMood(i + 1)}
                className={`w-10 h-10 text-xl border transition-colors ${
                  mood === i + 1
                    ? 'border-orange-500 bg-orange-500/20'
                    : 'border-stone-700 hover:border-stone-500'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <RatingRow label="Energy (1 = drained, 5 = peaked)" value={energy} onChange={setEnergy} />
        <RatingRow label="Sleep quality (1 = poor, 5 = great)" value={sleep} onChange={setSleep} />

        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-stone-500 font-mono mb-2">
            Notes <span className="text-stone-700">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any context for this week…"
            className="w-full bg-stone-950/60 border border-stone-800 px-4 py-3 text-stone-100 font-mono text-sm focus:outline-none focus:border-orange-500/60 transition-colors resize-none"
          />
        </div>

        {err && <div className="text-red-400 font-mono text-xs">{err}</div>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-stone-700 text-stone-400 font-mono text-xs uppercase tracking-wider hover:border-stone-500 hover:text-stone-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-orange-500 text-stone-950 font-anton text-sm uppercase tracking-wider hover:bg-orange-400 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : todayCheckin ? 'Update' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
