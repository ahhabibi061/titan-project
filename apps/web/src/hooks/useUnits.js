import { useProfileStore } from '../store/useProfileStore';

// ─── Conversion constants ──────────────────────────────────────────────────
const KG_TO_LBS    = 2.20462;
const CM_TO_IN     = 0.393701;
const ML_TO_FLOZ   = 0.033814;
const KM_TO_MI     = 0.621371;
const KCAL_TO_KJ   = 4.184;

// ─── useUnits ──────────────────────────────────────────────────────────────
// Reads the user's unit preferences from the profile store and returns
// display helpers + raw unit strings.
//
// All display functions return a formatted string with unit suffix.
// parseWeight() converts a user-entered value back to kg for DB storage.

export function useUnits() {
  const settings = useProfileStore(s => s.settings);

  const weightUnit   = settings?.weight_unit   ?? 'kg';
  const heightUnit   = settings?.height_unit   ?? 'cm';
  const energyUnit   = settings?.energy_unit   ?? 'kcal';
  const volumeUnit   = settings?.volume_unit   ?? 'ml';
  const distanceUnit = settings?.distance_unit ?? 'km';

  // ── Weight ──────────────────────────────────────────────────────────────
  const displayWeight = (kg, opts = {}) => {
    if (kg == null || kg === '') return '—';
    const n = Number(kg);
    if (weightUnit === 'lbs') {
      const lbs = n * KG_TO_LBS;
      return opts.noUnit ? lbs.toFixed(1) : `${lbs.toFixed(1)} lbs`;
    }
    return opts.noUnit ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : `${Number.isInteger(n) ? n : n.toFixed(1)} kg`;
  };

  // Convert a user-typed weight value (in their preferred unit) → kg for DB
  const parseWeight = (value) => {
    const n = parseFloat(value);
    if (isNaN(n)) return 0;
    return weightUnit === 'lbs' ? n / KG_TO_LBS : n;
  };

  // Label for the current weight unit
  const weightLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // ── Height ───────────────────────────────────────────────────────────────
  const displayHeight = (cm, opts = {}) => {
    if (cm == null) return '—';
    if (heightUnit === 'in') {
      const totalIn = Math.round(cm * CM_TO_IN);
      const ft = Math.floor(totalIn / 12);
      const inches = totalIn % 12;
      return opts.noUnit ? `${ft}'${inches}"` : `${ft}'${inches}"`;
    }
    return opts.noUnit ? String(Math.round(cm)) : `${Math.round(cm)} cm`;
  };

  const heightLabel = heightUnit === 'in' ? 'ft/in' : 'cm';

  // ── Energy ───────────────────────────────────────────────────────────────
  const displayEnergy = (kcal, opts = {}) => {
    if (kcal == null) return '—';
    if (energyUnit === 'kj') {
      const kj = Math.round(kcal * KCAL_TO_KJ);
      return opts.noUnit ? String(kj) : `${kj} kj`;
    }
    return opts.noUnit ? String(Math.round(kcal)) : `${Math.round(kcal)} kcal`;
  };

  const energyLabel = energyUnit === 'kj' ? 'kj' : 'kcal';

  // ── Volume (water / liquid) ───────────────────────────────────────────────
  const displayVolume = (ml, opts = {}) => {
    if (ml == null) return '—';
    if (volumeUnit === 'floz') {
      const oz = Math.round(ml * ML_TO_FLOZ);
      return opts.noUnit ? String(oz) : `${oz} fl oz`;
    }
    return opts.noUnit ? String(Math.round(ml)) : `${Math.round(ml)} ml`;
  };

  // Convert a volume amount in the user's preferred unit back to ml for DB
  const parseVolume = (value) => {
    const n = parseFloat(value);
    if (isNaN(n)) return 0;
    return volumeUnit === 'floz' ? n / ML_TO_FLOZ : n;
  };

  const volumeLabel = volumeUnit === 'floz' ? 'fl oz' : 'ml';

  // ── Distance ─────────────────────────────────────────────────────────────
  const displayDistance = (km, opts = {}) => {
    if (km == null) return '—';
    if (distanceUnit === 'mi') {
      const mi = km * KM_TO_MI;
      return opts.noUnit ? mi.toFixed(1) : `${mi.toFixed(1)} mi`;
    }
    return opts.noUnit ? km.toFixed(1) : `${km.toFixed(1)} km`;
  };

  const distanceLabel = distanceUnit === 'mi' ? 'mi' : 'km';

  return {
    // Raw unit strings
    weightUnit,
    heightUnit,
    energyUnit,
    volumeUnit,
    distanceUnit,

    // Labels (short display strings)
    weightLabel,
    heightLabel,
    energyLabel,
    volumeLabel,
    distanceLabel,

    // Display formatters
    displayWeight,
    displayHeight,
    displayEnergy,
    displayVolume,
    displayDistance,

    // Parsers (user input → DB unit)
    parseWeight,
    parseVolume,

    // Constants (for quick-add button generation etc.)
    ML_TO_FLOZ,
    KG_TO_LBS,
  };
}
