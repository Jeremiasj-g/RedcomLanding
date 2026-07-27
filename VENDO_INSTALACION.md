# Alta de VENDO · instalación y actualización

## 1. Base de datos

Para una instalación nueva, ejecutar en Supabase:

```sql
supabase/migrations/20260725_vendo_requests.sql
```

Para la base actual incluida en `REDCOM_BUCKUP.sql`, ejecutar:

```sql
supabase/migrations/20260727_vendo_actual_database_fix.sql
```

Esta migración es obligatoria para aceptar o rechazar solicitudes. La base actual todavía limita `status` a `pending` y `seen`. La migración elimina primero esa restricción, convierte los registros `seen` a `accepted` y recién después instala los estados nuevos:

```text
pending
accepted
rejected
```

El orden es importante: intentar convertir `seen` antes de retirar la restricción antigua hace que PostgreSQL cancele toda la transacción.

## 2. Web3Forms

La integración envía desde el navegador a `https://api.web3forms.com/submit`.

La Access Key incluida es:

```env
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=ee2bb86c-251a-41d0-82d2-29c6e92c00a8
```

La variable es opcional porque existe un valor por defecto en el proyecto. Para cambiar el correo receptor hay que crear otra Access Key en Web3Forms y reemplazarla.

## 3. Variables de servidor

La API que guarda, resuelve y elimina solicitudes necesita:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 4. Flujo administrativo

Administración puede:

- Aceptar solicitudes.
- Rechazarlas con una observación opcional.
- Responder al solicitante desde el cliente de correo del equipo.
- Eliminar una o varias solicitudes definitivamente.

El usuario ve el resultado en su historial personal.

## 5. Notificaciones de la barra superior

La campana del administrador suma las solicitudes VENDO pendientes y muestra cuántas corresponden a altas y cuántas a bajas. El contador se actualiza en tiempo real cuando se crea, resuelve o elimina una solicitud.

## 6. Eliminación

El solicitante puede eliminar definitivamente sus propias solicitudes. Administración puede eliminar cualquier solicitud. La ruta `DELETE /api/vendo/requests` acepta hasta 200 IDs por petición.

## 7. Correo y respuestas

Web3Forms recibe un único campo `message`, con asunto y contenido generados dinámicamente. El campo `replyto` utiliza `requester_email`, por lo que al responder desde Gmail u Outlook la respuesta se dirige al usuario que cargó la solicitud.
