-- Reporte dedicado de comprobantes para DROPSIZE.
-- Se conserva el archivo general de ventas para CCC/MIX y se agrega un
-- segundo archivo por sucursal con el detalle de comprobantes.

alter table public.ccc_workspace_files
  drop constraint if exists ccc_workspace_files_kind_check;

alter table public.ccc_workspace_files
  add constraint ccc_workspace_files_kind_check
  check (
    file_kind = any (
      array[
        'sales'::text,
        'seller_supervisor'::text,
        'personal_detail'::text,
        'dropsize_sales'::text
      ]
    )
  );
