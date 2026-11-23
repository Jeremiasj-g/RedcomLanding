-- Tolerancia comercial configurable, expresada en puntos porcentuales.
-- Valor inicial 1, compatible con el comportamiento anterior.
-- Las fotografías históricas ya confirmadas permanecen inmutables.
alter table public.category_scale_settings
 add column if not exists percent_tolerance numeric(4,2) not null default 1;
alter table public.category_scale_settings
 add constraint category_scale_percent_tolerance_range check (percent_tolerance between 0 and 10);

-- Supabase RPC: se entrega el valor a todos los consumidores del motor de categorías.
create or replace function public.branch_category_v2_data(p_branch_key text, p_month text default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_branch text;
  v_force text;
  v_user_branch text;
  v_data jsonb;
begin
  select b.branch,b.force,b.user_branch into v_branch,v_force,v_user_branch
  from (values
    ('corrientes_masivos','CASA CENTRAL','ESQUEMA 1','corrientes'),
    ('corrientes_refrigerados','CASA CENTRAL','ESQUEMA REGRIGERADOS','refrigerados'),
    ('chaco','SUCURSAL RESISTENCIA','all','chaco'),
    ('misiones','SUCURSAL POSADAS','all','misiones'),
    ('obera','SUCURSAL OBERA','all','obera')
  ) as b(key,branch,force,user_branch)
  where b.key=p_branch_key;
  if v_branch is null then
    raise exception 'Sucursal no válida' using errcode='22023';
  end if;
  if p_month is not null and p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mes no válido' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.is_active=true
      and (
        p.role='admin'
        or exists (select 1 from public.user_branches ub
                   where ub.user_id=p.id and ub.branch=v_user_branch)
      )
  ) then
    raise exception 'Acceso denegado a esta sucursal' using errcode='42501';
  end if;
  select jsonb_build_object(
    'months',coalesce((
      select jsonb_agg(m.month order by m.month desc)
      from public.category_panel_monthly m
      where exists(select 1 from jsonb_array_elements(m.rows) as r(value) where r.value->>'branch_key'=p_branch_key)
    ),'[]'::jsonb),
    'rows',coalesce((
      select jsonb_agg(r.value)
      from public.category_panel_monthly m,
           lateral jsonb_array_elements(m.rows) as r(value)
      where m.month=p_month and r.value->>'branch_key'=p_branch_key
    ),'[]'::jsonb),
    'projections',coalesce((
      select jsonb_agg(to_jsonb(pr))
      from public.category_kpi_projections_monthly pr
      where pr.month=p_month and pr.branch_key=p_branch_key
    ),'[]'::jsonb),
    'personnel',coalesce((
      select jsonb_agg(person.value)
      from public.category_commercial_personnel cp,
           lateral jsonb_array_elements(cp.people) as person(value)
      where cp.id=1 and person.value->>'branch'=v_branch
        and (v_force='all' or person.value->>'force'=v_force or person.value->>'role'='SUPERVISOR')
    ),'[]'::jsonb),
    'daily',coalesce((
      select jsonb_agg(to_jsonb(d))
      from public.category_sigo_daily d
      where p_month is not null
        and d.visit_date>=to_date(p_month||'-01','YYYY-MM-DD')
        and d.visit_date<(to_date(p_month||'-01','YYYY-MM-DD')+interval '1 month')::date
        and d.branch=v_branch and (v_force='all' or d.sales_force=v_force)
    ),'[]'::jsonb),
    'metrics',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.id,'sectionName',m.section_name,'metricName',m.metric_name,
        'valueType',m.value_type,'seniorValue',m.senior_value,
        'semiSeniorValue',m.semi_senior_value,'juniorValue',m.junior_value,
        'improvementValue',m.improvement_value,'weightPercent',m.weight_percent,'sortOrder',m.sort_order
      ) order by m.sort_order,m.id)
      from public.category_scale_metrics m where m.is_active=true
    ),'[]'::jsonb),
    'percentTolerance',(select settings.percent_tolerance from public.category_scale_settings settings where settings.id=1),
    'gates',coalesce((
      select jsonb_agg(jsonb_build_object('id',g.id,'label',g.label,'valueText',g.value_text,'sortOrder',g.sort_order)
        order by g.sort_order,g.id)
      from public.category_scale_gates g where g.is_active=true
    ),'[]'::jsonb)
  ) into v_data;
  return v_data;
end;
$$;
revoke all on function public.branch_category_v2_data(text,text) from public,anon;
grant execute on function public.branch_category_v2_data(text,text) to authenticated;

create or replace function public.my_commercial_vendor_category_v2(p_month text default null)
returns jsonb language plpgsql stable security definer
set search_path=''
as $fn$
declare
 v_user uuid:=auth.uid();
 v_branch text; v_code integer; v_current_scope text;
 v_month text; v_min_month text:='2026-10';
 v_allowed text[];
 v_months jsonb;
 v_row jsonb; v_row_scope text;
 v_projection jsonb;
 v_daily jsonb;
 v_scales jsonb; v_gates jsonb; v_excluded jsonb; v_monthly_consideration jsonb;
begin
 if v_user is null or not public.commercial_vendor_membership_active(v_user) then
   raise exception 'Acceso comercial no autorizado' using errcode='42501';
 end if;
 select a.branch,a.person_code,p.branch
 into v_branch,v_code,v_current_scope
 from public.commercial_vendor_accounts a
 join public.profiles p on p.id=a.auth_user_id
 where a.auth_user_id=v_user and not a.needs_review
   and p.is_active and p.role='vendedor';
 if v_code is null then raise exception 'No se encontró el código comercial' using errcode='42501';end if;
 v_allowed:=case v_branch
   when 'CASA CENTRAL' then array['corrientes_masivos','corrientes_refrigerados']
   when 'SUCURSAL RESISTENCIA' then array['chaco']
   when 'SUCURSAL POSADAS' then array['misiones']
   when 'SUCURSAL OBERA' then array['obera']
   else array[]::text[] end;
 if cardinality(v_allowed)=0 then raise exception 'Sucursal no reconocida' using errcode='22023';end if;
 v_month:=coalesce(p_month,to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM'));
 if v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    or v_month<v_min_month
    or v_month>to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')
 then raise exception 'Mes fuera del historial de Categorías V2' using errcode='22023';end if;
 select coalesce(jsonb_agg(m.month order by m.month desc),'[]'::jsonb)
 into v_months
 from public.category_panel_monthly m
 where m.month>=v_min_month and m.month<=to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')
   and exists(
     select 1 from jsonb_array_elements(m.rows) r(value)
     where r.value->>'branch_key'=any(v_allowed)
       and r.value->>'seller_id'=v_code::text
   );
 select r.value into v_row
 from public.category_panel_monthly m
 cross join lateral jsonb_array_elements(m.rows) r(value)
 where m.month=v_month and r.value->>'branch_key'=any(v_allowed)
   and r.value->>'seller_id'=v_code::text
 order by case when r.value->>'branch_key'=case v_current_scope
      when 'refrigerados' then 'corrientes_refrigerados'
      when 'corrientes' then 'corrientes_masivos'
      else v_current_scope end then 0 else 1 end
 limit 1;
 v_row_scope:=coalesce(v_row->>'branch_key',case v_current_scope
      when 'refrigerados' then 'corrientes_refrigerados'
      when 'corrientes' then 'corrientes_masivos'
      else v_current_scope end);
 select to_jsonb(pr) into v_projection
 from public.category_kpi_projections_monthly pr
 where pr.month=v_month and pr.branch_key=v_row_scope and pr.seller_id=v_code
 limit 1;
 select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) into v_daily
 from public.category_sigo_daily d
 where d.visit_date>=to_date(v_month||'-01','YYYY-MM-DD')
   and d.visit_date<(to_date(v_month||'-01','YYYY-MM-DD')+interval '1 month')::date
   and d.seller_id=v_code and d.branch=v_branch
   and (v_row_scope<>'corrientes_refrigerados' and v_row_scope<>'corrientes_masivos'
        or d.sales_force=case v_row_scope when 'corrientes_refrigerados'
               then 'ESQUEMA REGRIGERADOS' else 'ESQUEMA 1' end);
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',m.id,'sectionName',m.section_name,'metricName',m.metric_name,
 'valueType',m.value_type,'seniorValue',m.senior_value,
 'semiSeniorValue',m.semi_senior_value,'juniorValue',m.junior_value,
 'improvementValue',m.improvement_value,'weightPercent',m.weight_percent,
 'sortOrder',m.sort_order) order by m.sort_order,m.id),'[]'::jsonb)
 into v_scales from public.category_scale_metrics m where m.is_active=true;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',g.id,'label',g.label,'valueText',g.value_text,'sortOrder',g.sort_order)
 order by g.sort_order,g.id),'[]'::jsonb)
 into v_gates from public.category_scale_gates g where g.is_active=true;
 select coalesce(jsonb_agg(d.day::text),'[]'::jsonb)
 into v_excluded from public.category_nonworking_days d
 where d.day>=to_date(v_month||'-01','YYYY-MM-DD')
   and d.day<(to_date(v_month||'-01','YYYY-MM-DD')+interval '1 month')::date;
 select to_jsonb(c) into v_monthly_consideration
 from public.category_v2_monthly_considerations c
 where c.branch_key=v_row_scope and c.month=v_month and c.seller_id=v_code;
 return jsonb_build_object(
   'branch',v_branch,'code',v_code,'scope',v_row_scope,'month',v_month,
   'months',v_months,'row',v_row,'projection',v_projection,'daily',v_daily,
   'metrics',v_scales,'gates',v_gates,'excludedDays',v_excluded,
   'monthlyConsideration',v_monthly_consideration,
   'percentTolerance',(select settings.percent_tolerance from public.category_scale_settings settings where settings.id=1)
 );
end;
$fn$;
revoke all on function public.my_commercial_vendor_category_v2(text) from public,anon;
grant execute on function public.my_commercial_vendor_category_v2(text) to authenticated;

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
 v_considerations jsonb;
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
 select coalesce(jsonb_agg(to_jsonb(c) order by c.seller_id),'[]'::jsonb)
 into v_considerations from public.category_v2_monthly_considerations c
 where c.branch_key=p_branch_key and c.month=p_month
 and (c.metric_levels<>'{}'::jsonb or c.gate_exemptions<>'{}'::jsonb);
 v_snapshot:=jsonb_build_object(
  'schema_version',1,'branch_key',p_branch_key,'month',p_month,
  'rows',v_rows,'projections',v_projections,'personnel',v_personnel,'daily',v_daily,
  'metrics',v_metrics,'gates',v_gates,'excluded_days',v_excluded,
  'elapsed_workdays',v_elapsed,'percent_tolerance',
   (select settings.percent_tolerance from public.category_scale_settings settings where settings.id=1),
   'monthly_considerations',v_considerations,'results',p_results
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
