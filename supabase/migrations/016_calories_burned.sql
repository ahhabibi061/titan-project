-- Add calories_burned to workouts table
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS calories_burned integer;
