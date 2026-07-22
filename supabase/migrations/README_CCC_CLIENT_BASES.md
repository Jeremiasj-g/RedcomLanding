# CCC Calificados — base de clientes por sucursal

Antes de usar la carga persistente de la página `/ccc-calificados`, ejecutá en el SQL Editor de Supabase:

`20260722_ccc_client_bases.sql`

La migración crea:

- `public.ccc_client_bases`: metadatos, autor, fecha de carga y próximo vencimiento a 15 días.
- bucket privado `ccc-client-bases`: almacena el Excel de cada sucursal.
- políticas RLS basadas en `profiles.role` y `user_branches`.

Cada sucursal conserva una sola versión vigente. Una nueva carga reemplaza el archivo anterior y reinicia el contador de 15 días. Los roles `admin`, `jdv` y `supervisor` pueden leer y actualizar únicamente las sucursales habilitadas; `admin` tiene acceso global.
