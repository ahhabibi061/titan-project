-- Add user splits and templates to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS my_splits    jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS my_templates jsonb DEFAULT '[]';
