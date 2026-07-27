-- Solicitudes de alta/baja de dispositivos VENDO.
-- Guarda el formulario, una instantánea del solicitante, el seguimiento administrativo
-- y el estado de la notificación enviada mediante Web3Forms.

begin;

create table if not exists public.vendo_requests (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null,
  branch_name text not null,
  first_name text not null,
  last_name text not null,
  movement_type text not null,
  imei text not null,
  phone text not null,
  vendor_email text not null,
  reason text not null,

  requested_by uuid not null references public.profiles(id) on delete restrict,
  requester_name text not null,
  requester_email text not null,
  requester_role text,
  requester_branches text[] not null default '{}',

  status text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_by_name text,
  review_note text,
  -- Campos anteriores conservados para compatibilidad con instalaciones previas.
  seen_at timestamptz,
  seen_by uuid references public.profiles(id) on delete set null,

  -- Se conservan estos nombres genéricos para compatibilidad con instalaciones anteriores.
  email_status text not null default 'pending',
  email_sent_at timestamptz,
  email_recipients text[] not null default '{}',
  email_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vendo_requests_movement_check check (movement_type in ('alta', 'baja')),
  constraint vendo_requests_status_check check (status in ('pending', 'accepted', 'rejected')),
  constraint vendo_requests_email_status_check check (email_status in ('pending', 'sent', 'failed', 'no_recipients')),
  constraint vendo_requests_name_check check (char_length(trim(first_name)) >= 2 and char_length(trim(last_name)) >= 2),
  constraint vendo_requests_imei_check check (char_length(trim(imei)) >= 6),
  constraint vendo_requests_phone_check check (char_length(trim(phone)) >= 7),
  constraint vendo_requests_email_check check (position('@' in vendor_email) > 1),
  constraint vendo_requests_reason_check check (char_length(trim(reason)) >= 3)
);

create index if not exists vendo_requests_requested_by_idx
  on public.vendo_requests (requested_by, created_at desc);
create index if not exists vendo_requests_status_idx
  on public.vendo_requests (status, created_at desc);
create index if not exists vendo_requests_branch_idx
  on public.vendo_requests (branch_code, created_at desc);

create or replace function public.set_vendo_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendo_requests_set_updated_at on public.vendo_requests;
create trigger vendo_requests_set_updated_at
before update on public.vendo_requests
for each row execute function public.set_vendo_updated_at();

alter table public.vendo_requests enable row level security;

-- Cada usuario ve únicamente su historial. Administración ve todas las solicitudes.
drop policy if exists vendo_requests_select_own_or_admin on public.vendo_requests;
create policy vendo_requests_select_own_or_admin
on public.vendo_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or public.my_role() = 'admin'
);

-- Se conserva para permitir integraciones directas futuras. La API actual inserta desde servidor.
drop policy if exists vendo_requests_insert_own on public.vendo_requests;
create policy vendo_requests_insert_own
on public.vendo_requests
for insert
to authenticated
with check (requested_by = auth.uid());

-- Solo administración puede aceptar o rechazar solicitudes.
drop policy if exists vendo_requests_update_admin on public.vendo_requests;
create policy vendo_requests_update_admin
on public.vendo_requests
for update
to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

grant select, insert, update on public.vendo_requests to authenticated;

-- Habilita las actualizaciones en tiempo real del historial y el panel administrativo.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'vendo_requests'
     ) then
    execute 'alter publication supabase_realtime add table public.vendo_requests';
  end if;
end;
$$;

commit;
