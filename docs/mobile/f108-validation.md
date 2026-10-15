# F108 release hardening — validation checkpoint

Immediate parent: F107 draft [#320](https://github.com/shashikiran6sk/DealersDrive/pull/320), `feat/f107-mobile-account-deletion` at `9a774251f950f00c4d5204523650c1328158400e`. Its CI/security checks pass. F108 draft [#321](https://github.com/shashikiran6sk/DealersDrive/pull/321) targets that exact predecessor; all ten mobile PRs and legal #279 remain open/draft/unmerged. Main remains a969dc2 and foundation 6180a4b. No automatic restack or history rewrite occurred.

## Changes and executed local evidence

- Pinned SDK-57 patch alignment: Expo 57.0.29, Router 57.0.27, Constants 57.0.22, Linking 57.0.13 and Metro runtime 57.0.17. Official pinned Expo Doctor 1.20.4 reports **21/21 checks PASS**. No SDK-major, backend framework or database change. The existing API runtime Docker target builds successfully from the final frozen lockfile; image cd1a70cbca8e7f3982b8fe49d55531b59a08d7a60ccf90bdd03b11bf7a4264c1 stays local and was never pushed or deployed.
- Native tests: **24 suites / 146 tests PASS**. Added production config gates, bounded/canonical customer links, pasted +91 normalization and exception redaction/recovery. Four Python release-validator tests reject unsafe permissions/debug/cleartext/target and misaligned ELF data while requiring exact signature protection for the private receiver permission and forbidding DTD/entity processing through a hash-pinned build-only defusedxml parser.
- Full API before the final logging-only redaction addition: **181 files / 3,515 tests PASS**, coverage statements 95.72%, branches 90.30%, functions 97.95%, lines 96.94%; existing gates pass. Website 146 files / 1,737 and contracts 29 files / 599 PASS after the initial compatible security overrides. Final root lint/types/build and sandbox static rebuild PASS after the final lockfile checkpoint; source documentation formatting/references also pass.
- Source-map export/boundary scan PASS: 1,673 Android sources; no Prisma, API/web modules, policy archives or listed build-only high-severity modules. This is not a credential scan or complete binary security assessment.
- Compatible security overrides reduce audit from 0 critical / 7 high / 9 moderate to **0 critical / 3 high / 3 moderate**; [review](security-review.md) records residual reachability and incompatible/unpatched updates. No high-severity waiver is implied.
- Approved brand masters remain byte-identical; deterministic symbol-only 512px store icon and opaque RGB 1024×500 independent symbol/wordmark graphic generated and visually inspected as raster artwork. These are not native screenshots. Existing adaptive/splash geometry and theme tests pass.

## Actual native CI, distinct from JavaScript export

At source checkpoint `d321b8901c21f7a5e6e3acfb6b66b7408f12e7dc`, [run 38677741452](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38677741452) generated and compiled arm64 release-variant APK and AAB successfully in 12m03s, using the template's debug/validation key. Gradle reported minimum SDK 24 and compile/target SDK 36. The following manifest inspection **failed**, correctly detecting unused USE_BIOMETRIC/USE_FINGERPRINT permissions plus AndroidX's app-private receiver declaration. The successor removes biometric permissions (no biometric auth feature is used) and permits the receiver only when package-matched and signature-protected; all other unexpected permissions still fail. Final-head native build, ELF/ZIP checks and artifact upload must pass before claiming native validation complete. No production AAB/signing or physical installation is claimed.

CI uses only `.invalid` HTTPS origins and a preview application ID, with no production service credentials, EAS cloud resources or upload. Artifacts expire after seven days and are explicitly unsuitable for Play. Source maps remain ignored build artifacts; no map/secret is uploaded to a third-party monitoring service.

## Check execution notes

One early API run used the host's Asia/Kolkata timezone and exposed the existing migration fixture's UTC timestamp assumption. The final run uses TZ=UTC, matching CI; production migration behavior and the fixture were unchanged. A dependency install also changed Prisma's generated-client peer path; the client was regenerated before the complete final passing run. A native link typing mismatch was corrected by converting Map entries to the URLSearchParams-supported record; tests alone were not treated as typecheck evidence. Root formatting checks are repeated after documentation edits.

Local logs: `/private/tmp/f108-api-verified.log`, `f108-regression.log`, `f108-native-tests-verified.log`, `f108-native-types-verified.log`, `f108-native-lint-verified.log`, `f108-expo-doctor-final.log`, `f108-native-initial.log`, `f108-export-final.log`. Temporary logs are not permanent CI artifacts. Final GitHub heads/checks belong in the stack manifest checkpoint and PR.

## Remaining acceptance and rollback

Optional local Maestro guest/link smoke flows and the [full acceptance matrix](acceptance-tests.md) are prepared but **not executed** on Android; no emulator, real-device, TalkBack, installed screenshot, live provider or performance result is fabricated. The host has no JDK/SDK. Local Chrome visual review was blocked by automatic approval review over unrelated profile identifiers; no workaround was attempted.

Production remains [NO-GO](production-acceptance.md): actual deletion fulfilment/retention/operator approval, approved legal publication, residual security findings, live MSG91/DLT validation, installed/physical testing, measured performance/crash monitoring and final package/signing/App Links/Play Console requirements are unresolved. EAS profiles and build guards are configuration only; no project/key/resource or submission was created. Native UI rollback can revert this child independently; preserve F107 deactivation enforcement, revocation and consent evidence. Migration/deployment and Play submission require separate owner authorization.

## Security scanner correction

The first final-head security run flagged standard-library XML parsing in the build validator. A hash-pinned, build-only defusedxml 0.7.1 wheel now forbids DTDs/entities/external access explicitly, with a passing adversarial DTD test. The secret scanner also captured the exact documentation phrase `duplicate/unknown` after the word credentials. Its independently calculated entropy (3.6901165) matches the finding; it is prose, not an issued credential. The existing generic-api-key rule now allows only that exact noncredential captured value, without excluding a file, path, commit or rule. Local full-history gitleaks scans 681 commits / ~97.6 MB with no findings. Shared history is preserved and no credential finding is hidden. Local Semgrep using the same rule packs reports zero ERROR/HIGH/CRITICAL findings (44 advisory WARNING/MEDIUM findings); no scanner rule was disabled. Final GitHub security checks remain required.

## Native emulator follow-up at 0305fb26

[Run 38679375097](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38679375097) compiles arm64/x86_64 APK/AAB and passes merged-manifest, ELF and ZIP alignment inspection. Android 16/API 36 Pixel 5 emulator boots at 1080×2340, 440 dpi; installation succeeds. Guest/Profile/Saved/About smoke passes in 31 seconds. The public car-link test fails because Back is absent. A new regression reproduces route loss using React Native's URL implementation with the installed Router extractor; custom paths now normalize through the configured web origin and the native adapter returns a canonical HTTPS URL for internal route extraction. Seven cold/warm mapping/refusal cases and all 146 native tests pass locally. Final emulator confirmation is pending.

Artifact 11947079272 contains the APK/AAB, manifest merger report and truthful JUnit failure. No PNG survived collection because Maestro 2.11 requires an explicit test-output directory. The successor sets that directory, captures the link screen before asserting, gathers preview-only native logs, and uploads UI evidence separately from binaries. No screenshot or passing link test is fabricated.

The final logging-only defence redacts reactivationToken at root/one-level nesting and any accidentally logged req.body; the request logger already omits request bodies. Both logger/actual local transport suites pass 40 tests. No real Grafana service or customer credential is used. Final CI reruns the complete regression suite after this addition.

## Emulator host failure and release-task environment

At c531b244, native compilation/manifest/ELF/ZIP and all regular CI/security checks pass, but both emulator assertions are obstructed by an Android **System UI** ANR dialog. Actual screenshots and JUnit are preserved in [run 38682124954](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38682124954), UI artifact 11949028363. The Home screen is visible behind the system dialog; no application-crash conclusion or passing end-to-end result is inferred. The next run uses the official AOSP default x86_64 image at the same API 36 (availability verified against Google's SDK repository), removing unrelated Google-service first-boot work without dismissing/suppressing ANRs. Crash/last-ANR diagnostics remain in the artifact.

The installed Turborepo 2.11.7 docs were read before extending the mobile build environment allowlist with package/version/App Links/release-gate inputs. They are passed and hashed explicitly, preventing stale environment reuse. A preview export with version 7 and matching HTTPS App Links host passes through Turbo; a separate version-0 export correctly fails the positive-version guard. No production release approval flag was activated.

## Final standard CI verification at e52d1fd4

[CI run 38697170494](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38697170494) passes all existing gates on e52d1fd4: contracts 599, website 1,737, API 3,516 and native 146 tests; 24 native suites pass. Lint/types/build, infrastructure validation, dependency audit and the independent Semgrep/gitleaks checks are successful. The final cached API image rebuild also passes (4963737a4d783cfd6ffe7f2162ac31ad4111dd74c1466fdb405369bdf38f8965); runtime imports pass with network disabled. This is separate from the still-pending final native emulator run.

## AOSP API 36 host bootstrap remains blocked

At e52d1fd4, compilation, manifest/ELF/ZIP, standard CI and security pass. The AOSP API 36 smoke is obstructed by **Quickstep isn't responding**; captured last-ANR diagnostics identify com.android.launcher3 with no focused window before the app starts. UI artifact 11955229116 in run 38697170490 preserves the actual failure. This is not a passing app smoke result and does not waive Android 16 device validation.

The next isolated smoke uses supported Android 15/API 35 AOSP while retaining target/compile SDK 36 and the Android 16 release gate. Android's official wait-for-broadcast-idle command is bounded to 60 seconds before/after install; ANR dialogs are never dismissed automatically. Home and car Back assertions now use app-specific test IDs, preventing accidental matches on OS navigation buttons. All 146 native tests, lint/types and Actionlint pass after this test-only accessibility instrumentation.
