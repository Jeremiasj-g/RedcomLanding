# Socket.IO para Tableros Redcom

Esta versión usa una arquitectura parecida a Trello:

1. **Optimistic UI**: el cliente actualiza la pantalla al instante.
2. **WebSocket / Socket.IO**: los cambios se transmiten a otros usuarios conectados al mismo tablero.
3. **Caché en memoria**: el servidor Socket.IO guarda el estado desnormalizado del tablero en RAM.
4. **Snapshot jsonb opcional**: PostgreSQL sigue siendo relacional, pero se guarda una copia `jsonb` del tablero completo en `trello_board_snapshots` para levantar rápido el caché si el servidor se reinicia.

## 1. Ejecutar SQL

Ejecutá este archivo en Supabase:

```txt
components/trello/db/20260618_trello_socket_cache_snapshots.sql
```

## 2. Variables de entorno

En `.env.local`:

```env
NEXT_PUBLIC_TRELLO_SOCKET_URL=http://localhost:4001
TRELLO_SOCKET_PORT=4001
TRELLO_SOCKET_CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001

# Para que el servidor Socket.IO persista snapshots jsonb.
# Usar service role SOLO del lado servidor, nunca exponerlo en el navegador.
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
TRELLO_SOCKET_CACHE_TTL_MS=28800000
```

Si no ponés `SUPABASE_SERVICE_ROLE_KEY`, Socket.IO igual funciona con caché RAM, pero los snapshots no se guardan en Postgres.

## 3. Ejecutar en local

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:socket
```

Probar salud del socket:

```txt
http://localhost:4001/health
```

Ver caché en memoria:

```txt
http://localhost:4001/cache
```

## Nota importante

Las tablas relacionales `trello_*` siguen siendo la fuente de verdad. El snapshot jsonb es una copia rápida para UX/realtime, no reemplaza las tablas.
