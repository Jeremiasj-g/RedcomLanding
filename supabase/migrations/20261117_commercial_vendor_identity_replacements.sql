-- Auditoría de reemplazos de identidad comercial: conserva el usuario anterior
-- desactivado; nunca reutiliza su contraseña para una persona diferente.
begin;
create table if not exists public.commercial_vendor_identity_replacements (
 id uuid primary key default gen_random_uuid(),
 branch text not null,
 person_code integer not null check(person_code>0),
 previous_person_name text not null,
 new_person_name text not null,
 previous_auth_user_id uuid not null references auth.users(id) on delete restrict,
 new_auth_user_id uuid not null unique references auth.users(id) on delete restrict,
 performed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists commercial_vendor_identity_replacements_person
 on public.commercial_vendor_identity_replacements(branch,person_code,created_at desc);
alter table public.commercial_vendor_identity_replacements enable row level security;
drop policy if exists commercial_vendor_identity_replacements_admin_read
 on public.commercial_vendor_identity_replacements;
create policy commercial_vendor_identity_replacements_admin_read
 on public.commercial_vendor_identity_replacements for select to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid())
  and p.is_active=true and p.role='admin'));
grant select on public.commercial_vendor_identity_replacements to authenticated;
revoke insert,update,delete on public.commercial_vendor_identity_replacements from authenticated,anon;

create or replace function public.replace_commercial_vendor_account(
 p_branch text,p_person_code integer,p_expected_old_user uuid,
 p_new_user uuid,p_new_name text,p_new_email text,p_actor uuid
) returns void language plpgsql security definer set search_path=''
as $function$
declare
 v_old public.commercial_vendor_accounts%rowtype;
begin
 if not exists(select 1 from public.profiles p where p.id=p_actor and p.is_active and p.role='admin')
 then raise exception 'Administrador no autorizado' using errcode='42501'; end if;
 select * into v_old from public.commercial_vendor_accounts
 where branch=p_branch and person_code=p_person_code for update;
 if not found or v_old.auth_user_id is distinct from p_expected_old_user
    or v_old.needs_review is distinct from true
 then raise exception 'El vendedor ya fue revisado o cambió su identidad' using errcode='23514'; end if;
 if exists(select 1 from public.profiles p where p.id=v_old.auth_user_id and p.is_active)
 then raise exception 'No se puede sustituir una cuenta todavía activa' using errcode='23514'; end if;
 if not exists(select 1 from public.profiles p where p.id=p_new_user and p.role='vendedor' and p.is_active)
 then raise exception 'La cuenta nueva no está habilitada' using errcode='23514'; end if;
 if not exists(select 1 from public.category_commercial_personnel cp,
   lateral jsonb_array_elements(cp.people) v
   where cp.id=1 and v->>'role'='VENDEDOR'
     and v->>'branch'=p_branch and (v->>'id')::integer=p_person_code
     and v->>'name'=p_new_name)
 then raise exception 'La identidad no coincide con el padrón actual' using errcode='23514'; end if;
 update public.commercial_vendor_accounts
   set auth_user_id=p_new_user,login_email=p_new_email,person_name=p_new_name,
       needs_review=false,updated_at=now()
 where branch=p_branch and person_code=p_person_code;
 insert into public.commercial_vendor_identity_replacements (
   branch,person_code,previous_person_name,new_person_name,
   previous_auth_user_id,new_auth_user_id,performed_by
 ) values(p_branch,p_person_code,v_old.person_name,p_new_name,
   v_old.auth_user_id,p_new_user,p_actor);
end;
$function$;
revoke all on function public.replace_commercial_vendor_account(text,integer,uuid,uuid,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.replace_commercial_vendor_account(text,integer,uuid,uuid,text,text,uuid)
 to service_role;
commit;
