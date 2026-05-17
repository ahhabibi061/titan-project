-- Support tickets submitted from the Help & Support section in Settings
create table if not exists support_tickets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  type       text not null check (type in ('bug', 'question', 'feature')),
  subject    text not null,
  body       text not null,
  status     text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

alter table support_tickets enable row level security;

-- Users can submit tickets
create policy "Users can insert their own tickets"
  on support_tickets for insert
  with check (auth.uid() = user_id);

-- Users can view their own tickets
create policy "Users can view their own tickets"
  on support_tickets for select
  using (auth.uid() = user_id);
