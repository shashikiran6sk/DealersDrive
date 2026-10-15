# F108 release hardening — validation checkpoint

Immediate parent: F107 draft [#320](https://github.com/shashikiran6sk/DealersDrive/pull/320), `feat/f107-mobile-account-deletion` at `9a774251f950f00c4d5204523650c1328158400e`. Its CI/security checks pass. F108 draft [#321](https://github.com/shashikiran6sk/DealersDrive/pull/321) targets that exact predecessor; all ten mobile PRs and legal #279 remain open/draft/unmerged. Main remains a969dc2 and foundation 6180a4b. No automatic restack or history rewrite occurred.

## Changes and executed local evidence

- Pinned SDK-57 patch alignment: Expo 57.0.29, Router 57.0.27, Constants 57.0.22, Linking 57.0.13 and Metro runtime 57.0.17. Official pinned Expo Doctor 1.20.4 reports **21/21 checks PASS**. No SDK-major, backend framework or database change.
- Native tests: **23 suites / 137 tests PASS**. Added production config gates, bounded/canonical customer links, pasted +91 normalization and exception redaction/recovery. Three Python release-validator tests reject unsafe permissions/debug/cleartext/target and misaligned ELF data while requiring exact signature protection for the private receiver permission.
- Full API: **181 files / 3,515 tests PASS**, coverage statements 95.72%, branches 90.30%, functions 97.95%, lines 96.94%; existing gates pass. Website 146 files / 1,737 and contracts 29 files / 599 PASS after the initial compatible security overrides. Final root lint/types/build and sandbox rebuild must be recorded after the final lockfile/docs checkpoint.
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
