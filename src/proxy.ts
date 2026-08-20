// note: .js extension even though the file is fault-engine.ts — that's ESM resolution, not a typo
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { log } from './log.js';
import { FaultAction } from './fault-engine.js';
import { Recorder } from './recorder.js';

export type RequestInterceptor = (req: IncomingMessage) => FaultAction;
// startProxy provides the functionality for shipwreck to act as a server
// createServer provides the capability for this since something has to accept the incoming connection
export function startProxy(target: string, port: number, intercept: RequestInterceptor, recorder: Recorder): http.Server {
    const server = http.createServer((req, res) => {
        forward(req, res, target, intercept, recorder).catch((err) => {
            log.error('proxy.internal_error', {
                method: req.method,
                path: req.url,
                reason: (err as Error).message,
            });
            if (!res.headersSent) {
                res.writeHead(500);
                res.end();
            }
        });
    });
    server.listen(port);
    return server;
}

async function forward(req: IncomingMessage, res: ServerResponse, target: string, intercept: RequestInterceptor, recorder: Recorder): Promise<void> {
    const startedAt = Date.now();

    const action = intercept(req);

    const id = recorder.record({
        method: req.method ?? 'UNKNOWN',
        path: req.url ?? '/',
        bodyHash: null,
        idempotencyKey: (req.headers['idempotency-key'] as string) ?? null,
        requestedAt: startedAt,
    });

    if (action.kind === 'fail') {
        log.info('fault.injected', {
            kind: 'fail',
            path: req.url,
            status: action.status
        });
        recorder.complete(id, {
            status: action.status,
            durationMs: Date.now() - startedAt
        });
        res.writeHead(action.status);
        res.end();
        return;
    }

    if (action.kind === 'delay') {
        log.info('fault.injected', {
            kind: 'delay',
            path: req.url,
            ms: action.ms
        });
        await new Promise((resolve) => setTimeout(resolve, action.ms));
    }

    // The incoming request only knows its own path, it doesn't know where the real backend lives.
    // outboundUrl builds the full outbound address from the path plust --target
    const outboundUrl = new URL(req.url ?? '/', target);

    const outboundHeaders = { ...req.headers };
    outboundHeaders.host = outboundUrl.host;

    // Every proxy is a server on one side and a client on the other
    // This is the client half of the proxy.
    // This is shipwreck acting as a client to the real backend
    const proxyReq = http.request(
        outboundUrl,
        { method: req.method, headers: outboundHeaders },
        (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
            proxyRes.pipe(res);
            log.info('proxy.request.forwarded', {
                method: req.method,
                path: req.url,
                status: proxyRes.statusCode,
                durationMs: Date.now() - startedAt,
            });
        },
    );

    proxyReq.on('error', (err) => {
        log.error('proxy.forward.failed', {
            method: req.method,
            path: req.url,
            reason: err.message
        });
        recorder.complete(id, {
            status: 502, durationMs: Date.now() - startedAt
        });
        res.writeHead(502);
        res.end('Bad Gateway');
    });

    req.pipe(proxyReq);
}