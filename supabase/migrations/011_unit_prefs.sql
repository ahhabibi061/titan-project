-- 011_unit_prefs.sql
-- Adds unit preference columns to the settings table.
-- These are stored alongside eat_back_calories in the settings table.
-- NOTE: Most unit prefs are also stored in profiles.settings JSONB (the DEFAULT_SETTINGS object).
-- This migration adds explicit columns for eat_back_calories companions if needed,
-- but the primary storage for height_unit, energy_unit, volume_unit, distance_unit
-- is profiles.settings JSONB via the savePref() function in SettingsPage.
-- No schema changes required — profiles.settings is already a JSONB column
-- that accepts any keys. The DEFAULT_SETTINGS in SettingsPage.jsx provides the
-- fallbacks for all new unit keys.

-- Optional: if you want to add these as explicit settings table columns for
-- server-side queries, uncomment the following:

-- ALTER TABLE public.settings
--   ADD COLUMN IF NOT EXISTS height_unit   TEXT NOT NULL DEFAULT 'cm',
--   ADD COLUMN IF NOT EXISTS energy_unit   TEXT NOT NULL DEFAULT 'kcal',
--   ADD COLUMN IF NOT EXISTS volume_unit   TEXT NOT NULL DEFAULT 'ml',
--   ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'km';

-- For now, unit prefs live in profiles.settings JSONB (same as weight_unit, ghost_mode, etc.).
-- This migration is a no-op — it exists to document the intent.
SELECT 1;
