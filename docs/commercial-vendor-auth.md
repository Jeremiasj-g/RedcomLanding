# Acceso comercial independiente de usuarios del CRUD

## Objetivo
`DetallePersonal.xlsx` es el padrón de vendedores. No se vincula ningún vendedor del Excel con las cuentas `vendedor` creadas anteriormente en el CRUD.

- Los usuarios antiguos del CRUD permanecen intactos; su baja se hará en una operación posterior expresamente autorizada.
- Al establecer una contraseña para un vendedor, se crea **una identidad nueva de Supabase Auth**, registrada en `commercial_vendor_accounts` por `(branch, person_code)`. Si existe, solamente se actualiza su clave.
- Supabase Auth sigue gestionando hashes, sesiones y JWT; el login comercial no almacena ni compara contraseñas manualmente.
- En el CRUD de Administración se ocultan las identidades marcadas como gestionadas por Personal comercial; se editan desde `/admin/personal-comercial`.
- La columna Acciones ofrece establecer clave manual o generar clave aleatoria para cada vendedor.
- El botón general crea o actualiza claves distintas para todos los vendedores del padrón. Tras finalizar, las claves se muestran una sola vez y se pueden copiar; las fallas se muestran individualmente.
- No se envían correos ni se eliminan cuentas antiguas en esta etapa.

## Inicio de sesión
El interruptor **Vendedor** en el modal de acceso cambia el campo de correo por selectores con búsqueda de **Sucursal** y **Vendedor** (por ejemplo `01 MATIAS VILLORDO`). El login consulta el RPC `commercial_vendor_login_directory()` y utiliza la cuenta interna únicamente para autenticarse mediante `supabase.auth.signInWithPassword`. Las personas del Excel sin clave configurada aparecen en la lista, pero no pueden iniciar sesión.

Las cuentas creadas tienen rol `vendedor`, su sucursal correspondiente y acceso existente a las herramientas permitidas por ese rol. La fuerza "ESQUEMA REGRIGERADOS" corresponde a `refrigerados`; CASA CENTRAL restante a `corrientes`. No se deben usar direcciones de correo ficticias para notificaciones: el alias `@example.com` es exclusivamente técnico.

## Migración y puesta en marcha
1. Aplicar `supabase/migrations/20261117_independent_commercial_vendor_auth.sql` en el Supabase autorizado.
2. Desplegar la Edge Function nueva `commercial_vendor_admin`, con `verify_jwt=true`, las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` proporcionadas por Supabase.
3. Verificar que `commercial_vendor_accounts` esté vacía y que el padrón anterior conserve sus 102 registros.
4. Elegir **un solo vendedor de prueba**, generar su clave, verificar el login con el switch, la sucursal y la navegación autorizada, y comprobar que la cuenta previa del CRUD no se modificó.
5. Recién tras el ensayo exitoso, generar las claves en lote. Confirmar cantidad de resultados y errores; guardar los resultados en un gestor de credenciales aprobado. Cada contraseña se muestra una sola vez.
6. Las claves deben comunicarse de modo privado y los vendedores deberán tener un mecanismo futuro de rotación/recuperación. No guardar claves en el Excel, la BD, logs ni en el repo.
7. Después de completar la transición, **planificar aparte** la desactivación/retiro de las cuentas manuales anteriores. No automatizar esa baja sin una lista revisada.

## Seguridad e integridad
- La función administrativa verifica identidad y rol `admin` activo en el servidor y valida el vendedor contra el padrón publicado en cada operación.
- `commercial_vendor_accounts` tiene RLS y solo lectura para admins; la escritura queda restringida al servicio.
- La vista pública del login devuelve los nombres y sucursales de los vendedores porque el flujo expresamente requiere elegirlos.
- La importación/restauración de un padrón que elimina a un vendedor desactiva su identidad comercial, sin alterar otras cuentas.
- El histórico de documentos comerciales y el CRUD antiguo permanecen sin cambios.
- `commercial_personnel_account_links` de la implementación anterior ya no tiene consumidores. No usarla ni crear vínculos manuales; revisar su retiro solo en una migración posterior.
- No usar la cuenta comercial para enviar correos a su dirección técnica de Auth.

## Validaciones de AGENTS.md
- Filtros por campo, búsqueda y paginación de la tabla: se conservan.
- Sin scroll X en escritorio; vista móvil apilada.
- Dropdowns y diálogos reutilizados; transiciones de 0,2 s y skeletons existentes.
- Resultados de asignación masiva y claves: aviso antes de cerrar, confirmación para operaciones sensibles y bloqueo de recarga con proceso en curso.
- Pendiente verificación real en navegador y prueba de autenticación con un vendedor de pruebas. La compilación no sustituye estas comprobaciones.


## Actualización segura de DetallePersonal
Reimportar un archivo no ejecuta `updateUserById(..., password)` y por lo tanto **no cambia las contraseñas** que los vendedores hayan recibido o configurado desde Perfil.

La migración `20261117_commercial_roster_diff_and_identity_review.sql` agrega una comparación del nuevo padrón con el anterior y registra el resultado de **la última publicación o restauración** en `commercial_personnel_import_changes`.

- **Nuevo** (verde suave): código + sucursal inexistentes en la versión anterior. Aparece sin cuenta comercial y se puede configurar la clave por fila o con «Generar solo para pendientes».
- **Modificado** (ámbar suave): mismo código + sucursal, con cambios en nombre, cargo, superior o fuerza de venta. Los cambios de datos no alteran la clave.
- **Sin cambios**: se conserva exactamente la cuenta y el hash de contraseña existentes.
- **Baja**: la persona ya no está en el padrón. Se conserva el registro de acceso histórico y la contraseña, pero el perfil comercial queda inactivo para impedir ingreso.
- **Cambio de nombre con el mismo código**: podría ser una corrección o código reutilizado. Se bloquea preventivamente el acceso y se muestra «Revisar identidad»; el administrador puede confirmar que es la misma persona y reactivarla **sin cambiar la contraseña**.
- **Cambio de sucursal (clave compuesta diferente)**: se marca baja + alta nueva; nunca se transfiere una cuenta automáticamente porque la identidad sería ambigua. Requiere revisión administrativa.
- **Cambio de fuerza de venta dentro de la misma sucursal**: se actualizan sucursal autorizada y `user_branches` cuando corresponde, conservando la contraseña.

Al seleccionar un nuevo XLSX se muestran cifras de incorporaciones, modificaciones y bajas antes de confirmar. Después de publicar, los cambios quedan resaltados en la tabla, con filtros «Todos», «Nuevos», «Modificados». La acción masiva predeterminada cambia a **«Generar solo para pendientes»** para evitar el reemplazo accidental de contraseñas existentes; «Regenerar todas las claves» queda como acción explícita y confirmada.

**Puesta en marcha:** instalar la migración antes de publicar otro archivo. No ejecutar el generador masivo de todas las contraseñas luego de una importación si se desea preservar las claves de los usuarios actuales. Probar primero con una versión de ensayo o una copia de base y verificar el caso de cambio de nombre y fuerza de venta.
