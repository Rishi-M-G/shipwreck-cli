import { decideFault } from "../src/fault.js";
import type { FaultConfig } from "../src/config.js";

const faults: FaultConfig[] = [
    {
        latencyMs: 2000,
        failRate: 0,
        failStatus: 500
    },
    {
        latencyMs: 0,
        failRate: 1,
        failStatus: 503
    },
    {
        latencyMs: 0,
        failRate: 0.3,
        failStatus: 500
    },
    {
        latencyMs: 0,
        failRate: 0.3,
        failStatus: 500
    },
    {
        latencyMs: 1000,
        failRate: 1,
        failStatus: 500
    },
]

const rolls = [0.5, 0.999, 0.29, 0.31, 0]

function check(): void {
    for (let i = 0; i < faults.length; i++) {
        const fault = faults[i];
        const roll = rolls[i];

        console.log(decideFault(fault, roll));
    }
}

check();