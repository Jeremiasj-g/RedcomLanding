-- CCC Calificados: alinea las políticas RLS con el sistema dinámico de permisos.
-- Un rol personalizado con quarterly_indicators=true puede reutilizar los archivos
-- compartidos de sus sucursales asignadas, sin depender de nombres de rol fijos.

begin;

create or replace function public.auth_can_access_module(p_module_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_is_active boolean;
  v_explicit boolean;
  v_role_default boolean;
begin
  if v_user_id is null then
    return false;
  end if;

  select
    lower(trim(coalesce(p.role::text, ''))),
    coalesce(p.is_active, true)
  into v_role, v_is_active
  from public.profiles p
  where p.id = v_user_id;

  if not found or not coalesce(v_is_active, false) then
    return false;
  end if;

  -- El administrador conserva acceso total, igual que en el frontend.
  if v_role = 'admin' then
    return true;
  end if;

  -- Una excepción individual tiene prioridad sobre el permiso del rol.
  select ump.can_access
  into v_explicit
  from public.user_module_permissions ump
  where ump.user_id = v_user_id
    and ump.module_key = p_module_key
  limit 1;

  if found then
    return coalesce(v_explicit, false);
  end if;

  -- Si no hay excepción individual, hereda la configuración del rol.
  select rmp.can_access
  into v_role_default
  from public.role_module_permissions rmp
  where rmp.role_key = v_role
    and rmp.module_key = p_module_key
  limit 1;

  if found then
    return coalesce(v_role_default, false);
  end if;

  -- Fail closed: si el módulo no está configurado en BD, no concede acceso.
  return false;
end;
$$;

revoke all on function public.auth_can_access_module(text) from public;
grant execute on function public.auth_can_access_module(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Base de clientes compartida por sucursal
-- ---------------------------------------------------------------------------

drop policy if exists ccc_client_bases_select_by_branch on public.ccc_client_bases;
create policy ccc_client_bases_select_by_branch
on public.ccc_client_bases
for select
to authenticated
using (
  public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
);

drop policy if exists ccc_client_bases_insert_by_branch on public.ccc_client_bases;
create policy ccc_client_bases_insert_by_branch
on public.ccc_client_bases
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
);

drop policy if exists ccc_client_bases_update_by_branch on public.ccc_client_bases;
create policy ccc_client_bases_update_by_branch
on public.ccc_client_bases
for update
to authenticated
using (
  public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
)
with check (
  uploaded_by = auth.uid()
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
);

drop policy if exists ccc_client_bases_delete_by_branch on public.ccc_client_bases;
create policy ccc_client_bases_delete_by_branch
on public.ccc_client_bases
for delete
to authenticated
using (
  public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
);

-- ---------------------------------------------------------------------------
-- Archivos de trabajo compartidos: ventas, vendedor-supervisor y detalle personal
-- ---------------------------------------------------------------------------

drop policy if exists ccc_workspace_files_select_by_branch on public.ccc_workspace_files;
create policy ccc_workspace_files_select_by_branch
on public.ccc_workspace_files
for select
to authenticated
using (
  public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
);

drop policy if exists ccc_workspace_files_insert_by_branch on public.ccc_workspace_files;
create policy ccc_workspace_files_insert_by_branch
on public.ccc_workspace_files
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
);

drop policy if exists ccc_workspace_files_update_by_branch on public.ccc_workspace_files;
create policy ccc_workspace_files_update_by_branch
on public.ccc_workspace_files
for update
to authenticated
using (
  public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
)
with check (
  uploaded_by = auth.uid()
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
);

drop policy if exists ccc_workspace_files_delete_by_branch on public.ccc_workspace_files;
create policy ccc_workspace_files_delete_by_branch
on public.ccc_workspace_files
for delete
to authenticated
using (
  public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch(branch_key)
  )
);

-- ---------------------------------------------------------------------------
-- Storage privado: base de clientes
-- ---------------------------------------------------------------------------

drop policy if exists ccc_client_bases_storage_select on storage.objects;
create policy ccc_client_bases_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ccc-client-bases'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
);

drop policy if exists ccc_client_bases_storage_insert on storage.objects;
create policy ccc_client_bases_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ccc-client-bases'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
);

drop policy if exists ccc_client_bases_storage_update on storage.objects;
create policy ccc_client_bases_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ccc-client-bases'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
)
with check (
  bucket_id = 'ccc-client-bases'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
);

drop policy if exists ccc_client_bases_storage_delete on storage.objects;
create policy ccc_client_bases_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ccc-client-bases'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
);

-- ---------------------------------------------------------------------------
-- Storage privado: archivos de trabajo CCC
-- ---------------------------------------------------------------------------

drop policy if exists ccc_workspace_files_storage_select on storage.objects;
create policy ccc_workspace_files_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ccc-workspace-files'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
);

drop policy if exists ccc_workspace_files_storage_insert on storage.objects;
create policy ccc_workspace_files_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ccc-workspace-files'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
);

drop policy if exists ccc_workspace_files_storage_update on storage.objects;
create policy ccc_workspace_files_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ccc-workspace-files'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
)
with check (
  bucket_id = 'ccc-workspace-files'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
);

drop policy if exists ccc_workspace_files_storage_delete on storage.objects;
create policy ccc_workspace_files_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ccc-workspace-files'
  and public.auth_can_access_module('quarterly_indicators')
  and (
    coalesce(public.my_role()::text, '') = 'admin'
    or public.auth_has_branch((storage.foldername(name))[1])
  )
);

commit;
