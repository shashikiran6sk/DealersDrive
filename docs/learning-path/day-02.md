# Day 2 — The monorepo: pnpm workspaces and Turborepo

> **Track:** Week 1 · Orientation
> **Time:** ~3 hours · **Prerequisite:** Day 1
> **Goal in one sentence:** explain why `contracts` must build before anything
> else, what Turborepo caches, and how `--filter pkg...` shapes the Docker images.

---

## 1. Why today matters

Every build failure you will hit in your first month is a monorepo failure:
stale `dist`, a missing generated Prisma client, a cache hit that should not have
been. Three hours today saves those days.

There is also a design point hiding here. This is a monorepo for **one** reason:
`packages/contracts` defines the request and response shapes that the API
validates against and the web app renders. In four separate repositories there
would always be a window where the deployed API and the deployed web app disagree
about what a `VehicleDto` is. In one repository, one commit changes all three and
CI type-checks them together.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 30** — all of it (30.1 → 30.7) | 50 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 2.3** — why modules may not import each other's internals | 15 |
| [pnpm — Workspaces](https://pnpm.io/workspaces) | the whole page | 10 |
| [Turborepo — Configuring tasks](https://turborepo.com/docs) | "Configuring tasks" and "Caching" | 25 |

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `pnpm-workspace.yaml` | Four lines. This is the entire workspace definition |
| 2 | `apps/api/package.json` | Find `"@dealers-drive/contracts": "workspace:*"`. That protocol is why it resolves locally rather than from npm |
| 3 | `packages/contracts/package.json` | `main` and `types` point at `./dist/`. **This is why it must build first** |
| 4 | `turbo.json` | Read every line. `dependsOn: ["^build"]` — the caret is the whole lesson |
| 5 | `packages/config/package.json` | A package that ships no code, only `exports` of config files |
| 6 | `packages/config/eslint/node.js` | The module-boundary rules. Find the one that stops non-repository files importing Prisma |
| 7 | `apps/api/tsconfig.json` | See it `extends` the shared preset rather than redeclaring strictness |
| 8 | `apps/api/Dockerfile` | Only the `deps` stage today. Note that **only manifests** are copied before `pnpm install` |
| 9 | `.dockerignore` | Three lines that keep a gigabyte out of the build context |

> **The one line to understand today.** In `turbo.json`:
> ```jsonc
> "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] }
> ```
> `"build"` would mean *this package's* build. `"^build"` means *the build task
> of every package this package depends on.* That caret is what derives the whole
> execution plan.

---

## 4. Do

### 4.1 See the dependency graph resolve itself

```bash
pnpm clean
pnpm build
```

Watch the output order. `contracts#build` runs alone and first; `api#build` and
`web#build` then run **in parallel**. You never wrote that plan down — Turbo read
it from the `package.json` files.

### 4.2 See the cache

```bash
pnpm build      # again, immediately
```

Every task reports `cache hit, replaying logs`. Nothing was executed; the
recorded stdout was replayed and the `outputs` were restored from `.turbo/cache/`.

Now change one character in `packages/contracts/src/index.ts` (add a blank line)
and run `pnpm build` again. **Everything** rebuilds — because `contracts`'s hash
changed, and its hash is an input to `api` and `web`.

Undo the change and rebuild. Cache hit again.

### 4.3 Prove why `outputs` must be right

```bash
rm -rf packages/contracts/dist
pnpm build
ls packages/contracts/dist        # it is back — restored from cache, not rebuilt
```

That is what `outputs` declares. A task whose real output is not listed would
appear to succeed from cache while leaving nothing on disk.

### 4.4 Filtering

```bash
pnpm --filter @dealers-drive/api test          # one package
pnpm --filter @dealers-drive/api... build      # that package AND its dependencies
pnpm --filter @dealers-drive/web dev
```

The trailing `...` is what the Dockerfiles use:

```dockerfile
RUN pnpm install --frozen-lockfile --prod --filter @dealers-drive/api...
```

Production dependencies for the API *and* `contracts`, and nothing for `web`.
**It is why the API image contains no React.** Verify it:

```bash
grep -c "react" apps/api/package.json    # 0
```

### 4.5 Break it deliberately, then fix it

```bash
rm -rf packages/contracts/dist
pnpm --filter @dealers-drive/api typecheck
```

Read the error. It is `Cannot find module '@dealers-drive/contracts'` — the
single most common error in this repo, and now you know exactly what causes it.

```bash
pnpm build     # fixed
```

### 4.6 The Prisma variant of the same error

```bash
rm -rf node_modules/.prisma
pnpm --filter @dealers-drive/api typecheck    # fails
pnpm --filter @dealers-drive/api db:generate  # fixed
```

The Prisma client is a **build artifact**, generated from `schema.prisma`, so it
is in `.gitignore` and a fresh clone has no `PrismaClient` types at all. Both
`ci.yml` and the API Dockerfile run `db:generate` explicitly, before anything
that type-checks.

---

## 5. Prove you understood it

1. What does `workspace:*` do that a version number would not? → *§30.2*
2. Why does `dependsOn` use `^build` and not `build`? → *§30.3*
3. Why is `"cache": false` set on `test` but not on `build`? → *§30.3*
4. What is in `outputs`, and what breaks if it is wrong? → *§30.3*
5. Why does the `deps` Docker stage copy only `package.json` files? → *§30.6*
6. Why must both Dockerfiles be built from the repository root? → *§30.6*
7. What does `--filter @dealers-drive/api...` include that
   `--filter @dealers-drive/api` does not? → *§30.4*
8. Why is `packages/config` a package rather than four copied config files? → *§30.5*

---

## 6. Traps

- **`--frozen-lockfile` failing in CI or Docker** — someone installed a
  dependency without committing `pnpm-lock.yaml`. That flag is doing its job:
  it guarantees the tree CI tested is the tree the image contains.
- **A cached build that should not have been cached** — an input Turbo does not
  hash. Add it to `globalDependencies` or the task's `env`.
- **`next dev` run inside `apps/web`** — it works until you touch a contract.
  Always `pnpm dev` from the root so `contracts` is in watch mode.

---

## 7. Deliverable

- [ ] I watched `contracts` build before `api` and `web`, and those two in parallel
- [ ] I produced a cache hit, then invalidated it deliberately, then restored it
- [ ] I restored `contracts/dist` from cache without rebuilding
- [ ] I reproduced and fixed both "Cannot find module" errors on purpose
- [ ] I can explain `^build`, `outputs`, and `--filter pkg...` to someone else
- [ ] I have answered all eight questions in §5

---

## 8. Going deeper (optional)

- Open `packages/config/eslint/node.js` and find the `no-restricted-imports`
  rule enforcing ARCHITECTURE §5.5 rule 2 — *only `*.repository.ts` may import
  `platform/db/prisma`*. Try importing it from a service and watch lint fail.
  This is a **convention turned into a compiler error**, and it is a pattern
  worth copying.
