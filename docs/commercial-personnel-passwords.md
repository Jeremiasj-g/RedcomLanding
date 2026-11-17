# Credenciales del personal comercial

## Alcance
Administración puede vincular explícitamente un registro de vendedor de DetallePersonal (sucursal + código + nombre) a una **cuenta de vendedor activa** de Supabase Auth. La tabla maestra y el Excel siguen siendo fuentes comerciales; **no almacenan contraseñas** ni crean cuentas.

## Activación
1. Aplicar `supabase/migrations/20261117_commercial_personnel_account_links.sql` en el proyecto de Supabase autorizado.
2. En `/admin/personal-comercial` usar el ícono de vínculo en una fila con cargo VENDEDOR para seleccionar una cuenta real. Revisar nombre y correo antes de guardar.
3. Con la cuenta vinculada, usar los controles de clave manual o generada.
4. La acción general genera una contraseña distinta para **cada vendedor vinculado**. Los vendedores sin cuenta vinculada quedan expresamente excluidos.
5. Copiar las credenciales mostradas al finalizar. Se enseñan **una sola vez**, no se conservan en PostgreSQL, Storage, el Excel, logs ni localStorage. La comunicación por correo queda fuera de este cambio.

## Seguridad
- No inferir una cuenta usando sólo nombres o códigos: podrían existir coincidencias entre sucursales.
- No sobrescribir usuarios de rol supervisor, RRHH, JDV o admin.
- El vínculo requiere admin activo y una cuenta activa de rol `vendedor` mediante RLS, con FK a `auth.users`.
- Antes de cada operación se vuelve a verificar el vínculo y el rol actuales.
- El cambio de clave usa la Edge Function existente `admin_set_password` y sus controles de administrador.
- El procedimiento masivo reporta éxitos y errores por usuario; las fallas no se ocultan. Se confirma antes de iniciar.
- El botón no envía correos ni crea usuarios faltantes. Una futura función de envíos debe usar un canal privado aprobado.
- Las contraseñas temporales reemplazan contraseñas previas y podrían afectar los inicios de sesión siguientes.
- No publicar capturas, planillas o comentarios de PR que contengan credenciales.

## Auditoría de AGENTS.md
- Filtros individuales para cada campo original, combinables; ordenamiento y paginación: reutilizados.
- Tabla completa en cinco grupos + acciones, sin scroll horizontal en escritorio; filas apiladas en móvil.
- Skeleton de filas y acciones, estados vacíos y errores, confirmaciones reutilizadas.
- Confirmación de descartes en formularios y credenciales.
- Filtros, búsqueda, orden y página conservados temporalmente en sessionStorage al navegar.
- Pendiente de prueba manual: apariencia real, interacción por teclado, filtros combinados, y ejecución controlada del servicio de claves en un usuario de prueba.
