#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { startProxy } from "./proxy.js";

// const config = loadConfig();
// console.log(JSON.stringify({
//     event: 'cli.config.resolved', target: config.target.href, port:config.port,
// }));

startProxy(loadConfig());