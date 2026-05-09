-- IRONLAB — Initial Schema
-- Run via: supabase db push  OR  paste into Supabase SQL Editor
-- All tables use RLS. Default policy: user can only read/write their own rows.

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name      text,
  subscription_tier text NOT NULL DEFAULT 'basic'
                    CHECK (subscription_tier IN ('basic', 'pro', 'elite')),
  stripe_customer_id text,
  goal              text CHECK (goal IN ('cut', 'bulk', 'recomp', 'maintain')),
  start_weight_kg   numeric,
  goal_weight_kg    numeric,
  height_cm         numeric,
  age               int,
  sex               text,
  activity_level    text,
  experience        text,
  program_split     text,
  current_macros    jsonb,  -- { kcal, protein, carbs, fat }
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile"
  ON profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create profile row on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- EXERCISES (global read-only catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercises (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  primary_muscle   text,
  secondary_muscles text[],
  equipment        text,
  pattern          text,  -- push | pull | squat | hinge | isolation
  difficulty       int CHECK (difficulty BETWEEN 1 AND 5),
  splits           text[],
  premium          boolean NOT NULL DEFAULT false,
  cues             text[],
  video_url        text
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Free exercises visible to all; premium gated by tier
CREATE POLICY "exercise tier gate"
  ON exercises
  FOR SELECT USING (
    premium = false OR
    (SELECT subscription_tier FROM profiles WHERE id = auth.uid()) IN ('pro', 'elite')
  );

-- ============================================================
-- WORKOUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS workouts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  name           text,
  scheduled_date date,
  completed_at   timestamptz,
  notes          text
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own workouts"
  ON workouts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- WORKOUT EXERCISES (junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id   uuid NOT NULL REFERENCES workouts ON DELETE CASCADE,
  exercise_id  text NOT NULL REFERENCES exercises,
  order_index  int NOT NULL DEFAULT 0,
  sets_target  int
);

ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own workout exercises"
  ON workout_exercises
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

-- ============================================================
-- SETS
-- ============================================================
CREATE TABLE IF NOT EXISTS sets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id  uuid NOT NULL REFERENCES workout_exercises ON DELETE CASCADE,
  set_number           int NOT NULL,
  weight_kg            numeric,
  reps                 int,
  rir                  int,  -- reps in reserve
  logged_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sets"
  ON sets
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

-- ============================================================
-- NUTRITION LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  meal_name   text,
  kcal        int,
  protein_g   int,
  carbs_g     int,
  fat_g       int,
  source      text CHECK (source IN ('manual', 'vision_api', 'barcode')),
  confidence  numeric,  -- 0–100, set only when source = 'vision_api'
  logged_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own nutrition"
  ON nutrition_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Vision API inserts gated to Pro / Elite
CREATE POLICY "vision is pro"
  ON nutrition_logs
  FOR INSERT WITH CHECK (
    source != 'vision_api' OR
    (SELECT subscription_tier FROM profiles WHERE id = auth.uid()) IN ('pro', 'elite')
  );

-- ============================================================
-- BIOMETRIC ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS biometric_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  weight_kg       numeric NOT NULL,
  body_fat_pct    numeric,
  photo_front_url text,  -- signed URL from private Supabase Storage bucket
  photo_side_url  text,
  photo_back_url  text,
  notes           text,
  logged_at       date NOT NULL,
  UNIQUE (user_id, logged_at)
);

ALTER TABLE biometric_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own biometrics"
  ON biometric_entries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- COACH RECOMMENDATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS coach_recommendations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  cycle_number  int,
  trail         jsonb,   -- rule path taken { rules: [...], matched: "..." }
  decision      jsonb,   -- { kcalDelta, deload, label }
  narrative     text,    -- Claude-generated explanation
  old_macros    jsonb,
  new_macros    jsonb,
  applied       boolean NOT NULL DEFAULT false,
  applied_at    timestamptz
);

ALTER TABLE coach_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own recommendations"
  ON coach_recommendations
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
