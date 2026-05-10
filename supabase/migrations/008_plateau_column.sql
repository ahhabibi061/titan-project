-- Feature 9: Plateau Detection
-- Run this migration in Supabase SQL editor

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS plateaued BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.workout_exercises.plateaued IS
  'True when this exercise showed no improvement vs last 3 sessions (detected at workout completion)';
