---
name: modern-frontend
description: Aplica a cambios de React, Next.js, carga de datos, renderizado, navegación, accesibilidad y rendimiento web que requieran decisiones técnicas; omitir en ajustes visuales simples resueltos por AGENTS.md.
---

# Frontend moderno

1. Revisar AGENTS.md, versiones instaladas, componentes compartidos y consumidores. Respetar contratos y convenciones del framework vigente.
2. Identificar el cuello de botella antes de optimizar: red, JavaScript, renderizado o layout. Medir antes y después cuando corresponda.
3. Evitar consultas redundantes y carreras entre respuestas; acotar datos al contexto activo. Conservar filtros y navegación; invalidar cachés al cambiar datos o permisos. No persistir datos sensibles en almacenamiento local.
4. Mantener estado mínimo, claves estables y efectos con limpieza; usar memoización, paginación o virtualización cuando exista una necesidad medida. Evitar dependencias y abstracciones innecesarias.
5. Reutilizar controles del proyecto; comprobar HTML semántico, teclado, foco, contraste, responsive, movimiento reducido y estados de carga, vacío y error sin saltos de layout.
6. Verificar regresiones, tipos, lint, build y flujo real según corresponda; distinguir mediciones de estimaciones.

## Referencias bajo demanda

- https://github.com/GoogleChrome/modern-web-guidance
- https://web.dev/learn/performance/
- https://react.dev/learn
- https://nextjs.org/docs

Consultar sólo la guía pertinente si hay incertidumbre o APIs dependientes de versión. Priorizar documentación local de Next.js cuando AGENTS.md lo exija.
