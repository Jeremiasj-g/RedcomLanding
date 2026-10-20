insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('sku-foco-reports','sku-foco-reports',false,104857600,null)
on conflict(id) do nothing;
drop policy if exists "sku_foco_reports_read" on storage.objects;
create policy "sku_foco_reports_read" on storage.objects for select to authenticated using (bucket_id='sku-foco-reports');
drop policy if exists "sku_foco_reports_admin_insert" on storage.objects;
create policy "sku_foco_reports_admin_insert" on storage.objects for insert to authenticated with check (bucket_id='sku-foco-reports' and public.my_role()='admin');
drop policy if exists "sku_foco_reports_admin_delete" on storage.objects;
create policy "sku_foco_reports_admin_delete" on storage.objects for delete to authenticated using (bucket_id='sku-foco-reports' and public.my_role()='admin');
alter table public.sku_foco_shared_state
add column if not exists lineas_storage_path text,
add column if not exists articulos_storage_path text;