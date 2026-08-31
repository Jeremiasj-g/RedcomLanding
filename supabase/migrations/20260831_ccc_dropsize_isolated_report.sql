-- Permite guardar un segundo reporte exclusivo para DROPSIZE.
-- Este archivo usa el mismo formato del reporte general de ventas, pero debe
-- exportarse desde VENDO con una sola marca para conservar el detalle
-- jerárquico (jefe, supervisor, vendedor, ruta y cliente).

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
        'seller_supervisor'::text,
        'personal_detail'::text
      ]
    )
  );
