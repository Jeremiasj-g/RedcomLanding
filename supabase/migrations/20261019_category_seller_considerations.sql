create table if not exists public.category_seller_considerations (
  branch_key text not null,
  seller_id integer not null check (seller_id > 0),
  seller_name_snapshot text not null,
  reason text not null default '',
  metric_rules jsonb not null default '{}'::jsonb,
  gate_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  primary key (branch_key, seller_id),
  constraint consideration_metric_rules_object check (jsonb_typeof(metric_rules) = 'object'),
  constraint consideration_gate_rules_object check (jsonb_typeof(gate_rules) = 'object')
);
alter table public.category_seller_considerations enable row level security;
drop policy if exists category_seller_considerations_admin on public.category_seller_considerations;
create policy category_seller_considerations_admin on public.category_seller_considerations
  for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');
create or replace function public.admin_save_seller_consideration(
 p_branch_key text, p_seller_id integer, p_reason text,
 p_metric_rules jsonb, p_gate_rules jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare
 v_name text;
 v_item record;
 v_mode text;
 v_value jsonb;
begin
 if auth.uid() is null or public.my_role() <> 'admin' then
   raise exception 'Solo administradores pueden editar consideraciones' using errcode='42501';
 end if;
 select seller_name into v_name from public.category_panel_current
 where branch_key=p_branch_key and seller_id=p_seller_id;
 if v_name is null then raise exception 'El vendedor no figura en los KPIs actuales'; end if;
 if jsonb_typeof(p_metric_rules) is distinct from 'object'
    or jsonb_typeof(p_gate_rules) is distinct from 'object' then
   raise exception 'Formato de consideraciones inválido';
 end if;
 for v_item in select key,value from jsonb_each(p_metric_rules) loop
   if v_item.key !~ '^[0-9]+$' or not exists(
     select 1 from public.category_scale_metrics where id=v_item.key::bigint and is_active
   ) then raise exception 'Métrica de consideración desconocida'; end if;
   if jsonb_typeof(v_item.value) <> 'object' then raise exception 'Regla de métrica inválida'; end if;
   for v_mode in select jsonb_object_keys(v_item.value) loop
      if v_mode not in ('senior','semi','junior','improvement','weight') then
        raise exception 'Campo de métrica inválido';
      end if;
      v_value := v_item.value -> v_mode;
      if (v_value->>'mode') not in ('custom','exempt') then
         raise exception 'Modo de métrica inválido';
      end if;
      if v_value->>'mode'='custom' and
        (jsonb_typeof(v_value->'value') <> 'number') then
          raise exception 'El valor personalizado debe ser numérico';
      end if;
   end loop;
 end loop;
 for v_item in select key,value from jsonb_each(p_gate_rules) loop
   if v_item.key !~ '^[0-9]+$' or not exists(
     select 1 from public.category_scale_gates where id=v_item.key::bigint and is_active
   ) then raise exception 'Requisito desconocido'; end if;
   if (v_item.value->>'mode') not in ('custom','exempt') then
     raise exception 'Modo de requisito inválido';
   end if;
   if v_item.value->>'mode'='custom' and
      (jsonb_typeof(v_item.value->'value') <> 'number') then
      raise exception 'El valor personalizado debe ser numérico';
   end if;
 end loop;
 insert into public.category_seller_considerations(
   branch_key,seller_id,seller_name_snapshot,reason,metric_rules,gate_rules,updated_by,updated_at
 ) values(p_branch_key,p_seller_id,v_name,coalesce(p_reason,''),p_metric_rules,p_gate_rules,auth.uid(),now())
 on conflict(branch_key,seller_id) do update
 set seller_name_snapshot=excluded.seller_name_snapshot,
 reason=excluded.reason,metric_rules=excluded.metric_rules,gate_rules=excluded.gate_rules,
 updated_by=excluded.updated_by,updated_at=now();
end; $$;
revoke all on function public.admin_save_seller_consideration(text,integer,text,jsonb,jsonb) from public;
grant execute on function public.admin_save_seller_consideration(text,integer,text,jsonb,jsonb) to authenticated;