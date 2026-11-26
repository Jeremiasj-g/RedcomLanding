---
name: supabase-postgres
description: Usar para consultas SQL, RPC, RLS, índices, migraciones, diseño de datos, concurrencia e investigación de rendimiento en Supabase y PostgreSQL.
---

# Supabase y PostgreSQL

1. Inspeccionar esquema vigente, consultas, consumidores, restricciones, índices y políticas; no inferirlos de documentación antigua.
2. Medir cuellos de botella con estadísticas y EXPLAIN; EXPLAIN ANALYZE ejecuta la consulta, por lo que usar lecturas seguras o un entorno de prueba. Comparar con el rol real autorizado.
3. Filtrar y agregar en servidor, seleccionar sólo campos necesarios y evitar N+1. Evaluar índices según predicados, joins y orden reales; medir costo de escritura antes de añadirlos.
4. Mantener RLS y mínimo privilegio. Evitar evaluaciones repetidas de permisos independientes de la fila cuando sea seguro; comprobar equivalencia por roles y sucursales. Preferir SECURITY INVOKER; funciones privilegiadas requieren justificación, search_path seguro y permisos explícitos.
5. Preservar integridad con restricciones, transacciones atómicas, idempotencia y trazabilidad. No modificar datos productivos ni históricos sin autorización expresa.
6. Versionar migraciones, preparar reversión, comprobar dependencias, permisos y resultados. Verificar casos permitidos y denegados y medir el efecto real; no ocultar lentitud elevando timeouts sin diagnóstico.

## Referencias bajo demanda

- https://github.com/supabase-community/supabase-plugin
- https://supabase.com/docs/guides/database/query-optimization
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://www.postgresql.org/docs/current/using-explain.html

Consultar sólo reglas pertinentes y documentación compatible con las versiones del proyecto.
