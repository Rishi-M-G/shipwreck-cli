import { log } from "./log.js";

export interface RequestRecord {
    id: number
    method: string
    path: string
    bodyHash: string | null
    idempotencyKey: string | null
    requestedAt: number
    status?: number
    durationMs?: number
    respondedAt?: number
}

export class Recorder {
    private records = new Map<number, RequestRecord>();
    private nextId = 1;

    record(partial: Omit<RequestRecord, 'id'>): number {
        const id = this.nextId++;
        this.records.set(id, { id, ...partial });
        return id;
    }

    complete(id: number, outcome: { status: number; durationMs: number }): void {
        const rec = this.records.get(id);
        if (!rec) {
            log.error('recorder.complete.missing_id', { id });
            return;
        }
        rec.status = outcome.status;
        rec.durationMs = outcome.durationMs;
        rec.respondedAt = Date.now();
    }

    all(): RequestRecord[] {
        return [...this.records.values()];
    }
}