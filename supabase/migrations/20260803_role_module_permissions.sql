-- Permisos predeterminados de acceso a módulos por rol.
-- Los usuarios heredan estos valores automáticamente, salvo que tengan
-- una excepción explícita en public.user_module_permissions.

begin;

create table if not exists public.role_module_permissions (
  role_key text not null,
  module_key text not null,
  can_access boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_key, module_key),
  constraint role_module_permissions_role_key_check check (
    role_key = any (array['admin','jdv','supervisor','vendedor','rrhh'])
  ),
  constraint role_module_permissions_module_key_check check (
    module_key = any (
      array[
        'branch_dashboards',
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
      ]
    )
  )
);

create index if not exists role_module_permissions_role_idx
  on public.role_module_permissions (role_key, module_key);

alter table public.role_module_permissions enable row level security;

drop policy if exists role_module_permissions_select on public.role_module_permissions;
create policy role_module_permissions_select
on public.role_module_permissions
for select
to authenticated
using (true);

drop policy if exists role_module_permissions_insert on public.role_module_permissions;
create policy role_module_permissions_insert
on public.role_module_permissions
for insert
to authenticated
with check (
  public.my_role() = 'admin'
  and updated_by = auth.uid()
);

drop policy if exists role_module_permissions_update on public.role_module_permissions;
create policy role_module_permissions_update
on public.role_module_permissions
for update
to authenticated
using (public.my_role() = 'admin')
with check (
  public.my_role() = 'admin'
  and updated_by = auth.uid()
);

drop policy if exists role_module_permissions_delete on public.role_module_permissions;
create policy role_module_permissions_delete
on public.role_module_permissions
for delete
to authenticated
using (public.my_role() = 'admin');

grant select on public.role_module_permissions to authenticated;
grant insert, update, delete on public.role_module_permissions to authenticated;

-- Valores iniciales equivalentes a los accesos históricos del proyecto.
-- ON CONFLICT DO NOTHING evita sobrescribir configuraciones ya personalizadas
-- cuando la migración se vuelve a ejecutar.
insert into public.role_module_permissions (role_key, module_key, can_access)
values
  ('admin', 'branch_dashboards', true),
  ('admin', 'news', true),
  ('admin', 'personal_tasks', true),
  ('admin', 'projects', true),
  ('admin', 'boards', true),
  ('admin', 'focus', true),
  ('admin', 'quarterly_indicators', true),
  ('admin', 'vendo_requests', true),
  ('admin', 'hr_panel', true),
  ('admin', 'tasks_panel', true),
  ('admin', 'focus_panel', true),
  ('admin', 'management_resources', true),

  ('jdv', 'branch_dashboards', true),
  ('jdv', 'news', true),
  ('jdv', 'personal_tasks', true),
  ('jdv', 'projects', true),
  ('jdv', 'boards', true),
  ('jdv', 'focus', true),
  ('jdv', 'quarterly_indicators', true),
  ('jdv', 'vendo_requests', true),
  ('jdv', 'hr_panel', false),
  ('jdv', 'tasks_panel', true),
  ('jdv', 'focus_panel', true),
  ('jdv', 'management_resources', false),

  ('supervisor', 'branch_dashboards', true),
  ('supervisor', 'news', true),
  ('supervisor', 'personal_tasks', true),
  ('supervisor', 'projects', true),
  ('supervisor', 'boards', true),
  ('supervisor', 'focus', true),
  ('supervisor', 'quarterly_indicators', true),
  ('supervisor', 'vendo_requests', true),
  ('supervisor', 'hr_panel', false),
  ('supervisor', 'tasks_panel', false),
  ('supervisor', 'focus_panel', true),
  ('supervisor', 'management_resources', false),

  ('vendedor', 'branch_dashboards', true),
  ('vendedor', 'news', true),
  ('vendedor', 'personal_tasks', false),
  ('vendedor', 'projects', false),
  ('vendedor', 'boards', true),
  ('vendedor', 'focus', true),
  ('vendedor', 'quarterly_indicators', false),
  ('vendedor', 'vendo_requests', false),
  ('vendedor', 'hr_panel', false),
  ('vendedor', 'tasks_panel', false),
  ('vendedor', 'focus_panel', false),
  ('vendedor', 'management_resources', false),

  ('rrhh', 'branch_dashboards', true),
  ('rrhh', 'news', true),
  ('rrhh', 'personal_tasks', false),
  ('rrhh', 'projects', false),
  ('rrhh', 'boards', true),
  ('rrhh', 'focus', true),
  ('rrhh', 'quarterly_indicators', true),
  ('rrhh', 'vendo_requests', true),
  ('rrhh', 'hr_panel', true),
  ('rrhh', 'tasks_panel', false),
  ('rrhh', 'focus_panel', false),
  ('rrhh', 'management_resources', false)
on conflict (role_key, module_key) do nothing;

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
  v_expected_count integer := 12;
begin
  if coalesce(public.my_role()::text, '') <> 'admin' then
    raise exception 'Solo un administrador puede modificar los permisos predeterminados.'
      using errcode = '42501';
  end if;

  if v_role not in ('admin','jdv','supervisor','vendedor','rrhh') then
    raise exception 'El rol indicado no es válido.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_permissions, '[]'::jsonb)) <> 'array' then
    raise exception 'La configuración de permisos debe ser una lista.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_permissions, '[]'::jsonb)) <> v_expected_count then
    raise exception 'La configuración debe incluir los % módulos administrables.', v_expected_count
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
$$;

revoke all on function public.admin_set_role_module_permissions(text, jsonb) from public;
grant execute on function public.admin_set_role_module_permissions(text, jsonb)
to authenticated;

-- Realtime actualiza menús y guards sin requerir un nuevo inicio de sesión.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'role_module_permissions'
  ) then
    alter publication supabase_realtime add table public.role_module_permissions;
  end if;
exception
  when undefined_object then
    null;
end $$;

commit;
