import { EventEmitter } from 'node:events';

export type RunEvent =
  | { type: 'log'; level: 'debug' | 'info' | 'warn' | 'error' | 'success'; message: string; ts: string; meta?: unknown }
  | { type: 'progress'; page: number; totalPages?: number; items: number; phase: string }
  | { type: 'items'; items: Record<string, unknown>[] }
  | { type: 'status'; status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled'; error?: string }
  | { type: 'done'; itemCount: number; pages: number; durationMs: number };

/**
 * In-process pub/sub for live run telemetry. Routes push these straight down an SSE
 * stream so the runner UI stays honest about what the engine is doing.
 */
class RunBus extends EventEmitter {
  private buffers = new Map<string, RunEvent[]>();
  private cancelled = new Set<string>();

  emitRun(runId: string, event: RunEvent) {
    const buffer = this.buffers.get(runId) ?? [];
    buffer.push(event);
    if (buffer.length > 800) buffer.splice(0, buffer.length - 800);
    this.buffers.set(runId, buffer);
    this.emit(runId, event);
  }

  replay(runId: string): RunEvent[] {
    return this.buffers.get(runId) ?? [];
  }

  cancel(runId: string) {
    this.cancelled.add(runId);
    this.emitRun(runId, { type: 'status', status: 'cancelled' });
  }

  isCancelled(runId: string) {
    return this.cancelled.has(runId);
  }

  clear(runId: string) {
    this.cancelled.delete(runId);
    this.buffers.delete(runId);
  }
}

export const runBus = new RunBus();
