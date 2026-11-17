-- Identidades comerciales independientes de los usuarios vendedor del CRUD.
-- No migra, desactiva ni elimina las cuentas ya existentes.
begin;

create table if not exists public.commercial_vendor_accounts (
  branch text not null,
  person_code integer not null check (person_code > 0),
  person_name text not null,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  login_email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (branch, person_code)
);
create index if not exists commercial_vendor_accounts_auth_idx
  on public.commercial_vendor_accounts(auth_user_id);
alter table public.commercial_vendor_accounts enable row level security;
drop policy if exists commercial_vendor_accounts_admin_read on public.commercial_vendor_accounts;
create policy commercial_vendor_accounts_admin_read
  on public.commercial_vendor_accounts for select to authenticated
  using (exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role='admin' and p.is_active=true));
grant select on public.commercial_vendor_accounts to authenticated;
revoke insert, update, delete on public.commercial_vendor_accounts from authenticated, anon;

-- El selector público del login muestra el padrón comercial, pero jamás contraseñas.
-- El correo interno es solo un identificador técnico para Supabase Auth.
create or replace function public.commercial_vendor_login_directory()
returns table(branch text, person_code integer, person_name text, login_email text)
language sql stable security definer set search_path=''
as $function$
  select person->>'branch',
         (person->>'id')::integer,
         person->>'name',
         case when p.is_active=true and p.role='vendedor' then a.login_email else null end
  from public.category_commercial_personnel cp
  cross join lateral jsonb_array_elements(cp.people) person
  left join public.commercial_vendor_accounts a
    on a.branch=person->>'branch' and a.person_code=(person->>'id')::integer
       and a.person_name=person->>'name'
  left join public.profiles p on p.id=a.auth_user_id
  where cp.id=1 and person->>'role'='VENDEDOR'
  order by person->>'branch', (person->>'id')::integer, person->>'name';
$function$;
revoke all on function public.commercial_vendor_login_directory() from public;
grant execute on function public.commercial_vendor_login_directory() to anon, authenticated;

-- Al importar o restaurar otro padrón, dar de baja las identidades que ya
-- no figuran; no tocar vendedores creados manualmente en el CRUD.
create or replace function public.commercial_vendor_deactivate_orphans()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  update public.profiles p set is_active=false
  from public.commercial_vendor_accounts a
  where p.id=a.auth_user_id and p.is_active=true
    and not exists (
      select 1 from jsonb_array_elements(new.people) person
      where person->>'role'='VENDEDOR'
        and person->>'branch'=a.branch
        and (person->>'id')::integer=a.person_code
        and person->>'name'=a.person_name
    );
  return new;
end;
$function$;
drop trigger if exists commercial_vendor_roster_update on public.category_commercial_personnel;
create trigger commercial_vendor_roster_update
after insert or update of people on public.category_commercial_personnel
for each row execute function public.commercial_vendor_deactivate_orphans();

-- Validación reutilizable de sesión comercial contra el padrón actual.
create or replace function public.commercial_vendor_membership_active(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select exists(
    select 1
    from public.commercial_vendor_accounts a
    join public.profiles p on p.id=a.auth_user_id
    join public.category_commercial_personnel cp on cp.id=1
    cross join lateral jsonb_array_elements(cp.people) person
    where a.auth_user_id=p_user_id and p_user_id=(select auth.uid()) and p.is_active=true and p.role='vendedor'
      and person->>'role'='VENDEDOR'
      and person->>'branch'=a.branch
      and (person->>'id')::integer=a.person_code
      and person->>'name'=a.person_name
  );
$function$;
revoke all on function public.commercial_vendor_membership_active(uuid) from public, anon;
grant execute on function public.commercial_vendor_membership_active(uuid) to authenticated;

commit;
