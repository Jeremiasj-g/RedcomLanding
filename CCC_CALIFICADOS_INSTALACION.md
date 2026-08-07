# CCC Calificados — instalación de archivos compartidos

La página `/ccc-calificados` incluye carga de archivos por sucursal, reutilización automática, contador de 15 días para la base de clientes y exportaciones Excel/PDF.

## Instalación inicial en Supabase

Ejecutar en **SQL Editor**:

```text
supabase/migrations/20260722_ccc_client_bases.sql
supabase/migrations/20260729_ccc_workspace_files.sql
```

La primera migración crea la tabla `ccc_client_bases` y el bucket privado `ccc-client-bases`.
La segunda crea `ccc_workspace_files` y el bucket privado `ccc-workspace-files`.

## Permisos dinámicos y roles personalizados

Si el proyecto ya tiene instalado el sistema de permisos por usuario/rol y el CRUD de roles, ejecutar también:

```text
CCC_PERMISOS_DINAMICOS_BD.sql
```

La misma corrección queda versionada como migración en:

```text
supabase/migrations/20260807_ccc_dynamic_module_rls.sql
```

Esta migración reemplaza las políticas antiguas que dependían de nombres de rol fijos (`admin`, `jdv`, `supervisor`) y hace que CCC utilice el permiso dinámico `quarterly_indicators`.

El orden efectivo de autorización es:

1. `admin` conserva acceso total.
2. Si el usuario tiene una excepción individual para `quarterly_indicators`, se respeta esa excepción.
3. Si no tiene excepción individual, se utiliza el permiso predeterminado configurado para su rol en `role_module_permissions`.
4. Para usuarios que no son administradores, además se exige que la sucursal esté asignada al usuario mediante la lógica de `auth_has_branch`.
5. Si el permiso no existe o el usuario está inactivo, el acceso se deniega.

De esta forma, un rol personalizado creado desde el panel de administrador puede ver, descargar y reemplazar los archivos compartidos de CCC siempre que tenga habilitado **CCC Calificados / Indicadores trimestrales** y tenga asignada la sucursal correspondiente. No es necesario volver a modificar SQL al crear nuevos roles.

## Funcionamiento

1. El usuario elige una de sus sucursales asignadas.
2. Sube el Excel de clientes con las hojas `Clientes` y `Rutas de Venta`.
3. El archivo queda guardado como la versión vigente de esa sucursal.
4. Al procesar el archivo de ventas, la página descarga automáticamente la última base guardada de la sucursal elegida.
5. Una nueva carga reemplaza la versión anterior y reinicia el plazo de actualización de 15 días.

El binario se almacena en **Supabase Storage** y su información de vigencia, autor y fechas se registra en `public.ccc_client_bases`.

## Archivos compartidos de ventas, listado y detalle personal

`ccc_workspace_files` y el bucket privado `ccc-workspace-files` conservan por sucursal:

- Archivo de ventas.
- Listado Vendedor–Supervisor.
- Detalle personal.

Estos tres archivos muestran autor, fecha y tamaño de la última carga, pero no tienen vencimiento automático. La regla de actualización cada 15 días continúa aplicándose solamente a la base de clientes.

## Procesamiento automático y permanencia

Los resultados no se almacenan como HTML en la base de datos. Cuando el usuario vuelve a `/ccc-calificados`, la página consulta los metadatos de la sucursal y, si encuentra la base de clientes y el archivo de ventas, descarga las versiones vigentes y regenera automáticamente CCC Calificados y MIX.

Cuando también existe Detalle personal, se regenera DROPSIZE en la misma ejecución. El Listado Vendedor–Supervisor continúa siendo opcional y, si no está guardado, se usa el listado precargado.

Este enfoque evita guardar resultados desactualizados: cualquier reemplazo de un archivo cambia su fecha de actualización y dispara nuevamente el procesamiento automático.
