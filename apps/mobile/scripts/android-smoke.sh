#!/usr/bin/env bash
set -uo pipefail
mkdir -p artifacts
if ! timeout 60 adb shell cmd activity wait-for-broadcast-idle > artifacts/boot-ready.txt; then
  adb shell dumpsys activity lastanr > artifacts/android-last-anr.txt || true
  exit 1
fi
if ! adb install apps/mobile/android/app/build/outputs/apk/release/app-release.apk; then
  exit 1
fi
if ! timeout 60 adb shell cmd activity wait-for-broadcast-idle > artifacts/install-ready.txt; then
  adb shell dumpsys activity lastanr > artifacts/android-last-anr.txt || true
  exit 1
fi
smokeResult=0
if ! adb shell am force-stop com.dealersdrive.customer.preview; then exit 1; fi
if ! adb shell am start -n com.dealersdrive.customer.preview/.MainActivity; then exit 1; fi
if ! adb shell am start -n com.dealersdrive.customer.preview/.MainActivity -a android.intent.action.VIEW -d dealersdrive://car/missing-release-validation-car; then exit 1; fi
maestro test --format junit --output artifacts/maestro-startup-window.xml \
  --test-output-dir artifacts/maestro-startup-run --debug-output artifacts/startup-debug \
  -e APP_ID=com.dealersdrive.customer.preview apps/mobile/e2e-startup-window.yaml || smokeResult=$?
maestro test --format junit --output artifacts/maestro.xml \
  --test-output-dir artifacts/maestro-run --debug-output artifacts/debug \
  -e APP_ID=com.dealersdrive.customer.preview apps/mobile/e2e || smokeResult=$?
adb logcat -d -s ReactNativeJS:V '*:S' > artifacts/android-logcat.txt || true
adb shell dumpsys activity lastanr > artifacts/android-last-anr.txt || true
adb logcat -b crash -d > artifacts/android-crash-log.txt || true
exit "$smokeResult"
