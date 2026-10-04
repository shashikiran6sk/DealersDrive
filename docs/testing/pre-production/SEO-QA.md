# Local SEO smoke and production gaps

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

Local homepage, /cars, public car and /dealers returned 200 with a title, description, canonical and two JSON-LD blocks. The canonical origin is localhost because the inspected deployment is local. robots.txt disallows all indexing in this environment; local sitemap behavior is recorded. Neither behavior is declared a production defect or launch PASS.

The API sitemap lifecycle integration tests exclude SOLD/WITHDRAWN, include ACTIVE/RESERVED, drop suspended dealers and expose only slug/date information. These support the underlying resource policy, while deployed origin, robots, social images, structured-data validity and indexing changes remain BLOCKED.

Invalid route returned HTTP 404 with default Next.js text, without Dealers-Drive branding (**BUG-007**, PUBLIC-021/SEO-009). Server failure custom experience was not injected.

Evidence: [local HTTP/meta observations](evidence/public/local-http-observations.json), [404 screenshots](evidence/desktop/not-found.png), exact public-lifecycle assertions in [api-assertions.json](evidence/ci/api-assertions.json).
