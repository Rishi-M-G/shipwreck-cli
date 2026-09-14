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

- **Phase 0 — Scaffold and forwarding proxy: COMPLETE.** Gate passed 9 September 2026. Milestones
  0.1 through 0.5 are complete and verified, each with its own entry below. The gate ran my real
  React admin panel through the proxy against Spring Boot on port 8082 and the application behaved
  identically. Twenty-four requests forwarded, zero failure events.
- **Phase 1 — Fault injection: in progress.**
- Milestone 1.1 — The fault flags: complete and verified (14 September 2026).
- Milestone 1.2 — The fault decision function: complete and verified (14 September 2026).
- **Next: Milestone 1.3 — apply the plan in the proxy.** Delay before forwarding, short-circuit an
  injected failure so the backend never sees the request, and log each injected fault. The logs have
  to keep "I forwarded this" and "I faulted this" distinct, because Phase 2 reads them as data.
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

### 2026-09-04 — Diagnostics go to stderr, and stdout is reserved for the report

Every line shipwreck writes for a human or a log collector goes to **stderr**. Nothing is written to
stdout at all, and stdout is reserved for the resilience report that Phase 4 will produce.

A process has two output channels rather than one. `console.log` writes to stdout and
`console.error` writes to stderr, and a terminal displays both on the same screen, which is exactly
why the difference is invisible until something other than a terminal reads the output. Shell
redirection with `>` captures stdout only.

The reason this matters is concrete. At Phase 4 someone will run
`shipwreck run scenario.ts --json > report.json` inside a CI job. If my per-request diagnostic lines
were also on stdout they would land inside `report.json` and the file would no longer parse.
Deciding this now costs one line. Discovering it at Phase 4 costs a refactor, and a confusing bug
first.

The honest cost: someone who redirects stdout expecting to capture the logs gets an empty file,
because the logs are on the other channel. That is the conventional behaviour for command-line
tools, so it is a surprise people already expect.

### 2026-09-09 — Phase 3 assertions must use tolerance bands, never absolute timings

This is a constraint I measured rather than a preference. It is recorded here rather than left in
the milestone entry, because it decides something in Phase 3.

At the Phase 0 gate I watched the same request — `GET /api/v1/admin/agencies`, nothing changed, same
machine, no other load — take **838 ms** and then **121 ms**, 147 milliseconds apart. That is roughly
a sevenfold spread on identical work. The first call pays for connection setup, JIT warm-up and
whatever Spring initialises lazily. The second pays for none of it.

The consequence for Phase 3: an expectation such as `backsOff` has to assert that the *gaps between
retries grow*, which is a relative claim about a sequence rather than a claim about any single
number. Any absolute threshold needs a tolerance band wide enough to survive that spread. An
assertion written as "the retry must arrive more than 500 ms after the failure" would have passed or
failed here depending on nothing but whether the JVM happened to be warm.

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

## 2026-09-04 — Phase 0, Milestone 0.4: the real logger ✅

**What I built.** `src/log.ts`, a module that owns the log format so that the format is defined in
exactly one place instead of being repeated at every call site. It exports a `log` object with
`info` and `error`, and both delegate to a private `emit`. Every record is one line of JSON written
to **stderr**, carrying `ts` as an ISO 8601 timestamp, `level`, `event`, and whatever named fields
the caller passed. I then replaced all seven `console.log` and `console.error` calls in
`src/proxy.ts`, changing no event name and no field, so this milestone was purely a change of
transport.

`emit` is deliberately not exported. The record format is an implementation detail of this module,
and keeping `log.info` and `log.error` as the only entry points means that when Phase 4 changes the
format there is exactly one function to edit.

**How I proved it worked.** I ran the proxy against my throwaway echo backend, and separately made
deliberately hostile calls into the logger itself.

| Case | Result |
|---|---|
| `tsc --noEmit` | clean |
| `GET`, `POST` with a body, client abort, backend killed | behaviour identical to Milestone 0.3 |
| Every line the proxy emitted, fed to `JSON.parse` | 6 of 6 parsed |
| Proxy started with stdout redirected to a file | the file is 0 bytes, and the logs still appeared on screen |
| A deliberately circular object passed as a field | fallback line written, process survived, the next request logged normally |
| `log.info('proxy.stopped')` called with no fields | compiles |
| Bad `--target`, bad `--port` | still exit 2 |

**What I understood, including the mistakes that taught me.**

- **stdout carries results and stderr carries diagnostics.** I had never had to think about the
  difference, because a terminal shows both on the same screen. The difference only appears when
  something else reads the output, and `>` captures stdout only. The reasoning and the cost are in
  the standing decisions section above.
- **The recovery path is the code that never runs, which is precisely why it is where the bugs
  are.** My first attempt at the `catch` block contained three bugs in seven lines while the happy
  path was flawless. I wrote `new Date().toISOString` without the parentheses, so `ts` held the
  function rather than the string, and `JSON.stringify` silently drops keys whose value is a
  function — the fallback line had no timestamp at all. I wrote `reason: err`, and `JSON.stringify`
  turns an `Error` into `{}`, so the line reported that serialisation had failed but never said why.
  And I forgot the `"\n"`, so the fallback ran into the following record and neither line parsed.
  `tsc` was clean on all three, because the object literal had no declared type and TypeScript
  inferred `ts: () => string` quite happily. **A recovery path I have never executed is not a
  recovery path, it is an untested assumption.** Running the circular-object case once — the single
  case the whole block exists for — put all three failures on my screen in about ten seconds.
- **`JSON.stringify` fails in more ways than I expected.** It throws on a circular structure and on
  a `BigInt`, and it silently drops keys whose value is `undefined` or a function. The throw is the
  one that matters, because `log.error` is called from inside five error handlers, which means the
  logger is now on every failure path in the proxy. The 0.3 rule about error handlers never
  terminating the process therefore applies to the logger itself. I proved the cost by adding
  `socket: req.socket` as one extra context field, exactly the sort of thing I will want at Phase 2:
  the client received no response at all, the failure was never logged, and the proxy process
  exited. A logging call that throws destroys the evidence of the original problem and adds a second
  problem on top of it. The dropped-`undefined` case was live in my own code too, because
  `NodeJS.ErrnoException.code` is optional, so a non-system error would have produced a failure line
  with no `error` key. Fixed at the five call sites with `error: error.code ?? 'UNKNOWN'`, which
  keeps the logger simple and makes the gap visible rather than invisible.
- **Spread order decides who wins a name collision.** With `{ ts, level, event, ...fields }`, a
  caller passing a field named `event` silently replaced the real event name, and I watched
  `"event":"something.else"` come out. The three identity fields now come *after* the spread, so the
  framework always wins. These records are what the Phase 3 assertion engine reads, so `event` has
  to be trustworthy.
- **`process.stderr.write` does not actually throw, so only the formatting needs guarding.** I
  assumed a failing write was a real risk and was about to structure the code around it. Measured
  against three genuine failure modes — stderr closed with `2>&-`, stderr redirected to `/dev/full`
  to simulate a full disk, and stderr on a pipe whose reader had already exited — `write()` returned
  normally every time. Node routes those errors to the stream's `error` event and handles them
  quietly for stdout and stderr specifically, rather than throwing at the call site. So keeping the
  `JSON.stringify` and the write inside a single `try` is safe here. Worth remembering as a method
  rather than only as a fact: I nearly added an entire extra layer of defence for a failure that
  measurement showed cannot happen.

**Known and deliberately deferred.**

- The fallback line loses the caller's fields entirely. That is the honest trade, because the fields
  are the thing that failed to serialise, so a recovery path that tried to include them would fail
  in the same way. It keeps the event name, the level and the timestamp, and adds
  `logFieldsDropped: true` so the record is unambiguous when Phase 3 reads it.
- `level` is typed as `string` rather than as a union of `"info" | "error"`. The two public
  functions are the only callers and both pass literals, so nothing can go wrong today. Worth
  narrowing when Phase 4 adds a level, because at that point the set of valid levels becomes part of
  the record schema rather than an internal detail.
- The record itself has no declared TypeScript type. That is exactly what let the `toISOString` typo
  through. A `LogRecord` interface would have caught it at compile time instead of at runtime, and
  is worth adding once the shape stops changing.

---

## 2026-09-09 — Phase 0, Milestone 0.5: the gate — PHASE 0 COMPLETE ✅

**What I built.** Nothing. This milestone is the gate itself. Its only job is to find out whether the
proxy is genuinely transparent to a real browser rather than to `curl`, which is a far better-behaved
client than anything real.

**What I did.** Started Spring Boot on port 8082, started shipwreck with
`npm run dev -- --target http://localhost:8082 --port 4000`, repointed the React admin panel's API
base URL at port 4000, and used the application normally — loaded the dashboard, paged through
customers, opened analytics, listed orders, logged out, and logged back in.

**How I proved it worked.** Twenty-four requests passed through the proxy. The application behaved
identically to running against the backend directly, and shipwreck logged every one of them with no
failure events at all: no `proxy.forward.failed`, no `proxy.response.failed`, and no
`proxy.forward.cancelled`.

| What a browser does that `curl` never did | Evidence in the log |
|---|---|
| CORS preflight | Every `OPTIONS` returned 200 and the real request followed it |
| Query strings | `?page=0&size=20` and `?from=…&to=…&bucket=day` reached the backend intact |
| Request bodies from a real client | `POST /api/v1/panel/login` and `POST /api/v1/panel/logout`, both 200 |
| Authentication across a session boundary | Logged out, logged back in, dashboard reloaded correctly |
| Several requests issued at once | Four requests started within 50 ms of each other, all forwarded cleanly |

**What I understood.**

- **The browser's preflight cache is visible in my own log, and so is a miss.** A cross-origin
  request that is not "simple" makes the browser send an `OPTIONS` request first, asking the server
  whether the real request is allowed. The browser then caches that answer for as long as the
  server's `Access-Control-Max-Age` header permits. At 09:46 I watched the cache work: the first
  `GET /api/v1/admin/agencies` was preceded by an `OPTIONS`, and the repeat 147 ms later was not,
  because the cached answer was still valid.

  At 09:58, after logging back in, the same path produced **two** preflights instead of none.
  Subtracting `durationMs` from each `ts` shows why: both `OPTIONS` requests *started* at almost
  exactly the same instant, 09:58:48.337. Neither could benefit from the other, because the cache
  entry only exists once the first answer has come back. Two concurrent callers both missed a cache
  that either one of them was about to fill.

  That pattern has a name — a **thundering herd**, or a cache stampede. It is the same shape as the
  backend problem where a popular cache key expires and every in-flight request goes to the database
  at once. Two things are worth taking from it. First, it doubled the request count for that path,
  which is exactly the sort of thing shipwreck exists to make visible. Second, concurrency changes
  what the network does: identical application code produced no preflight at 09:46 and two at 09:58,
  purely because the calls happened to overlap the second time.

- **My application issues the same GET twice, consistently.** `GET /api/v1/admin/agencies` appears
  twice in both sessions. It is harmless, because a GET changes nothing — and that harmlessness is
  the point. It is real duplicate-shaped traffic produced by my own code, and it is precisely the
  safe case that Phase 2's detector must *not* flag. Worth keeping as a fixture rather than fixing:
  it is free evidence for the false-positive half of the Phase 2 gate.

- **Timing on an idle machine varies by roughly seven times.** Recorded as a standing decision above,
  because it constrains how Phase 3 assertions have to be written.

- **`ts` records when a request completed, not when it started.** The value is written inside
  `res.on('finish')`. For a per-request log line that is fine. For reasoning about the gaps between
  requests it is not, because ordering by completion time is not the same as ordering by start time —
  I had to subtract `durationMs` from `ts` by hand to establish that the two preflights above were
  simultaneous. Phase 2's recorder captures a request timestamp separately, so this resolves itself
  there rather than needing a fix now.

**Known and deliberately deferred.**

- **Websocket connections are not proxied.** `http.createServer` emits an `upgrade` event for a
  connection that asks to switch protocols, and shipwreck does not listen for it, so Node closes the
  socket. My admin panel does not use websockets, so this did not come up. It belongs in the README
  as an honest limit rather than as work, because Phase 3 is the moat and this is not.
- The two items already carried forward from 0.3 and 0.4 still stand: an aborted request produces no
  `proxy.request.forwarded` line because `'finish'` only fires on a clean end, and `clientGone` is
  set on a condition slightly broader than "the client left".

---

## 2026-09-14 — Phase 1, Milestone 1.1: the fault flags ✅

**The one idea:** before a fault can be injected it has to be describable. This milestone adds the
three flags that describe one, and nothing else. No fault is applied anywhere yet.

**What I built**, all in `src/config.ts` apart from one line:

- `interface FaultConfig { latencyMs, failRate, failStatus }`, nested inside `Config` as `faults`.
  Nested rather than flattened so that the decision function in Milestone 1.2 can take a
  `FaultConfig` and never be handed the target URL or the listen port, which are none of its
  business.
- Three options on `parseArgs`: `--latency` (default `'0'`), `--fail-rate` (default `'0'`) and
  `--fail-status` (default `'500'`). The last two contain hyphens, so they are quoted in the options
  object and read back as `values['fail-rate']` rather than with dot notation.
- `parseLatency`, `parseFailRate` and `parseFailStatus` — one helper per field, the same five-step
  shape as `parsePort`.
- `proxy.listening` now reports `latencyMs`, `failRate` and `failStatus` alongside `port` and
  `target`. A startup line that states the active configuration is how a log tells me afterwards
  which mode the process was actually running in, rather than my having to remember what I typed.

**Where the bounds come from.** Latency is an integer from 0 to 300000. The upper bound exists
because `setTimeout` stops waiting and fires immediately above roughly 2.1 billion milliseconds, so
without a bound a typo would produce a silently useless run rather than an error. Fail status is an
integer from 400 to 599, because shipwreck injects *failures* — a 200 is not one — and because
`res.writeHead` throws outright on a status code outside 100–599. A throw inside the request handler
is exactly the crash the fail-soft rule forbids, so the bad value is refused at startup instead,
where exiting is allowed.

**How I proved it worked.**

| Arguments after `--target http://localhost:8082` | Exit | Result |
|---|---|---|
| *(none)* | 0 | `latencyMs` 0, `failRate` 0, `failStatus` 500 |
| `--latency 2000 --fail-rate 0.25 --fail-status 503` | 0 | all three carried through correctly |
| `--fail-rate 0.5` | 0 | `failRate` 0.5 |
| `--latency abc`, `--latency=-1`, `--latency 1.5`, `--latency 400000` | 2 | rejected |
| `--fail-rate abc`, `--fail-rate 1.5`, `--fail-rate=-0.1` | 2 | rejected |
| `--fail-status 200`, `--fail-status abc`, `--fail-status 600` | 2 | rejected |
| `--port ""`, `--latency ""`, `--fail-rate ""`, `--fail-status ""` | 2 | rejected, each naming its own flag |

**Two bugs, both in the same place.**

The first is that `parseFailRate` used `Number.isInteger`. A fail rate is a probability, and between
0 and 1 the only whole numbers are 0 and 1, so `--fail-rate 0.3` was rejected and the flag could not
express fifty percent at all. `Number.isInteger` is not a stricter version of the check I wanted; it
is a different check that happened to fit in the same slot. The right question for this field is "is
it a number at all", which is `Number.isFinite`. I got this by copying the shape of `parsePort`,
where "must be an integer" is correct, without re-deriving the condition from what a fail rate
actually is.

The second is that none of the validators checked for an empty value, and `Number('')` returns `0`
rather than `NaN`. So `--latency ""` and `--fail-rate ""` were accepted and quietly became 0, which
is a real setting meaning "never delay" and "never fail". `--port ""` and `--fail-status ""` were
rejected, but only because 0 falls outside 1–65535 and outside 400–599 — the range check caught them
by accident, not because anything asked whether a value had been supplied. Both are fixed with a
`raw.trim() === ''` check at the top of each validator, and every message now names its own flag.

**What I understood.** `parseArgs` has no concept of a required option. Every option is optional as
far as it is concerned, and it never errors because something is missing. `--port` is optional
because it has a `default`; `--target` is required only because `loadConfig` contains
`if (!values.target) fail(...)`. In other words, `parseArgs` supplies defaults and my code supplies
requirements. Because port and the three fault flags all have defaults, `raw` can never arrive as
`undefined` in those validators — the only way to get an empty string is for someone to type
`--port ""` explicitly.

---

## 2026-09-14 — Phase 1, Milestone 1.2: the fault decision ✅

**The one idea:** deciding whether to perturb a request is a different job from perturbing it.
Keeping the decision in its own pure function is what makes it testable.

**What I built**, in a new file `src/fault.ts`:

- `interface FaultPlan { delayMs: number, failStatus: number | null }` — what the proxy should do to
  one request.
- `decideFault(faults: FaultConfig, roll: number): FaultPlan` — five lines, no I/O, no randomness of
  its own.

**Three decisions.**

*The roll is a parameter, not a `Math.random()` call inside the function.* A function that rolls its
own dice cannot be tested, because every call returns a different answer. With the roll passed in,
`decideFault(faults, 0.29)` has exactly one correct result that I can assert on. The proxy will call
`Math.random()` and hand the number over. This is the entire reason the decision is a separate
function rather than a few lines inside the request handler.

*The comparison is `roll < failRate`, not `<=`.* `Math.random()` returns a value from 0 up to but not
including 1. At a fail rate of 0, `roll < 0` is never true, so nothing fails. At 1, `roll < 1` is
always true, so everything fails. Both ends come out right. With `<=`, a fail rate of 0 would fail on
the rare occasion `Math.random()` returns exactly 0.

*The plan carries a delay and a failure together, rather than being one or the other.* Someone can
pass `--latency 2000 --fail-rate 1` and mean both. A request that is slow and then fails is the most
useful fault this tool has, because that is what makes a client time out and retry — the behaviour
Phases 2 and 3 exist to detect. An either/or return type would silently throw away one of the two
flags that were typed.

**How I proved it worked.** `scripts/fault-check.ts` calls `decideFault` with fixed rolls and prints
each plan.

| Config, roll | Plan returned |
|---|---|
| `{latencyMs:2000, failRate:0, failStatus:500}`, `0.5` | `{ delayMs: 2000, failStatus: null }` |
| `{latencyMs:0, failRate:1, failStatus:503}`, `0.999` | `{ delayMs: 0, failStatus: 503 }` |
| `{latencyMs:0, failRate:0.3, failStatus:500}`, `0.29` | `{ delayMs: 0, failStatus: 500 }` |
| `{latencyMs:0, failRate:0.3, failStatus:500}`, `0.31` | `{ delayMs: 0, failStatus: null }` |
| `{latencyMs:1000, failRate:1, failStatus:500}`, `0` | `{ delayMs: 1000, failStatus: 500 }` |

That file stays in the repository. In Phase 5 it becomes the first real unit test, because the
function was built to be callable with fixed inputs from the start.

**Still not wired in.** Nothing calls `decideFault` yet. The proxy applies the plan in Milestone 1.3.

---

## Open questions

*None outstanding.* The Phase 2 question about which path the Recorder should store was dissolved by
the bare-origin decision on 3 September 2026: with no prefix there is only one path.
