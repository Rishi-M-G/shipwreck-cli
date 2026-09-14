import { parseArgs } from 'node:util';

// ****** Interfaces ******
export interface FaultConfig {
    latencyMs: number,
    failRate: number,
    failStatus: number
}

export interface Config {
    target: URL,
    port: number,
    faults: FaultConfig
}
// ************************************

// ****** Helper Functions ******
// Fail Helper
export function fail(message: string): never {
    console.error(message);
    process.exit(2);
}
// ************************************


// ****** Validation Helpers ******
// Target URL conversion helper
function parseTarget(raw: string): URL {
    if (raw.trim() === '') {
        fail(`--target needs a value`)
    }
    try {
        return new URL(raw);
    } catch (err) {
        fail(`Invalid --target: ${raw} (expected something like http://localhost:8080)`);
    }
}

// Port conversion and validation helper
function parsePort(raw: string): number {
    if (raw.trim() === '') {
        fail(`--port needs a value, cannot be passed as an empty string`)
    }
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        fail(`Invalid --port: ${raw} (expected an integer between 1 and 65535)`);
    }
    return port;
}

// Latency validation helper
function parseLatency(raw: string): number {
    if (raw.trim() === '') {
        fail(`--latency needs a value, cannot be passed as an empty string`)
    }
    const latency = Number(raw);
    if (!Number.isInteger(latency) || latency < 0 || latency > 300000) {
        fail(`Invalid --latency: ${raw} (expected an integer between 0 and 300000 since latency can't be more than 5 minutes)`)
    }
    return latency;
}

// fail-rate validation helper
function parseFailRate(raw: string): number {
    if (raw.trim() === '') {
        fail(`--fail-rate needs a value, cannot be passed as an empty string`)
    }
    const failRate = Number(raw);
    if (!Number.isFinite(failRate) || failRate < 0 || failRate > 1) {
        fail(`Invalid --fail-rate: ${raw} (expected a value between 0 and 1 since it denotes the probability a request is failed)`);
    }
    return failRate;
}

// fail-status validation helper
function parseFailStatus(raw: string): number {
    if(raw.trim() === ''){
        fail(`--fail-status needs a value, cannot be passed as an empty string`)
    }
    const failStatus = Number(raw);
    if (!Number.isInteger(failStatus) || failStatus < 400 || failStatus > 599) {
        fail(`Invalid --fail-status: ${raw} (expected a value between 400 and 599 since it denotes the status code)`);
    }
    return failStatus;
}
// ************************************

// Function that takes in the arguments
function parseCliArgs() {
    try {
        return parseArgs({
            options: {
                target: { type: 'string' },
                port: { type: 'string', default: '4000' },
                latency: { type: 'string', default: '0' },
                'fail-rate': { type: 'string', default: '0' },
                'fail-status': { type: 'string', default: '500' }
            },
        });
    } catch (err) {
        fail(`Bad arguments: ${(err as Error).message}`);
    }
}

// Main Function
export function loadConfig(): Config {
    const { values } = parseCliArgs();
    if (!values.target) {
        fail(`Usage: shipwreck --target <backend-url> [--port <number>]`);
    }

    const target = parseTarget(values.target);

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        fail(`Invalid --target: ${values.target} (needs an http:// or https:// scheme)`);
    }

    if (target.pathname !== '/' || target.search !== '' || target.hash !== '') {
        fail(`Invalid --target: ${values.target} (pass a bare origin like http://localhost:8080 - your client sends the path)`);
    }
    return {
        target,
        port: parsePort(values.port),
        faults: {
            latencyMs: parseLatency(values.latency),
            failRate: parseFailRate(values['fail-rate']),
            failStatus: parseFailStatus(values['fail-status']),
        },
    };
}