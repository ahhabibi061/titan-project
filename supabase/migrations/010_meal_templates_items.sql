-- IRONLAB — Add items JSONB column to meal_templates
-- Run via: paste into Supabase SQL Editor → Run

ALTER TABLE public.meal_templates
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]';
