create table if not exists public.user_budgets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_budgets enable row level security;

grant select, insert, update, delete on public.user_budgets to authenticated;

drop policy if exists "Users can read their own budget" on public.user_budgets;
create policy "Users can read their own budget"
on public.user_budgets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own budget" on public.user_budgets;
create policy "Users can create their own budget"
on public.user_budgets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own budget" on public.user_budgets;
create policy "Users can update their own budget"
on public.user_budgets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own budget" on public.user_budgets;
create policy "Users can delete their own budget"
on public.user_budgets
for delete
to authenticated
using (auth.uid() = user_id);
