-- Amplía la vista usada por los modales de Compartir/Invitar para poder filtrar por
-- tipo de usuario, sucursal y rol sin tocar la tabla profiles desde el frontend.

create or replace view public.trello_available_users as
select
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.branch,
  p.branch_id,
  p.user_type_id,
  ut.name as user_type_name,
  p.is_active
from public.profiles p
left join public.user_types ut on ut.id = p.user_type_id
where coalesce(p.is_active, true) = true;

grant select on public.trello_available_users to authenticated;
