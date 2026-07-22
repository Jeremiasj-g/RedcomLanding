-- CCC Calificados: una base de clientes Excel vigente por sucursal.
-- El binario se guarda en Supabase Storage y la vigencia/autoría en public.ccc_client_bases.

begin;

create table if not exists public.ccc_client_bases (
  id uuid primary key default gen_random_uuid(),
  branch_key text not null unique,
  storage_path text not null unique,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now(),
  next_update_at timestamptz not null default (now() + interval '15 days'),
  updated_at timestamptz not null default now(),
  constraint ccc_client_bases_branch_check check (
    lower(branch_key) = branch_key
    and branch_key = any (array['corrientes','chaco','misiones','obera','refrigerados'])
  ),
  constraint ccc_client_bases_size_check check (size_bytes is null or size_bytes >= 0)
);

create index if not exists ccc_client_bases_uploaded_at_idx
  on public.ccc_client_bases (uploaded_at desc);

alter table public.ccc_client_bases enable row level security;

drop policy if exists ccc_client_bases_select_by_branch on public.ccc_client_bases;
create policy ccc_client_bases_select_by_branch
on public.ccc_client_bases
for select
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() in ('jdv','supervisor')
    and public.auth_has_branch(branch_key)
  )
);

drop policy if exists ccc_client_bases_insert_by_branch on public.ccc_client_bases;
create policy ccc_client_bases_insert_by_branch
on public.ccc_client_bases
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

drop policy if exists ccc_client_bases_update_by_branch on public.ccc_client_bases;
create policy ccc_client_bases_update_by_branch
on public.ccc_client_bases
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

drop policy if exists ccc_client_bases_delete_by_branch on public.ccc_client_bases;
create policy ccc_client_bases_delete_by_branch
on public.ccc_client_bases
for delete
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() in ('jdv','supervisor')
    and public.auth_has_branch(branch_key)
  )
);

grant select, insert, update, delete on public.ccc_client_bases to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ccc-client-bases',
  'ccc-client-bases',
  false,
  52428800,
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

drop policy if exists ccc_client_bases_storage_select on storage.objects;
create policy ccc_client_bases_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ccc-client-bases'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
);

drop policy if exists ccc_client_bases_storage_insert on storage.objects;
create policy ccc_client_bases_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ccc-client-bases'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
);

drop policy if exists ccc_client_bases_storage_update on storage.objects;
create policy ccc_client_bases_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ccc-client-bases'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
)
with check (
  bucket_id = 'ccc-client-bases'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
);

drop policy if exists ccc_client_bases_storage_delete on storage.objects;
create policy ccc_client_bases_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ccc-client-bases'
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch((storage.foldername(name))[1])
    )
  )
);

commit;
