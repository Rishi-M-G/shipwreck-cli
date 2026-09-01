# shipwreck — build log

This file is written for me, not for anyone evaluating the project. The [README](./README.md)
explains what shipwreck is to a stranger. This file records what I actually did, on which date, what
I verified before believing it worked, and what I understood at the time.

Entries are in chronological order, oldest first. Each entry records the same five things: the date,
the phase and milestone, what I built, how I proved it worked, and what I decided or learned. Open
questions live at the bottom of the file so I can find them without reading the whole log.

---

## Where I am right now

- **Phase 0 — Scaffold and forwarding proxy**, in progress.
- **Milestone 0.1 — Package setup: complete and verified** (1 September 2026).
- **Next: Milestone 0.2 — argument parsing with `node:util`'s `parseArgs`.**
- Phase 0's gate has not been reached yet. The gate is: my application runs normally through the
  proxy, every request produces one structured log line, and nothing is broken.

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

**What I deliberately did not keep.** The document that quoted my old implementation line by line.
Having it available would have let me paste code back that I could not explain, which is the exact
situation I was trying to escape.

---

## 2026-09-01 — Phase 0, Milestone 0.1: package setup ✅

**The one idea for Phase 0 as a whole:** a reverse proxy receives a request on one port and relays
it to another. Nothing else in this phase — no faults, no recording. This first milestone is only
the toolchain.

**What I built.**

- `npm init`, then set the load-bearing fields in `package.json` by hand: `"type": "module"`,
  `"engines": { "node": ">=20.0.0" }`, `"bin": { "shipwreck": "./dist/index.js" }`, and the two
  scripts `"dev": "tsx src/index.ts"` and `"build": "tsc"`.
- Installed `typescript`, `tsx` and `@types/node` as development dependencies.
- Wrote `tsconfig.json` with `target: ES2022`, `module: nodenext`, `moduleResolution: nodenext`,
  `strict: true`, `declaration: true`, `rootDir: src`, `outDir: dist`, and `include: ["src"]`.
- Wrote `src/index.ts` containing a shebang line and a single `console.log`, purely so there is
  something to run.
- Wrote `.gitignore` covering `node_modules` and `dist`.

**How I proved it worked.** Three checks, all of which passed:

1. `npm run dev` printed the log line. This proves `tsx` and `tsconfig.json` agree with each other.
2. `npm run build` completed silently and produced `dist/index.js` and `dist/index.d.ts`. Silence
   from `tsc` means success.
3. `node dist/index.js` printed the same line. This is the check that matters most, because it
   proves the file the `bin` field points at is genuinely runnable on its own. If that were wrong, I
   would not find out until publish time.

**What I understood, and want to still understand in forty years.**

- **`"type": "module"` makes the package ESM**, so I write `import` rather than `require`. It has one
  consequence that will confuse me the moment I forget it: every relative import must carry a `.js`
  extension even though the file on disk is a `.ts` file. I will write `import { log } from
  './log.js'` for a file called `log.ts`. The reason is that TypeScript deliberately does not rewrite
  import paths. It is *Node* that resolves them at runtime, against the compiled output in `dist/`,
  where the file really is called `log.js`. Setting `moduleResolution: nodenext` is what makes
  TypeScript enforce this rule at compile time instead of letting me write extensionless imports
  that compile cleanly and then break at runtime.
- **The `bin` field is what will eventually make `npx shipwreck` work.** npm creates a symlink from
  the command name to that file. Two requirements come with it. The target must be the *built* file
  in `dist/`, because users of the package do not have TypeScript. And that file needs a shebang as
  its literal first line.
- **The shebang is `#!/usr/bin/env node`, not `#!/usr/bin/node`.** Using `env` means Node is looked
  up on `PATH`, so the command works regardless of whether the user installed Node through nvm,
  volta, homebrew, or a system package manager. Hardcoding the path would work only on the machine
  it was written on.
- **`engines` declares the Node 20 minimum.** This matters because `util.parseArgs`, which
  Milestone 0.2 depends on, is a modern built-in. Declaring the requirement makes npm warn someone
  installing on Node 16, instead of letting them hit a confusing runtime crash.
- **`declaration: true` emits `.d.ts` files**, so the package ships its own type definitions. That
  is a large part of why TypeScript was worth the friction in the first place.

**Decisions made.** The `package.json` name is set to `shipwreck` as a placeholder. The real npm name
is already taken, so publishing will use something else — the working candidate is `scuttle`. This is
one line to change and it gets settled at Phase 5, not now.

---

## Open questions

*Nothing outstanding yet. Questions go here as they come up, with the date I hit them, so I can tell
later whether I ever answered them.*
