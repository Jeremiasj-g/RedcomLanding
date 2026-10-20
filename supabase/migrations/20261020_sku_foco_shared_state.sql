create table if not exists public.sku_foco_shared_state (
 id smallint primary key default 1 check (id = 1),
 lineas jsonb not null default '[]'::jsonb,
 articulos jsonb not null default '[]'::jsonb,
 focus_config jsonb not null default '[]'::jsonb,
 objectives jsonb not null default '{}'::jsonb,
 file_lineas_name text,
 file_articulos_name text,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 constraint sku_foco_lineas_array check (jsonb_typeof(lineas) = 'array'),
 constraint sku_foco_articulos_array check (jsonb_typeof(articulos) = 'array'),
 constraint sku_foco_focus_array check (jsonb_typeof(focus_config) = 'array'),
 constraint sku_foco_obj_object check (jsonb_typeof(objectives) = 'object')
);
insert into public.sku_foco_shared_state(id) values(1) on conflict (id) do nothing;
alter table public.sku_foco_shared_state enable row level security;
drop policy if exists sku_foco_shared_read on public.sku_foco_shared_state;
create policy sku_foco_shared_read on public.sku_foco_shared_state for select to authenticated using (true);
drop policy if exists sku_foco_shared_admin_write on public.sku_foco_shared_state;
create policy sku_foco_shared_admin_write on public.sku_foco_shared_state for update to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
