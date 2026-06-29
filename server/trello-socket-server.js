/* eslint-disable no-console */
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const port = Number(process.env.TRELLO_SOCKET_PORT || 4001);
const allowedOrigins = (process.env.TRELLO_SOCKET_CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const CACHE_TTL_MS = Number(process.env.TRELLO_SOCKET_CACHE_TTL_MS || 1000 * 60 * 60 * 8);
const boardCache = new Map();

const boardRoom = (boardId) => `trello:board:${boardId}`;
const workspacesRoom = 'trello:workspaces';

function nowIso() {
  return new Date().toISOString();
}

function cleanExpiredCache() {
  const now = Date.now();
  for (const [boardId, entry] of boardCache.entries()) {
    if (now - entry.cachedAt > CACHE_TTL_MS) boardCache.delete(boardId);
  }
}

setInterval(cleanExpiredCache, Math.min(CACHE_TTL_MS, 1000 * 60 * 15)).unref?.();

function normalizeSnapshot(snapshot, clientId) {
  if (!snapshot?.boardId) return null;
  return {
    boardId: snapshot.boardId,
    workspaceId: snapshot.workspaceId || snapshot.board?.workspaceId,
    board: snapshot.board,
    lists: Array.isArray(snapshot.lists) ? snapshot.lists : [],
    labels: Array.isArray(snapshot.labels) ? snapshot.labels : [],
    members: Array.isArray(snapshot.members) ? snapshot.members : [],
    messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
    version: Number(snapshot.version || Date.now()),
    sourceClientId: clientId || snapshot.sourceClientId,
    updatedAt: snapshot.updatedAt || nowIso(),
  };
}

function mergeSnapshotPatch(currentSnapshot, patch, clientId) {
  if (!patch?.boardId) return null;
  const base = currentSnapshot || {
    boardId: patch.boardId,
    workspaceId: patch.workspaceId,
    lists: [],
    labels: [],
    members: [],
    messages: [],
    version: 0,
    updatedAt: nowIso(),
  };

  return normalizeSnapshot({
    ...base,
    ...patch,
    version: Number(patch.version || Date.now()),
    updatedAt: patch.updatedAt || nowIso(),
  }, clientId);
}

function setCache(snapshot) {
  if (!snapshot?.boardId) return null;
  boardCache.set(snapshot.boardId, {
    snapshot,
    cachedAt: Date.now(),
  });
  return snapshot;
}

async function loadSnapshotFromDatabase(boardId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('trello_board_snapshots')
    .select('snapshot')
    .eq('board_id', boardId)
    .maybeSingle();

  if (error) {
    console.warn(`[Trello Socket] No se pudo leer snapshot ${boardId}:`, error.message);
    return null;
  }

  return data?.snapshot || null;
}

async function persistSnapshot(snapshot) {
  if (!supabase || !snapshot?.boardId) return;
  const { error } = await supabase
    .from('trello_board_snapshots')
    .upsert({
      board_id: snapshot.boardId,
      workspace_id: snapshot.workspaceId || null,
      snapshot,
      version: snapshot.version || Date.now(),
      updated_at: nowIso(),
    }, { onConflict: 'board_id' });

  if (error) {
    console.warn(`[Trello Socket] No se pudo persistir snapshot ${snapshot.boardId}:`, error.message);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'redcom-trello-socket',
      uptime: process.uptime(),
      cacheEntries: boardCache.size,
      denormalizedSnapshots: Boolean(supabase),
    }));
    return;
  }

  if (req.url === '/cache') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      entries: Array.from(boardCache.entries()).map(([boardId, entry]) => ({
        boardId,
        cachedAt: new Date(entry.cachedAt).toISOString(),
        version: entry.snapshot?.version,
      })),
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Redcom Trello Socket.IO server');
});

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin no permitido por Socket.IO: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  const clientId = socket.handshake.auth?.clientId || socket.id;
  console.log(`[Trello Socket] conectado ${socket.id} (${clientId})`);

  socket.on('trello:join-workspaces', () => {
    socket.join(workspacesRoom);
  });

  socket.on('trello:leave-workspaces', () => {
    socket.leave(workspacesRoom);
  });

  socket.on('trello:join-board', ({ boardId }) => {
    if (!boardId) return;
    socket.join(boardRoom(boardId));
  });

  socket.on('trello:leave-board', ({ boardId }) => {
    if (!boardId) return;
    socket.leave(boardRoom(boardId));
  });

  socket.on('trello:workspace-changed', (payload = {}) => {
    socket.to(workspacesRoom).emit('trello:workspace-changed', {
      ...payload,
      clientId: payload.clientId || clientId,
      createdAt: payload.createdAt || nowIso(),
    });
  });

  socket.on('trello:board-changed', (payload = {}) => {
    if (!payload.boardId) return;
    socket.to(boardRoom(payload.boardId)).emit('trello:board-changed', {
      ...payload,
      clientId: payload.clientId || clientId,
      createdAt: payload.createdAt || nowIso(),
    });
  });

  socket.on('trello:board-message', (payload = {}) => {
    if (!payload.boardId) return;
    socket.to(boardRoom(payload.boardId)).emit('trello:board-message', {
      ...payload,
      clientId: payload.clientId || clientId,
      scope: 'message',
      createdAt: payload.createdAt || nowIso(),
    });
  });

  socket.on('trello:board-state:get', async (payload = {}, ack) => {
    const boardId = payload.boardId;
    if (!boardId) {
      ack?.({ ok: false, error: 'boardId requerido' });
      return;
    }

    let snapshot = boardCache.get(boardId)?.snapshot || null;
    if (!snapshot) {
      snapshot = await loadSnapshotFromDatabase(boardId);
      if (snapshot) setCache(snapshot);
    }

    ack?.({ ok: true, snapshot });
  });

  socket.on('trello:board-state:put', async (payload = {}) => {
    const snapshot = normalizeSnapshot(payload.snapshot, payload.clientId || clientId);
    if (!snapshot) return;

    setCache(snapshot);
    void persistSnapshot(snapshot);

    socket.to(boardRoom(snapshot.boardId)).emit('trello:board-state', {
      boardId: snapshot.boardId,
      workspaceId: snapshot.workspaceId,
      scope: 'snapshot',
      action: 'snapshot_put',
      snapshot,
      clientId: payload.clientId || clientId,
      createdAt: nowIso(),
    });
  });

  socket.on('trello:board-state:patch', async (payload = {}) => {
    const boardId = payload.boardId || payload.patch?.boardId;
    if (!boardId) return;

    const current = boardCache.get(boardId)?.snapshot || await loadSnapshotFromDatabase(boardId);
    const snapshot = mergeSnapshotPatch(current, { ...payload.patch, boardId }, payload.clientId || clientId);
    if (!snapshot) return;

    setCache(snapshot);
    void persistSnapshot(snapshot);

    socket.to(boardRoom(boardId)).emit('trello:board-state', {
      boardId,
      workspaceId: snapshot.workspaceId,
      scope: 'patch',
      action: 'snapshot_patch',
      patch: payload.patch,
      snapshot,
      clientId: payload.clientId || clientId,
      createdAt: nowIso(),
    });
  });

  socket.on('trello:board-state:invalidate', (payload = {}) => {
    if (!payload.boardId) return;
    boardCache.delete(payload.boardId);
    socket.to(boardRoom(payload.boardId)).emit('trello:board-state', {
      boardId: payload.boardId,
      scope: 'snapshot',
      action: 'snapshot_invalidate',
      clientId: payload.clientId || clientId,
      createdAt: nowIso(),
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Trello Socket] desconectado ${socket.id}: ${reason}`);
  });
});

server.listen(port, () => {
  console.log(`[Trello Socket] escuchando en http://localhost:${port}`);
  console.log(`[Trello Socket] CORS: ${allowedOrigins.join(', ')}`);
  console.log(`[Trello Socket] caché RAM TTL: ${CACHE_TTL_MS}ms`);
  console.log(`[Trello Socket] snapshots jsonb: ${supabase ? 'activados' : 'desactivados - falta SUPABASE_SERVICE_ROLE_KEY'}`);
});
