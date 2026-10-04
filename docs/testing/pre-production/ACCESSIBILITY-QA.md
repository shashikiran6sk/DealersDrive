# Accessibility observations and gaps

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

Keyboard Enter submitted public search. Gallery Close and Escape worked after reopen. Selectors used visible field labels, meaningful button names, heading/form association and account-menu names. Mobile enquiry identity and Verified text were visible. STAFF close controls were absent; the server separately denied privileged transitions. OWNER invite had a labelled dialog and cancellation controls.

These are observations, not a WCAG or screen-reader certificate. No complete automated accessibility scan, contrast audit, focus-order/trap audit, screen-reader run, keyboard-only Admin/dealer form traversal or real mobile keyboard test was completed. UX canonical cases remain BLOCKED unless explicitly mapped to a reviewed execution. Root-level page error listeners in the initial Chromium UAT recorded no unhandled page errors, but do not establish all recovery/error boundaries.

Evidence: [browser action logs](evidence/desktop/uat.json), [targeted UI](evidence/targeted-browser.json), [mobile golden chain](evidence/golden-browser.json). The generic 404 fails custom experience requirements (BUG-007).
