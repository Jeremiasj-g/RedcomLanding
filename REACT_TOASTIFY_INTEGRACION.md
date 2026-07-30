# Notificaciones globales con React-Toastify

El contenedor global se monta una sola vez desde `app/layout.tsx` mediante:

```tsx
<ReactToastProvider />
```

Para mostrar mensajes desde cualquier componente cliente:

```tsx
import { errorMessage, notify } from '@/lib/notifications';

notify.success('Cambios guardados.');
notify.info('Archivo procesado.');
notify.warning('Completá los campos obligatorios.');
notify.error(errorMessage(error, 'No se pudo completar la acción.'));
```

Los runtimes JavaScript de CCC Calificados utilizan el puente global `window.__redcomToast` definido por el mismo proveedor.

## Archivos principales

- `components/providers/ReactToastProvider.tsx`
- `lib/notifications.ts`
- `app/globals.css`

No requiere migraciones ni cambios en Supabase.
