-- Add onboarding_complete flag to profiles.
-- Defaults false so every new user is routed through /onboarding on first sign-in.
-- Set to true at the end of the onboarding wizard.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;
