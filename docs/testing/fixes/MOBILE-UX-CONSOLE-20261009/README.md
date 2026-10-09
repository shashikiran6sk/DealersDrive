# Mobile UX corrections and dealer console cleanup

This folder follows the existing `testing_evidence` archive workflow. It is
never merged, deployed, or used as a product branch base. Product source,
permanent regression tests and durable component documentation remain in the
product PRs. Existing archive evidence is preserved.

## Mobile PR #285

- PR: https://github.com/shashikiran6sk/DealersDrive/pull/285
- Preserved baseline: `2b5561b2e36e175fee97e2b65fec28b9637e260e`.
- Correction head: `1a14c8f736c210a4f5245e338ef061fd6f972330`.
- Main base: `2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566`.
- Status: open, unmerged; all exact-head CI and Security checks passed.

Validation: 4,919 tests (1,478 web, 427 contracts, 3,014 API), root formatting,
lint, docs, types and production build passed. The two radio coexistence tests
fail on the untouched mobile baseline. 510 component cases passed (51 stories
at ten widths). All 330 final page cases fit their content width and render
without a transient error page; 66 matched desktop pairs are pixel-identical.
91 browser assertions cover the seven corrections, all implemented filter
control variants, history, rapid taps, pending/disabled/long-list states and a
short landscape CTA.

Widths: 320, 360, 375, 390, 430, 440, 768, 1024, 1280, 1440.

| Evidence | Contents |
| --- | --- |
| `mobile-before/` | Screenshots of the existing mobile branch before corrections |
| `mobile-after/` | Matched final correction screenshots |
| `desktop-mobile-correction-comparison.json` | 66 identical desktop comparisons |
| `mobile-components/` | 510 responsive component screenshots and result manifest |
| `mobile-interactions/` | Drawer status and filter first-selection screenshots; 81 assertions |
| `mobile-extra-interactions.json` | Ten further filter/history/landscape assertions |
| `filter-first-tap-before/first-tap.mp4` | Native mouse recording: applied price, unchecked mobile radio |
| `filter-first-tap-after/first-tap.mp4` | Native mouse recording: immediate and retained checked appearance |
| `filter-first-tap-*/result.json` | Checked state, applied URL and identical result total (76 cars) |
| `logs/regression-before.log` | Permanent regression tests fail on the original mobile source |
| `logs/` | Successful local verification logs |
| `harness/` | Reproducible native Chromium/CDP checks and existing isolated route fixtures |

The API, database, fixtures and fake OTP driver are local and isolated. No
production records, schemas, authentication behavior or endpoints were changed.
Restricted guest and sales routes retain their established redirects; requested
paths and actual destinations are recorded separately. Browser emulation of
short heights supplements testing and does not prove hardware keyboard behavior.

## Independent console PR and local integration

Console implementation and integration verification are ongoing. Their final
heads, checks, screenshots and functional logout evidence will be appended here
before completion. No additional product or integration PR will be opened.
