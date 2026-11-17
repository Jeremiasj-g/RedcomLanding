-- Selección histórica por mes, sin modificar permisos ni cálculo de otras secciones.
-- Categorías V 2.0: lectura mensual exclusivamente del equipo asignado.
-- La tabla JSON mensual sigue protegida: nunca se concede SELECT general.
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
      from lateral jsonb_array_elements(coalesce((
        select ver.people from public.commercial_personnel_monthly_versions mv
        join public.commercial_personnel_versions ver on ver.id=mv.version_id
        where p_month is not null and mv.effective_month<=p_month
        order by mv.effective_month desc limit 1
      ),(select cp.people from public.category_commercial_personnel cp where cp.id=1),'[]'::jsonb)) as person(value)
      where person.value->>'branch'=v_branch
        and (v_force='all' or person.value->>'force'=v_force)
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
