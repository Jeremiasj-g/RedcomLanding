# Perfil de vendedor · Categorías V 2.0

## Identidad y acceso
La cuenta comercial representa el **código + sucursal**, no el nombre ni el UUID de la persona actual. El RPC `my_commercial_vendor_category_v2(p_month)` identifica el código exclusivamente por `auth.uid()` y `commercial_vendor_accounts`; **no recibe códigos ni sucursales arbitrarias**. Devuelve solamente la fila KPI, proyección, horarios y datos de escala relacionados con ese código. Requiere sesión vigente y `commercial_vendor_membership_active`. Usuarios de otros roles no pueden usar ese RPC.

## Página Perfil
- Navegación local en tabs **Perfil** y **Categoría** para cuentas gestionadas por DetallePersonal. Resto de usuarios conserva su Perfil normal.
- El tab Categoría muestra categoría del mes seleccionado y del mes calendario anterior (si hay datos V2); el filtro ofrece meses efectivamente disponibles desde octubre de 2026.
- La comparación de puntajes utiliza **el mismo `SellerTierComparison` y `assessSellerCategory` de Categorías V2**, no una fórmula alternativa; se puede abrir el modal `SellerScoreDialog` para Datos + cálculos y exportar.
- Para Casa Central se busca en los dos alcances históricos (Masivos/Refrigerados), por `seller_id` y sucursal, incluso si el código cambió de fuerza de venta. El RPC no devuelve filas de otros vendedores.
- El nombre antiguo que eventualmente aparezca en el registro mensual corresponde al titular de ese período. El progreso mostrado es del **código/puesto comercial**, no necesariamente del empleado actual.
- La navegación entre tabs conserva el mes consultado. Se usa skeleton para mantener dimensiones durante la carga.

## Cambio de contraseña
En Perfil se exige la contraseña anterior, la nueva y su confirmación. Antes de modificarla se valida la anterior directamente con `supabase.auth.signInWithPassword` usando el email de la sesión; solo tras éxito se llama `supabase.auth.updateUser`. No se guardan contraseñas en SQL, archivos ni logs. El formulario mantiene requisitos mínimos existentes del perfil.

## Validaciones
- Migración `20261117_my_commercial_vendor_category_v2.sql` crea un RPC de lectura acotada; no cambia otros módulos ni publica más datos.
- Verificar TypeScript, ESLint, build Vercel, lectura de octubre/noviembre, selección mensual, modal de comparación y rechazo de contraseña anterior incorrecta.
- Probar con un usuario vendedor y un rol distinto antes de fusionar a main.
