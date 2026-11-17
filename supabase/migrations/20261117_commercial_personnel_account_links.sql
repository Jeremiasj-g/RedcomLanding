-- Vinculación explícita del personal vendedor al usuario de RedcomWeb.
-- No guarda contraseñas ni crea cuentas. No modifica datos actuales.
begin;
create table if not exists public.commercial_personnel_account_links (
  branch text not null check(length(btrim(branch)) between 1 and 160),
  person_code integer not null check(person_code>0),
  person_name text not null check(length(btrim(person_name))>0),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  primary key(branch,person_code)
);
alter table public.commercial_personnel_account_links enable row level security;
drop policy if exists "admin_select_personnel_links" on public.commercial_personnel_account_links;
create policy "admin_select_personnel_links" on public.commercial_personnel_account_links
for select to authenticated using (
  exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.role='admin' and me.is_active=true)
);
drop policy if exists "admin_insert_personnel_links" on public.commercial_personnel_account_links;
create policy "admin_insert_personnel_links" on public.commercial_personnel_account_links
for insert to authenticated with check (
  linked_by=(select auth.uid()) and
  exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.role='admin' and me.is_active=true) and
  exists(select 1 from public.profiles p where p.id=auth_user_id and p.role='vendedor' and p.is_active=true) and
  exists(select 1 from public.category_commercial_personnel cp,
    lateral jsonb_array_elements(cp.people) item
    where cp.id=1 and item->>'role'='VENDEDOR'
      and item->>'branch'=branch
      and (item->>'id')::integer=person_code
      and item->>'name'=person_name)
);
drop policy if exists "admin_update_personnel_links" on public.commercial_personnel_account_links;
create policy "admin_update_personnel_links" on public.commercial_personnel_account_links
for update to authenticated
using(exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.role='admin' and me.is_active=true))
with check(
  linked_by=(select auth.uid()) and
  exists(select 1 from public.profiles p where p.id=auth_user_id and p.role='vendedor' and p.is_active=true) and
  exists(select 1 from public.category_commercial_personnel cp,
    lateral jsonb_array_elements(cp.people) item
    where cp.id=1 and item->>'role'='VENDEDOR'
      and item->>'branch'=branch
      and (item->>'id')::integer=person_code
      and item->>'name'=person_name)
);
drop policy if exists "admin_delete_personnel_links" on public.commercial_personnel_account_links;
create policy "admin_delete_personnel_links" on public.commercial_personnel_account_links
for delete to authenticated using (
  exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.role='admin' and me.is_active=true)
);
grant select,insert,update,delete on public.commercial_personnel_account_links to authenticated;
commit;
