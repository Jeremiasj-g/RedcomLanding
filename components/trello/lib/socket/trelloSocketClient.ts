import { io, type Socket } from 'socket.io-client';
import type { TrelloBoardSnapshot, TrelloBoardSnapshotPatch } from '../../types/trello';

export type TrelloSocketChangeScope =
  | 'workspace'
  | 'board'
  | 'list'
  | 'card'
  | 'label'
  | 'member'
  | 'checklist'
  | 'comment'
  | 'message'
  | 'snapshot'
  | 'patch';

export interface TrelloSocketEventPayload {
  boardId?: string;
  workspaceId?: string;
  scope?: TrelloSocketChangeScope;
  action?: string;
  entityId?: string;
  clientId?: string;
  createdAt?: string;
  snapshot?: TrelloBoardSnapshot;
  patch?: TrelloBoardSnapshotPatch;
}

type Unsubscribe = () => void;

const socketUrl = process.env.NEXT_PUBLIC_TRELLO_SOCKET_URL;
const SOCKET_CLIENT_ID_KEY = 'redcom-trello:socket-client-id';

let socket: Socket | null = null;
let clientId: string | null = null;

function createClientId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = window.sessionStorage.getItem(SOCKET_CLIENT_ID_KEY);
  if (existing) return existing;
  const generated = `client-${crypto.randomUUID()}`;
  window.sessionStorage.setItem(SOCKET_CLIENT_ID_KEY, generated);
  return generated;
}

function getClientId(): string {
  if (!clientId) clientId = createClientId();
  return clientId;
}

function isEnabled(): boolean {
  return typeof window !== 'undefined' && Boolean(socketUrl);
}

function getSocket(): Socket | null {
  if (!isEnabled()) return null;
  if (socket) return socket;

  socket = io(socketUrl!, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
    timeout: 6000,
    auth: {
      clientId: getClientId(),
    },
  });

  socket.on('connect_error', (error) => {
    console.warn('[Tableros Socket.IO] No se pudo conectar al servidor realtime:', error.message);
  });

  return socket;
}

function shouldIgnoreOwnEvent(payload?: TrelloSocketEventPayload): boolean {
  return Boolean(payload?.clientId && payload.clientId === getClientId());
}

function emit(eventName: string, payload: TrelloSocketEventPayload): void {
  const activeSocket = getSocket();
  if (!activeSocket) return;
  activeSocket.emit(eventName, {
    ...payload,
    clientId: getClientId(),
    createdAt: payload.createdAt ?? new Date().toISOString(),
  });
}

function on(eventName: string, callback: (payload: TrelloSocketEventPayload) => void, ignoreOwnEvents = true): Unsubscribe {
  const activeSocket = getSocket();
  if (!activeSocket) return () => undefined;

  const listener = (payload: TrelloSocketEventPayload) => {
    if (ignoreOwnEvents && shouldIgnoreOwnEvent(payload)) return;
    callback(payload);
  };

  activeSocket.on(eventName, listener);
  return () => {
    activeSocket.off(eventName, listener);
  };
}

function emitWithAck<TResponse>(eventName: string, payload: Record<string, unknown>, timeoutMs = 1400): Promise<TResponse | null> {
  const activeSocket = getSocket();
  if (!activeSocket) return Promise.resolve(null);

  return new Promise((resolve) => {
    activeSocket.timeout(timeoutMs).emit(
      eventName,
      {
        ...payload,
        clientId: getClientId(),
        createdAt: new Date().toISOString(),
      },
      (error: Error | null, response?: TResponse) => {
        if (error) {
          console.warn(`[Tableros Socket.IO] ${eventName} no respondió a tiempo:`, error.message);
          resolve(null);
          return;
        }
        resolve(response ?? null);
      },
    );
  });
}

export const trelloSocketClient = {
  isEnabled,
  getClientId,

  joinBoard(boardId: string): Unsubscribe {
    const activeSocket = getSocket();
    if (!activeSocket) return () => undefined;

    activeSocket.emit('trello:join-board', { boardId, clientId: getClientId() });
    return () => {
      activeSocket.emit('trello:leave-board', { boardId, clientId: getClientId() });
    };
  },

  subscribeToBoard(boardId: string, callback: (payload: TrelloSocketEventPayload) => void): Unsubscribe {
    const leaveBoard = this.joinBoard(boardId);
    const unsubscribeChanged = on('trello:board-changed', (payload) => {
      if (payload.boardId === boardId) callback(payload);
    });
    const unsubscribeMessage = on('trello:board-message', (payload) => {
      if (payload.boardId === boardId) callback({ ...payload, scope: 'message' });
    });
    const unsubscribeSnapshot = on('trello:board-state', (payload) => {
      if (payload.boardId === boardId) callback({ ...payload, scope: payload.scope ?? 'snapshot' });
    });

    return () => {
      unsubscribeChanged();
      unsubscribeMessage();
      unsubscribeSnapshot();
      leaveBoard();
    };
  },

  subscribeToWorkspaceChanges(callback: (payload: TrelloSocketEventPayload) => void): Unsubscribe {
    const activeSocket = getSocket();
    if (!activeSocket) return () => undefined;
    activeSocket.emit('trello:join-workspaces', { clientId: getClientId() });

    const unsubscribe = on('trello:workspace-changed', callback);
    return () => {
      unsubscribe();
      activeSocket.emit('trello:leave-workspaces', { clientId: getClientId() });
    };
  },

  emitBoardChanged(payload: Omit<TrelloSocketEventPayload, 'clientId' | 'createdAt'>): void {
    if (!payload.boardId) return;
    emit('trello:board-changed', payload);
  },

  emitBoardMessage(payload: Omit<TrelloSocketEventPayload, 'clientId' | 'createdAt'>): void {
    if (!payload.boardId) return;
    emit('trello:board-message', { ...payload, scope: 'message' });
  },

  emitWorkspaceChanged(payload: Omit<TrelloSocketEventPayload, 'clientId' | 'createdAt'> = {}): void {
    emit('trello:workspace-changed', { ...payload, scope: 'workspace' });
  },

  async getBoardSnapshot(boardId: string): Promise<TrelloBoardSnapshot | null> {
    const response = await emitWithAck<{ ok: boolean; snapshot?: TrelloBoardSnapshot }>('trello:board-state:get', { boardId });
    return response?.ok && response.snapshot ? response.snapshot : null;
  },

  putBoardSnapshot(snapshot: TrelloBoardSnapshot): void {
    emit('trello:board-state:put', {
      boardId: snapshot.boardId,
      workspaceId: snapshot.workspaceId,
      scope: 'snapshot',
      action: 'snapshot_put',
      snapshot,
    });
  },

  patchBoardSnapshot(patch: TrelloBoardSnapshotPatch): void {
    emit('trello:board-state:patch', {
      boardId: patch.boardId,
      workspaceId: patch.workspaceId,
      scope: 'patch',
      action: 'snapshot_patch',
      patch,
    });
  },

  invalidateBoardSnapshot(boardId: string): void {
    emit('trello:board-state:invalidate', {
      boardId,
      scope: 'snapshot',
      action: 'snapshot_invalidate',
    });
  },
};
