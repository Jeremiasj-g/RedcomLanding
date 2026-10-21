create table if not exists public.category_commercial_personnel (
  id integer primary key default 1 check (id = 1),
  people jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.category_commercial_personnel enable row level security;
drop policy if exists "Admins read commercial personnel" on public.category_commercial_personnel;
create policy "Admins read commercial personnel"
on public.category_commercial_personnel for select to authenticated
using (public.my_role() = 'admin');
drop policy if exists "Admins insert commercial personnel" on public.category_commercial_personnel;
create policy "Admins insert commercial personnel"
on public.category_commercial_personnel for insert to authenticated
with check (public.my_role() = 'admin');
drop policy if exists "Admins update commercial personnel" on public.category_commercial_personnel;
create policy "Admins update commercial personnel"
on public.category_commercial_personnel for update to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');
