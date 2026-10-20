# Run Dealers-Drive Android on macOS

This runbook covers Android Studio, local Docker services, the deployed AWS API, and physical Android phones. Commands are for macOS/zsh and the existing pnpm workspace. No PR merge, cloud build or Play upload is needed for the local workflows.

Use the complete mobile stack on `feat/f108-mobile-release-hardening`. The Android implementation is not on `main` while its PRs remain unmerged. Preserve existing work before switching branches; do not reset, rebase or merge the stack to follow this guide.

Verified against source `e0874e6a37f762d3dc5685c70063ef447e81c63d` on **15 October 2026**. These are setup instructions, not a claim that Android Studio is installed or that these workflows have been executed on your Mac. The GitHub Linux emulator build passed guest and public-link flows; full authenticated and physical-device acceptance remain separate.

## Choose your setup

| Setup                                   | Build / package                                      | Backend                                      | Metro required?       | Best use                                                        |
| --------------------------------------- | ---------------------------------------------------- | -------------------------------------------- | --------------------- | --------------------------------------------------------------- |
| **1. Local Docker — recommended first** | Development/debug, `com.dealersdrive.customer.dev`   | Local API, database and web containers       | Yes                   | Full customer testing with local fake OTP and synthetic records |
| **2. AWS-connected release mode**       | Preview/release, `com.dealersdrive.customer.preview` | `https://api.dealers-drive.com`              | No after installation | Public inventory, images and dealers with optimized JavaScript  |
| 3. API on the Mac                       | Development/debug, `.dev`                            | Host API/web; Docker backing services        | Yes                   | Fast backend reloads and debugging                              |
| 4. USB phone                            | Either build above                                   | Local via ADB forwarding, or AWS via HTTPS   | For debug builds      | Real keyboard, scrolling, storage and lifecycle testing         |
| 5. Staging                              | Preview/release, `.preview`                          | Separately authorized compatible staging API | No after installation | Recommended next step for authenticated release testing         |
| 6. Existing CI APK                      | Preview/release, `.preview`                          | Reserved `.invalid` addresses embedded in CI | No                    | Guest shell, branding, navigation and failure states only       |

**Build type, API destination and production approval are separate settings.** Your requested “prod mode” is setup 2: Android's `release` variant pointed at AWS, retaining the test `.preview` identity and validation signing. The actual `production` app configuration is reserved for separately approved package/signing/App Links work. Ordinary testing does not require `APP_RELEASE_APPROVED=true`.

## Contents

- [One-time Mac setup](#one-time-mac-setup)
- [Environment files and networking](#environment-files-and-networking)
- [1. Android Studio with local Docker backend](#1-android-studio-with-local-docker-backend)
- [2. Release-mode app connected to AWS](#2-release-mode-app-connected-to-aws)
- [3. Run the API and website directly on macOS](#3-run-the-api-and-website-directly-on-macos)
- [4. Physical Android phone](#4-physical-android-phone)
- [5. Other useful ways to test](#5-other-useful-ways-to-test)
- [Switch environments](#switch-environments)
- [Troubleshooting](#troubleshooting)
- [Sources and verification](#sources-and-verification)

## One-time Mac setup

### Install the tools

Install missing tools yourself; writing this guide does not install or change them.

| Tool               | Requirement / purpose                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js            | **24**, matching `.nvmrc`; use your existing Node manager                                                                               |
| pnpm               | **9.15.9**, matching `packageManager`                                                                                                   |
| Android Studio     | Native IDE, SDK Manager and Device Manager; download the Apple Silicon or Intel edition for your Mac                                    |
| JDK                | **21**, matching the passing Android CI job                                                                                             |
| Android SDK        | Platform **36**, Build Tools **36.0.0**, Platform Tools and Android Emulator                                                            |
| Native build tools | NDK **27.1.12297006**, CMake **3.30.5**, from the installed React Native configuration; install via SDK Manager if Gradle requests them |
| Docker Desktop     | Required for setups 1/3; start it before starting containers                                                                            |

In Android Studio:

1. Open **Settings → Languages & Frameworks → Android SDK**; labels may vary by Studio version.
2. Install SDK Platform 36. Under **SDK Tools**, enable **Show Package Details** to select the exact Build Tools, NDK and CMake versions. Accept licenses.
3. Open **Tools → Device Manager**, or **More Actions → Virtual Device Manager** on the welcome screen.
4. Create a Pixel virtual device with an **arm64-v8a** image on Apple Silicon or **x86_64** on Intel. Start with Android 15/API 35; add Android 16/API 36 for release validation. The emulator OS can be API 35 while the app compiles/targets API 36. The observed app minimum is API 24.
5. When opening the native project, select JDK 21 under **Settings → Build, Execution, Deployment → Build Tools → Gradle**.

Add these to your own shell configuration if needed, adjusting the SDK path to match Studio:

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Open a new terminal and verify:

```bash
node --version
pnpm --version
java -version
adb version
emulator -list-avds
adb devices -l
docker compose version
```

Select Node 24 first. If pnpm is missing, one installation option with that Node active is `npm install --global pnpm@9.15.9`. Keep the SDK's `adb` on PATH; do not copy it into macOS system directories. This repository uses JDK 21 even if a generic Expo tutorial shows an older JDK.

### Prepare the workspace

From the repository root:

```bash
cd /Users/shashikiran/Development/dealers-drive
git branch --show-current
git status --short
pnpm install --frozen-lockfile
pnpm --filter @dealers-drive/contracts build
pnpm --filter @dealers-drive/api db:generate
```

For another clone, substitute its root path. Install with development tools available, not under `NODE_ENV=production`. No dependency version changes are needed.

Android native files are generated in `apps/mobile/android` and ignored by Git. Open **that folder** as the Android Studio Gradle project after prebuild below, rather than opening the repository root as an Android project.

## Environment files and networking

| Location                                         | Read by                                             | Contents                                                        |
| ------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------- |
| Root `.env`                                      | Host API, Prisma, website and Compose interpolation | Backend/database/provider configuration; keep private and local |
| `apps/mobile/.env.local`                         | Expo and its JavaScript bundler                     | Three public app settings below                                 |
| `/private/tmp/dealers-drive-mobile.compose.yaml` | Compose when explicitly passed with `-f`            | Local native-auth/legal test overrides                          |
| `apps/mobile/android/local.properties`           | Gradle, if Studio creates it                        | Machine SDK path; ignored native project                        |

Example mobile settings:

```dotenv
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_WEB_BASE_URL=http://localhost:3000
```

API/web values must be **origins**: no `/v1`, other path, query, fragment or credentials. The client adds endpoint paths. Preview/production configurations require HTTPS; development permits HTTP. Mobile public settings are compiled into the bundle. Never place database URLs, MSG91 keys, server signing secrets or AWS secrets in that file or an `EXPO_PUBLIC_*` variable.

Each `cat > ...` recipe below replaces the indicated local file; preserve any custom configuration you need first. Root `.env` and mobile `.env.local` are ignored. After creating them, verify with `git check-ignore .env apps/mobile/.env.local`.

Use a separate terminal for mobile. Before switching recipes, stop Metro and remove old shell overrides there, because exported values can override files:

```bash
unset EXPO_PUBLIC_APP_ENV EXPO_PUBLIC_API_BASE_URL EXPO_PUBLIC_WEB_BASE_URL
unset APP_RELEASE_APPROVED APP_ANDROID_PACKAGE APP_ANDROID_VERSION_CODE APP_LINK_HOST
unset EXPO_NO_DOTENV EXPO_NO_CLIENT_ENV_VARS
```

Do not use `NODE_ENV` to choose the backend. The app uses `EXPO_PUBLIC_APP_ENV`. Restart Metro and reload after public setting changes; rebuild release APKs to change embedded values.

### Emulator-to-Mac connections

The local recipes use **ADB reverse** so the API's existing localhost image/link URLs also work:

```bash
adb reverse tcp:4000 tcp:4000
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
adb reverse --list
```

For that connected device, localhost port 4000 reaches the Mac API, 3000 reaches the website, and 8081 reaches Metro. Repeat if mappings disappear after device/emulator restart. With multiple devices, insert `-s <serial>` after `adb`.

Android Studio emulators also provide `10.0.2.2` as an alias for the Mac's loopback interface. It is an alternative to reverse forwarding for the API, but changing only the app's API origin does not repair returned media URLs containing localhost. It is not the Mac address on a physical phone. Forwarding is the simpler initial setup because Docker already advertises localhost URLs and the Mac browser uses those URLs too.

Docker hostnames `api`, `postgres` and `minio` belong to the container network; they are not Android service addresses.

## 1. Android Studio with local Docker backend

This runs API, migrations, website, PostgreSQL, MinIO and Mailpit locally. Android runs in the emulator. Fake local OTP sends no SMS and needs no MSG91 credentials.

### Terminal A: start backend containers

From the root, create the root environment only if missing:

```bash
test -f .env || cp .env.example .env
```

Ensure this is a **local** environment file, not an AWS credentials file. Host Prisma/seed commands should use:

```dotenv
NODE_ENV=development
APP_ENV=local
DATABASE_URL=postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive
```

The checked-in Compose configuration hardcodes the local container database/runtime, but **does not pass native-auth or legal-enforcement flags through from the root `.env`**. Create this local override and use it explicitly:

```bash
cat > /private/tmp/dealers-drive-mobile.compose.yaml <<'YAML'
services:
  api:
    environment:
      NATIVE_CUSTOMER_AUTH_ENABLED: 'true'
      LEGAL_ENFORCEMENT_ENABLED: 'true'
      PHONE_OTP_DRIVER: fake
      PHONE_OTP_DEV_CODE: '123456'
YAML

docker compose -f docker-compose.yml -f /private/tmp/dealers-drive-mobile.compose.yaml --profile app up -d --build
docker compose -f docker-compose.yml -f /private/tmp/dealers-drive-mobile.compose.yaml --profile app ps
curl --fail http://localhost:4000/health/ready
curl --fail http://localhost:4000/v1/legal/publication
```

The `migrate` container applies the branch's migrations to the **local named-volume database** and exits successfully. That is expected; API startup waits for it. No production migration is involved. Ordinary startup/shutdown retains named-volume data.

Expect health HTTP 200. With these local switches, publication should return a nonproduction **DRAFT** response with `collectionEnabled: true`. This exercises draft policy/consent behavior only. It does not approve or publish legal documents; production has independent publication checks.

Compose uses local file storage by default, PostgreSQL cache/rate controls and an inline worker. No separate Redis/Firebase/Maps SDK or worker container is required. MinIO still starts as part of the existing stack. Local `MAIL_DRIVER=console` writes email to API logs; Mailpit does not receive those emails.

| Service       | Mac URL                              |
| ------------- | ------------------------------------ |
| Website       | `http://localhost:3000`              |
| API health    | `http://localhost:4000/health/ready` |
| API reference | `http://localhost:4000/api/docs`     |
| MinIO console | `http://localhost:9001`              |
| Mailpit UI    | `http://localhost:8025`              |

### Optional synthetic inventory

An empty database can legitimately show no cars. Run the existing development seed from the **Mac**, so its loopback guard recognizes the database:

```bash
DATABASE_URL=postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive pnpm db:seed:dev
```

Use only a disposable local database: the seed upserts synthetic dealerships/cars and prunes stale generated vehicle records, so sample-inventory edits may be replaced. Do not bypass the remote-database guard. Do not run database/volume resets for ordinary startup.

This seed deliberately creates **no vehicle photographs**; no-photo cards are expected. Gallery/image testing needs authorized local photo fixtures or public AWS inventory. Placeholder rendering is not proof of image decoding/storage integration.

### Terminal B: configure and run Android

Start the emulator in Android Studio. From the root, perform the mobile terminal environment cleanup above, then:

```bash
cat > apps/mobile/.env.local <<'ENV'
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_WEB_BASE_URL=http://localhost:3000
ENV

adb reverse tcp:4000 tcp:4000
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081

pnpm --filter @dealers-drive/mobile exec expo config --type public
pnpm --filter @dealers-drive/mobile exec expo prebuild --platform android --no-install --skip-dependency-update react,react-native
pnpm --filter @dealers-drive/mobile exec expo run:android --device
```

Select the running emulator when prompted. The final command builds/installs the native **debug** app and starts Metro. Public config should show package `com.dealersdrive.customer.dev`; API connectivity must still be tested separately.

**Installed SDK 57 prebuild behavior:** native folders are regenerated by default; `--no-clean` opts out. These recipes intentionally regenerate the ignored Android project when changing identity/settings. Save manual native experiments first. The dependency-skip option retains pinned React/React Native versions. Check `git diff -- package.json apps/mobile/package.json pnpm-lock.yaml` afterward; this setup needs no dependency edits.

For later JavaScript-only sessions with unchanged native configuration:

```bash
pnpm dev:mobile
```

Press `a` in Metro to open Android. Keep Metro running for this development app. Rebuild after changing native libraries, plugins, identity or native configuration.

The local HTTP recipe is for a **debug** build. The existing release manifest disallows cleartext traffic; for release-mode testing with a nonproduction backend, use a compatible HTTPS staging environment rather than disabling that protection.

### Android Studio's Run button

After prebuild:

```bash
open -a "Android Studio" apps/mobile/android
```

Let Gradle sync finish, select the **app** configuration, your emulator and **debug** in Build Variants. Keep `pnpm dev:mobile` running in another terminal with the same mobile settings and the ADB forwards. Click **Run**. Studio provides Logcat, native breakpoints and emulator controls.

If Studio cannot locate Node/pnpm, run the initial native compile from the configured terminal and check the IDE's PATH/JDK settings. Do not commit machine-specific tool paths. Sync/reopen Studio after regenerating the native folder; do not regenerate while a native build is running.

### Local acceptance checklist

1. Browse Home/Explore, filters, dealers, car details and no-photo states.
2. Tap Save while signed out. Use a dedicated synthetic Indian mobile number and fake OTP **123456**. New accounts request a name and local draft acknowledgments.
3. Save/unsave and compare with the same customer's web session against this local backend. The web fake-OTP flow uses its own existing UI.
4. Enquire only after required unticked choices; test same-dealership consent reuse and separate consent for a different dealership.
5. Create/view/reply to support tickets; test quota/closed states with local fixtures.
6. With disposable accounts, test fresh-OTP deactivation/reactivation and revocation of another CUSTOMER session. Deletion intake is **not completed erasure**.
7. Test offline/retry, background/restart, Android Back and cold/warm links. See the [full acceptance matrix](../acceptance-tests.md).

Fake OTP validates local logic, not SMS delivery/DLT approval. Rate limits remain active, including resend cooldowns; wait for the returned interval.

### Logs and shutdown

```bash
docker compose -f docker-compose.yml -f /private/tmp/dealers-drive-mobile.compose.yaml --profile app logs --tail=100 -f api
```

Control-C stops log following. Stop Metro with Control-C. To stop containers without erasing named-volume data:

```bash
docker compose -f docker-compose.yml -f /private/tmp/dealers-drive-mobile.compose.yaml --profile app down
```

Do not add `-v`, run `infra:reset` or reset the database unless intentionally discarding local records.

## 2. Release-mode app connected to AWS

Only the Android emulator and local build tools are needed. No local API, website or Docker container is required at runtime. JavaScript is embedded in the APK; Metro is unnecessary after installation. AWS connectivity still requires internet access.

### Current production capability limits

Read-only probes on **15 October 2026** returned:

| Probe                                                    | Result                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET https://api.dealers-drive.com/health/ready`         | HTTP 200; `appEnv: production`; version `a969dc2c5223ddb04c23d720ded6a4daccfe33ab` |
| `GET https://api.dealers-drive.com/v1/legal/publication` | HTTP 404; `NOT_FOUND`                                                              |

That revision predates the unmerged legal/mobile stack. **Public browsing can use existing deployed APIs; native OTP, legal integration, customer bearer sessions and new account controls are not yet available there.** Authenticated saved/enquiry/support flows depend on compatible native backend capabilities. Pointing the app at AWS does not deploy those changes.

Recheck before testing:

```bash
curl --fail --silent --show-error https://api.dealers-drive.com/health/ready
```

Do not activate flags, publish draft policies, deploy changes or run AWS migrations to make a local test pass. Full production-authenticated testing needs a separately approved backend rollout, real MSG91 validation and approved legal publication. Future successful mutations against this host affect **real production records**; start with public guest browsing.

### Configure, compile and install

Stop Metro and use the environment cleanup above. Replace the mobile file:

```bash
cat > apps/mobile/.env.local <<'ENV'
EXPO_PUBLIC_APP_ENV=preview
EXPO_PUBLIC_API_BASE_URL=https://api.dealers-drive.com
EXPO_PUBLIC_WEB_BASE_URL=https://www.dealers-drive.com
ENV

pnpm --filter @dealers-drive/mobile exec expo config --type public
pnpm --filter @dealers-drive/mobile exec expo prebuild --platform android --no-install --skip-dependency-update react,react-native
pnpm --filter @dealers-drive/mobile exec expo run:android --variant release --device
```

Expect package `com.dealersdrive.customer.preview`. **`preview` selects the test identity/HTTPS app configuration; `--variant release` selects an optimized native/JavaScript build.** It connects to the exact AWS API above. Do not change preview to production or set the production approval flag for this test.

This repository's generated release template currently uses generated debug/validation signing. It is installable for testing and **not Play release signing**. No new production keystore/account/cloud resource is needed. Do not submit this AAB to Play.

The CLI installs and launches the app. Close Metro and relaunch to confirm the embedded bundle works. Fake local OTP is not valid against AWS.

### Use Android Studio directly

After the same configuration/prebuild, open `apps/mobile/android`, sync Gradle, select **release** in Build Variants and select the emulator. Use **Run** or build an APK from the Build menu; release debugging is restricted. Keep `apps/mobile/.env.local` unchanged while Gradle invokes Expo to embed JavaScript.

The terminal recipe is the reproducible primary route if Studio cannot resolve tool/environment settings. Studio still hosts the emulator and Logcat. Setting Run-configuration values after an APK was built does not change its embedded API destination.

### Optional: build an APK without launching

After preview configuration/prebuild:

```bash
cd apps/mobile/android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 --no-daemon --max-workers=2
cd ../../..
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.dealersdrive.customer.preview/.MainActivity
```

APK output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Copy it with a descriptive Git SHA/environment filename if keeping multiple builds; later builds reuse this path. The mobile `build` pnpm script exports JavaScript/assets only, not an APK. An AAB is not the file to drag into an emulator for ordinary installation.

Test public cars/dealers, search/filters, real images/galleries, sharing, directions, offline states, Android Back and cold/warm links. Maps/sharing require a suitable receiving app/system image. A missing native backend endpoint is a compatibility finding, not proof that all native screens fail.

## 3. Run the API and website directly on macOS

Use this for backend debugging: Docker runs backing services; API `tsx watch` and Next run on the Mac. Use setup 1's mobile settings and ADB forwards.

Stop full app-profile containers first if they occupy 3000/4000. With a local root `.env`:

```bash
pnpm infra:up
DATABASE_URL=postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive pnpm --filter @dealers-drive/api db:migrate
```

API terminal, from the root:

```bash
NODE_ENV=development \
APP_ENV=local \
DATABASE_URL=postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive \
NATIVE_CUSTOMER_AUTH_ENABLED=true \
LEGAL_ENFORCEMENT_ENABLED=true \
PHONE_OTP_DRIVER=fake \
PHONE_OTP_DEV_CODE=123456 \
STORAGE_DRIVER=local \
CACHE_DRIVER=postgres \
MAIL_DRIVER=console \
JOBS_ENABLED=true \
WORKER_INLINE=true \
pnpm --filter @dealers-drive/api dev
```

Keep root `API_BASE_URL=http://localhost:4000`, `MEDIA_BASE_URL=http://localhost:4000/media`, `WEB_BASE_URL=http://localhost:3000` and `WEB_ORIGIN=http://localhost:3000`. Use the example's local session/upload secrets. These server settings are separate from mobile public values.

Website terminal, for cross-platform comparisons and external legal/account links:

```bash
API_BASE_URL=http://localhost:4000 WEB_BASE_URL=http://localhost:3000 pnpm --filter @dealers-drive/web dev
```

Use setup 1's optional seed if needed. Host API edits reload automatically. Shared-contract edits need a contracts rebuild and, if necessary, dependent-process restarts. Start the native app/Metro as in setup 1.

Host-shell flags do not change running containers. Editing a Compose override requires recreating the API service with the same `-f` files. Do not run host and container API processes on the same port.

## 4. Physical Android phone

Recommended after the emulator works; real-device testing remains a release requirement.

1. Enable Developer options/USB debugging on your test phone. Connect it and accept the Mac's debugging authorization.
2. Run `adb devices -l` and copy the phone serial. Replace `YOUR_DEVICE_SERIAL` below.
3. For local development, start the local backend, keep local mobile settings, and forward the services:

```bash
adb -s YOUR_DEVICE_SERIAL reverse tcp:4000 tcp:4000
adb -s YOUR_DEVICE_SERIAL reverse tcp:3000 tcp:3000
adb -s YOUR_DEVICE_SERIAL reverse tcp:8081 tcp:8081
pnpm --filter @dealers-drive/mobile exec expo run:android --device
```

Select the phone. Keep USB connected for forwarded services; mobile origins remain localhost.

For an AWS release APK, use setup 2, then:

```bash
adb -s YOUR_DEVICE_SERIAL install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

It uses the phone's internet without Metro/Docker/forwarding. Production capability limits still apply.

Wi-Fi/LAN development is possible but requires a reachable Mac LAN address in app, media/link URLs and Metro, listening interfaces and firewall permission. `10.0.2.2` is not a physical phone's Mac address. USB forwarding is the simpler first option and avoids exposing local services to the LAN.

## 5. Other useful ways to test

### Recommended next: compatible staging API + release APK

After local flows pass, use a separately authorized staging deployment of the complete backend/legal/mobile stack, isolated records and explicit provider/legal test configuration. Use preview app settings with the **actual authorized HTTPS staging origins**, regenerate native files and run setup 2's release command. This guide assumes no staging host/resource exists and creates none.

Staging offers realistic release behavior without production customer records. Live MSG91 testing is separate, with dedicated authorized numbers and credentials held only on the server. Local fake OTP results cannot validate delivery/DLT. Do not publish production drafts to get a staging result.

### Development app with public AWS data

For fast UI iteration on AWS inventory, save:

```dotenv
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_BASE_URL=https://api.dealers-drive.com
EXPO_PUBLIC_WEB_BASE_URL=https://www.dealers-drive.com
```

Prebuild for `.dev` and use the default debug command/Metro. This still uses production data; fake OTP and local server flags do not apply. Keep authenticated mutation testing in local/staging environments.

### Existing CI artifact, no native compilation on the Mac

Download the APK from the [passing e0874e6a native run](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38702174641), extract `app-release.apk`, and drag it into the emulator or install with `adb install -r <apk-path>`. Artifacts expire; obtain a current passing one if necessary.

Current CI APKs embed `https://api.validation.invalid` and `https://web.validation.invalid`. They test guest shell/branding/error states only. Starting a local API, changing a Mac variable after installation or running Metro cannot change that release APK's embedded origins. Rebuild with setup 1/2 for a different backend.

### Automated guest smoke

After installing a compatible preview APK and the reviewed Maestro CLI from the [acceptance matrix](../acceptance-tests.md), run:

```bash
mkdir -p /private/tmp/dealers-drive-maestro
maestro test --format junit \
  --output /private/tmp/dealers-drive-maestro/results.xml \
  --test-output-dir /private/tmp/dealers-drive-maestro/screens \
  -e APP_ID=com.dealersdrive.customer.preview apps/mobile/e2e
```

The flows clear that disposable app's local data, then test guest/Profile/Saved/About/restart, cold/warm car links and refusal of privileged links. They do not test real OTP or authenticated mutations. Use a disposable install, not a customer's device data. Record source/backend versions, device/OS and results; preserve failed artifacts.

### Component tests and Expo Go

`pnpm --filter @dealers-drive/mobile test` runs native component/state/service fixtures without booting Android. The web Storybook is not a rendered Android app. Use the repository's Expo **development client** for native work; Expo Go is not the acceptance path for installed SecureStore, native configuration, icons or intent behavior.

## Switch environments

1. Stop Metro and native builds. Keep backend terminals separate.
2. Sign out before changing backends so one server's SecureStore credential/cache is not reused against another.
3. Remove inherited mobile overrides and replace the three mobile file values for the recipe.
4. Explicitly prebuild when changing development/preview identity or native configuration. An existing native folder can retain the old application ID.
5. Rebuild/install. Development public-value changes need a full reload; release APKs always need a rebuilt bundle for new values.
6. Check backend `/health/ready` and open the intended package. `.dev` and `.preview` coexist but have the same display name. Different staging/AWS/CI preview builds share `.preview` and replace each other; they are not separate Android flavors.

Inspect installed packages and open a specific app:

```bash
adb shell pm list packages com.dealersdrive.customer
adb shell am start -n com.dealersdrive.customer.dev/.MainActivity
```

Use `.preview` for setup 2. To intentionally discard a **disposable** development install's local sessions/drafts:

```bash
adb shell pm clear com.dealersdrive.customer.dev
```

This clears that app's device data, not its server account. It is not an account deletion operation.

## Troubleshooting

| Symptom                               | Remedy                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| SDK/JDK not found                     | Check `ANDROID_HOME`, JDK 21 in Studio/terminal and Platform/Build Tools 36; let Studio create its ignored local SDK-path file |
| Slow/unbootable emulator              | Match the Mac's CPU, reduce concurrent AVDs/builds, allow resources and try a cold boot; preserve ANR evidence for acceptance  |
| Multiple/offline/unauthorized devices | Check `adb devices -l`, authorize the phone and select explicitly with `--device` / `adb -s <serial>`                          |
| Local network failure                 | Check host health, Docker/port 4000, ADB forwards and origins; preview/release HTTPS rules reject local HTTP                   |
| API works but images fail             | Check returned localhost URLs and forwarding; seed cars deliberately have no photographs                                       |
| Local login unavailable               | Root flag alone is not forwarded by Compose; use the override and recreate API with the same file list                         |
| Policy/signup collection unavailable  | Check local publication JSON and local enforcement switch; do not bypass production approval                                   |
| AWS native/legal 404 or 503           | Verify deployed revision/capability gates; app URL changes cannot deploy unmerged routes                                       |
| OTP/resend refused                    | Respect Retry-After/cooldown; use fake code only on local fake provider; consumed/expired challenge needs a new explicit flow  |
| Development JavaScript won't load     | Start Metro, forward 8081, use the development client and reload after setting changes                                         |
| Old release API destination           | Rebuild/install with desired settings; open the correct package; Run-time shell changes do not alter embedded values           |
| Port 3000/4000 in use                 | Stop the competing host/container app; check Compose status and the relevant host process                                      |
| Seed rejects remote host              | Run on the Mac against explicit loopback DB; do not bypass the remote guard                                                    |
| Signature mismatch on install         | Same package may have another signing key. Uninstalling erases app data; do so only on a disposable test install               |
| Share/Maps target missing             | Use an emulator/device with an appropriate receiving app and internet; retain fallback/error checks                            |
| Native package is still wrong         | `run:android` skips prebuild when native files exist; explicitly prebuild and sync Studio                                      |
| Override edits have no effect         | Recreate the relevant container with the same Compose file list; changing host variables does not alter a running process      |

Use Android Studio **Logcat** filtered by package. Bug reports should contain sanitized reproduction steps, source/backend versions, environment, device/API, expected/actual results and screenshots. Do not paste OTPs, tokens, phone numbers, private support text or raw customer records.

## Sources and verification

Repository sources:

- [Workspace commands](../../../package.json), [Compose](../../../docker-compose.yml), [root environment example](../../../.env.example), [startup helper](../../../scripts/app-up.sh).
- [Mobile commands](../../../apps/mobile/package.json), [public environment](../../../apps/mobile/src/services/environment.ts), [native build config](../../../apps/mobile/config/build-config.cjs), [EAS profiles](../../../apps/mobile/eas.json), [native CI](../../../.github/workflows/android.yml).
- [API commands](../../../apps/api/package.json), [Prisma configuration](../../../apps/api/prisma.config.ts), [seed guard](../../../apps/api/prisma/seed/dev-guard.ts), [native authentication design](../../code/api/modules/auth/native-auth.md).
- [Acceptance matrix](../acceptance-tests.md), [release operations](../release-operations.md), [production blockers](../production-acceptance.md), [stack manifest](../stack-manifest.json).

Official sources checked 15 October 2026:

- [Android Studio](https://developer.android.com/studio) and [JDK 21 downloads](https://adoptium.net/temurin/releases/?version=21).
- [Expo local compilation](https://docs.expo.dev/guides/local-app-development/): device selection and release variant.
- [Expo emulator setup](https://docs.expo.dev/workflow/android-studio-emulator/): SDK/AVD setup; repository-tested versions take precedence over generic examples.
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/): public bundling/environment switching; SDK 58-specific changes do not override this pinned SDK 57 CLI.
- [Android emulator addresses](https://developer.android.com/studio/run/emulator-networking-address) and [React Native device connections](https://reactnative.dev/docs/running-on-device): host aliases/ADB forwarding.

Installed `run:android --help` and `prebuild --help` were inspected, including SDK 57's default regeneration. AWS probes were read-only. No dependency installation, Docker startup, migration/database write, Mac native build, AWS change, legal publication or Play submission was performed to write this runbook. Implementation PRs remain unmerged, with separate owner merge/deployment/release gates.
