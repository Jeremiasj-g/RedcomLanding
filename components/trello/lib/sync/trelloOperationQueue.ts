export type TrelloOperationStatus = 'idle' | 'queued' | 'syncing' | 'error';

export interface TrelloSyncStatus {
  state: TrelloOperationStatus;
  pendingCount: number;
  inflightCount: number;
  version: number;
  lastSyncedAt?: number;
  lastError?: string;
}

type OperationContext = {
  id: string;
  sequence: number;
  clientVersion: number;
  createdAt: number;
  dedupeKey?: string;
};

export type TrelloQueuedOperation = OperationContext & {
  label: string;
  entityIds?: string[];
  execute: (context: OperationContext) => Promise<void>;
  rollback?: (context: OperationContext) => void;
  onSuccess?: (context: OperationContext) => void;
  onError?: (error: unknown, context: OperationContext) => void;
  resolve: () => void;
  reject: (error: unknown) => void;
};

interface TrelloOperationQueueOptions {
  batchSize?: number;
  debounceMs?: number;
  onStatusChange?: (status: TrelloSyncStatus) => void;
  onBackgroundError?: (error: unknown, operation: TrelloQueuedOperation) => void;
}

const INITIAL_STATUS: TrelloSyncStatus = {
  state: 'idle',
  pendingCount: 0,
  inflightCount: 0,
  version: 0,
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'No se pudo sincronizar la operación.';
}

export class TrelloOperationQueue {
  private queue: TrelloQueuedOperation[] = [];
  private processing = false;
  private nextOperationId = 0;
  private nextSequence = 0;
  private clientVersion = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private status: TrelloSyncStatus = INITIAL_STATUS;
  private latestSequenceByKey = new Map<string, number>();
  private readonly batchSize: number;
  private readonly debounceMs: number;
  private readonly onStatusChange?: (status: TrelloSyncStatus) => void;
  private readonly onBackgroundError?: (error: unknown, operation: TrelloQueuedOperation) => void;

  constructor(options: TrelloOperationQueueOptions = {}) {
    this.batchSize = options.batchSize ?? 5;
    this.debounceMs = options.debounceMs ?? 140;
    this.onStatusChange = options.onStatusChange;
    this.onBackgroundError = options.onBackgroundError;
    this.publishStatus('idle');
  }

  getStatus(): TrelloSyncStatus {
    return this.status;
  }

  addOperation(input: Omit<TrelloQueuedOperation, 'id' | 'sequence' | 'clientVersion' | 'createdAt' | 'resolve' | 'reject'>): Promise<void> {
    const operationId = `op-${Date.now()}-${++this.nextOperationId}`;
    const sequence = ++this.nextSequence;
    const operation: TrelloQueuedOperation = {
      ...input,
      id: operationId,
      sequence,
      clientVersion: ++this.clientVersion,
      createdAt: Date.now(),
      resolve: () => undefined,
      reject: () => undefined,
    };

    if (operation.dedupeKey) {
      this.latestSequenceByKey.set(operation.dedupeKey, sequence);
      const replaced = this.queue.filter((queuedOperation) => queuedOperation.dedupeKey === operation.dedupeKey);
      this.queue = this.queue.filter((queuedOperation) => queuedOperation.dedupeKey !== operation.dedupeKey);
      replaced.forEach((queuedOperation) => queuedOperation.resolve());
    }

    const promise = new Promise<void>((resolve, reject) => {
      operation.resolve = resolve;
      operation.reject = reject;
      this.queue.push(operation);
      this.publishStatus('queued');
      this.scheduleFlush();
    });

    return promise;
  }

  flushNow(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    void this.processQueue();
  }

  clear(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this.queue.forEach((operation) => operation.resolve());
    this.queue = [];
    this.processing = false;
    this.publishStatus('idle');
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.processQueue();
    }, this.debounceMs);
  }

  private isLatest(operation: TrelloQueuedOperation): boolean {
    if (!operation.dedupeKey) return true;
    return this.latestSequenceByKey.get(operation.dedupeKey) === operation.sequence;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      this.publishStatus(this.queue.length > 0 ? 'queued' : 'idle');
      return;
    }

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);
    this.publishStatus('syncing', batch.length);

    for (const operation of batch) {
      try {
        await operation.execute(operation);
        if (this.isLatest(operation)) operation.onSuccess?.(operation);
        operation.resolve();
      } catch (error) {
        if (this.isLatest(operation)) {
          operation.rollback?.(operation);
          operation.onError?.(error, operation);
          this.onBackgroundError?.(error, operation);
          this.publishStatus('error', 0, getErrorMessage(error));
          operation.reject(error);
        } else {
          operation.resolve();
        }
      }
    }

    this.processing = false;

    if (this.queue.length > 0) {
      this.scheduleFlush();
      this.publishStatus('queued');
      return;
    }

    this.publishStatus('idle', 0);
  }

  private publishStatus(state: TrelloOperationStatus, inflightCount = 0, lastError?: string): void {
    this.status = {
      state,
      pendingCount: this.queue.length,
      inflightCount,
      version: this.clientVersion,
      lastSyncedAt: state === 'idle' ? Date.now() : this.status.lastSyncedAt,
      lastError: lastError ?? (state === 'error' ? this.status.lastError : undefined),
    };
    this.onStatusChange?.(this.status);
  }
}
