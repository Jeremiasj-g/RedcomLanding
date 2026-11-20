-- Categorías V2: cierres confirmados e historial de revisiones inmutable.
-- No modifica los históricos de Categorías V1 ni los datos mensuales editables.
create table if not exists public.category_v2_confirmed_closures (
 id bigint generated always as identity primary key,
 branch_key text not null check (branch_key in ('corrientes_masivos','corrientes_refrigerados','chaco','misiones','obera')),
 month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 revision integer not null check (revision > 0),
 confirmed_at timestamptz not null default now(),
 confirmed_by uuid not null references auth.users(id),
 reason text,
 snapshot jsonb not null,
 unique(branch_key,month,revision)
);
create index if not exists category_v2_closures_lookup_idx
on public.category_v2_confirmed_closures (branch_key,month,revision desc);
alter table public.category_v2_confirmed_closures enable row level security;
revoke all on public.category_v2_confirmed_closures from public,anon,authenticated;
grant select on public.category_v2_confirmed_closures to authenticated;
create policy "Administradores activos consultan cierres V2"
on public.category_v2_confirmed_closures for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.is_active=true));
-- Sólo la función autenticada inserta cierres; sin UPDATE ni DELETE expuestos.
create or replace function public.confirm_category_v2_closure(
 p_branch_key text,
 p_month text,
 p_results jsonb,
 p_expected_revision integer default 0,
 p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_branch text;
 v_force text;
 v_user uuid := (select auth.uid());
 v_rows jsonb;
 v_personnel jsonb;
 v_projections jsonb;
 v_daily jsonb;
 v_metrics jsonb;
 v_gates jsonb;
 v_excluded jsonb;
 v_elapsed integer;
 v_revision integer;
 v_new integer;
 v_id bigint;
 v_snapshot jsonb;
begin
 if v_user is null or not exists (
  select 1 from public.profiles p
  where p.id=v_user and p.role='admin' and p.is_active=true
 ) then raise exception 'Solo un administrador activo puede confirmar cierres.' using errcode='42501'; end if;
 select m.branch,m.force into v_branch,v_force from (values
  ('corrientes_masivos','CASA CENTRAL','ESQUEMA 1'),
  ('corrientes_refrigerados','CASA CENTRAL','ESQUEMA REGRIGERADOS'),
  ('chaco','SUCURSAL RESISTENCIA','all'),
  ('misiones','SUCURSAL POSADAS','all'),
  ('obera','SUCURSAL OBERA','all')
 ) as m(key,branch,force) where m.key=p_branch_key;
 if v_branch is null or p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    or to_date(p_month||'-01','YYYY-MM-DD')> (now() at time zone 'America/Argentina/Buenos_Aires')::date
 then raise exception 'Sucursal o mes no válido para el cierre.' using errcode='22023'; end if;
 if p_expected_revision is null or p_expected_revision<0 or jsonb_typeof(p_results) is distinct from 'array'
 then raise exception 'Datos de cierre no válidos.' using errcode='22023'; end if;

 -- Bloqueo transaccional para evitar dos cierres simultáneos con la misma revisión.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_branch_key||':'||p_month));
 select coalesce(max(c.revision),0) into v_revision
 from public.category_v2_confirmed_closures c where c.branch_key=p_branch_key and c.month=p_month;
 if v_revision<>p_expected_revision then
  raise exception 'El cierre cambió desde la última consulta. Actualizá antes de confirmar.' using errcode='40001';
 end if;
 if v_revision>0 and (length(trim(coalesce(p_reason,'')))<10 or length(trim(p_reason))>500) then
  raise exception 'Ingresá un motivo de reconfirmación de 10 a 500 caracteres.' using errcode='22023';
 end if;

 select coalesce(jsonb_agg(item.value),'[]'::jsonb) into v_rows
 from public.category_panel_monthly m, lateral jsonb_array_elements(m.rows) item(value)
 where m.month=p_month and item.value->>'branch_key'=p_branch_key;
 if jsonb_array_length(v_rows)=0 then
  raise exception 'No hay KPIs unificados guardados para este mes y sucursal.' using errcode='22023'; end if;

 select coalesce(jsonb_agg(item.value order by (item.value->>'id')::integer),'[]'::jsonb) into v_personnel
 from public.category_commercial_personnel cp,
 lateral jsonb_array_elements(cp.people) item(value)
 where cp.id=1 and item.value->>'role'='VENDEDOR'
 and item.value->>'branch'=v_branch
 and (v_force='all' or item.value->>'force'=v_force);
 if jsonb_array_length(v_personnel)=0 then
  raise exception 'No hay vendedores registrados para la sucursal.' using errcode='22023'; end if;
 if jsonb_array_length(p_results)<>jsonb_array_length(v_personnel)
 or exists (
  select 1 from jsonb_array_elements(v_personnel) person(value)
  where not exists (
   select 1 from jsonb_array_elements(p_results) result(value)
   where result.value->>'seller_id'=person.value->>'id'
  )
 )
 or exists (
  select 1 from jsonb_array_elements(p_results) result(value)
  where result.value->>'category' not in ('SENIOR','SEMI SENIOR','JUNIOR','PLAN DE MEJORA','PENDIENTE')
    or result.value->>'seller_id' is null
    or not exists (select 1 from jsonb_array_elements(v_personnel) person(value)
                   where person.value->>'id'=result.value->>'seller_id')
 )
 or exists (
  select 1 from jsonb_array_elements(p_results) result(value)
  group by result.value->>'seller_id' having count(*)>1
 ) then raise exception 'Los resultados no coinciden con los vendedores actuales de la sucursal.' using errcode='22023'; end if;

 select coalesce(jsonb_agg(to_jsonb(p) order by p.seller_id),'[]'::jsonb)
 into v_projections from public.category_kpi_projections_monthly p
 where p.month=p_month and p.branch_key=p_branch_key;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.visit_date,d.seller_id),'[]'::jsonb)
 into v_daily from public.category_sigo_daily d
 where d.visit_date >= to_date(p_month||'-01','YYYY-MM-DD')
 and d.visit_date < (to_date(p_month||'-01','YYYY-MM-DD')+interval '1 month')::date
 and d.branch=v_branch and (v_force='all' or d.sales_force=v_force);
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'sectionName',m.section_name,
  'metricName',m.metric_name,'valueType',m.value_type,'seniorValue',m.senior_value,
  'semiSeniorValue',m.semi_senior_value,'juniorValue',m.junior_value,
  'improvementValue',m.improvement_value,'weightPercent',m.weight_percent,
  'sortOrder',m.sort_order) order by m.sort_order,m.id),'[]'::jsonb)
 into v_metrics from public.category_scale_metrics m where m.is_active=true;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'label',g.label,
  'valueText',g.value_text,'sortOrder',g.sort_order) order by g.sort_order,g.id),'[]'::jsonb)
 into v_gates from public.category_scale_gates g where g.is_active=true;
 if jsonb_array_length(v_metrics)=0 then raise exception 'No hay escalas activas para confirmar.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(n.day order by n.day),'[]'::jsonb) into v_excluded
 from public.category_nonworking_days n
 where n.day>=to_date(p_month||'-01','YYYY-MM-DD')
 and n.day<(to_date(p_month||'-01','YYYY-MM-DD')+interval '1 month')::date;
 select count(*) into v_elapsed from pg_catalog.generate_series(
  to_date(p_month||'-01','YYYY-MM-DD'),
  least((to_date(p_month||'-01','YYYY-MM-DD')+interval '1 month - 1 day')::date,
        (now() at time zone 'America/Argentina/Buenos_Aires')::date),
  '1 day'::interval
 ) as days(day)
 where extract(dow from days.day)<>0
 and not exists(select 1 from public.category_nonworking_days n where n.day=days.day::date);
 if v_elapsed<1 then raise exception 'No hay días laborales transcurridos en el mes.' using errcode='22023'; end if;
 v_snapshot:=jsonb_build_object(
  'schema_version',1,'branch_key',p_branch_key,'month',p_month,
  'rows',v_rows,'projections',v_projections,'personnel',v_personnel,'daily',v_daily,
  'metrics',v_metrics,'gates',v_gates,'excluded_days',v_excluded,
  'elapsed_workdays',v_elapsed,'results',p_results
 );
 v_new:=v_revision+1;
 insert into public.category_v2_confirmed_closures
  (branch_key,month,revision,confirmed_by,reason,snapshot)
 values(p_branch_key,p_month,v_new,v_user,nullif(trim(p_reason),''),v_snapshot)
 returning id into v_id;
 return jsonb_build_object('id',v_id,'revision',v_new,'confirmed_at',now(),
  'seller_count',jsonb_array_length(v_personnel));
end;
$$;
revoke all on function public.confirm_category_v2_closure(text,text,jsonb,integer,text)
from public,anon,authenticated;
grant execute on function public.confirm_category_v2_closure(text,text,jsonb,integer,text) to authenticated;
