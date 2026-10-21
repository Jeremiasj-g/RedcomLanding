create table if not exists public.category_sigo_daily (
 visit_date date not null,
 seller_name text not null,
 total_clients integer not null default 0,
 visited_clients integer not null default 0,
 unvisited_clients integer not null default 0,
 first_visit time,
 last_visit time,
 imported_at timestamptz not null default now(),
 imported_by uuid references auth.users(id),
 primary key(visit_date,seller_name),
 constraint sigo_non_negative check(total_clients>=0 and visited_clients>=0 and unvisited_clients>=0)
);
create index if not exists category_sigo_daily_date_idx on public.category_sigo_daily(visit_date desc);
alter table public.category_sigo_daily enable row level security;
create policy "Category SIGO admin select" on public.category_sigo_daily for select to authenticated using(public.my_role()='admin');
create policy "Category SIGO admin insert" on public.category_sigo_daily for insert to authenticated with check(public.my_role()='admin');
create policy "Category SIGO admin update" on public.category_sigo_daily for update to authenticated using(public.my_role()='admin') with check(public.my_role()='admin');

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
  or (x->>'total_clients')::integer<0 or (x->>'visited_clients')::integer<0 or (x->>'unvisited_clients')::integer<0
  or (x->>'total_clients')::integer<>(x->>'visited_clients')::integer+(x->>'unvisited_clients')::integer) then
  raise exception 'Datos diarios inválidos' using errcode='22023';
 end if;
 delete from public.category_sigo_daily
 where visit_date in(select distinct(x->>'visit_date')::date from jsonb_array_elements(p_rows) x);
 insert into public.category_sigo_daily(visit_date,seller_name,total_clients,visited_clients,unvisited_clients,first_visit,last_visit,imported_by)
 select(x->>'visit_date')::date,x->>'seller_name',
 (x->>'total_clients')::integer,(x->>'visited_clients')::integer,(x->>'unvisited_clients')::integer,
 nullif(x->>'first_visit','')::time,nullif(x->>'last_visit','')::time,auth.uid()
 from jsonb_array_elements(p_rows) x;
end $$;
revoke all on function public.replace_category_sigo_days(jsonb) from public;
grant execute on function public.replace_category_sigo_days(jsonb) to authenticated;
