# DetallePersonal maestro — RedcomWeb

## Objetivo
Una sola importación administrativa para CCC/MIX/DROPSIZE, Seguimiento SKUs FOCO y Panel de Categorías/Categorías V2. No se modifican las fórmulas comerciales.

## Activación en una rama de pruebas
1. Revisar AGENTS.md y el esquema existente.
2. Revisar y aplicar en orden las migraciones 20261116_central_commercial_personnel_master.sql y 20261116_central_personnel_v2_monthly_history.sql. No aplicarlas en producción hasta probar la rama.
3. Ingresar como administrador a /admin/personal-comercial, cargar el XLSX con Código, Descripción, Sucursal, Cargo y Superior; Fuerza de Venta opcional.
4. Previsualizar, confirmar y comparar varios vendedores y sucursales en CCC, SKUs FOCO, Categorías y Categorías V2.
5. Probar restauración de versión anterior y devolver la versión deseada.

## Contratos
- CCC sigue descargando el Excel original desde ccc-shared-files vía ccc_shared_files. Las instantáneas congeladas de CCC no se alteran.
- SKUs FOCO procesa las columnas originales y conserva las importaciones de ventas y objetivos; ya no escribe personal_storage_path.
- Categorías lee la estructura procesada en category_commercial_personnel. Único escritor: publish_commercial_personnel_master.
- Categorías V2 consulta commercial_personnel_monthly_versions y evita reemplazar jerarquías de períodos que ya tienen versión asignada.
- commercial_personnel_versions conserva el archivo y los registros procesados por versión; cada archivo Storage es inmutable.
- Meses previos a la primera importación centralizada mantienen la lectura anterior: no es posible reconstruir retroactivamente cambios pasados no registrados.
- Las nuevas cargas admiten XLSX. Los XLS ya existentes siguen disponibles para los consumidores que los lean.

## Seguridad
- Sólo administradores activos ejecutan las RPC de publicación y restauración; las escrituras directas de las tablas maestras se revocan.
- Los archivos usan el bucket privado con RLS ya configurado en CCC.
- No ejecutar cambios de datos históricos ni desplegar migraciones productivas sin pruebas y autorización.

## Pruebas de aceptación
- [ ] Importación, previsualización, confirmación y conteos.
- [ ] Duplicados, datos inválidos y errores de red no alteran la versión anterior.
- [ ] CCC, MIX, DROPSIZE conservan resultados.
- [ ] SKUs FOCO conserva objetivos, cobertura, volumen y jerarquía.
- [ ] Categorías V2 conserva permisos, fuerzas de venta y versiones por mes.
- [ ] Usuario no admin no puede publicar, restaurar ni leer el historial.
- [ ] Restauración y exportación del archivo activo.
- [ ] Lint/build y prueba manual responsive.
## Consolidación de consumidores (noviembre de 2026)

La publicación de DetallePersonal se realiza exclusivamente en **Administración → Personal comercial**. Ya no se ofrecen importaciones o descargas del archivo de jerarquía en los consumidores.

- **CCC, MIX y DROPSIZE:** la jerarquía del dashboard sigue leyendo el XLSX original activo del registro global `ccc_shared_files` mediante `downloadSharedPersonalDetail`. Se retiraron los tipos obsoletos de carga local `personal_detail` y `seller_supervisor` del servicio de archivos por sucursal, sin eliminar archivos históricos ni cambiar las importaciones de ventas/base de clientes.
- **Seguimiento SKUs FOCO:** el Excel maestro se descarga automáticamente desde `downloadActivePersonnel` y se procesa como antes; se eliminó el botón adicional «Descargar archivo maestro». Se conservan las cargas y exportaciones de objetivos, líneas y artículos.
- **Categorías / Categorías V2:** se leen los registros del maestro publicado y, en V2, las versiones históricas asignadas por mes. Se quitó el acceso redundante a «Administrar DetallePersonal» desde el panel de Categorías; el árbol jerárquico, la tabla y los filtros se mantienen.

No se modificaron las tablas SQL, políticas RLS, datos productivos, versiones de archivo ni instantáneas CCC. Las descargas históricas de períodos congelados siguen utilizando los datos archivados originalmente y no deben sustituirse por el maestro actual.

Prueba de regresión requerida antes de fusionar: CCC/MIX/DROPSIZE (actual y congelado), dashboard SKUs FOCO con objetivos y jerarquía, Categorías con histórico mensual, y ausencia de controles locales de importación de DetallePersonal.
