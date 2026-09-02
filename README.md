# shipwreck

**Chaos proxies break your app. Shipwreck breaks your app and then tells you whether it survived.**

A command-line tool that sits between a frontend and its backend, injects controlled network
faults, and then **grades how the application responded**. It produces a pass/fail resilience
report and a non-zero exit code on failure, so it can gate a CI pipeline.

> **Status: in active development. Phase 0 of 6.**
> This is not installable yet. The command-line interface parses and validates its arguments, but
> the proxy itself is not built. See [PROGRESS.md](./PROGRESS.md) for the dated build log.

---

## The problem

Your application talks to its backend over a network. On a developer's machine that network is
effectively perfect, so client-side failure handling is almost never exercised. In production the
network is not perfect: requests are slow, servers return 5xx responses, and connections drop
partway through.

The failure mode that matters most is subtle. A request times out. A timeout does **not** mean the
request failed to arrive — it may have arrived, mutated state on the server, and only the *response*
was lost. If the client then retries a non-idempotent request, the mutation happens twice. This is
the exact mechanism behind double-charging in payment systems.

You cannot see that bug by looking at the user interface. You can only see it by watching the wire.

## How it works

Shipwreck is a reverse proxy: a server that stands in front of another server and relays traffic to
it. You point your frontend's API base URL at shipwreck's port instead of the backend's port.

```
frontend  ──▶  shipwreck (listen port)  ──▶  backend (target)
                     │
                     ├─ records every request and response
                     ├─ optionally injects a fault
                     └─ evaluates the recorded traffic against expectations
```

Every request follows the same pipeline:

1. **Receive** the incoming request on the listen port.
2. **Record** its identity: method, path, a hash of the body, selected headers, a timestamp.
3. **Decide** whether to perturb it, based on the active fault configuration.
4. **Forward** it to the real target and await the response.
5. **Record** the outcome: status and duration.
6. **Return** the response to the caller.

Because it is a proxy, it works on any stack and requires **zero changes to the application's code**.

## Why this exists when chaos proxies already do

Fault injection is a crowded space. Toxiproxy, chaos-proxy, Trixter and several npm packages all
inject latency and errors. Every one of them is **input-side only**: they break things and leave you
to eyeball the interface and guess whether the app coped. **None of them close the loop.**

Shipwreck's value is entirely in the verification layer. Fault injection is table stakes; the
assertions are the product.

### What it will assert (all network-observable)

| Expectation | Question it answers |
|---|---|
| `retriesOnFailure` | After the injected failure, did the client send the request again? |
| `backsOff` | Did the gaps between retries grow, or did the client hammer the server in a tight loop? |
| `noDuplicateMutations` | Did a state-changing request get sent twice because of a timeout-and-retry? |
| `eventuallySucceeds` | Once the fault cleared, did a request for that resource ultimately succeed? |

Every result carries **evidence** — the specific recorded requests that support the verdict. A
report that says "fail" without showing why is a report nobody trusts.

## Command-line interface

This section documents what is actually implemented, not what is planned.

```
shipwreck --target <backend-url> [--port <number>]
```

| Flag | Required | Default | Rules |
|---|---|---|---|
| `--target` | yes | — | Must parse as a URL, use an `http:` or `https:` scheme, and be a bare origin with no path, query or fragment. |`--port` | no | `4000` | Must be an integer between 1 and 65535. |

**The target must be a bare origin.** `--target http://localhost:8080` is valid; a trailing slash is
fine. A path, query string or fragment is rejected, because your client already sends the path and a
proxy that rewrites paths is no longer transparent — the path your app sent would stop being the path
your backend received. If your API lives under a prefix, keep the prefix in your client's base URL
and point that base URL at shipwreck: `http://localhost:4000/api`.

Anything that fails validation produces a single-sentence message on **stderr** and exit code `2`.
No failure path prints a stack trace. The full set of cases the CLI is checked against lives in
`check.ps1` at the repository root.

## Honest limits

These are stated up front on purpose. A tool that claims certainty it does not have is a tool a
reviewer stops believing.

1. **Duplicate and retry detection is a strong heuristic, not a proof.** Identity is computed as
   `method + normalizedPath + sha256(body)`. Headers are deliberately excluded, because they carry
   timestamps and tokens that would make two identical requests look different. But bodies can also
   carry nonces — a client-generated UUID, a timestamp, a CSRF token — and a nonce defeats naive
   fingerprinting. Configurable field normalization is a later feature, not a v1 guarantee.
2. **Version 1 asserts on network-observable behaviour only.** It knows what requests were sent,
   when, and with what body. It does not know whether a spinner appeared or an error toast rendered.
   Assertions on UI state would require a browser driver and are explicitly out of scope.
3. **Shipwreck tests an application you own, running locally.** It is not a penetration-testing
   tool and must never be pointed at a third-party host.

## The exit-code contract

This is the detail that makes the tool usable in continuous integration, so it is treated as a
public interface rather than an implementation choice.

| Code | Meaning |
|---|---|
| `0` | Every assertion passed |
| `1` | An assertion failed |
| `2` | Configuration or usage error |

The payoff is that `shipwreck run scenario.ts && deploy` only deploys when resilience actually held.

## Technical decisions

- **TypeScript, strict mode.** The package will ship its own type definitions. `any` is treated as a
  defect rather than a shortcut, because it switches off checking for everything downstream of it.
- **Node built-ins first.** `node:http` for the proxy core, `node:util`'s `parseArgs` for arguments,
  `node:crypto` for hashing. Every dependency in a security-adjacent tool is a supply-chain surface,
  and a lean dependency tree is itself a selling point. A dependency gets added only when
  hand-rolling is genuinely worse. There are currently **zero runtime dependencies**.
- **ESM**, Node 20 or newer.
- **Vitest** for tests. Integration tests spin up a throwaway target server inside the suite, so
  runs are deterministic and touch no real network.
- **Fail soft.** An internal error in shipwreck must never crash the development loop it is sitting
  in front of. On error it logs loudly with a structured event and keeps forwarding. Fail soft means
  *degrade and shout*, never *degrade and hide*.
- **Catch narrowly.** A `try` block holds the one call that can throw, never a whole function body.
  A broad catch relabels the developer's own bugs as user errors and discards the stack trace that
  would have located them.
- **Structured logging throughout**, including shipwreck's own logs — event-name messages with named
  fields, such as `log.info('proxy.request.forwarded', { method, path, status, durationMs })`, never
  concatenated strings. This is a tool about observability discipline, so its own logs should be the
  reference example.

## Build plan

Each phase has a gate. The next phase does not begin until the current gate passes.

| Phase | Deliverable | Gate | Status |
|---|---|---|---|
| 0 | Scaffold and forwarding proxy | The app runs normally through the proxy and every request is logged | 🔧 in progress |
| 1 | Fault injection (latency, failure) | The flags visibly change application behaviour | ⬜ |
| 2 | Request recording and fingerprinting | A duplicate POST is detected, and a non-duplicate is *not* flagged | ⬜ |
| 3 | Scenario and assertion engine | One expectation gives a real pass on good traffic and a real fail on bad traffic | ⬜ |
| 4 | Resilience report | Terminal scorecard, JSON output, correct exit codes | ⬜ |
| 5 | Tests, docs, publish | Tests green, limits documented, publish dry-run clean | ⬜ |

## A note on the name

The project is called **shipwreck**. The npm package name `shipwreck` is already taken by an
actively published Siren Hypermedia UI, so the published package will use a different name. The
working candidate is **`scuttle`** — to scuttle a ship is to deliberately sink your own, which is
exactly what this tool does to your application. This is one line in `package.json` and gets settled
at Phase 5.

## Licence

Not yet chosen. To be decided before publishing.