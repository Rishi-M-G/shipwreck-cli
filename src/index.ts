#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { startProxy } from './proxy.js';

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


console.log(`target: ${values.target} port: ${port} latency: ${values.latency} fail-rate: ${values['fail-rate']} fail-status: ${values['fail-status']}`);
// startProxy(values.target, port);
// console.log(`shipwreck: ${port} -> ${values.target}`);