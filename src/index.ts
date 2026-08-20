#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { startProxy } from './proxy.js';
import { decideFault, type FaultConfig } from './fault-engine.js';
import { log } from './log.js';
import { Recorder } from './recorder.js';

const recorder = new Recorder();

// Prints a message & exists with code 2 (config/usage-error code)
// Returns: Never returns
// Arguments: message -> string
function fail(message: string): never {
    console.error(message);
    process.exit(2);
}

// Arguments: None
// Returns: None
// parseCliArgs wraps the real call in try/catch block so, typo'd incorrect bogus flags
// like (--bogus) will fail through the same fail() path instead of a raw crash.
function parseCliArgs() {
    try {
        return parseArgs({
            options: {
                target: { type: 'string' },
                port: { type: 'string', default: '4000' },
                latency: { type: 'string' },
                "fail-rate": { type: 'string' },
                "fail-status": { type: 'string' }
            },
        });
    } catch (err) {
        fail(`Bad arguments: ${(err as Error).message}`);
    }
}

const { values } = parseCliArgs();

if (!values.target) {
    fail('Usage: shipwreck --target <backend-url> [--port <number> --latency <ms> --fail-rate <0..1> --fail-status <code>]');
}

const port = Number(values.port);
if (Number.isNaN(port)) {
    fail(`Invalid --port: ${values.port}`);
}

function parseOptionalNumber(raw: string | undefined, flagName: string): number | undefined {
    if (raw === undefined) return undefined;
    const n = Number(raw);
    if (Number.isNaN(n)) {
        fail(`Invalid ${flagName}: ${raw}`);
    }
    return n;
}

const faultConfig: FaultConfig = {
    latency: parseOptionalNumber(values.latency, '--latency'),
    failRate: parseOptionalNumber(values['fail-rate'], '--fail-rate'),
    failStatus: parseOptionalNumber(values['fail-status'], '--fail-status'),
};


// console.log(`target: ${values.target} port: ${port} latency: ${values.latency} fail-rate: ${values['fail-rate']} fail-status: ${values['fail-status']}`);
// startProxy(values.target, port, faultConfig;
// console.log(`shipwreck: ${port} -> ${values.target}`);
log.info('cli.config.parsed', {
    target: values.target,
    port: values.port,
    ...faultConfig
});

startProxy(values.target, port, (req) => decideFault(faultConfig), recorder);