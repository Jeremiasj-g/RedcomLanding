-- Require explicit confirmation for overwriting any existing date + branch + sales force.
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
   or (x->>'total_clients')::integer<0 or (x->>'visited_clients')::integer<0 or (x->>'unvisited_clients')::integer<0
   or (x->>'total_clients')::integer<>(x->>'visited_clients')::integer+(x->>'unvisited_clients')::integer
 ) then raise exception 'Datos diarios o sucursal inválidos' using errcode='22023'; end if;
 if not coalesce(p_confirm_replace,false) and exists(
  select 1 from public.category_sigo_daily d
  join (select distinct (x->>'visit_date')::date visit_date,x->>'branch' branch,x->>'sales_force' sales_force
    from jsonb_array_elements(p_rows) x) incoming
    on d.visit_date=incoming.visit_date and d.branch=incoming.branch and d.sales_force=incoming.sales_force
 ) then
  raise exception 'Ya existen horarios importados para esa fecha, sucursal y fuerza de venta. Confirmá el reemplazo.' using errcode='P0001';
 end if;
 delete from public.category_sigo_daily d
 using (select distinct (x->>'visit_date')::date visit_date,x->>'branch' branch,x->>'sales_force' sales_force
  from jsonb_array_elements(p_rows) x) incoming
 where d.visit_date=incoming.visit_date and d.branch=incoming.branch and d.sales_force=incoming.sales_force;
 insert into public.category_sigo_daily(visit_date,branch,sales_force,seller_name,total_clients,visited_clients,unvisited_clients,first_visit,last_visit,imported_by)
 select (x->>'visit_date')::date,x->>'branch',x->>'sales_force',x->>'seller_name',
 (x->>'total_clients')::integer,(x->>'visited_clients')::integer,(x->>'unvisited_clients')::integer,
 nullif(x->>'first_visit','')::time,nullif(x->>'last_visit','')::time,auth.uid()
 from jsonb_array_elements(p_rows) x;
end $$;
revoke all on function public.replace_category_sigo_days(jsonb) from public,anon,authenticated;
revoke all on function public.replace_category_sigo_days(jsonb,boolean) from public,anon;
grant execute on function public.replace_category_sigo_days(jsonb,boolean) to authenticated;