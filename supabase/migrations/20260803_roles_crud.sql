-- CRUD administrativo de roles.
-- Convierte public.user_types en el catálogo central de roles y elimina
-- las listas rígidas de roles de profiles y role_module_permissions.

begin;

alter table public.user_types
  add column if not exists description text,
  add column if not exists is_active boolean not null default true,
  add column if not exists is_system boolean not null default false,
  add column if not exists sort_order integer not null default 100,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Garantiza que cualquier rol histórico presente en perfiles o permisos exista
-- antes de agregar las nuevas claves foráneas.
insert into public.user_types (code, name, description, is_active, is_system, sort_order)
select distinct
  lower(trim(p.role)) as code,
  initcap(replace(lower(trim(p.role)), '_', ' ')) as name,
  'Rol recuperado automáticamente desde perfiles existentes.' as description,
  true,
  false,
  100
from public.profiles p
where nullif(trim(p.role), '') is not null
on conflict (code) do nothing;

-- Roles históricos del sistema. Se pueden renombrar y configurar, pero no borrar.
update public.user_types
set
  is_system = true,
  is_active = true,
  sort_order = case code
    when 'admin' then 10
    when 'jdv' then 20
    when 'supervisor' then 30
    when 'vendedor' then 40
    when 'rrhh' then 50
    else sort_order
  end,
  description = coalesce(description, case code
    when 'admin' then 'Administración completa del sistema.'
    when 'jdv' then 'Jefatura de ventas y seguimiento de equipos comerciales.'
    when 'supervisor' then 'Supervisión operativa de vendedores y sucursales.'
    when 'vendedor' then 'Accesos operativos para vendedores y colaboradores.'
    when 'rrhh' then 'Gestión de contenidos y herramientas de Recursos Humanos.'
    else null
  end),
  updated_at = now()
where code in ('admin','jdv','supervisor','vendedor','rrhh');

alter table public.user_types
  drop constraint if exists user_types_code_format_check;

alter table public.user_types
  add constraint user_types_code_format_check
  check (code = lower(code) and code ~ '^[a-z][a-z0-9_]{1,31}$');

-- profiles.role deja de depender de un CHECK rígido y pasa a usar el catálogo.
update public.profiles
set role = lower(trim(role))
where role is not null and role is distinct from lower(trim(role));

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  drop constraint if exists profiles_role_user_types_fk;

alter table public.profiles
  add constraint profiles_role_user_types_fk
  foreign key (role)
  references public.user_types(code)
  on update cascade
  on delete restrict;

-- Sincroniza el identificador histórico user_type_id con el código vigente.
update public.profiles p
set user_type_id = ut.id
from public.user_types ut
where lower(trim(p.role)) = ut.code
  and p.user_type_id is distinct from ut.id;

-- role_module_permissions también pasa a aceptar roles dinámicos.
do $$
begin
  if to_regclass('public.role_module_permissions') is not null then
    insert into public.user_types (code, name, description, is_active, is_system, sort_order)
    select distinct
      lower(trim(rmp.role_key)),
      initcap(replace(lower(trim(rmp.role_key)), '_', ' ')),
      'Rol recuperado automáticamente desde permisos existentes.',
      true,
      false,
      100
    from public.role_module_permissions rmp
    where nullif(trim(rmp.role_key), '') is not null
    on conflict (code) do nothing;

    update public.role_module_permissions
    set role_key = lower(trim(role_key))
    where role_key is distinct from lower(trim(role_key));

    alter table public.role_module_permissions
      drop constraint if exists role_module_permissions_role_key_check;

    alter table public.role_module_permissions
      drop constraint if exists role_module_permissions_role_fk;

    alter table public.role_module_permissions
      add constraint role_module_permissions_role_fk
      foreign key (role_key)
      references public.user_types(code)
      on update cascade
      on delete cascade;
  end if;
end
$$;

create or replace function public.set_user_types_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_profile_user_type_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_type_id smallint;
begin
  if new.role is not null then
    select id into v_user_type_id
    from public.user_types
    where code = lower(trim(new.role));

    if v_user_type_id is null then
      raise exception 'El rol % no existe en el catálogo de roles.', new.role;
    end if;

    new.role = lower(trim(new.role));
    new.user_type_id = v_user_type_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_user_type on public.profiles;
create trigger trg_profiles_sync_user_type
before insert or update of role on public.profiles
for each row execute function public.sync_profile_user_type_id();

drop trigger if exists trg_user_types_updated_at on public.user_types;
create trigger trg_user_types_updated_at
before update on public.user_types
for each row execute function public.set_user_types_updated_at();

alter table public.user_types enable row level security;

drop policy if exists user_types_select_authenticated on public.user_types;
create policy user_types_select_authenticated
on public.user_types
for select
to authenticated
using (
  is_active
  or public.my_role() = 'admin'
  or code = public.my_role()
);

drop policy if exists user_types_insert_admin on public.user_types;
create policy user_types_insert_admin
on public.user_types
for insert
to authenticated
with check (public.my_role() = 'admin');

drop policy if exists user_types_update_admin on public.user_types;
create policy user_types_update_admin
on public.user_types
for update
to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

drop policy if exists user_types_delete_admin on public.user_types;
create policy user_types_delete_admin
on public.user_types
for delete
to authenticated
using (public.my_role() = 'admin');

grant select, insert, update, delete on public.user_types to authenticated;
grant usage, select on sequence public.user_types_id_seq to authenticated;

-- Crear rol y preparar automáticamente sus permisos predeterminados.
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

    -- Completa en false cualquier módulo que el rol plantilla todavía no tuviera.
    insert into public.role_module_permissions (role_key, module_key, can_access, updated_by)
    select
      v_code,
      module_key,
      false,
      auth.uid()
    from unnest(array[
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
    ]::text[]) as module_key
    on conflict (role_key, module_key) do nothing;
  end if;

  return v_role;
end;
$$;

revoke all on function public.admin_create_user_role(text, text, text, text) from public;
grant execute on function public.admin_create_user_role(text, text, text, text) to authenticated;

create or replace function public.admin_update_user_role(
  p_role_id smallint,
  p_name text,
  p_description text,
  p_is_active boolean,
  p_sort_order integer
)
returns public.user_types
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.user_types;
  v_updated public.user_types;
begin
  if coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'Solo un administrador puede modificar roles.';
  end if;

  select * into v_current
  from public.user_types
  where id = p_role_id
  for update;

  if not found then
    raise exception 'El rol seleccionado ya no existe.';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Ingresá un nombre válido para el rol.';
  end if;

  if v_current.code = 'admin' and not coalesce(p_is_active, true) then
    raise exception 'El rol Administrador no puede desactivarse.';
  end if;

  update public.user_types
  set
    name = trim(p_name),
    description = nullif(trim(coalesce(p_description, '')), ''),
    is_active = coalesce(p_is_active, true),
    sort_order = greatest(coalesce(p_sort_order, 100), 0)
  where id = p_role_id
  returning * into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.admin_update_user_role(smallint, text, text, boolean, integer) from public;
grant execute on function public.admin_update_user_role(smallint, text, text, boolean, integer) to authenticated;

create or replace function public.admin_delete_user_role(p_role_id smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_types;
  v_users integer;
begin
  if coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'Solo un administrador puede eliminar roles.';
  end if;

  select * into v_role
  from public.user_types
  where id = p_role_id
  for update;

  if not found then
    raise exception 'El rol seleccionado ya no existe.';
  end if;

  if v_role.is_system then
    raise exception 'Los roles base del sistema no pueden eliminarse.';
  end if;

  select count(*) into v_users
  from public.profiles
  where role = v_role.code or user_type_id = v_role.id;

  if v_users > 0 then
    raise exception 'No se puede eliminar: hay % usuario(s) asignado(s) a este rol.', v_users;
  end if;

  delete from public.user_types where id = p_role_id;
end;
$$;

revoke all on function public.admin_delete_user_role(smallint) from public;
grant execute on function public.admin_delete_user_role(smallint) to authenticated;

-- La configuración predeterminada acepta cualquier rol presente en user_types.
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

  if not exists (select 1 from public.user_types where code = v_role) then
    raise exception 'El rol indicado no existe en el catálogo.'
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

-- Realtime para que altas, ediciones y desactivaciones se reflejen sin recargar.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_types'
  ) then
    alter publication supabase_realtime add table public.user_types;
  end if;
end
$$;

commit;
