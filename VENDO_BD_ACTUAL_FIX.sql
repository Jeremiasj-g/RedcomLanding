-- Sincroniza el módulo VENDO con la estructura real de la base actual.
-- IMPORTANTE: primero se elimina la restricción antigua que solo admitía
-- pending/seen y recién después se convierten los registros a accepted/rejected.
-- El orden anterior provocaba que toda la transacción hiciera rollback.

begin;

alter table public.vendo_requests
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by_name text,
  add column if not exists review_note text;

-- La base exportada todavía tiene el check: status in ('pending', 'seen').
-- Debe quitarse antes de convertir cualquier fila.
alter table public.vendo_requests
  drop constraint if exists vendo_requests_status_check;

-- Las solicitudes anteriormente marcadas como vistas pasan a aceptadas.
update public.vendo_requests
set
  status = 'accepted',
  reviewed_at = coalesce(reviewed_at, seen_at, updated_at, now()),
  reviewed_by = coalesce(reviewed_by, seen_by),
  reviewed_by_name = coalesce(reviewed_by_name, 'Administración')
where status = 'seen';

alter table public.vendo_requests
  alter column status set default 'pending';

alter table public.vendo_requests
  add constraint vendo_requests_status_check
  check (status in ('pending', 'accepted', 'rejected'));

create index if not exists vendo_requests_reviewed_at_idx
  on public.vendo_requests (reviewed_at desc)
  where reviewed_at is not null;

comment on column public.vendo_requests.reviewed_at is 'Fecha en que Administración aceptó o rechazó la solicitud.';
comment on column public.vendo_requests.reviewed_by is 'Usuario administrador que resolvió la solicitud.';
comment on column public.vendo_requests.reviewed_by_name is 'Nombre del administrador guardado como instantánea.';
comment on column public.vendo_requests.review_note is 'Observación opcional, especialmente para rechazos.';

-- Fuerza a PostgREST/Supabase a refrescar las columnas recién agregadas.
notify pgrst, 'reload schema';

commit;
