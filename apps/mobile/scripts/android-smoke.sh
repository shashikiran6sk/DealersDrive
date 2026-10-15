#!/usr/bin/env bash
set -uo pipefail
mkdir -p artifacts
if ! adb install apps/mobile/android/app/build/outputs/apk/release/app-release.apk; then
  exit 1
fi
smokeResult=0
maestro test --format junit --output artifacts/maestro.xml \
  --test-output-dir artifacts/maestro-run --debug-output artifacts/debug \
  -e APP_ID=com.dealersdrive.customer.preview apps/mobile/e2e || smokeResult=$?
adb logcat -d -s ReactNativeJS:V '*:S' > artifacts/android-logcat.txt || true
exit "$smokeResult"
