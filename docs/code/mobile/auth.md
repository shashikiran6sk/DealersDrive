# Native authentication and session lifecycle

F101 uses F100's customer-only REST transport. No MSG91 keys/SDK, Google client secret, cookie borrowing, refresh-token invention or separate customer identity. Public discovery remains usable while secure session restoration runs; Profile/Saved show a restoring or unavailable state rather than an unauthenticated flash or cached private account.

## API and storage

Opaque credentials live only in Expo SecureStore and private SessionManager memory. Only token/expiry is persisted, not profile, phone, OTP, signup ticket, pending action or private query data. Corrupt, expired, revoked and forbidden credentials are cleared. Network/server failures retain secure credentials for explicit retry while hiding private data. Secure writes/removals are serialized and generation checks reject stale restore/login callbacks. Cancellation racing a candidate write queues cleanup; logout deletion cannot be skipped by a later auth generation. Local cleanup or server revocation failures are reported without claiming both succeeded.

Native POST auth uses a 12-second bounded timeout for the two sequential provider calls; ordinary reads/session restore retain the 8-second bound. Cookies are omitted. Authorization is attached only to the customer allowlist; privileged/workspace/invitation routes are refused before fetch. Redirects are rejected and final response origin checked. React Native's native networking redirect behavior still requires installed-device/release validation; this source check is not a claim of native transport certification.

## Phone, OTP and name

Indian mobile input explicitly shows +91 and reuses the strict shared number/name validators. OTP is entered/autofilled through Android's standard one-time-code hint, without SMS permissions. Requests/submissions have synchronous tap locks; no auth mutation automatically retries. Server resend/expiry timestamps use absolute time so backgrounding does not reset the cooldown. Invalid codes stay retryable within server limits; expired challenges/tickets require an explicit new request. Signup tickets/OTP remain in memory.

The server supplies NAME_REQUIRED or a server-issued credential. The screen restores the original screen only after secure persistence succeeds. Android back/cancel aborts the request and invalidates the generation before navigation transitions complete, preventing a late result from popping another screen or executing a cancelled action. Foreground restoration skips active OTP/name flows, so reading an SMS and returning does not invalidate the challenge.

## Policies and protected intent

Terms ACCEPT and Privacy ACKNOWLEDGE are independent, initially unchecked choices when the server enables collection. Displayed versions are echoed to the existing service; stale version/hash/enforcement changes clear choices. No local acceptance flag establishes legal truth. Drafts are explicitly labeled; production UNAVAILABLE policies disable signup continuation. When the existing nonproduction enforcement switch is off, the client omits agreement payloads as required by the foundation.

The policy reader displays the authoritative publication response with native text and current branding; no document archive is bundled. A trusted canonical website URL is a fallback when the publication cannot be displayed. It never embeds a generic WebView. Dealer contact-sharing consent is a separate F105 workflow.

Pending intents are one in-memory typed record, with a monotonically increasing ID and authenticated owner binding. Save/enquiry/Saved context is restored through the original screen behind the auth modal. An intent can be consumed once by its owner; cancellation/logout/identity change clears it. Process death discards it, preventing mutation replay. Save handlers arrive in F104 and may resume an idempotent server save once; enquiry resumes a form and must never submit or grant consent automatically. Removed inventory clears/fails the intent through authoritative inventory/mutation results in F102/F104/F105.

## Rendering and remaining evidence

Auth screens use approved PR #311 separate SVG symbol/wordmark, shared neutral tokens/Manrope, safe areas, keyboard avoidance, scalable labels, 48dp controls and screen-reader checkbox/alert states. Policy and profile surfaces share that identity. Native host tests validate forms and session races; the Android Hermes export is built and inspected for server/archive identifiers. No emulator/physical-device or real provider test is claimed. System back/keyboard/autofill/native redirect/splash behavior must be checked on installed Android builds before release.
