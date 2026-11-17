# Contraseñas de Personal comercial

La implementación antigua que vinculaba cada vendedor a un usuario **ya existente en el CRUD** fue reemplazada.

El flujo vigente mantiene **identidades de acceso comerciales independientes** basadas en el padrón DetallePersonal. Consultar la documentación actualizada:

- [Acceso comercial independiente](./commercial-vendor-auth.md)

No usar `commercial_personnel_account_links` para nuevas altas: se conserva temporalmente como tabla histórica sin consumidores para evitar cambios destructivos en producción.
