-- Antigüedad del titular actual del código comercial.
-- La fecha de ingreso no pertenece al puesto: se limpia al rotar el titular.
begin;
alter table public.commercial_vendor_accounts
 add column if not exists hire_date date;
comment on column public.commercial_vendor_accounts.hire_date is
 'Fecha de ingreso del titular actual, administrada por RRHH/Administración. No representa antigüedad del código comercial.';

create or replace function public.clear_commercial_vendor_hire_date_on_holder_change()
returns trigger language plpgsql set search_path=''
as $fn$
begin
 if new.person_name is distinct from old.person_name then
   new.hire_date:=null;
 end if;
 return new;
end;
$fn$;
drop trigger if exists clear_vendor_hire_date_on_holder_change on public.commercial_vendor_accounts;
create trigger clear_vendor_hire_date_on_holder_change
 before update of person_name on public.commercial_vendor_accounts
 for each row execute function public.clear_commercial_vendor_hire_date_on_holder_change();

create or replace function public.set_commercial_vendor_hire_date(
 p_branch text,p_person_code integer,p_hire_date date
) returns date language plpgsql security definer set search_path=''
as $fn$
declare current_name text; account_name text;
begin
 if not exists(
   select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.role='admin' and p.is_active
 ) then
   raise exception 'Solo administradores activos pueden gestionar fechas de ingreso'
    using errcode='42501';
 end if;
 if p_hire_date> (now() at time zone 'America/Argentina/Buenos_Aires')::date
    or p_hire_date < date '1900-01-01' then
   raise exception 'La fecha de ingreso no es válida' using errcode='22023';
 end if;
 select v->>'name' into current_name
 from public.category_commercial_personnel m
 cross join lateral jsonb_array_elements(m.people) v
 where m.id=1 and v->>'branch'=p_branch
  and v->>'role'='VENDEDOR' and (v->>'id')::int=p_person_code
 limit 1;
 if current_name is null then
  raise exception 'El código no está en el padrón actual'
    using errcode='23514';
 end if;
 select a.person_name into account_name from public.commercial_vendor_accounts a
 where a.branch=p_branch and a.person_code=p_person_code and not a.needs_review
 for update;
 if not found or account_name is distinct from current_name then
  raise exception 'El vendedor debe tener una cuenta comercial vigente antes de cargar su ingreso'
    using errcode='23514';
 end if;
 update public.commercial_vendor_accounts
 set hire_date=p_hire_date
 where branch=p_branch and person_code=p_person_code and not needs_review;
 return p_hire_date;
end;
$fn$;

create or replace function public.my_commercial_vendor_employment()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare result jsonb;
begin
 if (select auth.uid()) is null or
    not public.commercial_vendor_membership_active((select auth.uid()))
 then
   raise exception 'Acceso comercial no autorizado' using errcode='42501';
 end if;
 select jsonb_build_object(
   'hire_date',a.hire_date,'person_code',a.person_code,'branch',a.branch
 ) into result
 from public.commercial_vendor_accounts a
 join public.profiles p on p.id=a.auth_user_id
 join public.category_commercial_personnel m on m.id=1
 where a.auth_user_id=(select auth.uid()) and not a.needs_review
   and p.is_active and p.role='vendedor'
   and exists(select 1 from jsonb_array_elements(m.people) v
     where v->>'branch'=a.branch and v->>'role'='VENDEDOR'
       and (v->>'id')::int=a.person_code and v->>'name'=a.person_name)
 limit 1;
 if result is null then raise exception 'No se encontró el acceso comercial vigente' using errcode='42501';end if;
 return result;
end;
$fn$;

revoke all on function public.set_commercial_vendor_hire_date(text,integer,date) from public,anon;
revoke all on function public.my_commercial_vendor_employment() from public,anon;
grant execute on function public.set_commercial_vendor_hire_date(text,integer,date) to authenticated;
grant execute on function public.my_commercial_vendor_employment() to authenticated;
commit;