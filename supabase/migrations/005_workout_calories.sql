-- Add calories_burned to workouts table (computed from MET formula on complete)
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS calories_burned NUMERIC;

-- Update settings default to include eat_back_calories flag
-- Existing rows keep their current JSONB; new rows get the updated default.
ALTER TABLE profiles
  ALTER COLUMN settings SET DEFAULT
    '{"ghost_mode": false, "weight_unit": "kg", "coach_alerts": true, "eat_back_calories": false}'::jsonb;
