alter table public.sku_foco_shared_state
 add column if not exists objetivo_volumen_storage_path text,
 add column if not exists objetivo_cobertura_storage_path text,
 add column if not exists objetivo_volumen_file_name text,
 add column if not exists objetivo_cobertura_file_name text;