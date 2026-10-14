# F101 native authentication UI — validation checkpoint

Immediate base: feat/f100-mobile-auth-backend at 8ec6b2da319166bd5dde01917daec541158dc454 / draft PR #313. F099 #312 and F100 #313 reported all GitHub checks successful. Both remain open/unmerged, above PR #279 / 6180a4b. Main is unchanged.

Scope: native phone/OTP/name screens, SecureStore/session restoration/logout, protected Saved entry/Profile identity, deterministic pending intent and native current-policy reader. Uses approved branding, shared schemas and F100 routes. No backend/API/DB/provider/legal-content changes or new dependency.

Executed mobile checks: seven suites / 47 tests pass with clean process exit; API bounds, bearer allowlist/empty logout/redirect rejection, session restoration, invalid/corrupt/expired credentials, stale-account races, secure write/logout/cancel races, OTP foreground behavior, pending owner/once/process-death handling and unticked signup choices. Type checking and native lint pass. Android Hermes export succeeds (3.8MB); inspected bundle lacks server-secret identifiers and legal archive entry points. Artifact sizes are not performance benchmarks.

Root lint/types and documentation checks pass. Saved inventory/save effects arrive in F104 and enquiry consent/submission in F105; this milestone does not invent saved records or submit enquiries. Live MSG91/DLT, installed Android build/screenshots/back/keyboard/autofill/network behavior remain unverified because no SDK/JDK/emulator/physical device is available locally. No fake Android screenshots are provided. Later native build CI/device acceptance remains a release gate.

See [implementation details](../code/mobile/auth.md). Local checks do not imply remote CI or launch readiness. New native server capability remains off by default until independently approved provider/legal activation. No PR merge/deployment/Play upload is authorized.

## CI follow-up

The first shared-runner CI failed the first form fixture at its 10-second timeout while other workspaces tested concurrently; security/secret checks passed. The focused follow-up removes unused countdown updates from phone/name phases and uses deterministic fake clock control in form tests. All 47 mobile tests, native lint and types pass locally in an isolated F101 worktree. The timeout assertion remains unchanged; no history or base is rewritten. Remote revalidation is pending the normal follow-up push.
