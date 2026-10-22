alter table public.category_sigo_daily add column if not exists seller_id integer;
-- Only backfill when the historical name matches exactly one ID within its already stored team.
with matching as (
 select d.visit_date,d.branch,d.sales_force,d.seller_name,
 min((p->>'id')::integer) as seller_id,
 count(distinct (p->>'id')::integer) as options
 from public.category_sigo_daily d
 join public.category_commercial_personnel c on c.id=1
 cross join lateral jsonb_array_elements(c.people) p
 where p->>'role'='VENDEDOR'
   and upper(trim(p->>'name'))=upper(trim(d.seller_name))
   and p->>'branch'=d.branch and p->>'force'=d.sales_force
   and (p->>'id') ~ '^[0-9]+$'
 group by d.visit_date,d.branch,d.sales_force,d.seller_name
)
update public.category_sigo_daily d set seller_id=m.seller_id
from matching m
where d.visit_date=m.visit_date and d.branch=m.branch
 and d.sales_force=m.sales_force and d.seller_name=m.seller_name
 and m.options=1 and d.seller_id is null;

create index if not exists category_sigo_daily_seller_id_idx
on public.category_sigo_daily(branch,sales_force,seller_id,visit_date);

create or replace function public.replace_category_sigo_days(p_rows jsonb,p_confirm_replace boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.my_role()<>'admin' then
  raise exception 'Sin permisos para importar horarios' using errcode='42501';
 end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then
  raise exception 'El reporte debe contener datos' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x
  where nullif(x->>'visit_date','') is null
   or nullif(x->>'seller_name','') is null
   or nullif(x->>'branch','') is null
   or nullif(x->>'sales_force','') is null
   or coalesce(x->>'seller_id','') !~ '^[0-9]+$'
   or (x->>'seller_id')::integer <= 0
   or (x->>'total_clients')::integer<0
   or (x->>'visited_clients')::integer<0
   or (x->>'unvisited_clients')::integer<0
   or (x->>'total_clients')::integer <> (x->>'visited_clients')::integer+(x->>'unvisited_clients')::integer
 ) then raise exception 'Datos diarios, ID o sucursal inválidos' using errcode='22023'; end if;
 -- Fail closed if name, ID and team do not match the current uploaded personnel snapshot.
 if exists (
  select 1 from jsonb_array_elements(p_rows) x
  where not exists (
   select 1 from public.category_commercial_personnel c
   cross join lateral jsonb_array_elements(c.people) p
   where c.id=1 and p->>'role'='VENDEDOR'
    and p->>'branch'=x->>'branch' and p->>'force'=x->>'sales_force'
    and upper(trim(p->>'name'))=upper(trim(x->>'seller_name'))
    and p->>'id'=x->>'seller_id'
  )
 ) then raise exception 'El ID o nombre no coincide con Personal comercial. Actualizá el detalle y volvé a importar.' using errcode='22023'; end if;
 if not coalesce(p_confirm_replace,false) and exists(
  select 1 from public.category_sigo_daily d
  join (select distinct (x->>'visit_date')::date visit_date,x->>'branch' branch,x->>'sales_force' sales_force
    from jsonb_array_elements(p_rows) x) incoming
    on d.visit_date=incoming.visit_date and d.branch=incoming.branch and d.sales_force=incoming.sales_force
 ) then
  raise exception 'Ya existen horarios para esa fecha y equipo. Confirmá el reemplazo.' using errcode='P0001';
 end if;
 delete from public.category_sigo_daily d
 using (select distinct (x->>'visit_date')::date visit_date,x->>'branch' branch,x->>'sales_force' sales_force
  from jsonb_array_elements(p_rows) x) incoming
 where d.visit_date=incoming.visit_date and d.branch=incoming.branch and d.sales_force=incoming.sales_force;
 insert into public.category_sigo_daily(visit_date,branch,sales_force,seller_id,seller_name,total_clients,visited_clients,unvisited_clients,first_visit,last_visit,imported_by)
 select (x->>'visit_date')::date,x->>'branch',x->>'sales_force',(x->>'seller_id')::integer,x->>'seller_name',
 (x->>'total_clients')::integer,(x->>'visited_clients')::integer,(x->>'unvisited_clients')::integer,
 nullif(x->>'first_visit','')::time,nullif(x->>'last_visit','')::time,auth.uid()
 from jsonb_array_elements(p_rows) x;
end $$;
revoke all on function public.replace_category_sigo_days(jsonb,boolean) from public,anon;
grant execute on function public.replace_category_sigo_days(jsonb,boolean) to authenticated;
