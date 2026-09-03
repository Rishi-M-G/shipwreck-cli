# shipwreck — build log

This file is written for me, not for anyone evaluating the project. The [README](../README.md)
explains what shipwreck is to a stranger. This file records what I actually did, on which date, what
I verified before believing it worked, and what I understood at the time.

Entries are in chronological order, oldest first. Each entry records the same five things: the date,
the phase and milestone, what I built, how I proved it worked, and what I decided or learned.
Decisions that outlive a single milestone are collected in their own section below, so they do not
get buried. Open questions live at the bottom of the file.

---

## Where I am right now

- **Phase 0 — Scaffold and forwarding proxy**, in progress.
- **Milestone 0.1 — Package setup: complete and verified** (1 September 2026).
- **Milestone 0.2 — CLI arguments and validation: complete and verified** (3 September 2026).
- **Milestone 0.3 — The proxy core: complete and verified** (3 September 2026).
- **Next: Milestone 0.4 — the real logger.** Replace the `console.log` and `console.error` calls in
  `src/proxy.ts` with a small logging module that emits the same event-name-plus-fields shape, so
  the format is defined in one place instead of repeated at every call site.
- Phase 0's gate has not been reached yet. The gate is: my application runs normally through the
  proxy, every request produces one structured log line, and nothing is broken. That is Milestone
  0.5, after the logger.

---

## Standing decisions

Decisions here shape later phases. I append to this list rather than leaving them buried in the
entries below.

### 2026-09-03 — `--target` must be a bare origin (reverses an earlier decision the same day)

I first decided to accept a path prefix such as `--target http://localhost:8080/api`, then reversed
it once I saw what it cost. `--target` now accepts an origin only. A path, query string or fragment
is a usage error. The client supplies all paths; shipwreck never rewrites them.

Why, in the order the arguments actually carry weight:

1. **The use case cannot occur.** To use shipwreck at all I have to edit my frontend's API base URL
   so traffic goes through the proxy. That is the setup step. If my base URL happened to include
   `/api`, then at the exact moment I am editing that string I can write `http://localhost:4000/api`
   just as easily as `http://localhost:4000`. Prefix support solves a problem I am already holding
   the pen on.
2. **A proxy that rewrites paths is no longer transparent.** The path my app sent would stop being
   the path my backend received, which turns shipwreck into a translation layer rather than an
   observer. Transparency is the entire appeal of the proxy approach.
3. **It dissolves a downstream question.** With no prefix there is only one path, so the Phase 2
   question of whether the Recorder stores the client-visible or the upstream path disappears
   entirely. Simplifying a decision upstream deleted a future decision.

The honest cost: someone who passes a path gets an error instead of a working proxy. That is only
acceptable because the message tells them what to do instead.

The validation checks all three components separately, because they are independent:

```ts
if (target.pathname !== '/' || target.search !== '' || target.hash !== '') {
    fail(`Invalid --target: ${raw} (pass a bare origin like http://localhost:8080 — your client sends the path)`);
}
```

A trailing slash still yields `pathname === '/'`, so `http://localhost:8080/` is accepted with no
special handling. But a query string or fragment leaves `pathname` untouched, so checking `pathname`
alone would let `http://localhost:8080?x=1` through.

**What I nearly walked into, and why the check exists.** Under the prefix decision, the obvious
forwarding code would have been silently wrong:

```
new URL('/orders', 'http://localhost:8080/api')  ->  http://localhost:8080/orders
```

The two-argument `URL(path, base)` form discards the base's path whenever the first argument begins
with `/`, which `req.url` always does. It does not throw and does not warn — it returns a completely
valid URL that is simply the wrong one. That is the same shape of trap as `Number('abc')` returning
`NaN`. **A standard-library function doing something reasonable with my input is not the same as it
doing what I meant.** Convenience APIs earn a quick test before I trust them.

Confirmed at Milestone 0.3: because the target is guaranteed to be a bare origin,
`new URL(req.url ?? '/', config.target)` is correct with no prefix concatenation anywhere.

### 2026-09-03 — `fail()` in `config.ts` keeps its name

I was offered a rename to `failUsage()`. The concern was real: a function named `fail` that calls
`process.exit(2)` is dangerous to have in scope inside the request path, where exiting violates the
fail-soft rule. I kept the name and removed the risk differently, by deleting the unused import of
`fail` from `proxy.ts`. Nothing in the request path can now reach it. Settled — do not revisit.

### 2026-09-03 — `PROGRESS.md` lives in `docs/`, deliberately

This file is in `docs/`, not at the repository root. That is a choice, not drift. There is exactly
one progress file in the repository.

---

## 2026-09-01 — Restart from zero

**What I did.** Deleted the entire previous shipwreck repository — every source file, the git
history, and the one existing commit — and started again with `git init` on an empty folder. The
remote repository was force-replaced with this new history, so the old code no longer exists
anywhere.

**Why.** I came back to this project after a long gap and found that I could not explain my own
code. Phase 0 and Phase 1 were finished and Phase 2 was roughly a quarter built, but I no longer
remembered why any of it was written the way it was. Resuming a half-finished implementation I could
not defend would have produced a tool I could not talk about in an interview, which defeats the
entire reason for building it. Retyping it costs a few hours and buys back the understanding.

**What I deliberately kept.** The design decisions from the first attempt were good and did not need
re-litigating: TypeScript in strict mode, Node built-ins before dependencies, ESM on Node 20+,
Vitest with a throwaway in-suite target server, fail-soft error handling in the proxy, and the
exit-code contract (`0` pass, `1` assertion failure, `2` configuration error). What I threw away was
the code, not the reasoning.

---

## 2026-09-01 — Phase 0, Milestone 0.1: package setup ✅

**The one idea for Phase 0 as a whole:** a reverse proxy receives a request on one port and relays
it to another. Nothing else in this phase — no faults, no recording.

**What I built.**

- `npm init`, then set the load-bearing fields in `package.json` by hand: `"type": "module"`,
  `"engines": { "node": ">=20.0.0" }`, `"bin": { "shipwreck": "./dist/index.js" }`, and the two
  scripts `"dev": "tsx src/index.ts"` and `"build": "tsc"`.
- Installed `typescript`, `tsx` and `@types/node` as development dependencies.
- Wrote `tsconfig.json` with `target: ES2022`, `module: nodenext`, `moduleResolution: nodenext`,
  `strict: true`, `declaration: true`, `rootDir: src`, `outDir: dist`, `include: ["src"]`, and
  `types: ["node"]`.
- Wrote `src/index.ts` containing a shebang and a single `console.log`.
- Wrote `.gitignore` covering `node_modules` and `dist`.

**How I proved it worked.** Three checks, all of which passed:

1. `npm run dev` printed the log line. This proves `tsx` and `tsconfig.json` agree with each other.
2. `npm run build` completed silently and produced `dist/index.js` and `dist/index.d.ts`.
3. `node dist/index.js` printed the same line. This one matters most, because it proves the file the
   `bin` field points at is genuinely runnable on its own. If that were wrong, I would not find out
   until publish time.

**What I understood, and want to still understand in forty years.**

- **`"type": "module"` makes the package ESM**, so I write `import` rather than `require`. It has one
  consequence that will confuse me the moment I forget it: every relative import must carry a `.js`
  extension even though the file on disk is a `.ts` file. I will write `import { log } from
  './log.js'` for a file called `log.ts`. TypeScript deliberately does not rewrite import paths. It
  is *Node* that resolves them at runtime, against the compiled output in `dist/`, where the file
  really is called `log.js`. Setting `moduleResolution: nodenext` makes TypeScript enforce this at
  compile time rather than letting me write extensionless imports that compile and then break.
- **The `bin` field is what will eventually make `npx shipwreck` work.** npm symlinks the command
  name to that file. It must be the *built* file in `dist/`, because users do not have TypeScript,
  and that file needs a shebang as its literal first line.
- **The shebang is `#!/usr/bin/env node`, not `#!/usr/bin/node`.** Using `env` means Node is looked
  up on `PATH`, so it works regardless of nvm, volta, homebrew, or a system package manager.
  Hardcoding the path would work only on the machine it was written on. I typo'd this as `mode`
  originally and none of my three checks caught it, because both `tsx` and `node dist/index.js` name
  the interpreter explicitly and ignore the shebang entirely. It would first have failed at publish
  time.
- **`engines` declares the Node 20 minimum**, which matters because `util.parseArgs` is a modern
  built-in. npm then warns someone installing on Node 16 rather than letting them hit a confusing
  crash.
- **`declaration: true` emits `.d.ts` files**, so the package ships its own type definitions. That is
  a large part of why TypeScript was worth the friction.
- **`types: ["node"]` is required on TypeScript 7.** TypeScript 5 resolved `@types/node`
  automatically; TypeScript 7 does not. Without it, every `node:` import and every Node global fails
  to resolve. The symptom is a cluster of errors, and the fix is always to resolve the missing-types
  error first and re-run, because the rest are usually downstream of it.

---

## 2026-09-03 — Phase 0, Milestone 0.2: command-line arguments ✅

**The one idea:** everything arriving from the command line is either an untrusted string or missing
entirely. This milestone turns that into a typed configuration object, or refuses clearly and exits
with the right code.

**What I built**, all in `src/config.ts` (it started in `index.ts` and moved out at Milestone 0.3):

- `interface Config { target: URL, port: number }` — the boundary. Above it, values are
  `string | undefined` and untrusted. Below it, everything is present, typed and validated. Nothing
  else in the program will ever touch `process.argv`.
- `fail(message: string): never` — writes to stderr and exits with code 2.
- `parseCliArgs()` — wraps `node:util`'s `parseArgs`, declaring `--target` (string) and `--port`
  (string, default `'4000'`), with a try/catch routing unknown flags into `fail`.
- `parseTarget(raw: string): URL` and `parsePort(raw: string): number` — one small helper per field.
- `loadConfig(): Config` — runs presence, conversion and validation in order and returns the config.
- A temporary `console.log` emitting a `cli.config.resolved` line. **This is scaffolding.** It was
  removed at Milestone 0.3 once the proxy had real logs of its own, and Milestone 0.4 replaces the
  rest with the real structured logger. After that there should be no bare `console.log` anywhere.

I also wrote **`check.ps1`** at the repository root: a PowerShell loop that runs all the verification
cases and prints each exit code. I will extend this at every later phase rather than rewriting it,
and it doubles as a record of exactly what the CLI is supposed to accept and reject.

**How I proved it worked.** All nineteen cases behave correctly.

Five valid inputs exit `0`, including the boundary ports 1 and 65535, and both `http:` and `https:`
targets. The invalid inputs exit `2` with one clean sentence and no stack trace: no arguments at all,
an unknown flag, `--port abc`, `--port 0`, `--port 65536`, `--port 40.5`, `--port ""`,
`--target localhost:8080`, `--target ftp://localhost:8080`, `--target "not a url"`, and the four
bare-origin cases. I also confirmed with `npx tsx src/index.ts --bogus > out.txt` that the error
still appears on the console and `out.txt` stays empty, which proves errors go to stderr and not
stdout.

**What I understood, including the mistakes that taught me.**

- **`: never` is load-bearing, three times over.** Because `fail` is declared as returning `never`,
  TypeScript knows it cannot fall through. That means `if (!values.target) { fail(...) }` narrows
  `values.target` from `string | undefined` to `string` automatically. It means `parseCliArgs` infers
  a clean return type instead of `... | undefined`, even though its catch block returns nothing. And
  it means `loadConfig` needs only a single `return` at the very end, because every other path has
  already exited. Typing `fail` as `void` would have cost me all three and left me writing
  `values.target!` everywhere, which is me overriding the compiler rather than being helped by it.
- **`arguments` is a reserved binding in strict mode.** I tried to name a variable `arguments` and
  got `TS1215: Invalid use of 'arguments'. Modules are automatically in strict mode.` In old
  non-strict JavaScript every function has an implicit local `arguments` object holding the values
  passed to it, predating rest parameters. Strict mode forbids shadowing it, and ES modules are
  always strict. So that name is unusable anywhere in this project.
- **Catch narrowly.** I first wrapped the whole body of `loadConfig` in a try/catch. Two things were
  wrong with that. It was dead code for its stated purpose, because `parseCliArgs` already handles
  everything `parseArgs` can throw and therefore cannot throw. And it would have become the handler
  for all the validation code I was about to write, including my own bugs. I saw this demonstrated: a
  typo produced the user-facing message `Bad arguments: Cannot read properties of undefined (reading
  'toLowerCase')`, which blames the user for my mistake and throws away the stack trace that would
  have found it. **A try block should hold the one call that can throw, not a function body.** If I
  cannot name the specific error I am handling, I should not be catching there.
- **One condition, one question.** My worst bug. I wrote `if (!port)` intending to handle a missing
  port. But `parseArgs` had already applied the `default: '4000'`, so the value was never missing.
  The branch could therefore only ever fire for `NaN` or `0` — both invalid — and it treated them as
  "use the default". Its intent and its trigger condition were exact opposites, and `--port abc`
  silently resolved to `NaN` while printing "Using default port number 4000" and exiting `0`. The
  cause is that a single truthiness check was standing in for three different questions: is it
  missing, is it convertible, and is it in range. JavaScript's falsy rules answered all three the
  same way, and got two of them wrong. **A truthiness check on a converted value is a proxy, and
  proxies drift away from the thing they stand for.**
- **`any` is a mute button, not a fix.** I added `: any` to `parseCliArgs` to quiet the compiler. It
  was never needed — the inferred type was correct. It did not cause the bugs above, but it switched
  off checking for everything downstream, including the typo I had not made yet.

**The procedure I was given, and want to keep.** Any function turning untrusted input into a trusted
value runs the same five steps in this order:

1. **Acquire** the raw value. It is a string, or it is missing. Nothing else.
2. **Presence.** Is it there? If a default already supplied it, this step is done for me and I skip
   it entirely.
3. **Convert** to the real type. This is the only step that can throw, so it is the only step that
   gets a try/catch.
4. **Validate** the converted value — range, allowed set, shape. This step never throws; it compares
   and calls `fail`.
5. **Return** the trusted value.

Two rules bind them. Each step assumes the previous one succeeded, and **no step answers a question
belonging to another step**. And I should finish one field completely before starting the next;
interleaving them is how I lost track of what had already been checked.

**Decisions made.** `--target` must be a bare origin — see the standing decisions section above. I
originally decided the opposite and reversed it the same day.

---

## 2026-09-03 — Phase 0, Milestone 0.3: the proxy core ✅

**The one idea:** a reverse proxy receives a request on one port and relays it to another. No faults,
no recording, no assertions. If my app cannot tell the difference between talking to shipwreck and
talking to the backend directly, the milestone succeeded.

**What I built.**

- Split the code into three files. `src/config.ts` holds everything from Milestone 0.2.
  `src/proxy.ts` is new and exports one function, `startProxy(config: Config): Server`.
  `src/index.ts` is now a four-line entry point that calls `startProxy(loadConfig())`. The split is
  not cosmetic: in Phase 5 my integration tests need to start a proxy against a throwaway target
  server without going anywhere near `process.argv`, and that test is three lines only if
  `startProxy` takes a plain `Config` object.
- The forward itself. Build the upstream URL with `new URL(req.url ?? '/', config.target)`, open an
  outbound `http.request`, copy the method and every header across with `host` overridden to
  `upstreamURL.host`, then `req.pipe(upstreamRequest)` outbound and `upstreamResponse.pipe(res)`
  inbound.
- Error handling on all four streams, and structured logs for startup, completion, and each of the
  four ways forwarding can fail. The event table is in the README.

**How I proved it worked.** I wrote a throwaway echo backend that reports the method, path, `Host`
header and body byte count it received, plus two deliberately hostile endpoints: one that sends
headers and then destroys its socket partway through the body, and one that waits four seconds
before answering. Four cases, all passing:

| Case | Client sees | Proxy logs |
|---|---|---|
| `GET` and `POST` with a body | 200, body intact, backend saw `host: localhost:8081` | `proxy.request.forwarded` with a sane `durationMs` |
| Backend down entirely | 502, and the proxy stays up | `proxy.forward.failed ECONNREFUSED` |
| Backend dies mid-response | truncated body in 0.15s, no hang | `proxy.response.failed ECONNRESET` |
| Client aborts after 1 second | — | `proxy.forward.cancelled ECONNRESET`, and the backend observed its own socket close early |

`npx tsc --noEmit` is clean.

**What I understood, including the mistakes that taught me.**

- **An error handler must never terminate the process.** My editor auto-imported `fail` from
  `node:assert` when I wanted to log a forward failure. `assert.fail()` does not log — it *throws* an
  `AssertionError`. The throw happened inside an `error` event handler where nothing catches it, so
  the entire proxy died the first time the backend refused a connection. The deeper point is that my
  own `fail()` in `config.ts` would have been just as wrong, because it calls `process.exit(2)`.
  **In a fail-soft component an error handler may log, may respond, and may close a connection, but
  may never call anything that terminates the process.** Exiting belongs to the CLI startup layer,
  where there is nothing yet to degrade to. Two functions named `fail` with opposite obligations is
  itself the smell.
- **Every stream is its own failure domain.** I had handlers on two streams and asked whether the
  response direction needed them too. It did. Measured behaviour when the backend dies mid-response:
  `upstreamResponse` emits `aborted`, then `error` (`ECONNRESET`), then `close`, while
  `upstreamRequest` emits only `close` and never `error`. So my existing handler could not possibly
  see it. Worse, an `IncomingMessage` with no `'error'` listener does not throw — it goes silent, so
  the client hung for its full timeout with nothing in my log. A silent hang is worse than a crash.
  **A proxied exchange has four independent streams** — client to proxy request, proxy to backend
  request, backend to proxy response, proxy to client response. Each fails independently, each has
  its own `error` event, and `pipe()` carries data but not failures. If I can name four streams, I
  need four error handlers.
- **A log event must distinguish what happened from what I did.** I used the name
  `proxy.response.failed` for two different failures, one on the client side and one on the backend
  side. Worse, when my own `res.on('close')` handler cancelled the outbound request, the resulting
  `ECONNRESET` was logged as `proxy.forward.failed` — shipwreck reporting its own deliberate action
  as a backend fault. That matters far beyond tidiness: these records are what the Phase 3 assertion
  engine reads, so an impatient client would have manufactured a phantom fault and shipwreck would
  have graded my app on a failure it invented itself. Fixed with a `clientGone` flag and a distinct
  `proxy.forward.cancelled` event. **An event name is an interface, not a comment.**
- **Rewrite the `Host` header.** The browser sends shipwreck's own host and port. Forwarding that
  unchanged breaks any backend that does virtual-host routing, generates absolute URLs such as
  redirect `Location` headers or pagination links, or validates the origin — which Spring Security
  may well do. `URL.host` includes the port, which is what the header wants; `URL.hostname` does not.
- **Pipe, do not buffer.** `pipe()` handles backpressure — the mechanism by which a slow reader tells
  a fast writer to pause. A hand-rolled `on('data')` loop that ignores the return value of `write()`
  does not, and it will buffer an entire large response in memory when the client is slower than the
  backend. Buffering an arbitrary upload with no cap is a memory-exhaustion foot-gun. I will buffer
  deliberately in Phase 2 to hash bodies, but with an explicit configurable cap, which is a different
  decision made for a different reason.
- **Smaller corrections.** A conditional whose two branches were identical
  (`if (!res.headersSent) { res.destroy() } else { res.destroy() }`) — deleted, because `writeHead`
  runs synchronously two lines below where that listener is registered, so `headersSent` is always
  true by the time it can fire. `upstreamRequest` referenced inside listeners declared above its own
  `const` — worked only because events are asynchronous, so I moved the declaration up. And
  `error.code` needs the `NodeJS.ErrnoException` annotation, because Node types the `'error'` payload
  as plain `Error` while system errors are a subclass carrying `code`, `errno` and `syscall`.

**Known and deliberately deferred.**

- An aborted request produces no `proxy.request.forwarded` line, because `'finish'` only fires on a
  clean end. Acceptable now. At Phase 2 every request needs a record that eventually gets marked
  complete, and `'close'` is the event that always fires, so that is where the backstop goes.
- `clientGone` is set inside a condition meaning "the response did not finish cleanly", which is
  broader than "the client left". The two coincide today under measured event ordering, but the code
  does not guarantee it. If I ever see a `proxy.forward.cancelled` I cannot explain, that gap is the
  first place to look.
- `check.ps1` still only covers exit codes. The four proxy cases need two servers running at once, so
  they do not script cleanly yet. They become automatable at Phase 5, when the Vitest suite starts
  its own throwaway backend in-process — the same echo server I tested against by hand.

---

## Open questions

*None outstanding.* The Phase 2 question about which path the Recorder should store was dissolved by
the bare-origin decision on 3 September 2026: with no prefix there is only one path.
