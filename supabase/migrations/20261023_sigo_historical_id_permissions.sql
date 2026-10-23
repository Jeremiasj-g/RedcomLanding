alter table public.category_sigo_edit_log add column if not exists seller_id integer, add column if not exists actor_name text;
update public.category_sigo_edit_log log set seller_id=d.seller_id from public.category_sigo_daily d
where log.visit_date=d.visit_date and log.branch=d.branch and log.sales_force=d.sales_force and log.seller_name=d.seller_name and log.seller_id is null;
update public.category_sigo_edit_log log set actor_name=p.full_name from public.profiles p where p.id=log.actor_id and log.actor_name is null;
drop policy if exists "Category SIGO assigned managers select" on public.category_sigo_daily;
drop policy if exists "SIGO edit audit branch read" on public.category_sigo_edit_log;
drop function if exists public.sigo_seller_allowed(text,text,text);
create or replace function public.sigo_seller_allowed(p_branch text,p_force text,p_seller_id integer)
returns boolean language sql stable security definer set search_path=public as $$
select exists (
 select 1 from public.profiles p
 where p.id=auth.uid() and p.is_active=true and
 ((p.role='admin') or
 (p.role='jdv' and public.sigo_allowed_team(p_branch,p_force)) or
 (p.role='supervisor' and public.sigo_allowed_team(p_branch,p_force) and exists (
  select 1 from public.category_commercial_personnel c,
  lateral jsonb_array_elements(c.people) person
  where c.id=1 and person->>'role'='VENDEDOR'
   and person->>'branch'=p_branch and person->>'force'=p_force
   and person->>'id'=p_seller_id::text
   and upper(trim(person->>'superior'))=upper(trim(p.full_name))
 )))
) $$;
revoke all on function public.sigo_seller_allowed(text,text,integer) from public,anon;
grant execute on function public.sigo_seller_allowed(text,text,integer) to authenticated;
create policy "Category SIGO assigned managers select" on public.category_sigo_daily
for select to authenticated using (public.sigo_seller_allowed(branch,sales_force,seller_id));
create policy "SIGO edit audit branch read" on public.category_sigo_edit_log
for select to authenticated using (public.sigo_seller_allowed(branch,sales_force,seller_id));
create or replace function public.sigo_update_correction(
 p_date date,p_branch text,p_force text,p_seller text,p_field text,p_expected text,p_value text
) returns boolean language plpgsql security definer set search_path=public as $$
declare old_value text; v_seller_id integer; actor_role text; actor_name text;
begin
 select p.role,p.full_name into actor_role,actor_name from public.profiles p
 where p.id=auth.uid() and p.is_active=true;
 if actor_role is null or (actor_role<>'admin' and
 (actor_role not in ('supervisor','jdv') or not public.sigo_allowed_team(p_branch,p_force))) then
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
 ,seller_id into old_value,v_seller_id
 from public.category_sigo_daily where visit_date=p_date and branch=p_branch and sales_force=p_force and seller_name=p_seller
 for update;
 if not found then raise exception 'Registro no encontrado' using errcode='P0002'; end if;
 if actor_role='supervisor' and not public.sigo_seller_allowed(p_branch,p_force,v_seller_id) then
 raise exception 'No tenés permiso para corregir este vendedor' using errcode='42501'; end if;
 -- PostgreSQL time::text can return HH:MM:SS, identical to values normalized in UI.
 if old_value is distinct from p_expected then return false; end if;
 if old_value is not distinct from p_value then return true; end if;
 update public.category_sigo_daily set
 corrected_start=case when p_field='corrected_start' then p_value::time else corrected_start end,
 corrected_end=case when p_field='corrected_end' then p_value::time else corrected_end end,
 reason=case when p_field='reason' then p_value else reason end,
 comments=case when p_field='comments' then p_value else comments end
 where visit_date=p_date and branch=p_branch and sales_force=p_force and seller_name=p_seller;
 insert into public.category_sigo_edit_log(visit_date,branch,sales_force,seller_name,seller_id,column_name,old_value,new_value,actor_id,actor_name)
 values(p_date,p_branch,p_force,p_seller,v_seller_id,p_field,old_value,p_value,auth.uid(),actor_name);
 return true;
end $$;
revoke all on function public.sigo_update_correction(date,text,text,text,text,text,text) from public,anon;
grant execute on function public.sigo_update_correction(date,text,text,text,text,text,text) to authenticated;
