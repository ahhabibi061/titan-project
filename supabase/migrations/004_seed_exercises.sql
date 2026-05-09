-- ============================================================
-- 004_seed_exercises.sql
-- Seed the exercises catalog with 20 common strength exercises.
-- exercises.id is TEXT (not uuid) — matches the existing schema.
-- Run: supabase db push  OR paste into Supabase SQL Editor.
-- ============================================================

INSERT INTO exercises (id, name, primary_muscle, secondary_muscles, equipment, pattern, difficulty)
VALUES
  ('bench_press',           'Bench Press',              'chest',       ARRAY['front_delts','triceps'],                  'barbell',    'push',      3),
  ('back_squat',            'Back Squat',               'quads',       ARRAY['glutes','hamstrings'],                    'barbell',    'squat',     4),
  ('deadlift',              'Deadlift',                 'hamstrings',  ARRAY['glutes','lower_back','traps','lats'],      'barbell',    'hinge',     5),
  ('overhead_press',        'Overhead Press',           'front_delts', ARRAY['side_delts','triceps'],                   'barbell',    'push',      3),
  ('pull_up',               'Pull Up',                  'lats',        ARRAY['biceps','rear_delts'],                    'bodyweight', 'pull',      4),
  ('barbell_row',           'Barbell Row',              'lats',        ARRAY['biceps','rear_delts','traps'],             'barbell',    'pull',      3),
  ('incline_bench_press',   'Incline Bench Press',      'chest',       ARRAY['front_delts','triceps'],                  'barbell',    'push',      3),
  ('romanian_deadlift',     'Romanian Deadlift',        'hamstrings',  ARRAY['glutes','lower_back'],                    'barbell',    'hinge',     3),
  ('leg_press',             'Leg Press',                'quads',       ARRAY['glutes','hamstrings'],                    'machine',    'squat',     2),
  ('lat_pulldown',          'Lat Pulldown',             'lats',        ARRAY['biceps'],                                 'cable',      'pull',      2),
  ('dumbbell_curl',         'Dumbbell Curl',            'biceps',      ARRAY['forearms'],                               'dumbbell',   'isolation', 1),
  ('tricep_pushdown',       'Tricep Pushdown',          'triceps',     ARRAY[]::text[],                                 'cable',      'isolation', 1),
  ('face_pull',             'Face Pull',                'rear_delts',  ARRAY['traps'],                                  'cable',      'pull',      2),
  ('cable_fly',             'Cable Fly',                'chest',       ARRAY['front_delts'],                            'cable',      'isolation', 2),
  ('hip_thrust',            'Hip Thrust',               'glutes',      ARRAY['hamstrings'],                             'barbell',    'hinge',     2),
  ('bulgarian_split_squat', 'Bulgarian Split Squat',    'quads',       ARRAY['glutes','hamstrings'],                    'dumbbell',   'squat',     4),
  ('hack_squat',            'Hack Squat',               'quads',       ARRAY['glutes','hamstrings'],                    'machine',    'squat',     3),
  ('seated_row',            'Seated Row',               'lats',        ARRAY['biceps','rear_delts','traps'],             'cable',      'pull',      2),
  ('arnold_press',          'Arnold Press',             'front_delts', ARRAY['side_delts','triceps'],                   'dumbbell',   'push',      3),
  ('shrug',                 'Shrug',                    'traps',       ARRAY[]::text[],                                 'barbell',    'isolation', 1)
ON CONFLICT (id) DO NOTHING;
