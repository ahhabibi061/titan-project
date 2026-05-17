-- 014_custom_exercises_and_splits.sql
-- Adds user-created custom exercises and custom workout splits.

-- ============================================================
-- 1. Allow users to add their own exercises to the catalog
-- ============================================================

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles;

-- Drop the old blanket SELECT policy and replace with one that also
-- exposes a user's own custom exercises regardless of their tier.
DROP POLICY IF EXISTS "exercise tier gate" ON exercises;

CREATE POLICY "exercise tier gate"
  ON exercises
  FOR SELECT USING (
    created_by = auth.uid()   OR   -- own custom exercises always visible
    premium = false            OR
    (SELECT subscription_tier FROM profiles WHERE id = auth.uid()) IN ('pro', 'elite')
  );

-- Allow users to INSERT their own custom exercises.
CREATE POLICY "insert own exercises"
  ON exercises
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- ============================================================
-- 2. Custom workout splits
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_splits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  name       text NOT NULL,
  days       jsonb NOT NULL DEFAULT '[]',
  -- Each day:  { "label": "Push", "exerciseIds": ["bench", "ohp", ...] }
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE custom_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own custom_splits"
  ON custom_splits
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
