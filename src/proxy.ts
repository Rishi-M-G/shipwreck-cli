import { createServer, request, Server } from "node:http";
import { Config } from "./config.js";

export function startProxy(config: Config): Server {
    const server = createServer((req, res) => {

        // since req.url contains only the path, lets build the upstream url
        const upstreamURL = new URL(req.url ?? '/', config.target);

        let clientGone: boolean = false;
        const startTime = Date.now();

        const upstreamRequest = request(upstreamURL, {
            method: req.method,
            headers: {
                ...req.headers,
                host: upstreamURL.host
            },

        },
            (upstreamResponse) => {
                // Backend -> Proxy failure handling
                upstreamResponse.on('error', (error: NodeJS.ErrnoException) => {
                    console.error(`proxy.response.failed`, {
                        method: req.method,
                        path: req.url,
                        error: error.code
                    });
                    res.destroy();
                })
                res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
                upstreamResponse.pipe(res);
            }
        );

        res.on('finish', () => {
            const durationMs = Date.now() - startTime;

            console.log("proxy.request.forwarded", {
                method: req.method,
                path: req.url,
                status: res.statusCode,
                durationMs
            });
        });

        res.on('error', (error: NodeJS.ErrnoException) => {
            console.error("proxy.client.write_failed", {
                method: req.method,
                path: req.url,
                error: error.code
            });

            upstreamRequest.destroy();
        });

        res.on('close', () => {
            if (!res.writableFinished) {
                clientGone = true;
                upstreamRequest.destroy();
            }
        })



        // Proxy -> Backend Failure Handling
        upstreamRequest.on('error', (error: NodeJS.ErrnoException) => {
            if (clientGone) {
                console.error(`proxy.forward.cancelled`, {
                    method: req.method,
                    path: req.url,
                    error: error.code
                });
            } else {
                console.error(`proxy.forward.failed`, {
                    method: req.method,
                    path: req.url,
                    error: error.code
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
            console.error(`proxy.request.failed`, {
                method: req.method,
                path: req.url,
                error: error.code
            });
            upstreamRequest.destroy();
        });

        // Client -> Backend Forwarding
        req.pipe(upstreamRequest); // Whatever body comes into req pipe it to upstream request
    });
    server.listen(config.port, () => {
        console.log("proxy.listening", {
            port: config.port,
            target: config.target.href
        });
    });



    return server;
}