-- Permite que IMEI/código y motivo sean opcionales en las solicitudes VENDO.
-- Las columnas se mantienen NOT NULL para conservar compatibilidad; el valor vacío
-- se guarda como cadena vacía y la aplicación lo muestra como "No informado".

begin;

alter table public.vendo_requests
  drop constraint if exists vendo_requests_imei_check;

alter table public.vendo_requests
  add constraint vendo_requests_imei_check check (
    trim(imei) = '' or char_length(trim(imei)) >= 6
  );

alter table public.vendo_requests
  drop constraint if exists vendo_requests_reason_check;

alter table public.vendo_requests
  add constraint vendo_requests_reason_check check (
    trim(reason) = '' or char_length(trim(reason)) >= 3
  );

commit;
