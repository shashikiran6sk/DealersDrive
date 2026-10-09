# Enquiry scroll and portfolio address follow-up

Mobile source: `6ccf12a0699b86e49149cbeb68a940159b8eecd7` in existing PR #285.

The bottom enquiry button previously scrolled the collapsed panel before React committed the enquiry form. It now scrolls the mounted message textarea into the viewport center. Returning from sign-in and cancel/reopen follow the same timing. The field is not auto-focused, so opening the form does not force the keyboard open.

The mobile dealer address now spans the identity grid below the logo and dealer name. Tagline remains below the address. Desktop layout classes and structure are unchanged.

## Verification

- Two enquiry regression assertions fail on the old source; all 15 enquiry tests pass after the fix.
- All 37 final browser checks pass: eight phone/short/landscape enquiry scenarios, editable message fields, short-height login-return behavior, and two portfolios at ten widths.
- Three additional browser checks pass: desktop enquiry opening at 1280/1440px and mobile cancel/reopen.
- Eight matched desktop portfolio pairs at 768/1024/1280/1440px are pixel-identical. The single initially unloaded header icon was recaptured after image decoding; no source changed.
- Formatting, lint/docs, type checks and production build pass. Full-suite and exact-head CI results are recorded in the final merge report and logs.

`before/` records the initial reproduction on original mobile head `fb48fa6`. Its first directory lookup used an unsupported search key and did not add the Capital fixture; that lookup was corrected to the existing `q` query before the complete comparison. `before-final/` records the complete comparison on local combination `6a825fc`, whose enquiry and portfolio source is byte-identical to `fb48fa6`. `after/` is the final production build, including Capital Region Motors from the supplied screenshot. The before failures are expected evidence of the reported defects.

Local OTP fixtures and production builds were used. No production SMS, Google OAuth or real-device hardware checks are claimed. No enquiry was submitted during these navigation checks. No session cookie or token is archived.

Native browser harness: `browser-check.mjs`, using the existing sibling `../harness/dealer-ux-cdp.mjs` helper (adjust its import path when replaying from the archive).
