import { FaultConfig } from "./config.js";

export interface FaultPlan {
    delayMs: number,
    failStatus: number | null
}

export function decideFault(faults: FaultConfig, roll: number): FaultPlan {
    return {
        delayMs: faults.latencyMs,
        failStatus: (roll < faults.failRate) ? faults.failStatus : null
    }
}