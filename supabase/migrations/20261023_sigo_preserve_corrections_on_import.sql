-- Preserve manual edits when refreshing the underlying SIGO report.
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
  where nullif(x->>'visit_date','') is null or nullif(x->>'seller_name','') is null
  or nullif(x->>'branch','') is null or nullif(x->>'sales_force','') is null
  or coalesce(x->>'seller_id','') !~ '^[0-9]+$'
  or (x->>'seller_id')::integer<=0 or (x->>'total_clients')::integer<0
  or (x->>'visited_clients')::integer<0 or (x->>'unvisited_clients')::integer<0
  or (x->>'total_clients')::integer<>(x->>'visited_clients')::integer+(x->>'unvisited_clients')::integer
 ) then raise exception 'Datos diarios o ID inválidos' using errcode='22023'; end if;
 if exists (select 1 from jsonb_array_elements(p_rows) x
 where not exists (select 1 from public.category_commercial_personnel c,
 lateral jsonb_array_elements(c.people) p where c.id=1 and p->>'role'='VENDEDOR'
 and p->>'branch'=x->>'branch' and p->>'force'=x->>'sales_force'
 and upper(trim(p->>'name'))=upper(trim(x->>'seller_name'))
 and p->>'id'=x->>'seller_id')) then
 raise exception 'El nombre o ID no coincide con Personal comercial' using errcode='22023'; end if;
 if not coalesce(p_confirm_replace,false) and exists (
 select 1 from public.category_sigo_daily d
 join (select distinct (x->>'visit_date')::date visit_date,x->>'branch' branch,x->>'sales_force' sales_force
 from jsonb_array_elements(p_rows) x) incoming using(visit_date,branch,sales_force)
 ) then raise exception 'Confirmá el reemplazo de fechas ya importadas' using errcode='P0001'; end if;
 -- Lock the full team/date scope before checking for changes.
 perform 1 from public.category_sigo_daily d
 join (select distinct (x->>'visit_date')::date visit_date,x->>'branch' branch,x->>'sales_force' sales_force
 from jsonb_array_elements(p_rows) x) incoming using(visit_date,branch,sales_force) for update of d;
 -- A corrected row omitted or renamed by a new import must be reconciled instead of silently deleted.
 if exists(
 select 1 from public.category_sigo_daily d
 join (select distinct (x->>'visit_date')::date visit_date,x->>'branch' branch,x->>'sales_force' sales_force
 from jsonb_array_elements(p_rows) x) incoming using(visit_date,branch,sales_force)
 where (d.corrected_start is not null or d.corrected_end is not null or d.reason is not null or d.comments is not null)
 and not exists(select 1 from jsonb_array_elements(p_rows) x where (x->>'visit_date')::date=d.visit_date
  and x->>'branch'=d.branch and x->>'sales_force'=d.sales_force
  and x->>'seller_name'=d.seller_name and (x->>'seller_id')::integer=d.seller_id)
 ) then raise exception 'Hay correcciones de vendedores que desaparecieron o cambiaron de nombre. Revisá esos datos antes de reemplazar.' using errcode='P0001'; end if;
 delete from public.category_sigo_daily d using (
 select distinct (x->>'visit_date')::date visit_date,x->>'branch' branch,x->>'sales_force' sales_force
 from jsonb_array_elements(p_rows) x) incoming
 where d.visit_date=incoming.visit_date and d.branch=incoming.branch and d.sales_force=incoming.sales_force
 and not exists(select 1 from jsonb_array_elements(p_rows) x where (x->>'visit_date')::date=d.visit_date
  and x->>'branch'=d.branch and x->>'sales_force'=d.sales_force and x->>'seller_name'=d.seller_name);
 insert into public.category_sigo_daily(visit_date,branch,sales_force,seller_id,seller_name,total_clients,visited_clients,unvisited_clients,first_visit,last_visit,imported_by)
 select (x->>'visit_date')::date,x->>'branch',x->>'sales_force',(x->>'seller_id')::integer,x->>'seller_name',
 (x->>'total_clients')::integer,(x->>'visited_clients')::integer,(x->>'unvisited_clients')::integer,
 nullif(x->>'first_visit','')::time,nullif(x->>'last_visit','')::time,auth.uid()
 from jsonb_array_elements(p_rows) x
 on conflict(visit_date,branch,sales_force,seller_name)
 do update set seller_id=excluded.seller_id,total_clients=excluded.total_clients,
 visited_clients=excluded.visited_clients,unvisited_clients=excluded.unvisited_clients,
 first_visit=excluded.first_visit,last_visit=excluded.last_visit,imported_by=excluded.imported_by,
 imported_at=now();
end $$;
revoke all on function public.replace_category_sigo_days(jsonb,boolean) from public,anon;
grant execute on function public.replace_category_sigo_days(jsonb,boolean) to authenticated;
