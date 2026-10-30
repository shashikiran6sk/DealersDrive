# Reproducing browser evidence

Use Node 24, Chromium CDP, the existing dependency tree, production Next builds,
Storybook and isolated seeded APIs. Source heads are in the readiness report.
No production data or credentials are required.

Page/native scripts default to CDP 9226. Component checks use a separate browser
profile at 9227 to avoid renderer contention. `dealer-ux-cdp.mjs` accepts
`CHROME_DEBUG_URL`. Copy these scripts to `/tmp` or adjust their explicit
evidence output and route-fixture paths.

| Command                                                | Purpose                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `node dealer-ux-pages.mjs PHASE BASE_URL`              | 33 routes × ten widths; `UX_ROUTES` can restrict affected routes                                    |
| `node dealer-ux-console-check.mjs console BASE_URL`    | Four real API metrics and responsive geometry                                                       |
| `node dealer-ux-cookie-check.mjs console BASE_URL`     | Real fake-OTP, public workspace entry and desktop logout; untouched-main cookie baseline is on 3008 |
| `node dealer-ux-cookie-check.mjs integrated BASE_URL`  | Drawer, nested Escape, saved cars, enquiry and session revocation                                   |
| `node dealer-ux-console-edge.mjs PHASE STORYBOOK_PORT` | Menu keyboard behavior, long names and 200% text fixture                                            |
| `node dealer-ux-integrated-gallery.mjs`                | Native gallery controls and short height on Storybook 6006                                          |
| `node dealer-ux-all-components.mjs`                    | From integration repo root: all 57 stories and permanent short-gallery checks                       |

Page fixtures use the existing API in development auth mode on 4000. Real
cookie-session checks use the same API in cookie mode on 4001 with web origin
3006, existing fake OTP and jobs disabled. The fictional seed owner is used.
Session values are read only in memory to verify HTTP 200 before logout and
HTTP 401 afterward, and never written to evidence.

Run full package tests after stopping Storybook, Next previews and test
browsers. API suites must not initialize their shared isolated test database
concurrently. Existing tests, timeouts and coverage settings remain unchanged.
Diagnose and rerun resource/readiness errors; reject error pages and genuine
layout failures rather than weakening assertions.
