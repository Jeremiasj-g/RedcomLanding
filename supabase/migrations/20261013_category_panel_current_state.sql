-- Estado actual del Panel de categorías.
-- Cada importación válida reemplaza completamente las filas anteriores.

create table if not exists public.category_panel_current (
  branch_key text not null,
  branch_label text not null,
  sector integer not null,
  seller_id integer not null,
  seller_name text not null,
  visitados integer not null default 0,
  venta_distancia integer not null default 0,
  venta_pdv integer not null default 0,
  visitas_planeadas integer not null default 0,
  importe_final_facturado numeric(18,2) not null default 0,
  cnt_fac integer not null default 0,
  imported_at timestamptz not null default now(),
  imported_by uuid null references auth.users(id) on delete set null,
  primary key (branch_key, seller_id)
);

create index if not exists category_panel_current_sector_idx
  on public.category_panel_current(sector);

create table if not exists public.category_panel_state (
  id smallint primary key default 1 check (id = 1),
  last_imported_at timestamptz null,
  last_imported_by uuid null references auth.users(id) on delete set null,
  row_count integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.category_panel_state(id, row_count)
values (1, 0)
on conflict (id) do nothing;

alter table public.category_panel_current enable row level security;
alter table public.category_panel_state enable row level security;

drop policy if exists category_panel_current_admin_select on public.category_panel_current;
create policy category_panel_current_admin_select
on public.category_panel_current
for select
to authenticated
using (public.my_role() = 'admin');

drop policy if exists category_panel_state_admin_select on public.category_panel_state;
create policy category_panel_state_admin_select
on public.category_panel_state
for select
to authenticated
using (public.my_role() = 'admin');

create or replace function public.admin_replace_category_panel(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_now timestamptz := now();
begin
  if auth.uid() is null or public.my_role() <> 'admin' then
    raise exception 'Solo un administrador puede reemplazar los datos del Panel de categorías.'
      using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Los datos recibidos no tienen un formato válido.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'No se puede guardar una importación vacía.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as x(
      branch_key text,
      branch_label text,
      sector integer,
      seller_id integer,
      seller_name text,
      visitados integer,
      venta_distancia integer,
      venta_pdv integer,
      visitas_planeadas integer,
      importe_final_facturado numeric,
      cnt_fac integer
    )
    where coalesce(trim(x.branch_key), '') = ''
       or coalesce(trim(x.branch_label), '') = ''
       or x.sector is null
       or x.seller_id is null
       or coalesce(trim(x.seller_name), '') = ''
  ) then
    raise exception 'Hay filas incompletas en la importación.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select x.branch_key, x.seller_id, count(*) as qty
      from jsonb_to_recordset(p_rows) as x(
        branch_key text,
        branch_label text,
        sector integer,
        seller_id integer,
        seller_name text,
        visitados integer,
        venta_distancia integer,
        venta_pdv integer,
        visitas_planeadas integer,
        importe_final_facturado numeric,
        cnt_fac integer
      )
      group by x.branch_key, x.seller_id
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'La importación contiene vendedores duplicados.'
      using errcode = '22023';
  end if;

  delete from public.category_panel_current
  where branch_key is not null;

  insert into public.category_panel_current (
    branch_key,
    branch_label,
    sector,
    seller_id,
    seller_name,
    visitados,
    venta_distancia,
    venta_pdv,
    visitas_planeadas,
    importe_final_facturado,
    cnt_fac,
    imported_at,
    imported_by
  )
  select
    x.branch_key,
    x.branch_label,
    x.sector,
    x.seller_id,
    x.seller_name,
    coalesce(x.visitados, 0),
    coalesce(x.venta_distancia, 0),
    coalesce(x.venta_pdv, 0),
    coalesce(x.visitas_planeadas, 0),
    coalesce(x.importe_final_facturado, 0),
    coalesce(x.cnt_fac, 0),
    v_now,
    auth.uid()
  from jsonb_to_recordset(p_rows) as x(
    branch_key text,
    branch_label text,
    sector integer,
    seller_id integer,
    seller_name text,
    visitados integer,
    venta_distancia integer,
    venta_pdv integer,
    visitas_planeadas integer,
    importe_final_facturado numeric,
    cnt_fac integer
  );

  get diagnostics v_count = row_count;

  insert into public.category_panel_state(
    id,
    last_imported_at,
    last_imported_by,
    row_count,
    updated_at
  )
  values (1, v_now, auth.uid(), v_count, v_now)
  on conflict (id) do update
  set last_imported_at = excluded.last_imported_at,
      last_imported_by = excluded.last_imported_by,
      row_count = excluded.row_count,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'row_count', v_count,
    'imported_at', v_now
  );
end;
$$;

revoke all on function public.admin_replace_category_panel(jsonb) from public;
grant execute on function public.admin_replace_category_panel(jsonb) to authenticated;
