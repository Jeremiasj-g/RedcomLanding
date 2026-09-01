-- CCC Calificados: Detalle personal global compartido por todas las sucursales.
-- Solo administración puede cargar/reemplazar/eliminar el archivo.
-- Todos los usuarios autenticados del módulo pueden leerlo para resolver
-- la relación vendedor -> superior/supervisor en CCC, MIX y DROPSIZE.

begin;

create table if not exists public.ccc_shared_files (
  file_key text primary key,
  storage_path text not null unique,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ccc_shared_files_key_check check (
    file_key = 'personal_detail'
  ),
  constraint ccc_shared_files_size_check check (
    size_bytes is null or size_bytes >= 0
  )
);

alter table public.ccc_shared_files enable row level security;

drop policy if exists ccc_shared_files_select_authenticated on public.ccc_shared_files;
create policy ccc_shared_files_select_authenticated
on public.ccc_shared_files
for select
to authenticated
using (true);

drop policy if exists ccc_shared_files_insert_admin on public.ccc_shared_files;
create policy ccc_shared_files_insert_admin
on public.ccc_shared_files
for insert
to authenticated
with check (
  public.my_role() = 'admin'
  and uploaded_by = auth.uid()
);

drop policy if exists ccc_shared_files_update_admin on public.ccc_shared_files;
create policy ccc_shared_files_update_admin
on public.ccc_shared_files
for update
to authenticated
using (public.my_role() = 'admin')
with check (
  public.my_role() = 'admin'
  and uploaded_by = auth.uid()
);

drop policy if exists ccc_shared_files_delete_admin on public.ccc_shared_files;
create policy ccc_shared_files_delete_admin
on public.ccc_shared_files
for delete
to authenticated
using (public.my_role() = 'admin');

grant select, insert, update, delete on public.ccc_shared_files to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'ccc-shared-files',
  'ccc-shared-files',
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

drop policy if exists ccc_shared_files_storage_select on storage.objects;
create policy ccc_shared_files_storage_select
on storage.objects
for select
to authenticated
using (bucket_id = 'ccc-shared-files');

drop policy if exists ccc_shared_files_storage_insert_admin on storage.objects;
create policy ccc_shared_files_storage_insert_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ccc-shared-files'
  and public.my_role() = 'admin'
);

drop policy if exists ccc_shared_files_storage_update_admin on storage.objects;
create policy ccc_shared_files_storage_update_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ccc-shared-files'
  and public.my_role() = 'admin'
)
with check (
  bucket_id = 'ccc-shared-files'
  and public.my_role() = 'admin'
);

drop policy if exists ccc_shared_files_storage_delete_admin on storage.objects;
create policy ccc_shared_files_storage_delete_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ccc-shared-files'
  and public.my_role() = 'admin'
);

commit;
