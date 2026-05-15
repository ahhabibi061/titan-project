-- IRONLAB — Extended nutrition_logs columns
-- Adds meal_type, micros, serving info, and workouts.created_at
-- Run via: paste into Supabase SQL Editor → Run

-- ── nutrition_logs additions ──────────────────────────────────────────────
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS meal_type      text DEFAULT 'uncategorized'
    CHECK (meal_type IN ('breakfast','lunch','dinner','snacks','uncategorized')),
  ADD COLUMN IF NOT EXISTS serving_amount numeric,
  ADD COLUMN IF NOT EXISTS serving_unit   text,
  ADD COLUMN IF NOT EXISTS fiber_g        numeric,
  ADD COLUMN IF NOT EXISTS sugar_g        numeric,
  ADD COLUMN IF NOT EXISTS sodium_mg      numeric,
  ADD COLUMN IF NOT EXISTS potassium_mg   numeric,
  ADD COLUMN IF NOT EXISTS cholesterol_mg numeric,
  ADD COLUMN IF NOT EXISTS saturated_fat_g numeric,
  ADD COLUMN IF NOT EXISTS vitamin_a_iu   numeric,
  ADD COLUMN IF NOT EXISTS vitamin_c_mg   numeric,
  ADD COLUMN IF NOT EXISTS calcium_mg     numeric,
  ADD COLUMN IF NOT EXISTS iron_mg        numeric;

-- ── workouts.created_at (needed by Logger and Dashboard queries) ──────────
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows so created_at is not null (use completed_at or now)
UPDATE public.workouts
  SET created_at = COALESCE(completed_at, now())
  WHERE created_at IS NULL;

-- Index for today-range queries in useDashboard
CREATE INDEX IF NOT EXISTS workouts_user_created_idx
  ON public.workouts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS nutrition_logs_user_logged_idx
  ON public.nutrition_logs (user_id, logged_at DESC);
