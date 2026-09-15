import { FaultConfig } from "./config.js";

export interface FaultPlan {
    delayMs: number,
    failStatus: number | null
}

export function decideFault(faults: FaultConfig, roll: number, method: string | undefined): FaultPlan {
    if (method === 'OPTIONS') {
        return {
            delayMs: 0,
            failStatus: null
        }
    }
    
    return {
        delayMs: faults.latencyMs,
        failStatus: (roll < faults.failRate) ? faults.failStatus : null
    }
}