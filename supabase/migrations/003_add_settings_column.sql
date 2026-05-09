-- Add settings JSONB to profiles for per-user app preferences.
-- Defaults: ghost_mode off, weight in kg, coach alerts on.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT
    '{"ghost_mode": false, "weight_unit": "kg", "coach_alerts": true}'::jsonb;
