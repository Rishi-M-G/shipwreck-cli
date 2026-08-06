import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { log } from './log.js';

// startProxy provides the functionality for shipwreck to act as a server
// createServer provides the capability for this since something has to accept the incoming connection
export function startProxy(target: string, port: number): http.Server {
    const server = http.createServer((req, res) => {
        forward(req, res, target);
    });
    server.listen(port);
    return server;
}

function forward(req: IncomingMessage, res: ServerResponse, target: string): void {
    const startedAt = Date.now();

    // The incoming request only knows its own path, it doesn't know where the real backend lives.
    // outboundUrl builds the full outbound address from the path plust --target
    const outboundUrl = new URL(req.url ?? '/', target);

    // Every proxy is a server on one side and a client on the other
    // This is the client half of the proxy.
    // This is shipwreck acting as a client to the real backend
    const proxyReq = http.request(
        outboundUrl,
        { method: req.method, headers: req.headers },
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
        res.writeHead(502);
        res.end('Bad Gateway');
    });

    req.pipe(proxyReq);
}