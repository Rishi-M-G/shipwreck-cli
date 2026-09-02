#!/usr/bin/env node
import { parseArgs } from 'node:util';

// Interfaces
export interface Config {
    target: URL,
    port: number
}

// Fail Helper
function fail(message: string): never {
    console.error(message);
    process.exit(2);
}

// Target URL conversion helper
function parseTarget(raw: string): URL {
    try {
        return new URL(raw);
    } catch (err) {
        fail(`Invalid --target: ${raw} (expected something like http://localhost:8080)`);
    }
}

// Port conversion and validation helper
function parsePort(raw: string): number {
    const port = Number(raw);
    if(!Number.isInteger(port) || port < 1 || port > 65535){
        fail(`Invalid --port: ${raw} (expected an integer between 1 and 65535)`);
    }
    return port;
}

// Function that takes in the arguments
function parseCliArgs() {
    try {
        return parseArgs({
            options: {
                target: { type: 'string' },
                port: { type: 'string', default: '4000' },
            },
        });
    } catch (err) {
        fail(`Bad arguments: ${(err as Error).message}`);
    }
}

// Main Function
function loadConfig(): Config {
    const {values} = parseCliArgs();
    if (!values.target) {
        fail(`Usage: shipwreck --target <backend-url> [--port <number>]`);
    }

    const target = parseTarget(values.target);

    if(target.protocol !== 'http:' && target.protocol !== 'https:'){
        fail(`Invalid --target: ${values.target} (needs an http:// or https:// scheme)`);
    }

    if(target.pathname !== '/' || target.search !== '' || target.hash !== ''){
        fail(`Invalid --target: ${values.target} (pass a bare origin like http://localhost:8080 - your client sends the path)`);
    }
    return { target, port: parsePort(values.port) };
}

const config = loadConfig();
console.log(JSON.stringify({
    event: 'cli.config.resolved', target: config.target.href, port:config.port,
}));