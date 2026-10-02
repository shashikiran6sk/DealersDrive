# Branded 404 integration review

Existing PR: https://github.com/shashikiran6sk/DealersDrive/pull/209

Base: main `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Original PR head: `389babb3a04488afe30ab8898419fe3920c8aa78`.

Main was merged into the PR branch locally, with five conflicts resolved. The current homepage discovery/information bands and existing component IDs were preserved; new error components use C131–C135. No PR was merged. The application logger was restricted to diagnostic metadata, omitting arbitrary exception text, URL query values and unknown fields; this is a correction to the logger introduced by this PR. A new regression fails against the original logger and passes after the correction. The original baseline certification remains separate and unchanged.

## Local verification

- Uncached repository lint and typecheck: PASS.
- Full web suite: 99 files, 1,346 tests PASS.
- Targeted error suite: 138 tests PASS. The first run exposed an assertion expecting raw exception text; it was corrected to assert diagnostic categories and absence of raw text. Both logs are retained.
- Production build: PASS with `pnpm build --env-mode=loose`, needed to pass this workspace’s proxy configuration through Turbo. The initial strict-environment build failed fetching Google Fonts; both logs are retained. No font or application source workaround was used.
- Built-server Chromium UAT: unknown route, missing car and missing dealer at 1440, 768 and 390 pixels; HTTP 404, branded heading, noindex, working homepage link and no page overflow. PASS. Screenshots and `browser.json` retain each result.
- Isolated upstream unavailable/503/timeout: four public routes per condition remain 500, with safe text, retry and noindex; the BFF returns 502/503/504 respectively. Recovery returns 200. PASS. `outages.json` and three mobile screenshots retain evidence. These simulated provider failures contact no production account.

Checks above ran against the resolved merge working tree before the integration commit. The subsequent remote CI must be checked against the pushed exact SHA; these local results are not a claim of remote CI success. Original PR head CI had passed, which does not certify this updated tree. Original main’s invitation race remains BUG-001 and has not yet been fixed.

## BUG-NEW-001 — Framework logs inspect raw upstream exceptions

Severity: P2 provisional (log confidentiality; no actual production credentials or customer records were used). Reproduced: YES during the isolated 503 browser probe. The upstream returned inert private error text in `title`/`detail`. The UI and BFF suppressed it, but Next.js inspected the thrown `ApiError`, whose message and enumerable problem payload retained upstream text. Network exception causes and query-bearing exception messages are additional paths to inspect.

Root cause: filtering `lib/logger.ts` does not affect Next’s own exception logging. The raw thrown exception remains available to the framework. The metadata correction above covers the application logger only. Status: OPEN; requires its own fix layer and regression demonstrating safe framework-visible errors while preserving safe 4xx validation behavior and trace correlation. Production reachability of sensitive upstream text is not established; the unsafe sink is reproduced with inert fixtures.

Human UAT: PENDING. Firefox/WebKit and actual iOS/Android are unavailable in this environment. This review does not certify production providers or deployment readiness.
