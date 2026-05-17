-- ============================================================
-- 015 — Missing tables, columns, and streak function
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── water_logs ───────────────────────────────────────────────
create table if not exists water_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount_ml   integer not null,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
alter table water_logs enable row level security;
create policy "water_logs: owner select" on water_logs for select using (auth.uid() = user_id);
create policy "water_logs: owner insert" on water_logs for insert with check (auth.uid() = user_id);
create policy "water_logs: owner delete" on water_logs for delete using (auth.uid() = user_id);

-- ── progress_photos ──────────────────────────────────────────
create table if not exists progress_photos (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  taken_at    date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now()
);
alter table progress_photos enable row level security;
create policy "progress_photos: owner select" on progress_photos for select using (auth.uid() = user_id);
create policy "progress_photos: owner insert" on progress_photos for insert with check (auth.uid() = user_id);
create policy "progress_photos: owner delete" on progress_photos for delete using (auth.uid() = user_id);

-- ── activity_feed ─────────────────────────────────────────────
create table if not exists activity_feed (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null,  -- 'workout_complete', 'pr_hit', 'streak_milestone', etc.
  payload     jsonb,
  created_at  timestamptz not null default now()
);
alter table activity_feed enable row level security;
create policy "activity_feed: owner select" on activity_feed for select using (auth.uid() = user_id);
create policy "activity_feed: owner insert" on activity_feed for insert with check (auth.uid() = user_id);

-- ── profiles — missing columns ───────────────────────────────
alter table profiles
  add column if not exists full_name           text,
  add column if not exists avatar_url          text,
  add column if not exists updated_at          timestamptz default now(),
  add column if not exists program_week        integer default 1,
  add column if not exists program_duration    integer default 12,
  add column if not exists streak_days         integer default 0,
  add column if not exists last_active_date    date,
  add column if not exists revenue_cat_id      text,
  add column if not exists training_age_years  integer default 0,
  add column if not exists date_of_birth       date,
  add column if not exists current_streak      integer default 0;

-- ── workouts — missing columns ───────────────────────────────
alter table workouts
  add column if not exists updated_at          timestamptz default now(),
  add column if not exists started_at          timestamptz,
  add column if not exists finished_at         timestamptz,
  add column if not exists completed           boolean default false,
  add column if not exists duration_seconds    integer,
  add column if not exists total_volume_kg     numeric(10,2),
  add column if not exists split_tag           text;

-- ── sets — missing columns ────────────────────────────────────
alter table sets
  add column if not exists user_id        uuid references auth.users(id) on delete cascade,
  add column if not exists completed_at   timestamptz,
  add column if not exists rpe            numeric(3,1),
  add column if not exists is_warmup      boolean default false,
  add column if not exists created_at     timestamptz default now();

-- ── workout_exercises — missing columns ──────────────────────
alter table workout_exercises
  add column if not exists notes text;

-- ── update_streak function ───────────────────────────────────
create or replace function update_streak(p_user_id uuid, p_date date)
returns void
language plpgsql
security definer
as $$
declare
  v_last_active date;
  v_current_streak integer;
begin
  select last_active_date, current_streak
    into v_last_active, v_current_streak
    from profiles
   where id = p_user_id;

  if v_last_active is null then
    -- First ever workout
    update profiles
       set current_streak   = 1,
           streak_days      = 1,
           last_active_date = p_date,
           updated_at       = now()
     where id = p_user_id;

  elsif p_date = v_last_active then
    -- Same day, no change
    null;

  elsif p_date = v_last_active + interval '1 day' then
    -- Consecutive day
    update profiles
       set current_streak   = v_current_streak + 1,
           streak_days      = greatest(streak_days, v_current_streak + 1),
           last_active_date = p_date,
           updated_at       = now()
     where id = p_user_id;

  else
    -- Streak broken — reset
    update profiles
       set current_streak   = 1,
           last_active_date = p_date,
           updated_at       = now()
     where id = p_user_id;
  end if;
end;
$$;
