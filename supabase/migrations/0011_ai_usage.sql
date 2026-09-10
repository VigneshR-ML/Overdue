-- 0011: monthly AI-draft usage for the Free plan quota (5/month, Pro unlimited).
-- One row per user per calendar month; incremented only when the LLM is
-- actually called. Safe to re-run.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.ai_usage enable row level security;
