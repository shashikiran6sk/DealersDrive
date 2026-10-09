# PR 1 — browser favicon lettering

PR: [#287](https://github.com/shashikiran6sk/DealersDrive/pull/287)
Branch: `feat/dd-favicon-sizing` · Base: `main`
Baseline: `5ce6df503a33df0c199ac90e7a2941ead8c70bcb`
Final head: `6bc012858d389a113790e8c9aee6f196f333de86`.
State: OPEN, unmerged, auto-merge disabled. No production deployment.

## Implementation and exact outline preservation

The browser glyph shrank from 388×272 to 291×204 pixels at 512px: exactly 25%
in both dimensions. It remains centered. Every alpha pixel of the previous
rounded tile matches, including the ICO's 16/32/48px frames. The homepage
logo, Apple icon, manifest and installed-app icons are unchanged. See
`asset-verification.json` and the actual ICO frame captures under `before/`,
`pre-pr/` and `post-pr/`. These are decoded implementation assets; they are
explicitly not screenshots of browser-tab chrome.

PR 1 also enables the unchanged CI/security jobs on the approved stacked
parent branches and preserves the initial campaign audit in product docs.
No schema, API, auth or authorization change is introduced.

Two post-creation blocking findings were fixed on the same branch:

1. GitHub's initial run exposed a timing race in the existing enquiry test:
   DOM appearance can precede the scrolling effect. `waitFor` now awaits the
   identical assertion. No assertion or threshold was removed. The failed
   run is preserved in `ci-initial-failure.txt`.
2. Vercel failed inside Next's Google font loader. The same Manrope 4.504 font
   is now bundled under OFL 1.1. `font-verification.json` confirms 218 compared
   Latin glyph outlines and all advance widths are unchanged. The compressed
   full variable font is 53,804 bytes. The build passes inside the restricted
   sandbox, without a build-time Google Fonts connection.

## Executed validation

| Category                  | Result                  | Evidence                                                                                          |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| Formatting / lint / docs  | PASS                    | `final-lint.txt`; clean feature diff                                                              |
| Typecheck                 | PASS                    | `final-typecheck.txt`, all packages and sandbox                                                   |
| Contracts                 | PASS — 427 tests        | `final-tests.txt`                                                                                 |
| Frontend                  | PASS — 1,488 tests      | `final-tests.txt`                                                                                 |
| API unit + integration    | PASS — 3,014 tests      | `final-tests.txt`, real local PostgreSQL                                                          |
| Coverage                  | PASS existing 90% gates | API 96.98% lines / 90.24% branches; contracts 98.73% lines / 95.21% branches                      |
| Migration / data          | PASS baseline suite     | Existing clean/legacy scratch migrations; no new schema                                           |
| Targeted corrective tests | PASS — 47 tests         | SEO, error shells and enquiry panel, separate focused execution                                   |
| Production build          | PASS                    | `network-restricted-build.txt`, all three build tasks executed                                    |
| Favicon assets            | PASS                    | Exact 25% shrink, centering, unchanged rounded alpha, valid ICO frames and unchanged brand assets |
| Browser                   | PASS                    | `post-pr/browser-results.json`: six routes, icon links and HTTP 200 assets                        |
| Responsive / fonts        | PASS                    | 320/360/390/768/1280px; no document overflow, actual local font loaded; 390px at DPR 2            |
| Light/dark                | PASS asset review       | Actual native-size ICO frames and enlarged previews on both backgrounds                           |
| Required GitHub CI        | PASS latest head        | `github-status.json`; CI and Security runs record this exact head                                 |
| Vercel preview            | PASS latest head        | Final preview succeeds after the font correction                                                  |

The complete local suite passed before creation, after creation, after the
scroll-test correction, and after the font correction. Final executed count:
4,929 passing tests. These are suite assertions, not a claim that all historical
556 canonical/manual certification scenarios were executed.

The first uncontrolled baseline had environment/timezone failures and is
preserved. Controlled test command:

```sh
TZ=UTC APP_ENV=local pnpm run test --env-mode=loose
```

The initial post-creation browser attempt encountered local API shutdown during
fixture restart, then a harness assertion incorrectly expected the light header
logo where main uses the dark variant. The fixture was restored and the harness
was corrected against source. Final route/overflow/font assertions passed;
neither was hidden as an application success.

## Privacy and reproduction

All API/browser fixtures are local. No production database, real SMS, email or
KYC provider operation occurred. Screenshot email/phone text is masked before
capture. Logs redact emails/phones and local repository paths, remove terminal color codes and normalize trailing whitespace. No credentials,
OTPs or private documents are included. Browser automation uses isolated local
Chrome and production Next builds. The before-stage preview uses preserved main
icon bytes on otherwise unchanged page code; the report records that boundary.

`browser-harness.mjs` and `asset-harness.mjs` preserve the actual checks; adjust
their local paths before rerunning. ICO previews and page screenshots are real
browser renders. Real OS/browser favicon-cache behavior, browser tab chrome and
physical high-DPI devices remain owner UAT. Deployment cache behavior cannot be
tested because production deployment is prohibited.

## Post-PR quality record

PR number / URL: #287, linked above.
Files changed: `changed-files.txt`.
Migrations / API / security-domain changes: none.
UI changes: favicon only; same font is hosted locally for build reliability.
Tests failed on final local execution: zero.
CI and Security: all required checks PASS on the final head; run URLs in `ci-run.json` and `security-run.json`.
Known limitations: browser-native cache/theme/device UAT; six high and six
moderate dependency advisories, zero critical.
Next PR: email uniqueness, only after final-head gates pass.
MERGED: NO.
