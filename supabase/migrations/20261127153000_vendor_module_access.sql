-- Split module permissions, retaining existing individual overrides.
alter table public.role_module_permissions drop constraint role_module_permissions_module_key_check;
alter table public.role_module_permissions add constraint role_module_permissions_module_key_check check(module_key in ('branch_dashboards','branch_categories','branch_sigo','branch_buyers','branch_coverages','branch_billing','branch_objectives','branch_operational_news','branch_critical_accounts','branch_current_accounts','branch_kilos_bultos','branch_analytics','news','personal_tasks','projects','boards','focus','quarterly_indicators','vendo_requests','hr_panel','tasks_panel','focus_panel','management_resources','branch_categories_v2','branch_supervisor_objectives','sku_foco_tracking'));
alter table public.user_module_permissions drop constraint user_module_permissions_module_key_check;
alter table public.user_module_permissions add constraint user_module_permissions_module_key_check check(module_key in ('branch_dashboards','branch_categories','branch_sigo','branch_buyers','branch_coverages','branch_billing','branch_objectives','branch_operational_news','branch_critical_accounts','branch_current_accounts','branch_kilos_bultos','branch_analytics','news','personal_tasks','projects','boards','focus','quarterly_indicators','vendo_requests','hr_panel','tasks_panel','focus_panel','management_resources','branch_categories_v2','branch_supervisor_objectives','sku_foco_tracking'));
CREATE OR REPLACE FUNCTION public.admin_set_role_module_permissions(p_role_key text, p_permissions jsonb DEFAULT '[]'::jsonb)
 RETURNS SETOF role_module_permissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text := lower(trim(coalesce(p_role_key, '')));
  v_allowed_modules text[] := array[
    'branch_dashboards',
    'branch_categories',
    'branch_sigo',
    'branch_buyers',
    'branch_coverages',
    'branch_billing',
    'branch_objectives',
    'branch_operational_news',
    'branch_critical_accounts',
    'branch_current_accounts',
    'branch_kilos_bultos',
    'branch_analytics',
    'news',
    'personal_tasks',
    'projects',
    'boards',
    'quarterly_indicators',
    'vendo_requests',
    'hr_panel',
    'tasks_panel',
    'management_resources', 'branch_categories_v2', 'branch_supervisor_objectives', 'sku_foco_tracking'
  ]::text[];
  v_expected_count integer := cardinality(v_allowed_modules);
  v_received_count integer;
  v_distinct_count integer;
begin
  if coalesce(public.my_role()::text, '') <> 'admin' then
    raise exception 'Solo un administrador puede modificar los permisos predeterminados.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_types
    where lower(trim(code)) = v_role
  ) then
    raise exception 'El rol indicado no existe en el catálogo.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_permissions, '[]'::jsonb)) <> 'array' then
    raise exception 'La configuración de permisos debe ser una lista.'
      using errcode = '22023';
  end if;

  select count(*), count(distinct item.module_key)
    into v_received_count, v_distinct_count
  from jsonb_to_recordset(coalesce(p_permissions, '[]'::jsonb))
    as item(module_key text, can_access boolean);

  if v_received_count not in (v_expected_count,v_expected_count-3)
     or v_distinct_count <> v_received_count then
    raise exception
      'La configuración debe incluir una sola vez los % permisos administrables.',
      v_expected_count
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_permissions, '[]'::jsonb))
      as item(module_key text, can_access boolean)
    where not (item.module_key = any (v_allowed_modules))
  ) then
    raise exception 'La configuración contiene un permiso desconocido.'
      using errcode = '22023';
  end if;

  delete from public.role_module_permissions
  where role_key = v_role;

  insert into public.role_module_permissions (
    role_key,
    module_key,
    can_access,
    updated_by,
    created_at,
    updated_at
  )
  select
    v_role,
    item.module_key,
    case when v_role = 'admin' then true else item.can_access end,
    auth.uid(),
    now(),
    now()
  from jsonb_to_recordset(coalesce(p_permissions, '[]'::jsonb))
    as item(module_key text, can_access boolean);

  return query
  select *
  from public.role_module_permissions
  where role_key = v_role
  order by module_key;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.branch_category_v2_data(p_branch_key text, p_month text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not public.has_module_permission('branch_categories_v2') then raise exception 'Sin permiso para Categorías V2' using errcode='42501'; end if;
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
      from public.category_scale_metrics m where m.is_active=true and m.scale_key=case when p_branch_key='corrientes_refrigerados' then 'refrigerados' else 'general' end
    ),'[]'::jsonb),
    'percentTolerance',(select settings.percent_tolerance from public.category_scale_settings settings where settings.id=case when p_branch_key='corrientes_refrigerados' then 2 else 1 end),
    'gates',coalesce((
      select jsonb_agg(jsonb_build_object('id',g.id,'label',g.label,'valueText',g.value_text,'sortOrder',g.sort_order)
        order by g.sort_order,g.id)
      from public.category_scale_gates g where g.is_active=true and g.scale_key=case when p_branch_key='corrientes_refrigerados' then 'refrigerados' else 'general' end
    ),'[]'::jsonb)
  ) into v_data;
  return v_data;
end;
$function$
;
insert into public.role_module_permissions(role_key,module_key,can_access)
select u.code,k.key,case when u.code='vendedor' then false when k.key='sku_foco_tracking' then true when k.key='branch_categories_v2' then coalesce((select can_access from public.role_module_permissions where role_key=u.code and module_key='branch_categories'),u.code in ('admin','jdv','supervisor','rrhh')) else coalesce((select can_access from public.role_module_permissions where role_key=u.code and module_key='branch_objectives'),false) end
from public.user_types u cross join (values ('branch_categories_v2'),('branch_supervisor_objectives'),('sku_foco_tracking')) k(key) on conflict do nothing;
insert into public.user_module_permissions(user_id,module_key,can_access,granted_by)
select user_id,'branch_categories_v2',can_access,granted_by from public.user_module_permissions where module_key='branch_categories' on conflict do nothing;
insert into public.user_module_permissions(user_id,module_key,can_access,granted_by)
select user_id,'branch_supervisor_objectives',can_access,granted_by from public.user_module_permissions where module_key='branch_objectives' on conflict do nothing;
update public.role_module_permissions set can_access=true where role_key='vendedor' and module_key in ('branch_categories','branch_objectives','branch_dashboards');
update public.branch_resources set permission_key='branch_categories',allowed_roles=null where title='Categorías' and branch_key in ('corrientes_masivos','corrientes_refrigerados','chaco','misiones','obera');
update public.branch_resources set permission_key='branch_supervisor_objectives',allowed_roles=null where permission_key='branch_objectives' and title ilike '%supervisor%';
update public.branch_resources set permission_key=case when title ilike 'Novedades%' then 'branch_operational_news' when title='Planilla SuperAPP' then 'branch_sigo' else 'branch_critical_accounts' end where permission_key is null and allowed_roles is null and branch_key in ('corrientes_masivos','corrientes_refrigerados','chaco','misiones','obera');
drop policy sku_foco_shared_read on public.sku_foco_shared_state;
create policy sku_foco_shared_read on public.sku_foco_shared_state for select to authenticated using ((select public.has_module_permission('sku_foco_tracking')));
drop policy sku_foco_reports_read on storage.objects;
create policy sku_foco_reports_read on storage.objects for select to authenticated using (bucket_id='sku-foco-reports' and (select public.has_module_permission('sku_foco_tracking')));
drop policy branch_resources_select_authenticated on public.branch_resources;
create policy branch_resources_select_authenticated on public.branch_resources for select to authenticated using ((select public.my_role())='admin' or (allowed_roles is not null and (select public.my_role())=any(allowed_roles)) or (allowed_roles is null and ((permission_key is not null and public.has_module_permission(permission_key)) or (permission_key is null and (select public.my_role())<>'vendedor'))));
