-- Compare each imported commercial roster against the immediately previous active one.
-- Preserve Auth credentials, and quarantine renamed/reassigned identities until reviewed.
begin;

alter table public.commercial_vendor_accounts
 add column if not exists needs_review boolean not null default false;

create table if not exists public.commercial_personnel_import_changes (
 branch text not null,
 person_code integer not null,
 status text not null check(status in ('new','modified','removed')),
 previous_person jsonb,
 current_person jsonb,
 recorded_at timestamptz not null default now(),
 primary key(branch,person_code)
);
alter table public.commercial_personnel_import_changes enable row level security;
drop policy if exists commercial_personnel_import_changes_admin_read
 on public.commercial_personnel_import_changes;
create policy commercial_personnel_import_changes_admin_read
 on public.commercial_personnel_import_changes for select to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid())
   and p.role='admin' and p.is_active=true));
grant select on public.commercial_personnel_import_changes to authenticated;
revoke insert,update,delete on public.commercial_personnel_import_changes from authenticated,anon;

-- The original trigger deactivated on any name change, even a typo, with no
-- visible explanation. This replacement records the import diff and marks
-- ambiguous account identities for review rather than ever overwriting secrets.
create or replace function public.commercial_vendor_deactivate_orphans()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  -- This table describes only the latest successful import or restoration.
  delete from public.commercial_personnel_import_changes;

  insert into public.commercial_personnel_import_changes
    (branch,person_code,status,previous_person,current_person,recorded_at)
  select
    coalesce(n.person->>'branch',o.person->>'branch'),
    coalesce((n.person->>'id')::integer,(o.person->>'id')::integer),
    case when o.person is null then 'new'
         when n.person is null then 'removed'
         else 'modified' end,
    o.person,n.person,now()
  from (
    select v as person from jsonb_array_elements(coalesce(old.people,'[]'::jsonb)) v
  ) o
  full join (
    select v as person from jsonb_array_elements(coalesce(new.people,'[]'::jsonb)) v
  ) n
    on o.person->>'branch'=n.person->>'branch'
       and o.person->>'id'=n.person->>'id'
  where o.person is null or n.person is null or o.person is distinct from n.person;

  -- Keep password hashes and account ids unchanged. Do not auto-transfer an
  -- identity if the name changes or the code disappears (possible code reuse).
  update public.commercial_vendor_accounts a
     set needs_review=true,updated_at=now()
   where not exists (
     select 1 from jsonb_array_elements(new.people) v
     where v->>'role'='VENDEDOR'
       and v->>'branch'=a.branch
       and (v->>'id')::integer=a.person_code
       and v->>'name'=a.person_name
   );

  -- Changes to sales force can change the authorized branch without
  -- changing the seller identity or their password. Sync scopes from the
  -- current roster for verified accounts, leaving all others untouched.
  update public.profiles p
     set branch=case
       when v->>'branch'='CASA CENTRAL' then
         case when upper(v->>'force') like '%REFRIGERAD%'
                or upper(v->>'force') like '%REGRIGERAD%'
              then 'refrigerados' else 'corrientes' end
       when v->>'branch'='SUCURSAL RESISTENCIA' then 'chaco'
       when v->>'branch'='SUCURSAL POSADAS' then 'misiones'
       when v->>'branch'='SUCURSAL OBERA' then 'obera'
       else p.branch end
    from public.commercial_vendor_accounts a
    cross join lateral jsonb_array_elements(new.people) v
   where p.id=a.auth_user_id and a.needs_review=false
     and v->>'role'='VENDEDOR' and v->>'branch'=a.branch
     and (v->>'id')::integer=a.person_code and v->>'name'=a.person_name;

  delete from public.user_branches ub
   using public.commercial_vendor_accounts a, public.profiles p
   where ub.user_id=a.auth_user_id and p.id=a.auth_user_id
     and a.needs_review=false and ub.branch<>p.branch;

  insert into public.user_branches(user_id,branch,branch_id)
  select a.auth_user_id,p.branch,b.id
    from public.commercial_vendor_accounts a
    join public.profiles p on p.id=a.auth_user_id
    join public.branches b on b.code=p.branch
   where a.needs_review=false
  on conflict (user_id,branch) do update set branch_id=excluded.branch_id;

  update public.profiles p
     set is_active=false
    from public.commercial_vendor_accounts a
   where p.id=a.auth_user_id and a.needs_review=true and p.is_active=true;

  return new;
end;
$function$;
revoke all on function public.commercial_vendor_deactivate_orphans() from public,anon,authenticated;

-- PostgreSQL's UPDATE trigger always has OLD, and the commercial-personnel
-- singleton already exists in Redcom. Handle INSERT without referencing OLD:
drop trigger if exists commercial_vendor_roster_update on public.category_commercial_personnel;
create trigger commercial_vendor_roster_update
 after update of people on public.category_commercial_personnel
 for each row execute function public.commercial_vendor_deactivate_orphans();

-- Existing accounts with a pending identity review must not appear as
-- sign-in-ready. This is a SQL signature-preserving replacement of the RPC.
create or replace function public.commercial_vendor_login_directory()
returns table(branch text,person_code integer,person_name text,login_email text)
language sql stable security definer set search_path=''
as $function$
 select v->>'branch',(v->>'id')::integer,v->>'name',
   case when p.is_active=true and p.role='vendedor'
       and a.needs_review=false then a.login_email else null end
 from public.category_commercial_personnel cp
 cross join lateral jsonb_array_elements(cp.people) v
 left join public.commercial_vendor_accounts a
   on a.branch=v->>'branch' and a.person_code=(v->>'id')::integer
      and a.person_name=v->>'name'
 left join public.profiles p on p.id=a.auth_user_id
 where cp.id=1 and v->>'role'='VENDEDOR'
 order by v->>'branch',(v->>'id')::integer,v->>'name';
$function$;

create or replace function public.commercial_vendor_membership_active(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select exists (
  select 1 from public.commercial_vendor_accounts a
  join public.profiles p on p.id=a.auth_user_id
  join public.category_commercial_personnel cp on cp.id=1
  cross join lateral jsonb_array_elements(cp.people) v
  where a.auth_user_id=p_user_id and p_user_id=(select auth.uid())
    and a.needs_review=false and p.is_active=true and p.role='vendedor'
    and v->>'role'='VENDEDOR' and v->>'branch'=a.branch
    and (v->>'id')::integer=a.person_code and v->>'name'=a.person_name
 );
$function$;
commit;