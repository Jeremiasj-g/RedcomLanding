-- Seguimiento de respuestas manuales a solicitudes VENDO.
-- Nota: el botón actual abre el cliente de correo mediante mailto:, por lo que no es posible
-- confirmar técnicamente que el usuario haya presionado "Enviar". Estos campos registran
-- que administración inició/preparó una respuesta desde el panel.

begin;

alter table public.vendo_requests
  add column if not exists reply_started_at timestamptz,
  add column if not exists reply_started_by uuid references public.profiles(id) on delete set null,
  add column if not exists reply_started_by_name text;

create index if not exists vendo_requests_reply_started_at_idx
  on public.vendo_requests (reply_started_at desc)
  where reply_started_at is not null;

commit;
