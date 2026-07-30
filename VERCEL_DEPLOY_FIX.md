# Corrección de despliegue en Vercel

Cambios aplicados:

- Vercel instala dependencias con `npm ci` desde `vercel.json`, evitando reutilizar un `node_modules` incoherente del caché.
- Antes de cada build se elimina `.next` mediante `scripts/clean-next-cache.js`.
- Se quitó `isomorphic-dompurify` y sus tipos porque no se utilizaban en el código activo y arrastraban `jsdom`/`parse5` innecesariamente.
- Los módulos nativos opcionales `bufferutil` y `utf-8-validate` se deshabilitan en Webpack para evitar advertencias de `ws`.

No requiere cambios en Supabase.
