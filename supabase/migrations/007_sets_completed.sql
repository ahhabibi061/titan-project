-- Add completed flag to sets so done-state persists across sessions.
ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;
