-- Shared SIGO read permissions and field-scoped optimistic edits.
create or replace function public.sigo_allowed_team(p_branch text,p_force text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists (
 select 1 from public.profiles p
 join public.user_branches ub on ub.user_id=p.id
 where p.id=auth.uid() and p.is_active=true
 and p.role in ('supervisor','jdv')
 and ((ub.branch='corrientes' and p_branch='CASA CENTRAL' and p_force='ESQUEMA 1')
   or (ub.branch='refrigerados' and p_branch='CASA CENTRAL' and p_force='ESQUEMA REGRIGERADOS')
   or (ub.branch='chaco' and p_branch='SUCURSAL RESISTENCIA')
   or (ub.branch='misiones' and p_branch='SUCURSAL POSADAS')
   or (ub.branch='obera' and p_branch='SUCURSAL OBERA'))
 )
$$;
revoke all on function public.sigo_allowed_team(text,text) from public,anon;
grant execute on function public.sigo_allowed_team(text,text) to authenticated;
create or replace function public.sigo_seller_allowed(p_branch text,p_force text,p_seller text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists (
 select 1 from public.profiles p
 where p.id=auth.uid() and p.is_active=true
 and (
 (p.role='admin')
 or (p.role='jdv' and public.sigo_allowed_team(p_branch,p_force))
 or (p.role='supervisor' and public.sigo_allowed_team(p_branch,p_force)
 and exists(
 select 1 from public.category_commercial_personnel c,
 lateral jsonb_array_elements(c.people) person
 where c.id=1 and person->>'role'='VENDEDOR'
 and person->>'branch'=p_branch and person->>'force'=p_force
 and upper(trim(person->>'name'))=upper(trim(p_seller))
 and upper(trim(person->>'superior'))=upper(trim(p.full_name))
 ))
 )
 )
$$;
revoke all on function public.sigo_seller_allowed(text,text,text) from public,anon;
grant execute on function public.sigo_seller_allowed(text,text,text) to authenticated;
create policy "Category SIGO assigned managers select" on public.category_sigo_daily
 for select to authenticated using (public.sigo_seller_allowed(branch,sales_force,seller_name));
-- Keep direct UPDATE admin-only: field-scoped RPC below is the sole write gateway for branch managers.
create table if not exists public.category_sigo_edit_log (
 id bigint generated always as identity primary key,
 visit_date date not null,branch text not null,sales_force text not null,seller_name text not null,
 column_name text not null,old_value text,new_value text,actor_id uuid not null references auth.users(id),
 edited_at timestamptz not null default now()
);
alter table public.category_sigo_edit_log enable row level security;
create policy "SIGO edit audit admin read" on public.category_sigo_edit_log
 for select to authenticated using (public.my_role()='admin');
create policy "SIGO edit audit branch read" on public.category_sigo_edit_log
 for select to authenticated using (public.sigo_seller_allowed(branch,sales_force,seller_name));
create or replace function public.sigo_update_correction(
 p_date date,p_branch text,p_force text,p_seller text,p_field text,p_expected text,p_value text
) returns boolean language plpgsql security definer set search_path=public as $$
declare old_value text; updated_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true and
 (p.role='admin' or (p.role in ('supervisor','jdv') and public.sigo_seller_allowed(p_branch,p_force,p_seller)))) then
 raise exception 'No tenés permisos para modificar estos horarios' using errcode='42501';
 end if;
 if p_field not in ('corrected_start','corrected_end','reason','comments') then
 raise exception 'Campo no editable' using errcode='22023'; end if;
 if p_field in ('corrected_start','corrected_end') and p_value is not null and
 (p_value !~ '^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$') then
 raise exception 'Horario inválido' using errcode='22023'; end if;
 if p_field='reason' and p_value is not null and p_value not in ('Vacaciones','Desvinculado','Suspendido','Médico','Duelo','Otro') then
 raise exception 'Motivo inválido' using errcode='22023'; end if;
 select case p_field when 'corrected_start' then corrected_start::text
 when 'corrected_end' then corrected_end::text when 'reason' then reason else comments end
 into old_value
 from public.category_sigo_daily where visit_date=p_date and branch=p_branch and sales_force=p_force and seller_name=p_seller
 for update;
 if not found then raise exception 'Registro no encontrado' using errcode='P0002'; end if;
 -- PostgreSQL time::text can return HH:MM:SS, identical to values normalized in UI.
 if old_value is distinct from p_expected then return false; end if;
 if old_value is not distinct from p_value then return true; end if;
 update public.category_sigo_daily set
 corrected_start=case when p_field='corrected_start' then p_value::time else corrected_start end,
 corrected_end=case when p_field='corrected_end' then p_value::time else corrected_end end,
 reason=case when p_field='reason' then p_value else reason end,
 comments=case when p_field='comments' then p_value else comments end
 where visit_date=p_date and branch=p_branch and sales_force=p_force and seller_name=p_seller;
 insert into public.category_sigo_edit_log(visit_date,branch,sales_force,seller_name,column_name,old_value,new_value,actor_id)
 values(p_date,p_branch,p_force,p_seller,p_field,old_value,p_value,auth.uid());
 return true;
end $$;
revoke all on function public.sigo_update_correction(date,text,text,text,text,text,text) from public,anon;
grant execute on function public.sigo_update_correction(date,text,text,text,text,text,text) to authenticated;
