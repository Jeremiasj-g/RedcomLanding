-- El código + sucursal identifica la única cuenta comercial.
-- Un cambio de titular obliga a nueva contraseña, no a nuevo auth.users.
begin;
create table if not exists public.commercial_vendor_holder_rotations (
 id uuid primary key default gen_random_uuid(),
 branch text not null,
 person_code integer not null check(person_code>0),
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 previous_person_name text not null,
 new_person_name text not null,
 performed_by uuid references auth.users(id) on delete set null,
 rotated_at timestamptz not null default now()
);
create index if not exists commercial_vendor_holder_rotations_slot_idx
 on public.commercial_vendor_holder_rotations(branch,person_code,rotated_at desc);
alter table public.commercial_vendor_holder_rotations enable row level security;
drop policy if exists commercial_vendor_holder_rotations_admin_read on public.commercial_vendor_holder_rotations;
create policy commercial_vendor_holder_rotations_admin_read
on public.commercial_vendor_holder_rotations for select to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.is_active));
grant select on public.commercial_vendor_holder_rotations to authenticated;
revoke insert,update,delete on public.commercial_vendor_holder_rotations from authenticated,anon;

create or replace function public.is_current_commercial_vendor()
returns boolean language sql stable security definer set search_path=''
as $fn$
 select exists(select 1 from public.commercial_vendor_accounts a
               where a.auth_user_id=(select auth.uid()));
$fn$;
revoke all on function public.is_current_commercial_vendor() from public,anon;
grant execute on function public.is_current_commercial_vendor() to authenticated;

-- Las cuentas comerciales no pueden alterarse el nombre, rol o alcance
-- mediante un update directo a profiles, aunque exista una política de autoservicio.
create or replace function public.protect_commercial_vendor_profile_identity()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if (select auth.role())='authenticated' and
    exists(select 1 from public.commercial_vendor_accounts a where a.auth_user_id=old.id) and
    (new.full_name is distinct from old.full_name or
     new.email is distinct from old.email or
     new.role is distinct from old.role or
     new.branch is distinct from old.branch or
     new.is_active is distinct from old.is_active)
 then
    raise exception 'La identidad del vendedor se administra desde DetallePersonal' using errcode='42501';
 end if;
 return new;
end;
$fn$;
drop trigger if exists prevent_commercial_vendor_identity_edit on public.profiles;
create trigger prevent_commercial_vendor_identity_edit
 before update on public.profiles for each row
 execute function public.protect_commercial_vendor_profile_identity();

-- Luego de rotar la contraseña de Auth, completar atómicamente la
-- reasignación del titular y la revocación de sesiones persistentes.
create or replace function public.finalize_commercial_vendor_holder_rotation(
 p_branch text,p_person_code integer,p_auth_user_id uuid,
 p_new_name text,p_profile_branch text,p_branch_id smallint,p_actor uuid
) returns void language plpgsql security definer set search_path=''
as $fn$
declare existing public.commercial_vendor_accounts%rowtype;
begin
 if not exists(select 1 from public.profiles p
               where p.id=p_actor and p.role='admin' and p.is_active)
 then raise exception 'Administrador no autorizado' using errcode='42501';end if;
 select * into existing from public.commercial_vendor_accounts
 where branch=p_branch and person_code=p_person_code for update;
 if not found or existing.auth_user_id is distinct from p_auth_user_id
    or existing.needs_review is distinct from true
 then raise exception 'El acceso cambió; actualizá la lista' using errcode='23514';end if;
 if not exists(select 1 from public.category_commercial_personnel cp,
   lateral jsonb_array_elements(cp.people) v
   where cp.id=1 and v->>'role'='VENDEDOR' and v->>'branch'=p_branch
   and (v->>'id')::integer=p_person_code and v->>'name'=p_new_name)
 then raise exception 'El titular no coincide con DetallePersonal' using errcode='23514';end if;
 if not exists(select 1 from public.branches b where b.id=p_branch_id and b.code=p_profile_branch)
 then raise exception 'Sucursal inválida' using errcode='23514';end if;
 update public.profiles
 set full_name=p_new_name,branch=p_profile_branch,is_active=true
 where id=p_auth_user_id and role='vendedor';
 if not found then raise exception 'No existe el perfil vendedor' using errcode='23514';end if;
 delete from public.user_branches
 where user_id=p_auth_user_id and branch<>p_profile_branch;
 insert into public.user_branches(user_id,branch,branch_id)
 values(p_auth_user_id,p_profile_branch,p_branch_id)
 on conflict(user_id,branch) do update set branch_id=excluded.branch_id;
 update public.commercial_vendor_accounts
 set person_name=p_new_name,needs_review=false,updated_at=now()
 where branch=p_branch and person_code=p_person_code and auth_user_id=p_auth_user_id;
 insert into public.commercial_vendor_holder_rotations(
 branch,person_code,auth_user_id,previous_person_name,new_person_name,performed_by
 ) values(p_branch,p_person_code,p_auth_user_id,existing.person_name,p_new_name,p_actor);
 -- Tokens de refresco invalidados; JWT emitidos antes pueden durar hasta exp.
 delete from auth.sessions where user_id=p_auth_user_id;
end;
$fn$;
revoke all on function public.finalize_commercial_vendor_holder_rotation(text,integer,uuid,text,text,smallint,uuid)
 from public,anon,authenticated;
grant execute on function public.finalize_commercial_vendor_holder_rotation(text,integer,uuid,text,text,smallint,uuid)
 to service_role;
commit;