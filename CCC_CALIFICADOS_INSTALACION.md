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
