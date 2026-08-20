export type FaultAction =
    | { kind: 'pass' }
    | { kind: 'delay'; ms: number }
    | { kind: 'fail'; status: number };

export interface FaultConfig {
    latency?: number
    failRate?: number
    failStatus?: number
}

export function decideFault(config: FaultConfig): FaultAction {
    if (config.failRate && Math.random() < config.failRate) {
        return { kind: 'fail', status: config.failStatus ?? 500 };
    }
    if (config.latency) {
        return { kind: 'delay', ms: config.latency };
    }

    return { kind: 'pass' };
}