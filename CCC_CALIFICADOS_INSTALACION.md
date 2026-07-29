# CCC Calificados — instalación de la base compartida

La página `/ccc-calificados` ya incluye la carga de la base de clientes por sucursal, reutilización automática, contador de 15 días y exportaciones Excel/PDF.

## Paso obligatorio en Supabase

Ejecutar en **SQL Editor** el archivo:

`supabase/migrations/20260722_ccc_client_bases.sql`

Esto crea la tabla de metadatos, el bucket privado y las políticas RLS para `admin`, `jdv` y `supervisor` según las sucursales de `user_branches`.

## Funcionamiento

1. El usuario elige una de sus sucursales asignadas.
2. Sube el Excel de clientes con las hojas `Clientes` y `Rutas de Venta`.
3. El archivo queda guardado como la versión vigente de esa sucursal.
4. Al procesar el archivo de ventas, la página descarga automáticamente la última base guardada de la sucursal elegida.
5. Una nueva carga reemplaza la versión anterior y reinicia el plazo de actualización de 15 días.

El binario se almacena en **Supabase Storage** y su información de vigencia, autor y fechas se registra en `public.ccc_client_bases`.

## Archivos compartidos de ventas, listado y detalle personal

Ejecutar también en Supabase SQL Editor:

```text
supabase/migrations/20260729_ccc_workspace_files.sql
```

Esta migración crea la tabla `ccc_workspace_files` y el bucket privado `ccc-workspace-files` para conservar por sucursal:

- Archivo de ventas.
- Listado Vendedor–Supervisor.
- Detalle personal.

Estos tres archivos muestran autor, fecha y tamaño de la última carga, pero no tienen vencimiento automático. La regla de actualización cada 15 días continúa aplicándose solamente a la base de clientes.

## Procesamiento automático y permanencia

Los resultados no se almacenan como HTML en la base de datos. En su lugar, cuando el usuario vuelve a `/ccc-calificados`, la página consulta los metadatos de la sucursal y, si encuentra la base de clientes y el archivo de ventas, descarga las versiones vigentes y regenera automáticamente CCC Calificados y MIX.

Cuando también existe Detalle personal, se regenera DROPSIZE en la misma ejecución. El Listado Vendedor–Supervisor continúa siendo opcional y, si no está guardado, se usa el listado precargado.

Este enfoque evita guardar resultados desactualizados: cualquier reemplazo de un archivo cambia su fecha de actualización y dispara nuevamente el procesamiento automático.
