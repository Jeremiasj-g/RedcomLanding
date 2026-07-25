# Módulo Alta de Vendo

## 1. Crear tablas y políticas

Ejecutá en el SQL Editor de Supabase:

`supabase/migrations/20260725_vendo_requests.sql`

La migración crea:

- `public.vendo_requests`: solicitudes, datos del vendedor/dispositivo, solicitante, estado de revisión y resultado del correo.
- `public.vendo_notification_recipients`: usuarios activos elegidos desde **Administración > Vendo** para recibir cada correo.
- Políticas RLS: cada usuario ve su propio historial; el administrador ve todo y puede marcar solicitudes como vistas/configurar destinatarios.

## 2. Configurar Resend

Agregá estas variables al archivo `.env.local` y también a Vercel:

```env
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=Redcom VENDO <vendo@tu-dominio-verificado.com>
```

- `SUPABASE_SERVICE_ROLE_KEY` se usa solamente en la ruta del servidor y nunca llega al navegador.
- El dominio de `RESEND_FROM_EMAIL` debe estar verificado en Resend para enviar a destinatarios reales.
- No publiques ni subas estas claves a Git.

## 3. Configurar destinatarios

1. Ingresá como administrador.
2. Abrí **Panel de administrador > Vendo**.
3. Seleccioná los usuarios de la base de datos que recibirán las nuevas solicitudes.
4. Presioná **Guardar destinatarios**.

## 4. Flujo

- El usuario abre **Espacio de trabajo > Alta de Vendo**.
- Las sucursales se consultan dinámicamente desde `public.branches`.
- Al enviar, la API valida la sesión, guarda la solicitud y envía el correo mediante Resend.
- Aunque Resend falle o no haya destinatarios, la solicitud queda guardada y el panel muestra el estado del correo.
- El usuario ve todo su historial; administración visualiza todas las solicitudes y puede marcarlas como vistas.
