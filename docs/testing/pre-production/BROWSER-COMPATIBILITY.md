# Browser coverage limits

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

| Browser/device                       | Status       | Actual scope                                                                                                   |
| ------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------- |
| System Chromium 151, Linux           | Partial PASS | Real headless browser, clicking/typing/navigation/scrolling; desktop 1440×900, tablet 768×1024, mobile 390×844 |
| Branded Chrome desktop / Android     | BLOCKED      | Chromium engine evidence is useful; installed branded browser/real Android not available                       |
| Safari desktop / iPhone / WebKit     | BLOCKED      | Engine and real devices unavailable                                                                            |
| Firefox                              | BLOCKED      | Browser binary unavailable                                                                                     |
| Edge                                 | BLOCKED      | Browser binary unavailable                                                                                     |
| Tablet device / mobile soft keyboard | BLOCKED      | Viewport/touch emulation; no OS keyboard overlap or real tablet certificate                                    |
| Admin responsive width               | FAIL         | 423-pixel document at 390-pixel viewport, BUG-008                                                              |

Successful Chromium interactions are not a blanket BROWSER-001/005/007 PASS. No Chrome/Safari/Firefox claim is inferred from rendered HTML. Full golden paths and multi-tab context remain incomplete; see each canonical row.

Evidence: [desktop](evidence/desktop/uat.json), [tablet](evidence/tablet/uat.json), [mobile](evidence/mobile/uat.json), [role UI](evidence/targeted-browser.json), [mobile enquiry chain](evidence/golden-browser.json).
