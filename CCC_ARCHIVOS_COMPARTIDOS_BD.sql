-- CCC Calificados: archivos compartidos por sucursal.
-- Guarda ventas, listado vendedor-supervisor y detalle personal en Supabase Storage.
-- A diferencia de la base de clientes, estos archivos no tienen vencimiento obligatorio.

begin;

create table if not exists public.ccc_workspace_files (
  id uuid primary key default gen_random_uuid(),
  branch_key text not null,
  file_kind text not null,
  storage_path text not null unique,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ccc_workspace_files_branch_kind_unique unique (branch_key, file_kind),
  constraint ccc_workspace_files_branch_check check (
    lower(branch_key) = branch_key
    and branch_key = any (array['corrientes','chaco','misiones','obera','refrigerados'])
  ),
  constraint ccc_workspace_files_kind_check check (
    file_kind = any (array['sales','seller_supervisor','personal_detail'])
  ),
  constraint ccc_workspace_files_size_check check (size_bytes is null or size_bytes >= 0)
);

create index if not exists ccc_workspace_files_branch_idx
  on public.ccc_workspace_files (branch_key, file_kind);

create index if not exists ccc_workspace_files_uploaded_at_idx
  on public.ccc_workspace_files (uploaded_at desc);

alter table public.ccc_workspace_files enable row level security;

drop policy if exists ccc_workspace_files_select_by_branch on public.ccc_workspace_files;
create policy ccc_workspace_files_select_by_branch
on public.ccc_workspace_files
for select
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() in ('jdv','supervisor')
    and public.auth_has_branch(branch_key)
  )
);

drop policy if exists ccc_workspace_files_insert_by_branch on public.ccc_workspace_files;
create policy ccc_workspace_files_insert_by_branch
on public.ccc_workspace_files
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch(branch_key)
    )
  )
);

drop policy if exists ccc_workspace_files_update_by_branch on public.ccc_workspace_files;
create policy ccc_workspace_files_update_by_branch
on public.ccc_workspace_files
for update
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() in ('jdv','supervisor')
    and public.auth_has_branch(branch_key)
  )
)
with check (
  uploaded_by = auth.uid()
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch(branch_key)
    )
  )
);

drop policy if exists ccc_workspace_files_delete_by_branch on public.ccc_workspace_files;
create policy ccc_workspace_files_delete_by_branch
on public.ccc_workspace_files
for delete
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() in ('jdv','supervisor')
    and public.auth_has_branch(branch_key)
  )
);

grant select, insert, update, delete on public.ccc_workspace_files to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ccc-workspace-files',
  'ccc-workspace-files',
  false,
  104857600,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ccc_workspace_files_storage_select on storage.objects;
create policy ccc_workspace_files_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ccc-workspace-files'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
);

drop policy if exists ccc_workspace_files_storage_insert on storage.objects;
create policy ccc_workspace_files_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ccc-workspace-files'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
);

drop policy if exists ccc_workspace_files_storage_update on storage.objects;
create policy ccc_workspace_files_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ccc-workspace-files'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
)
with check (
  bucket_id = 'ccc-workspace-files'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
);

drop policy if exists ccc_workspace_files_storage_delete on storage.objects;
create policy ccc_workspace_files_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ccc-workspace-files'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
);

commit;
