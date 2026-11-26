-- SIGO: RLS with cached, request-scoped authorization rather than per-row profile lookups.
-- Existing branch/role semantics are retained; no operational data is altered.
create or replace function public.sigo_authorized_branch_keys()
returns text[] language sql stable security definer set search_path = ''
as $$
 select coalesce(array_agg(distinct ub.branch),'{}'::text[])
 from public.profiles p join public.user_branches ub on ub.user_id=p.id
 where p.id=(select auth.uid()) and p.is_active=true
 and p.role in ('supervisor','jdv')
 and ub.branch in ('corrientes','refrigerados','chaco','misiones','obera');
$$;
revoke all on function public.sigo_authorized_branch_keys() from public,anon,authenticated;
grant execute on function public.sigo_authorized_branch_keys() to authenticated;

drop policy if exists "Category SIGO admin select" on public.category_sigo_daily;
create policy "Category SIGO admin select" on public.category_sigo_daily
for select to authenticated using ((select public.my_role())='admin');

drop policy if exists "Category SIGO assigned managers select" on public.category_sigo_daily;
create policy "Category SIGO assigned managers select" on public.category_sigo_daily
for select to authenticated using (
 coalesce(case
  when branch='CASA CENTRAL' and sales_force='ESQUEMA 1' then 'corrientes'
  when branch='CASA CENTRAL' and sales_force='ESQUEMA REGRIGERADOS' then 'refrigerados'
  when branch='SUCURSAL RESISTENCIA' then 'chaco'
  when branch='SUCURSAL POSADAS' then 'misiones'
  when branch='SUCURSAL OBERA' then 'obera'
 end,'') = any((select public.sigo_authorized_branch_keys())::text[])
);

-- Small, indexed metadata response; never download all daily rows merely to show five counters.
create or replace function public.sigo_month_team_counts(p_month text)
returns jsonb language sql stable security invoker set search_path = ''
as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.branch,x.sales_force),'[]'::jsonb)
 from (
  select d.branch,d.sales_force,count(*)::integer as records
  from public.category_sigo_daily d
  where p_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
   and d.visit_date >= (p_month||'-01')::date
   and d.visit_date < ((p_month||'-01')::date + interval '1 month')
  group by d.branch,d.sales_force
 ) x;
$$;
revoke all on function public.sigo_month_team_counts(text) from public,anon,authenticated;
grant execute on function public.sigo_month_team_counts(text) to authenticated;

-- One query for indexed existence and verification of all import scopes.
-- No row content from other teams is sent to the browser.
create or replace function public.sigo_import_scope_counts(p_scopes jsonb)
returns jsonb language sql stable security invoker set search_path = ''
as $$
 with incoming as (
  select distinct i.visit_date,i.branch,i.sales_force
  from jsonb_to_recordset(p_scopes) as i(visit_date date,branch text,sales_force text)
  where i.visit_date is not null and i.branch is not null and i.sales_force is not null
 ), counts as (
  select i.visit_date,i.branch,i.sales_force,
    (select count(*)::integer from public.category_sigo_daily d
     where d.visit_date=i.visit_date and d.branch=i.branch and d.sales_force=i.sales_force) as records
  from incoming i
 )
 select coalesce(jsonb_agg(to_jsonb(c) order by c.visit_date,c.branch,c.sales_force),'[]'::jsonb)
 from counts c where (select public.my_role())='admin';
$$;
revoke all on function public.sigo_import_scope_counts(jsonb) from public,anon,authenticated;
grant execute on function public.sigo_import_scope_counts(jsonb) to authenticated;

-- Rollback approach: restore the two prior RLS policy definitions, then drop
-- these three helper functions. Indexes and original data remain unchanged.
