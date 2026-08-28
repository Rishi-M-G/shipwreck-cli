# Shipwreck — Progress
 
## Status: Phase 1 complete, gate verified. Starting Phase 2.
 
## Phase 0 — Scaffold + forwarding proxy — DONE
- `npm init`, ESM (`"type": "module"`), `engines.node >=20`, `bin` entry pointing at `dist/index.js`.
- TypeScript strict mode, `tsx` for dev runs, `tsc` for build.
- Args parsed with `node:util` `parseArgs` — no dependency. `--target`, `--port`.
- Proxy core in `src/proxy.ts` using `node:http`: forwards method/headers/body, pipes response back.
- Fail-soft: forward errors caught, logged via `proxy.forward.failed` / `proxy.internal_error`, never crash the process.
- Structured logging (`src/log.ts`): JSON lines, `{ level, event, ...fields, time }`. Every forward logs `proxy.request.forwarded` with `durationMs`.
- Gate: verified — app behaves identically through the proxy, one log line per request, nothing broken.
## Phase 1 — Fault injection — DONE
- Flags added: `--latency <ms>`, `--fail-rate <0..1>`, `--fail-status <code>`.
- `decideFault()` in `src/fault-engine.ts` — pure function, `FaultConfig -> FaultAction` (`pass | delay | fail`). Kept separate from the proxy so it's unit-testable later.
- `fail` short-circuits before the request reaches the target (simulates the request never arriving). `delay` awaits before forwarding.
- Both paths emit `fault.injected` with `{ kind, path, ... }`.
- Gate: verified by hand — `--latency 2000` visibly slowed the app, `--fail-rate 1 --fail-status 500` visibly broke it, both logged.
## Decisions made
- Node built-ins over dependencies wherever reasonable (`node:http`, `node:util`, will use `node:crypto` in Phase 2). Deliberate — smaller supply-chain surface for a security-adjacent tool.
- Fault *decision* kept separate from fault *application* — same pattern will extend to the fingerprinter and later the assertion evaluator (decide vs. act, judge vs. run).
- npm package name: `shipwreck` is taken. Working candidate `scuttle`. Not resolved yet — doesn't block build, one line in `package.json` at Phase 5.
## Open questions
- Body buffering cap for hashing in Phase 2 — what's a sane default limit before falling back to "too large, no hash"?
- How to name/version the package for publish (still just `scuttle` as a placeholder, unconfirmed via `npm view`).
## Next up: Phase 2 — Recording + fingerprinting
- Build the Recorder (`record`, `complete`, `all`) as an append-only in-memory list.
- Buffer + hash request bodies (sha256), forward the buffered copy.
- Fingerprinter: `method + normalizedPath + sha256(body)`, headers excluded.
- Duplicate detection within a time window, emits `duplicate.detected`.
- Gate: a hand-crafted duplicate POST is detected and reported; a non-duplicate is not flagged.