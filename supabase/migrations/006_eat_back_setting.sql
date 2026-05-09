-- Backfill eat_back_calories key into all existing profiles that don't have it yet.
-- New profiles already get it via the DEFAULT updated in 005_workout_calories.sql.
UPDATE profiles
  SET settings = settings || '{"eat_back_calories": false}'::jsonb
  WHERE settings IS NOT NULL
    AND NOT (settings ? 'eat_back_calories');
