# AGENTS.md — RedcomWeb

Estas reglas aplican a todo el repositorio (pantallas, modales, componentes y cambios nuevos). Antes de modificar una interfaz, revisar los componentes existentes y seguir estas pautas. Si una indicación explícita del pedido exige otra solución, respetarla sin cambiar funcionalidades ajenas.

## 1. Identidad visual
- Estilo Apple: minimalista, profesional, limpio, consistente y **mobile-first**. Priorizar legibilidad, jerarquía visual, espacios generosos y distribución intuitiva.
- Información breve, precisa y útil. **No agregar subtítulos decorativos**, etiquetas superiores, textos repetitivos ni descripciones obvias debajo de cada título. Conservar únicamente textos necesarios para comprender o utilizar la función.
- Evitar tarjetas dentro de tarjetas, contenedores anidados visibles, bordes repetidos y ruido visual. Preferir espacios, divisores discretos y superficies simples.
- No usar numeraciones decorativas (01, 02, etc.) salvo que indiquen pasos reales.
- Pesos de fuente **400 a 600** en toda la interfaz; los **h1** pueden superar 600 si lo justifica la composición. Evitar `font-bold`, `font-extrabold` y `font-black` fuera de esa excepción.
- Paleta neutra por defecto: blancos, grises suaves y negros no puros. Sombras sutiles pero perceptibles; bordes finos y radios consistentes. Evitar degradados o colores llamativos sin propósito.
- Usar colores por significado: verde para confirmar/éxito, rojo para eliminar o errores, ámbar para advertencias, azul para información y neutros para navegación. No hacer todos los botones negros: su apariencia debe expresar su acción.
- Usar `lucide-react` y tamaños/espaciados coherentes; evitar iconos únicamente decorativos.

## 2. Componentes compartidos
- **Dropdowns y selectores:** reutilizar primero `components/ui/redcom-select.tsx` (basado en `@radix-ui/react-select`, `@radix-ui/react-popover` y `cmdk`, según la variante). Mantener el patrón visual de selector moderno: trigger simple, indicador a la derecha, lista flotante con sombra, selección clara, soporte de teclado, búsqueda cuando corresponda y ajuste al viewport. Tomar como referencia de interacción `src/shared/components/ui/Select.tsx` del proyecto La Central Burger, pero conservar la paleta neutra de REDCOM, **no** copiar sus colores de marca.
- **Calendarios y selectores de fecha:** reutilizar y adaptar `components/ui/calendar.tsx` (basado en `react-day-picker`) y los controles de fecha existentes. Como referencia de experiencia, seguir el `DatePickerField` de La Central Burger: popover flotante bien posicionado, navegación intuitiva de mes/año, días alineados, semana comenzando en lunes cuando corresponda, fecha seleccionada claramente, compatibilidad móvil y animación breve. No copiar colores de marca ni crear un calendario diferente para cada módulo.
- Antes de crear dropdowns, date pickers, popovers, modales, inputs, tablas o botones, **buscar un componente reutilizable**. Extenderlo si hace falta, sin duplicar lógica ni introducir bibliotecas alternativas innecesariamente.
- Formularios: etiquetas claras, tamaños cómodos, estados de error/carga/deshabilitado visibles, controles accesibles y valores con formatos locales apropiados (`es-AR` cuando corresponda).

## 3. Interacciones y organización
- Transiciones y animaciones discretas de **200 ms** (entradas, tabs, dropdowns, modales, hover), respetando `prefers-reduced-motion`; evitar movimientos exagerados o apariciones bruscas.
- Modales: encabezado claro, contenido ordenado, pocos adornos, scroll interno cuando sea necesario y acciones identificables. Confirmar operaciones destructivas.
- Tabs y filtros: navegación simple, estado activo claro y componentes visualmente consistentes entre módulos.
- Tablas: priorizar que se lean completas en escritorio, sin scroll horizontal **cuando sea viable**. Reducir espacios, permitir salto de línea y adaptar la presentación a móvil sin volver los datos ilegibles. Usar edición en línea cuando sea apropiado y mostrar qué filas tienen cambios.
- En formularios con cambios pendientes, advertir antes de salir o cambiar de sección. Usar una modal propia minimalista para navegación interna cuando sea posible; para cerrar/recargar el navegador, usar el aviso nativo.
- Mantener acciones frecuentes (por ejemplo, Guardar cambios) visibles con sticky si la página es larga y no tapa contenido.
- Mostrar estados vacíos, loading y errores claros; no inventar valores ni colocar datos estáticos cuando hay fuentes reales.

## 4. Mantener funcionalidad y consistencia
- Un cambio **solo visual** no debe alterar cálculos, permisos, roles, RLS, importaciones, rutas, modelos de datos ni lógica de negocio.
- Conservar el comportamiento existente salvo pedido explícito. No reemplazar implementaciones funcionales por prototipos.
- Para permisos, estados y datos compartidos, reutilizar la fuente de verdad existente; evitar dos lógicas distintas para la misma función.
- Si se modifica un patrón visual compartido, buscar otros lugares donde se use y mantener consistencia sin rediseñar módulos fuera del alcance.

## 5. Flujo de trabajo
1. Leer este archivo y revisar los componentes y convenciones del módulo antes de editar.
2. Identificar el alcance funcional y la rama indicada por el usuario. **No cambiar de rama ni subir a `main` por iniciativa propia.**
3. Aplicar el cambio más pequeño y reutilizable posible; evitar dependencias y código duplicado.
4. Completar y revisar **todos los cambios del pedido antes de publicar**. Agruparlos en **un único commit y un único push por pedido y rama**; no crear un commit por archivo o corrección intermedia. Evitar commits vacíos, pushes de prueba y despliegues innecesarios.
5. Verificar tipos, lint y build cuando el entorno lo permita; revisar responsive, accesibilidad y estados interactivos **antes del único push**. Si hace falta corregir algo, hacerlo antes de publicar.
6. En `main`, extremar el cuidado con los pushes porque pueden disparar builds de Vercel y consumir cuota. Trabajar en ramas de pruebas cuando corresponda, pero comprobar su configuración de despliegue: estar fuera de `main` no garantiza que Vercel no genere previews.
7. Reportar qué se modificó, en qué rama/commit y qué validaciones se ejecutaron realmente. No afirmar que un despliegue o prueba pasó sin comprobarlo.
