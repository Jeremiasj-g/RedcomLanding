# Configuración dinámica de analítica

1. Ejecutar una sola vez `CONFIGURACION_ANALITICA_BD.sql` desde Supabase → SQL Editor.
2. Ingresar como administrador a **Panel de administrador → Analítica**.
3. Actualizar las URLs en las secciones **Dashboards**, **Mapas de calor** o **Tableros**.
4. Presionar **Guardar cambios**.

Cada sección y sucursal conserva una única fila en `analytics_embed_settings`. Al guardar una URL nueva se reemplaza la anterior; no se genera historial.

La migración carga como valores iniciales los enlaces que antes estaban escritos en `components/LookerEmbed.jsx`, `app/(protected)/gerencia/page.jsx` y `lib/data.js`. Puede ejecutarse nuevamente sin pisar configuraciones hechas desde el panel gracias a `ON CONFLICT DO NOTHING`.
