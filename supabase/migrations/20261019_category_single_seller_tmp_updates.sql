alter table public.category_panel_current
 add column if not exists partial_updated_at timestamptz null,
 add column if not exists partial_update_source text null;
create or replace function public.admin_update_category_seller_tmp(
 p_branch_key text, p_seller_id integer, p_amount numeric, p_invoice_count integer
) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.my_role()<>'admin' then
  raise exception 'Solo administradores pueden actualizar facturación individual' using errcode='42501';
 end if;
 if p_amount is null or p_invoice_count is null or p_invoice_count < 0 then
  raise exception 'Importe o cantidad de facturas inválidos';
 end if;
 update public.category_panel_current
 set importe_final_facturado=p_amount, cnt_fac=p_invoice_count,
     partial_updated_at=now(),partial_update_source='tmp',
     imported_at=now(),imported_by=auth.uid()
 where branch_key=p_branch_key and seller_id=p_seller_id;
 if not found then raise exception 'El vendedor no existe en los KPIs guardados'; end if;
end; $$;
revoke all on function public.admin_update_category_seller_tmp(text,integer,numeric,integer) from public;
grant execute on function public.admin_update_category_seller_tmp(text,integer,numeric,integer) to authenticated;
create or replace function public.admin_update_category_seller_pivot(
 p_branch_key text, p_seller_id integer, p_sector integer, p_seller_name text,
 p_visitados integer, p_venta_distancia integer, p_venta_pdv integer, p_visitas_planeadas integer
) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.my_role()<>'admin' then
   raise exception 'Solo administradores pueden actualizar KPIs individuales' using errcode='42501';
 end if;
 if p_seller_id is null or p_seller_id<=0 or p_sector is null or p_sector<=0 or trim(coalesce(p_seller_name,''))='' then
   raise exception 'Identidad inválida';
 end if;
 update public.category_panel_current set
   sector=p_sector,seller_name=trim(p_seller_name),
   visitados=p_visitados,venta_distancia=p_venta_distancia,
   venta_pdv=p_venta_pdv,visitas_planeadas=p_visitas_planeadas,
   partial_updated_at=now(),partial_update_source='pivot',
   imported_at=now(),imported_by=auth.uid()
 where branch_key=p_branch_key and seller_id=p_seller_id;
 if not found then raise exception 'El vendedor no existe en los KPIs guardados'; end if;
end; $$;