-- Amplía la vista usada por los modales de Compartir/Invitar para poder filtrar por
-- sucursal y rol sin tocar la tabla profiles desde el frontend.
-- La sucursal se toma desde user_branches, igual que en el CRUD de usuarios.

create or replace view public.trello_available_users as
select
  p.id,
  p.email,
  p.full_name,
  p.role,
  coalesce(min(ub.branch), p.branch) as branch,
  p.branch_id,
  p.user_type_id,
  ut.name as user_type_name,
  p.is_active,
  coalesce(array_remove(array_agg(distinct lower(ub.branch)), null), array[]::text[]) as branches
from public.profiles p
left join public.user_types ut on ut.id = p.user_type_id
left join public.user_branches ub on ub.user_id = p.id
where coalesce(p.is_active, true) = true
group by
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.branch,
  p.branch_id,
  p.user_type_id,
  ut.name,
  p.is_active;

grant select on public.trello_available_users to authenticated;
