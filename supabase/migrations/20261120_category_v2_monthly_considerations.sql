-- Excepciones puntuales a puntajes, por vendedor y mes, independientes de reglas permanentes.
create table if not exists public.category_v2_monthly_considerations (
 branch_key text not null check (branch_key in ('corrientes_masivos','corrientes_refrigerados','chaco','misiones','obera')),
 month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 seller_id integer not null check (seller_id > 0),
 metric_levels jsonb not null default '{}'::jsonb check (jsonb_typeof(metric_levels)='object'),
 gate_exemptions jsonb not null default '{}'::jsonb check (jsonb_typeof(gate_exemptions)='object'),
 reason text not null check (length(btrim(reason)) between 10 and 500),
 revision integer not null default 1 check (revision>0),
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 primary key(branch_key,month,seller_id)
);
create index if not exists category_v2_monthly_considerations_month_idx
 on public.category_v2_monthly_considerations (month,branch_key);

create table if not exists public.category_v2_monthly_consideration_audit (
 id bigint generated always as identity primary key,
 branch_key text not null,
 month text not null,
 seller_id integer not null,
 revision integer not null,
 prior jsonb,
 current_data jsonb not null,
 changed_at timestamptz not null default now(),
 changed_by uuid not null references auth.users(id),
 unique(branch_key,month,seller_id,revision)
);
alter table public.category_v2_monthly_considerations enable row level security;
alter table public.category_v2_monthly_consideration_audit enable row level security;
revoke all on public.category_v2_monthly_considerations from public,anon,authenticated;
revoke all on public.category_v2_monthly_consideration_audit from public,anon,authenticated;
grant select on public.category_v2_monthly_considerations to authenticated;
grant select on public.category_v2_monthly_consideration_audit to authenticated;

-- Los administradores ven toda la información. Cada sucursal sólo lee sus propios ajustes.
create policy "monthly consideration branch scope"
on public.category_v2_monthly_considerations for select to authenticated using (
 exists (
  select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.is_active
  and (
   p.role='admin'
   or exists (
    select 1 from public.user_branches ub
    where ub.user_id=p.id and ub.branch=case branch_key
      when 'corrientes_masivos' then 'corrientes'
      when 'corrientes_refrigerados' then 'refrigerados'
      when 'chaco' then 'chaco'
      when 'misiones' then 'misiones'
      when 'obera' then 'obera'
    end
   )
  )
 )
);
create policy "monthly consideration audit admin"
on public.category_v2_monthly_consideration_audit for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin')
);

-- El guardado reemplaza todos los ajustes del vendedor/mes en una transacción.
-- Se conserva el historial incluso cuando el administrador elimina todas las excepciones.
create or replace function public.admin_save_category_v2_monthly_consideration(
 p_branch_key text,p_month text,p_seller_id integer,p_metric_levels jsonb,
 p_gate_exemptions jsonb,p_reason text,p_expected_revision integer default 0
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_user uuid := (select auth.uid());
 v_old public.category_v2_monthly_considerations%rowtype;
 v_revision integer;
 v_force text;
 v_branch text;
 v_saved public.category_v2_monthly_considerations%rowtype;
begin
 if v_user is null or not exists (
  select 1 from public.profiles p where p.id=v_user and p.role='admin' and p.is_active
 ) then raise exception 'Solo un administrador activo puede registrar consideraciones.' using errcode='42501'; end if;
 select b.branch,b.force into v_branch,v_force
 from (values
 ('corrientes_masivos','CASA CENTRAL','ESQUEMA 1'),
 ('corrientes_refrigerados','CASA CENTRAL','ESQUEMA REGRIGERADOS'),
 ('chaco','SUCURSAL RESISTENCIA','all'),
 ('misiones','SUCURSAL POSADAS','all'),
 ('obera','SUCURSAL OBERA','all')) as b(key,branch,force)
 where b.key=p_branch_key;
 if v_branch is null or p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
 or p_seller_id is null or p_seller_id<=0 or p_expected_revision is null or p_expected_revision<0
 or p_metric_levels is null or jsonb_typeof(p_metric_levels)<>'object'
 or p_gate_exemptions is null or jsonb_typeof(p_gate_exemptions)<>'object'
 or length(btrim(coalesce(p_reason,''))) not between 10 and 500
 then raise exception 'Datos de consideración inválidos.' using errcode='22023'; end if;
 if not exists(
  select 1 from public.category_commercial_personnel cp,
  lateral jsonb_array_elements(cp.people) person(value)
  where cp.id=1 and (person.value->>'id')::integer=p_seller_id
   and person.value->>'role'='VENDEDOR' and person.value->>'branch'=v_branch
   and (v_force='all' or person.value->>'force'=v_force)
 ) then raise exception 'Vendedor no reconocido en esta sucursal.' using errcode='22023'; end if;
 if exists(
  select 1 from jsonb_each_text(p_metric_levels) item(k,v)
  where item.v not in ('junior','semi','senior')
  or item.k !~ '^[0-9]+$'
  or not exists(select 1 from public.category_scale_metrics m
      where m.id::text=item.k and m.is_active and m.weight_percent>0)
 ) or exists(
  select 1 from jsonb_each(p_gate_exemptions) item(k,v)
  where item.k not in ('route','effectiveness') or item.v<>'true'::jsonb
 ) then raise exception 'Indicadores o reconocimientos inválidos.' using errcode='22023'; end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_branch_key||':'||p_month||':'||p_seller_id::text));
 select * into v_old from public.category_v2_monthly_considerations
 where branch_key=p_branch_key and month=p_month and seller_id=p_seller_id for update;
 v_revision:=coalesce(v_old.revision,0);
 if v_revision<>p_expected_revision then
  raise exception 'La consideración cambió desde que la abriste. Actualizá los datos.' using errcode='40001'; end if;
 insert into public.category_v2_monthly_considerations(
  branch_key,month,seller_id,metric_levels,gate_exemptions,reason,revision,updated_by,updated_at
 ) values(
  p_branch_key,p_month,p_seller_id,p_metric_levels,p_gate_exemptions,btrim(p_reason),v_revision+1,v_user,now()
 )
 on conflict(branch_key,month,seller_id) do update set
  metric_levels=excluded.metric_levels,gate_exemptions=excluded.gate_exemptions,
  reason=excluded.reason,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at
 returning * into v_saved;

 insert into public.category_v2_monthly_consideration_audit(
  branch_key,month,seller_id,revision,prior,current_data,changed_by
 ) values(p_branch_key,p_month,p_seller_id,v_saved.revision,
   case when v_revision=0 then null else to_jsonb(v_old) end,to_jsonb(v_saved),v_user);
 return to_jsonb(v_saved);
end;
$$;
revoke all on function public.admin_save_category_v2_monthly_consideration(text,text,integer,jsonb,jsonb,text,integer)
 from public,anon,authenticated;
grant execute on function public.admin_save_category_v2_monthly_consideration(text,text,integer,jsonb,jsonb,text,integer)
 to authenticated;

-- Rollback: drop function public.admin_save_category_v2_monthly_consideration(...);
-- drop table public.category_v2_monthly_consideration_audit;
-- drop table public.category_v2_monthly_considerations;
