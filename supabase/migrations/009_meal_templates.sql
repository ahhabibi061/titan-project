-- IRONLAB — Meal Templates
-- Run via: paste into Supabase SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.meal_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name        text        NOT NULL,
  kcal        integer     NOT NULL DEFAULT 0,
  protein_g   numeric     NOT NULL DEFAULT 0,
  carbs_g     numeric     NOT NULL DEFAULT 0,
  fat_g       numeric     NOT NULL DEFAULT 0,
  notes       text,
  times_used  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own meal templates"
  ON public.meal_templates
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS meal_templates_user_id_idx
  ON public.meal_templates (user_id);
