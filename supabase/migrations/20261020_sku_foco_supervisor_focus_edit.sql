create or replace function public.save_sku_foco_configuration(p_focus_config jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.my_role() not in ('admin','supervisor') then
    raise exception 'No tenés permiso para editar las líneas y artículos FOCO' using errcode='42501';
  end if;
  if p_focus_config is null or jsonb_typeof(p_focus_config) <> 'array' or jsonb_array_length(p_focus_config)=0 then
    raise exception 'Se necesita al menos una línea FOCO válida' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_focus_config) item
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item->'linea') <> 'string'
      or nullif(btrim(item->>'linea'),'') is null
      or jsonb_typeof(item->'articulos') <> 'array'
      or exists (select 1 from jsonb_array_elements(item->'articulos') article where jsonb_typeof(article)<>'string')
  ) then
    raise exception 'Formato de líneas FOCO inválido' using errcode='22023';
  end if;
  update public.sku_foco_shared_state
  set focus_config=p_focus_config,updated_at=now(),updated_by=auth.uid()
  where id=1;
  if not found then raise exception 'No se encontró la configuración FOCO'; end if;
end $$;
revoke all on function public.save_sku_foco_configuration(jsonb) from public;
grant execute on function public.save_sku_foco_configuration(jsonb) to authenticated;