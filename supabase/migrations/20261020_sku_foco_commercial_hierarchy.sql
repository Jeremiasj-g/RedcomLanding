alter table public.sku_foco_shared_state
 add column if not exists personal_storage_path text,
 add column if not exists personal_file_name text;