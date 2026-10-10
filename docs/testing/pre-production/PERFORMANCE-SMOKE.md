# Loopback performance smoke

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

Built web app, one process, tiny synthetic DB, six sequential requests per public route, including response body consumption. All sampled endpoints returned 200. Results are HTTP smoke timings, not browser LCP/INP/CLS, provider latency, production throughput or a load-test/SLA result.

| Path                                            | HTTP | Six local samples: middle sample / maximum (ms) |
| ----------------------------------------------- | ---- | ----------------------------------------------- |
| `/`                                             | 200  | 19 / 52                                         |
| `/cars`                                         | 200  | 21 / 34                                         |
| `/car/2023-hyundai-creta-sx-o-katpadi-659cfc1d` | 200  | 20 / 26                                         |
| `/dealers`                                      | 200  | 13 / 15                                         |
| `/robots.txt`                                   | 200  | 3 / 8                                           |
| `/sitemap.xml`                                  | 200  | 4 / 15                                          |

Evidence: [samples](evidence/public/local-http-observations.json). Cold starts, concurrency saturation, production-size data/index plans, CDN caching and remote storage remain untested. The timings do not contribute blanket canonical PASS.
