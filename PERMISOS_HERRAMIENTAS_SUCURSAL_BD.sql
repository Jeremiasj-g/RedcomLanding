-- Permisos granulares para herramientas y analítica dentro de las sucursales.
-- Elimina la dependencia de listas estáticas de roles en lib/data.js y permite
-- configurar cada capacidad desde Panel de administrador > Permisos.

begin;

alter table public.user_module_permissions
  drop constraint if exists user_module_permissions_module_key_check;

alter table public.user_module_permissions
  add constraint user_module_permissions_module_key_check check (
    module_key = any (array[
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
      'focus',
      'quarterly_indicators',
      'vendo_requests',
      'hr_panel',
      'tasks_panel',
      'focus_panel',
      'management_resources'
    ]::text[])
  );

alter table public.role_module_permissions
  drop constraint if exists role_module_permissions_module_key_check;

alter table public.role_module_permissions
  add constraint role_module_permissions_module_key_check check (
    module_key = any (array[
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
      'focus',
      'quarterly_indicators',
      'vendo_requests',
      'hr_panel',
      'tasks_panel',
      'focus_panel',
      'management_resources'
    ]::text[])
  );

-- Valores históricos: herramientas internas para admin/JDV/supervisor/RRHH,
-- objetivos para todos y analítica para admin/JDV/supervisor.
insert into public.role_module_permissions (role_key, module_key, can_access)
values
  ('admin', 'branch_categories', true),
  ('admin', 'branch_sigo', true),
  ('admin', 'branch_buyers', true),
  ('admin', 'branch_coverages', true),
  ('admin', 'branch_billing', true),
  ('admin', 'branch_objectives', true),
  ('admin', 'branch_operational_news', true),
  ('admin', 'branch_critical_accounts', true),
  ('admin', 'branch_current_accounts', true),
  ('admin', 'branch_kilos_bultos', true),
  ('admin', 'branch_analytics', true),

  ('jdv', 'branch_categories', true),
  ('jdv', 'branch_sigo', true),
  ('jdv', 'branch_buyers', true),
  ('jdv', 'branch_coverages', true),
  ('jdv', 'branch_billing', true),
  ('jdv', 'branch_objectives', true),
  ('jdv', 'branch_operational_news', true),
  ('jdv', 'branch_critical_accounts', true),
  ('jdv', 'branch_current_accounts', true),
  ('jdv', 'branch_kilos_bultos', true),
  ('jdv', 'branch_analytics', true),

  ('supervisor', 'branch_categories', true),
  ('supervisor', 'branch_sigo', true),
  ('supervisor', 'branch_buyers', true),
  ('supervisor', 'branch_coverages', true),
  ('supervisor', 'branch_billing', true),
  ('supervisor', 'branch_objectives', true),
  ('supervisor', 'branch_operational_news', true),
  ('supervisor', 'branch_critical_accounts', true),
  ('supervisor', 'branch_current_accounts', true),
  ('supervisor', 'branch_kilos_bultos', true),
  ('supervisor', 'branch_analytics', true),

  ('vendedor', 'branch_categories', false),
  ('vendedor', 'branch_sigo', false),
  ('vendedor', 'branch_buyers', false),
  ('vendedor', 'branch_coverages', false),
  ('vendedor', 'branch_billing', false),
  ('vendedor', 'branch_objectives', true),
  ('vendedor', 'branch_operational_news', false),
  ('vendedor', 'branch_critical_accounts', false),
  ('vendedor', 'branch_current_accounts', false),
  ('vendedor', 'branch_kilos_bultos', false),
  ('vendedor', 'branch_analytics', false),

  ('rrhh', 'branch_categories', true),
  ('rrhh', 'branch_sigo', true),
  ('rrhh', 'branch_buyers', true),
  ('rrhh', 'branch_coverages', true),
  ('rrhh', 'branch_billing', true),
  ('rrhh', 'branch_objectives', true),
  ('rrhh', 'branch_operational_news', true),
  ('rrhh', 'branch_critical_accounts', true),
  ('rrhh', 'branch_current_accounts', true),
  ('rrhh', 'branch_kilos_bultos', true),
  ('rrhh', 'branch_analytics', false)
on conflict (role_key, module_key) do nothing;

-- Los roles personalizados existentes reciben los nuevos permisos apagados.
insert into public.role_module_permissions (role_key, module_key, can_access)
select
  ut.code,
  module_key,
  false
from public.user_types ut
cross join unnest(array[
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
  'branch_analytics'
]::text[]) as module_key
where ut.code not in ('admin', 'jdv', 'supervisor', 'vendedor', 'rrhh')
on conflict (role_key, module_key) do nothing;

-- La validación deja de depender de un número escrito manualmente.
create or replace function public.admin_set_role_module_permissions(
  p_role_key text,
  p_permissions jsonb default '[]'::jsonb
)
returns setof public.role_module_permissions
language plpgsql
security definer
set search_path = public
as $$
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
    'focus',
    'quarterly_indicators',
    'vendo_requests',
    'hr_panel',
    'tasks_panel',
    'focus_panel',
    'management_resources'
  ]::text[];
  v_expected_count integer := cardinality(v_allowed_modules);
  v_received_count integer;
  v_distinct_count integer;
begin
  if coalesce(public.my_role()::text, '') <> 'admin' then
    raise exception 'Solo un administrador puede modificar los permisos predeterminados.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.user_types where code = v_role) then
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

  if v_received_count <> v_expected_count or v_distinct_count <> v_expected_count then
    raise exception 'La configuración debe incluir una sola vez los % permisos administrables.', v_expected_count
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

  delete from public.role_module_permissions where role_key = v_role;

  insert into public.role_module_permissions (
    role_key, module_key, can_access, updated_by, created_at, updated_at
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
$$;

revoke all on function public.admin_set_role_module_permissions(text, jsonb) from public;
grant execute on function public.admin_set_role_module_permissions(text, jsonb) to authenticated;

-- Los roles creados desde el CRUD heredan también todos los permisos nuevos.
create or replace function public.admin_create_user_role(
  p_code text,
  p_name text,
  p_description text default null,
  p_template_role text default null
)
returns public.user_types
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lower(trim(coalesce(p_code, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_template text := lower(trim(coalesce(p_template_role, '')));
  v_role public.user_types;
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
    'focus',
    'quarterly_indicators',
    'vendo_requests',
    'hr_panel',
    'tasks_panel',
    'focus_panel',
    'management_resources'
  ]::text[];
begin
  if coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'Solo un administrador puede crear roles.';
  end if;

  if v_code !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception 'El código debe comenzar con una letra y usar solo minúsculas, números o guion bajo.';
  end if;

  if length(v_name) < 2 then
    raise exception 'Ingresá un nombre válido para el rol.';
  end if;

  insert into public.user_types (
    code, name, description, is_active, is_system, sort_order
  )
  values (
    v_code,
    v_name,
    nullif(trim(coalesce(p_description, '')), ''),
    true,
    false,
    coalesce((select max(sort_order) + 10 from public.user_types), 100)
  )
  returning * into v_role;

  if to_regclass('public.role_module_permissions') is not null then
    if v_template <> '' and exists (
      select 1 from public.user_types where code = v_template
    ) then
      insert into public.role_module_permissions (role_key, module_key, can_access, updated_by)
      select v_code, module_key, can_access, auth.uid()
      from public.role_module_permissions
      where role_key = v_template
      on conflict (role_key, module_key) do update
      set can_access = excluded.can_access, updated_by = auth.uid(), updated_at = now();
    end if;

    insert into public.role_module_permissions (role_key, module_key, can_access, updated_by)
    select v_code, module_key, false, auth.uid()
    from unnest(v_allowed_modules) as module_key
    on conflict (role_key, module_key) do nothing;
  end if;

  return v_role;
end;
$$;

revoke all on function public.admin_create_user_role(text, text, text, text) from public;
grant execute on function public.admin_create_user_role(text, text, text, text) to authenticated;

commit;
