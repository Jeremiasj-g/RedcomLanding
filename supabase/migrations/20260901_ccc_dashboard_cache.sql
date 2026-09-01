-- Persistencia de resultados procesados de CCC/MIX/DROPSIZE.
-- El dashboard se reutiliza mientras las fuentes mantengan el mismo fingerprint.

create table if not exists public.ccc_dashboard_cache (
  branch_key text primary key,
  source_fingerprint text not null,
  payload jsonb not null default '{}'::jsonb,
  generated_by uuid null references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ccc_dashboard_cache enable row level security;

drop policy if exists "ccc_dashboard_cache_select_authenticated" on public.ccc_dashboard_cache;
create policy "ccc_dashboard_cache_select_authenticated"
  on public.ccc_dashboard_cache
  for select
  to authenticated
  using (true);

drop policy if exists "ccc_dashboard_cache_insert_authenticated" on public.ccc_dashboard_cache;
create policy "ccc_dashboard_cache_insert_authenticated"
  on public.ccc_dashboard_cache
  for insert
  to authenticated
  with check (true);

drop policy if exists "ccc_dashboard_cache_update_authenticated" on public.ccc_dashboard_cache;
create policy "ccc_dashboard_cache_update_authenticated"
  on public.ccc_dashboard_cache
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "ccc_dashboard_cache_delete_authenticated" on public.ccc_dashboard_cache;
create policy "ccc_dashboard_cache_delete_authenticated"
  on public.ccc_dashboard_cache
  for delete
  to authenticated
  using (true);

create index if not exists ccc_dashboard_cache_updated_at_idx
  on public.ccc_dashboard_cache(updated_at desc);
