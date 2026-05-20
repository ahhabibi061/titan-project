-- Dedicated column for user-created splits (separate from program_split)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_splits jsonb DEFAULT '[]';
