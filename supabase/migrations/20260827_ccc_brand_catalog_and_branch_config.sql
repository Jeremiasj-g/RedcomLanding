-- CCC Calificados: catálogo global de marcas y focos/cuotas configurables por sucursal.
-- El catálogo lo administra únicamente un usuario admin.
-- Cada sucursal puede seleccionar marcas del catálogo y definir su cuota mensual.

begin;

create table if not exists public.ccc_brand_catalog (
  catalog_key text primary key default 'global',
  storage_path text not null unique,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  brands text[] not null default '{}',
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ccc_brand_catalog_singleton_check check (catalog_key = 'global'),
  constraint ccc_brand_catalog_size_check check (size_bytes is null or size_bytes >= 0)
);

alter table public.ccc_brand_catalog enable row level security;

drop policy if exists ccc_brand_catalog_select on public.ccc_brand_catalog;
create policy ccc_brand_catalog_select
on public.ccc_brand_catalog
for select
to authenticated
using (
  public.my_role() = 'admin'
  or public.my_role() in ('jdv','supervisor')
);

drop policy if exists ccc_brand_catalog_insert_admin on public.ccc_brand_catalog;
create policy ccc_brand_catalog_insert_admin
on public.ccc_brand_catalog
for insert
to authenticated
with check (
  public.my_role() = 'admin'
  and uploaded_by = auth.uid()
);

drop policy if exists ccc_brand_catalog_update_admin on public.ccc_brand_catalog;
create policy ccc_brand_catalog_update_admin
on public.ccc_brand_catalog
for update
to authenticated
using (public.my_role() = 'admin')
with check (
  public.my_role() = 'admin'
  and uploaded_by = auth.uid()
);

drop policy if exists ccc_brand_catalog_delete_admin on public.ccc_brand_catalog;
create policy ccc_brand_catalog_delete_admin
on public.ccc_brand_catalog
for delete
to authenticated
using (public.my_role() = 'admin');

grant select, insert, update, delete on public.ccc_brand_catalog to authenticated;


create table if not exists public.ccc_branch_brand_config (
  id uuid primary key default gen_random_uuid(),
  branch_key text not null,
  brand_name text not null,
  quota integer not null,
  sort_order integer not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_by_name text,
  updated_at timestamptz not null default now(),
  constraint ccc_branch_brand_config_unique unique (branch_key, brand_name),
  constraint ccc_branch_brand_config_branch_check check (
    lower(branch_key) = branch_key
    and branch_key = any (array['corrientes','chaco','misiones','obera','refrigerados'])
  ),
  constraint ccc_branch_brand_config_brand_check check (length(trim(brand_name)) > 0),
  constraint ccc_branch_brand_config_quota_check check (quota > 0 and quota <= 999999),
  constraint ccc_branch_brand_config_sort_check check (sort_order >= 0)
);

create index if not exists ccc_branch_brand_config_branch_idx
  on public.ccc_branch_brand_config (branch_key, sort_order, brand_name);

alter table public.ccc_branch_brand_config enable row level security;

drop policy if exists ccc_branch_brand_config_select_by_branch on public.ccc_branch_brand_config;
create policy ccc_branch_brand_config_select_by_branch
on public.ccc_branch_brand_config
for select
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() in ('jdv','supervisor')
    and public.auth_has_branch(branch_key)
  )
);

drop policy if exists ccc_branch_brand_config_insert_by_branch on public.ccc_branch_brand_config;
create policy ccc_branch_brand_config_insert_by_branch
on public.ccc_branch_brand_config
for insert
to authenticated
with check (
  updated_by = auth.uid()
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch(branch_key)
    )
  )
);

drop policy if exists ccc_branch_brand_config_update_by_branch on public.ccc_branch_brand_config;
create policy ccc_branch_brand_config_update_by_branch
on public.ccc_branch_brand_config
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
  updated_by = auth.uid()
  and (
    public.my_role() = 'admin'
    or (
      public.my_role() in ('jdv','supervisor')
      and public.auth_has_branch(branch_key)
    )
  )
);

drop policy if exists ccc_branch_brand_config_delete_by_branch on public.ccc_branch_brand_config;
create policy ccc_branch_brand_config_delete_by_branch
on public.ccc_branch_brand_config
for delete
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() in ('jdv','supervisor')
    and public.auth_has_branch(branch_key)
  )
);

grant select, insert, update, delete on public.ccc_branch_brand_config to authenticated;


-- Conserva el comportamiento actual como configuración inicial en todas las sucursales.
insert into public.ccc_branch_brand_config
  (branch_key, brand_name, quota, sort_order, updated_by_name)
select branch_key, brand_name, quota, sort_order, 'Configuración inicial'
from (
  values
    ('corrientes','QUENTO SNACK',12,0),
    ('corrientes','HEROE',8,1),
    ('chaco','QUENTO SNACK',12,0),
    ('chaco','HEROE',8,1),
    ('misiones','QUENTO SNACK',12,0),
    ('misiones','HEROE',8,1),
    ('obera','QUENTO SNACK',12,0),
    ('obera','HEROE',8,1),
    ('refrigerados','QUENTO SNACK',12,0),
    ('refrigerados','HEROE',8,1)
) as seed(branch_key, brand_name, quota, sort_order)
on conflict (branch_key, brand_name) do nothing;


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ccc-brand-catalog',
  'ccc-brand-catalog',
  false,
  10485760,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',
    'text/plain',
    'text/tab-separated-values',
    'text/csv'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ccc_brand_catalog_storage_select on storage.objects;
create policy ccc_brand_catalog_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ccc-brand-catalog'
  and (
    public.my_role() = 'admin'
    or public.my_role() in ('jdv','supervisor')
  )
);

drop policy if exists ccc_brand_catalog_storage_insert_admin on storage.objects;
create policy ccc_brand_catalog_storage_insert_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ccc-brand-catalog'
  and public.my_role() = 'admin'
);

drop policy if exists ccc_brand_catalog_storage_update_admin on storage.objects;
create policy ccc_brand_catalog_storage_update_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ccc-brand-catalog'
  and public.my_role() = 'admin'
)
with check (
  bucket_id = 'ccc-brand-catalog'
  and public.my_role() = 'admin'
);

drop policy if exists ccc_brand_catalog_storage_delete_admin on storage.objects;
create policy ccc_brand_catalog_storage_delete_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ccc-brand-catalog'
  and public.my_role() = 'admin'
);

commit;
