# Plan de acción de solo lectura para vendedores

## Modelo
- El histórico de Categorías continúa vinculado a `(branch_key,seller_id)`, tal como lo usa el editor existente de Proyectos.
- Una segunda asignación explícita vincula la cuenta técnica comercial (`viewer_auth_user_id`) y registra el **nombre del titular** al asignarla (`assigned_holder_name`) en `project_task_action_plans`.
- En una rotación, la cuenta técnica permanece estable por código, pero cambia su titular. Los planes del titular anterior **no se muestran automáticamente al nuevo ocupante** porque el RPC exige coincidencia exacta entre `assigned_holder_name` y `commercial_vendor_accounts.person_name`.
- No se vinculan de forma automática los planes antiguos: el supervisor debe confirmar la asignación con la cuenta comercial del mismo código y sucursal. Cambiar el vendedor histórico invalida la asignación anterior.
- La funcionalidad de edición, tareas, calendarios, checklist y responsabilidades en Proyectos permanece igual.

## Vista del vendedor
- En `/perfil`, los vendedores de Personal comercial tienen **Perfil, Categoría y Mi plan**.
- Mi plan muestra solo las tareas/planes vinculados a la cuenta y titular actual: estado, fecha límite, avance por checklist, resumen, descripción y acciones completas/pendientes.
- Es **solo lectura**; no se habilita acceso a la vista administrativa de Proyectos, edición ni consultas generales de RRHH.
- La RPC `my_vendor_action_plans()` usa `auth.uid()` y `commercial_vendor_membership_active`; **no recibe un ID de usuario ni un ID de tarea controlable por el cliente**. La autorización se verifica en PostgreSQL. No añade RLS de lectura general sobre `project_tasks` o sus espacios de trabajo.
- El porcentaje usa `round(checklist_done/checklist_total * 100)` como RRHH. Sin checklist se muestra «Sin acciones», no 100%.

## Administración
- En Proyectos → Plan de acción, al seleccionar el histórico, se abre una segunda sección «Vendedor con acceso al plan».
- Las opciones se consultan de `commercial_vendor_accounts` y `profiles`, se filtran por la sucursal y el código histórico, y se confirma expresamente la vinculación. Solo admin/JDV/supervisor con permisos reales de edición.
- El backend comprueba el código comercial, el alcance y la cuenta activa antes de persistir; permite retirar la vinculación.
- Errores de red y estados sin cuenta disponible son explícitos; nunca se simula éxito al fallar.

## Despliegue y compatibilidad
- Migración: `supabase/migrations/20261118_vendor_action_plan_readonly_access.sql`.
- Aditiva, no migra ni actualiza las asignaciones históricas; índice sobre `viewer_auth_user_id`.
- Se aplicó al Supabase conectado para probar la rama. No se asignaron planes reales durante la implementación.
- No afecta `rrhh_list_action_plans` ni los permisos existentes de RRHH.
- Si se decide revertir, retirar los controles y RPC de lectura/vinculación y, tras verificar que no se pierden asignaciones reales, considerar eliminar las dos columnas nuevas por una migración separada.

## Pruebas
- SQL reversible: usuario vendedor autorizado ve exclusivamente su plan; otra cuenta no ve ninguno; asignación de vendedor con código distinto es rechazada; toda la prueba se revierte.
- SQL: usuarios anónimos no tienen permiso EXECUTE; candidatos requieren rol autorizado y permiso de edición.
- Verificar visualmente en localhost: vista móvil, edición de histórico → asignación de cuenta, cambio de histórico invalida vinculación, lectura del avance en Perfil, actualización de checklist desde Proyectos y refresco desde Perfil.
- Antes de fusionar a main: TypeScript, ESLint, build de Vercel y prueba de un vendedor real.

## Vista ampliada y grupos del checklist (18-11-2026)

- La tarjeta de `Perfil → Mi plan` incorpora estado del proyecto, prioridad, sucursal, código, inicio, vencimiento, descripción del proyecto y responsables (solo nombres y roles autorizados; nunca correos técnicos).
- Los checklist agrupados usan el **mismo decodificador** `decodeTodoLabel` que RRHH; se extrajo a `lib/projectActionPlanGroups.ts`. El formato persistido `§§RUTAS§§ 101` se muestra como el grupo **RUTAS** y el ítem **101**. No se reescribe información guardada.
- Cada grupo calcula su progreso a partir de los estados `done` de sus acciones. El progreso general mantiene la fórmula actual compartida con RRHH.
- El RPC `my_vendor_action_plans` sigue identificado por `auth.uid()` y la misma validación de código, sucursal y titular; se amplían únicamente campos existentes del proyecto y nombres de responsables de roles administrativos. Ninguna tabla de Proyectos concede SELECT/UPDATE directo a vendedores.
- Migración aditiva `20261118_vendor_action_plan_more_details.sql` aplicada y validada en Supabase. Prueba con un vendedor vinculado: campos presentes, JSON de grupos/responsables correcto; otra cuenta no tiene acceso a su plan. No hubo cambios en planes reales.
- La vista mantiene mobile-first, skeletons, estados vacío/error y solo lectura. Falta validación visual con cuenta real.
