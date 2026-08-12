-- VENDO: reemplaza la eliminación directa del usuario por una solicitud de eliminación.
-- Administración conserva la eliminación definitiva y puede descartar la petición del usuario.

begin;

alter table public.vendo_requests
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason_code text,
  add column if not exists deletion_reason_note text;

alter table public.vendo_requests
  drop constraint if exists vendo_requests_deletion_reason_code_check;

alter table public.vendo_requests
  add constraint vendo_requests_deletion_reason_code_check
  check (
    deletion_reason_code is null
    or deletion_reason_code = any (
      array['wrong_data','duplicate','wrong_movement','no_longer_needed','other']
    )
  );

alter table public.vendo_requests
  drop constraint if exists vendo_requests_deletion_request_coherence_check;

alter table public.vendo_requests
  add constraint vendo_requests_deletion_request_coherence_check
  check (
    (deletion_requested_at is null and deletion_reason_code is null)
    or (deletion_requested_at is not null and deletion_reason_code is not null)
  );

create index if not exists vendo_requests_deletion_requested_at_idx
  on public.vendo_requests (deletion_requested_at desc)
  where deletion_requested_at is not null;

commit;
