// scripts/target.mjs — throwaway backend for verifying the proxy. Not part of shipwreck.
import { createServer } from 'node:http';

createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        console.log('target.received', { method: req.method, url: req.url, host: req.headers.host, bytes: body.length });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ method: req.method, url: req.url, host: req.headers.host, body }));
    });
}).listen(8080, () => console.log('target.listening', { port: 8080 }));