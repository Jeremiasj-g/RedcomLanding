-- Permite actualizaciones de profiles originadas en triggers internos (p. ej.
-- importación maestra), pero mantiene el bloqueo en actualizaciones directas
-- realizadas con JWT de un vendedor comercial.
begin;
create or replace function public.protect_commercial_vendor_profile_identity()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if (select auth.role())='authenticated'
    and pg_trigger_depth()=1
    and exists(select 1 from public.commercial_vendor_accounts a where a.auth_user_id=old.id)
    and (new.full_name is distinct from old.full_name
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.branch is distinct from old.branch
      or new.is_active is distinct from old.is_active)
 then
    raise exception 'La identidad del vendedor se administra desde DetallePersonal' using errcode='42501';
 end if;
 return new;
end;
$fn$;
commit;
