-- Actualización para bases que ya instalaron la versión anterior con Resend.
-- Web3Forms envía al correo asociado a su Access Key, por lo que la tabla de
-- destinatarios seleccionados desde la aplicación deja de utilizarse.

begin;

drop table if exists public.vendo_notification_recipients;

-- La columna resend_email_id puede existir en instalaciones anteriores.
-- Se conserva para no destruir el historial, pero el código Web3Forms ya no la usa.

commit;
