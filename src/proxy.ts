import { ClientRequest, createServer, request, Server } from "node:http";
import { Config } from "./config.js";
import { log } from "./log.js";
import { decideFault } from "./fault.js";
import { setTimeout as delay } from "node:timers/promises";

export function startProxy(config: Config): Server {
    const server = createServer(async (req, res) => {
        /**
         * The (req, res) => { ... } arrow function passed to createServer is a handler — Node calls it once per incoming request.
         */

        // since req.url contains only the path, lets build the upstream url
        const upstreamURL = new URL(req.url ?? '/', config.target);

        let clientGone: boolean = false;
        let faulted: boolean = false;
        const startTime = Date.now();

        let upstreamRequest: ClientRequest | undefined;

        res.on('finish', () => {
            const durationMs = Date.now() - startTime;

            log.info(faulted ? "proxy.request.faulted" : "proxy.request.forwarded", {
                method: req.method,
                path: req.url,
                status: res.statusCode,
                durationMs
            });
        });

        res.on('error', (error: NodeJS.ErrnoException) => {
            log.error("proxy.client.write_failed", {
                method: req.method,
                path: req.url,
                error: error.code ?? 'UNKNOWN'
            });

            upstreamRequest?.destroy();
        });

        res.on('close', () => {
            if (!res.writableFinished) {
                clientGone = true;
                upstreamRequest?.destroy();
            }
        })

        // Decide the fault plan for the current request
        const plan = decideFault(config.faults, Math.random(), req.method);

        if (plan.delayMs > 0) {
            log.info("fault.injected", {
                method: req.method,
                path: req.url,
                latencyMs: plan.delayMs,
                kind: 'latency'
            });

            await delay(plan.delayMs);
        }

        if (plan.failStatus !== null) {
            log.info("fault.injected", {
                method: req.method,
                path: req.url,
                kind: 'failure',
                failStatus: plan.failStatus
            });
            faulted = true;

            res.writeHead(plan.failStatus, {
                "Content-Type": "application/json",
                "X-shipwreck-fault": "injected"
            });
            res.end(JSON.stringify({ error: 'shipwreck injected fault', status: plan.failStatus }));
            return;
        }

        upstreamRequest = request(upstreamURL, {
            method: req.method,
            headers: {
                ...req.headers,
                host: upstreamURL.host
            },

        },
            (upstreamResponse) => {
                // Backend -> Proxy failure handling
                upstreamResponse.on('error', (error: NodeJS.ErrnoException) => {
                    log.error(`proxy.response.failed`, {
                        method: req.method,
                        path: req.url,
                        error: error.code ?? 'UNKNOWN'
                    });
                    res.destroy();
                })
                res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
                upstreamResponse.pipe(res);
            }
        );





        // Proxy -> Backend Failure Handling
        upstreamRequest.on('error', (error: NodeJS.ErrnoException) => {
            if (clientGone) {
                log.error(`proxy.forward.cancelled`, {
                    method: req.method,
                    path: req.url,
                    error: error.code ?? 'UNKNOWN'
                });
            } else {
                log.error(`proxy.forward.failed`, {
                    method: req.method,
                    path: req.url,
                    error: error.code ?? 'UNKNOWN'
                });
                if (!res.headersSent) {
                    res.writeHead(502);
                    res.end(`Bad Gateway`);
                } else {
                    res.destroy();
                }
            }

        });

        // Client -> Proxy Failure Handling
        req.on('error', (error: NodeJS.ErrnoException) => {
            log.error(`proxy.request.failed`, {
                method: req.method,
                path: req.url,
                error: error.code ?? 'UNKNOWN'
            });
            upstreamRequest.destroy();
        });

        // Client -> Backend Forwarding
        req.pipe(upstreamRequest); // Whatever body comes into req pipe it to upstream request
    });
    server.listen(config.port, () => {
        log.info("proxy.listening", {
            port: config.port,
            target: config.target.href,
            latencyMs: config.faults.latencyMs,
            failRate: config.faults.failRate,
            failStatus: config.faults.failStatus
        });
    });

    return server;
}