alter table public.category_sigo_daily
 add column if not exists branch text not null default '',
 add column if not exists sales_force text not null default '';

-- Reclassify existing historical rows only when the personnel name resolves to one unambiguous branch and force.
with personnel as (
 select upper(btrim(p->>'name')) name, min(p->>'branch') branch, min(coalesce(p->>'force','')) sales_force,
 count(distinct (coalesce(p->>'branch','')||'|'||coalesce(p->>'force',''))) variants
 from public.category_commercial_personnel c cross join lateral jsonb_array_elements(c.people) p
 where c.id=1 and p->>'role'='VENDEDOR'
 group by upper(btrim(p->>'name'))
)
update public.category_sigo_daily d set branch=p.branch,sales_force=p.sales_force
from personnel p where upper(btrim(d.seller_name))=p.name and p.variants=1 and d.branch='';

alter table public.category_sigo_daily drop constraint if exists category_sigo_daily_pkey;
alter table public.category_sigo_daily add primary key(visit_date,branch,sales_force,seller_name);
create index if not exists category_sigo_branch_date_idx on public.category_sigo_daily(branch,sales_force,visit_date desc);

create or replace function public.replace_category_sigo_days(p_rows jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.my_role()<>'admin' then
  raise exception 'Sin permisos para importar horarios' using errcode='42501';
 end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then
  raise exception 'El reporte debe contener datos' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x
  where nullif(x->>'visit_date','') is null or nullif(x->>'seller_name','') is null
   or nullif(x->>'branch','') is null or nullif(x->>'sales_force','') is null
   or (x->>'total_clients')::integer<0 or (x->>'visited_clients')::integer<0 or (x->>'unvisited_clients')::integer<0
   or (x->>'total_clients')::integer<>(x->>'visited_clients')::integer+(x->>'unvisited_clients')::integer
 ) then raise exception 'Datos diarios o sucursal inválidos' using errcode='22023'; end if;
 -- Replace only the individual branch/force/days present in this workbook.
 delete from public.category_sigo_daily d
 using (select distinct (x->>'visit_date')::date visit_date, x->>'branch' branch,x->>'sales_force' sales_force
  from jsonb_array_elements(p_rows) x) incoming
 where d.visit_date=incoming.visit_date and d.branch=incoming.branch and d.sales_force=incoming.sales_force;
 insert into public.category_sigo_daily(visit_date,branch,sales_force,seller_name,total_clients,visited_clients,unvisited_clients,first_visit,last_visit,imported_by)
 select (x->>'visit_date')::date,x->>'branch',x->>'sales_force',x->>'seller_name',
 (x->>'total_clients')::integer,(x->>'visited_clients')::integer,(x->>'unvisited_clients')::integer,
 nullif(x->>'first_visit','')::time,nullif(x->>'last_visit','')::time,auth.uid()
 from jsonb_array_elements(p_rows) x;
end $$;
revoke all on function public.replace_category_sigo_days(jsonb) from public;
grant execute on function public.replace_category_sigo_days(jsonb) to authenticated;
