-- Weekly check-in table for mood, energy, sleep quality tracking
CREATE TABLE IF NOT EXISTS weekly_checkins (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at     timestamptz DEFAULT now(),
  user_id        uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  checkin_date   date NOT NULL,
  mood           integer CHECK (mood BETWEEN 1 AND 5),
  energy         integer CHECK (energy BETWEEN 1 AND 5),
  sleep_quality  integer CHECK (sleep_quality BETWEEN 1 AND 5),
  notes          text,
  UNIQUE(user_id, checkin_date)
);

ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_own"
  ON weekly_checkins
  FOR ALL
  USING (auth.uid() = user_id);
