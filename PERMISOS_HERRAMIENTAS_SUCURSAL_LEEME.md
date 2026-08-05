# Permisos dinámicos para herramientas de sucursal

Esta versión elimina la dependencia de listas estáticas de roles como `ALL_ROLES`, `INTERNAL_ROLES` y validaciones manuales de `canSeeAnalytics`.

## Instalación en Supabase

Ejecutar una sola vez en **Supabase → SQL Editor**:

```text
PERMISOS_HERRAMIENTAS_SUCURSAL_BD.sql
```

El mismo script se encuentra en:

```text
supabase/migrations/20260805_branch_resource_permissions.sql
```

La migración agrega estos permisos administrables:

- Categorías por sucursal.
- Horarios SIGO.
- Planilla de compradores.
- Coberturas.
- Facturación.
- Avance y objetivos.
- Novedades operativas.
- Críticos y vencimientos.
- Cuentas corrientes.
- Kilos y bultos.
- Analítica comercial.

## Configuración

Ingresar en:

```text
Panel de administrador → Permisos
```

La sección **Herramientas de sucursal** aparece tanto en:

- **Permisos por usuario**, para crear excepciones individuales.
- **Predeterminados por rol**, para definir el acceso automático de usuarios nuevos y existentes que no tengan una excepción.

Las excepciones individuales prevalecen sobre los permisos predeterminados del rol.

## Roles nuevos

Los roles creados desde el CRUD reciben los 23 permisos administrables:

- Si se elige una plantilla, copian la configuración del rol seleccionado.
- Si no se elige una plantilla, comienzan con todos los permisos deshabilitados.
- Luego pueden configurarse desde el mismo panel de permisos.

## Sucursales

Los permisos de módulo no reemplazan la asignación de sucursales. Para acceder a una herramienta, el usuario necesita:

1. Tener acceso al módulo correspondiente.
2. Tener asignada la sucursal desde la administración de usuarios.
