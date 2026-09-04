#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { startProxy } from "./proxy.js";

startProxy(loadConfig());