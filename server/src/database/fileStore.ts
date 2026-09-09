import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { ApiError, keySchema } from '../validation.js';

const MAX_ENTRIES = 10000;
const MAX_BYTES = 32 * 1024 * 1024;
type Replay<T> = { key: string; hash: string } & ({ data: T } | { receipt: unknown });
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

// One process per file. Entity and original replay response commit in one rename.
// Never evict keys silently: old offline retries must not create new records.
export class FileStore<T extends { id: string }> {
  private state: { records: T[]; replays: Replay<T>[] } | undefined;
  private pending = new Map<string, { hash: string; compact: boolean; result: Promise<unknown> }>();
  constructor(private path: string) {}
  private load() {
    if (!this.state) {
      try {
        if (existsSync(this.path) && statSync(this.path).size > MAX_BYTES) throw new Error('Store too large');
        const data = existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : { records: [], replays: [] };
        if (!Array.isArray(data.records) || !Array.isArray(data.replays)) throw new Error('Invalid store');
        this.state = data;
      } catch { throw new ApiError(503, 'Local store unavailable; no write confirmed'); }
    }
    return this.state!;
  }
  all(): T[] { return structuredClone(this.load().records); }
  get(id: string): T | undefined { return this.all().find(row => row.id === id); }
  save(record: T, replay?: Replay<T>) {
    const next = structuredClone(this.load());
    const index = next.records.findIndex(row => row.id === record.id);
    if (index < 0) next.records.push(record); else next.records[index] = record;
    if (replay) next.replays.push(replay);
    const json = JSON.stringify(next);
    if (next.records.length > MAX_ENTRIES || next.replays.length > MAX_ENTRIES || Buffer.byteLength(json) > MAX_BYTES) {
      throw new ApiError(503, 'Local store capacity reached; no write confirmed');
    }
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${process.pid}.tmp`;
      writeFileSync(temporary, json, { mode: 0o600 });
      renameSync(temporary, this.path);
      this.state = structuredClone(next);
    } catch { throw new ApiError(503, 'Local store unavailable; no write confirmed'); }
  }
  async transact<R = T>(keyInput: unknown, body: unknown, factory: () => T | Promise<T>, receipt?: (record: T) => R): Promise<{ data: R; replayed: boolean }> {
    const key = keySchema.parse(keyInput);
    const hash = createHash('sha256').update(canonical(body)).digest('hex');
    if (key) {
      const previous = this.load().replays.find(row => row.key === key);
      if (previous) {
        if (previous.hash !== hash) throw new ApiError(409, 'Idempotency-Key already used with a different request');
        if ('receipt' in previous) {
          if (!receipt) throw new ApiError(409, 'Idempotency-Key belongs to a compact receipt operation');
          return { data: structuredClone(previous.receipt) as R, replayed: true };
        }
        // Existing files contain full-record snapshots. Project the original snapshot,
        // not today's record, without discarding its key/hash or mutating stored history.
        const original = structuredClone(previous.data);
        return { data: (receipt ? receipt(original) : original) as R, replayed: true };
      }
      const pending = this.pending.get(key);
      if (pending) {
        if (pending.hash !== hash) throw new ApiError(409, 'Idempotency-Key already in use with a different request');
        if (pending.compact !== !!receipt) throw new ApiError(409, 'Idempotency-Key already in use with a different receipt format');
        return { data: structuredClone(await pending.result) as R, replayed: true };
      }
    }
    const result = Promise.resolve().then(async () => {
      // Synchronous mutations must read, modify and commit without yielding.
      // Async factories are for creation only, never updates to existing records.
      const produced = factory();
      const data = produced instanceof Promise ? await produced : produced;
      const response = receipt ? receipt(structuredClone(data)) : data;
      this.save(data, key ? receipt ? { key, hash, receipt: response } : { key, hash, data } : undefined);
      return response;
    });
    if (key) this.pending.set(key, { hash, compact: !!receipt, result });
    try { return { data: structuredClone(await result) as R, replayed: false }; }
    finally { if (key) this.pending.delete(key); }
  }
}
