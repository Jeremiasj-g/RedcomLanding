-- Corrige el trigger de diferencias: Supabase requiere un predicado WHERE
-- explícito para operaciones DELETE. Conserva la última versión del padrón
-- y no modifica cuentas de Auth ni contraseñas.
begin;
create or replace function public.commercial_vendor_deactivate_orphans()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  delete from public.commercial_personnel_import_changes
  where recorded_at <= now();

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

  update public.commercial_vendor_accounts a
     set needs_review=true,updated_at=now()
   where not exists (
     select 1 from jsonb_array_elements(new.people) v
     where v->>'role'='VENDEDOR'
       and v->>'branch'=a.branch
       and (v->>'id')::integer=a.person_code
       and v->>'name'=a.person_name
   );

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
commit;