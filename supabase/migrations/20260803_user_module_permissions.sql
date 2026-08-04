-- Permisos individuales de acceso a módulos.
-- Los permisos explícitos reemplazan el acceso predeterminado del rol.
-- Si un usuario no tiene filas, la aplicación conserva el comportamiento histórico por rol.

begin;

create table if not exists public.user_module_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null,
  can_access boolean not null default false,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module_key),
  constraint user_module_permissions_module_key_check check (
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

create index if not exists user_module_permissions_user_idx
  on public.user_module_permissions (user_id);

create index if not exists user_module_permissions_module_idx
  on public.user_module_permissions (module_key, can_access);

alter table public.user_module_permissions enable row level security;

drop policy if exists user_module_permissions_select on public.user_module_permissions;
create policy user_module_permissions_select
on public.user_module_permissions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.my_role() = 'admin'
);

drop policy if exists user_module_permissions_insert on public.user_module_permissions;
create policy user_module_permissions_insert
on public.user_module_permissions
for insert
to authenticated
with check (
  public.my_role() = 'admin'
  and granted_by = auth.uid()
);

drop policy if exists user_module_permissions_update on public.user_module_permissions;
create policy user_module_permissions_update
on public.user_module_permissions
for update
to authenticated
using (public.my_role() = 'admin')
with check (
  public.my_role() = 'admin'
  and granted_by = auth.uid()
);

drop policy if exists user_module_permissions_delete on public.user_module_permissions;
create policy user_module_permissions_delete
on public.user_module_permissions
for delete
to authenticated
using (public.my_role() = 'admin');

grant select, insert, update, delete on public.user_module_permissions to authenticated;


create or replace function public.admin_set_user_module_permissions(
  p_user_id uuid,
  p_permissions jsonb default '[]'::jsonb
)
returns setof public.user_module_permissions
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.my_role()::text, '') <> 'admin' then
    raise exception 'Solo un administrador puede modificar permisos de módulos.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'El usuario indicado no existe.'
      using errcode = 'P0002';
  end if;

  delete from public.user_module_permissions
  where user_id = p_user_id;

  insert into public.user_module_permissions (
    user_id,
    module_key,
    can_access,
    granted_by,
    created_at,
    updated_at
  )
  select
    p_user_id,
    item.module_key,
    item.can_access,
    auth.uid(),
    now(),
    now()
  from jsonb_to_recordset(coalesce(p_permissions, '[]'::jsonb))
    as item(module_key text, can_access boolean)
  on conflict (user_id, module_key)
  do update set
    can_access = excluded.can_access,
    granted_by = excluded.granted_by,
    updated_at = now();

  return query
  select *
  from public.user_module_permissions
  where user_id = p_user_id
  order by module_key;
end;
$$;

revoke all on function public.admin_set_user_module_permissions(uuid, jsonb) from public;
grant execute on function public.admin_set_user_module_permissions(uuid, jsonb)
to authenticated;

-- Realtime permite que un usuario vea cambios de permisos sin cerrar sesión.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_module_permissions'
  ) then
    alter publication supabase_realtime add table public.user_module_permissions;
  end if;
exception
  when undefined_object then
    null;
end $$;

commit;
