-- Habilita un reporte dedicado de MIX Alfajores por sucursal.

alter table public.ccc_workspace_files
  drop constraint if exists ccc_workspace_files_kind_check;

alter table public.ccc_workspace_files
  add constraint ccc_workspace_files_kind_check
  check (
    file_kind = any (
      array[
        'sales'::text,
        'dropsize_sales'::text,
        'dropsize_isolated'::text,
        'mix_alfajores'::text,
        'seller_supervisor'::text,
        'personal_detail'::text
      ]
    )
  );
