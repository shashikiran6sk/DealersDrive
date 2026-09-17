# Mobile number verification with MSG91 (R39)

Onboarding step 1 proves the dealer's mobile number before a dealership can be
built around it. This is the setup and rollout guide; the _why_ is
[`feature-map.md` R39](./feature-map.md).

---

## What runs where

```
browser                                  API                         MSG91
───────                                  ───                         ─────
GET /v1/auth/phone/widget  ─────────────►  widgetId + tokenAuth
initSendOTP(…)                                                       ◄── script
sendOtp('919840012345')  ──────────────────────────────────────────►  SMS sent
verifyOtp('528193')      ──────────────────────────────────────────►  ◄── JWT
POST /v1/auth/phone/verify { phone, accessToken }
                                         │ authkey + access-token ──►
                                         │ ◄── the identifier it proves
                                         └─ users.phone + phoneVerifiedAt
```

Two facts fall out of that picture and both are load-bearing:

- **The six digits never reach this API.** Nothing here can judge a code; the
  only thing it can do is take the token MSG91 signed back to MSG91 with a key
  no browser holds.
- **The send happens in the browser.** The API cannot rate-limit it. See
  _Spend_ below for what it can do instead.

---

## Configuration

| Variable               | Where           | What                                                   |
| ---------------------- | --------------- | ------------------------------------------------------ |
| `PHONE_OTP_DRIVER`     | API             | `fake` locally and in tests, `msg91` in production     |
| `MSG91_AUTH_KEY`       | API, **secret** | Server-only credential used to verify the widget token |
| `MSG91_WIDGET_ID`      | API → browser   | `configuration.widgetId`                               |
| `MSG91_WIDGET_TOKEN`   | API → browser   | `configuration.tokenAuth`                              |
| `PHONE_OTP_DEV_CODE`   | API             | The code the `fake` driver accepts. Default `123456`   |
| `PHONE_OTP_TIMEOUT_MS` | API             | How long to wait for MSG91. Default 4000               |

`env.ts` refuses to boot when `PHONE_OTP_DRIVER=msg91` and any of the three
credentials is missing — in **every** environment, not just production, because
a preview pointed at MSG91 with no credentials would refuse every verification
silently. It also refuses `fake` in production, for the same reason it refuses
`CACHE_DRIVER=memory` there.

`MSG91_WIDGET_ID` and `MSG91_WIDGET_TOKEN` reach the browser — the widget
cannot initialise without them — but they are **served from the API**, not
inlined as `NEXT_PUBLIC_*` (rule 9). Rotating a widget is therefore a restart,
not a rebuild of the web image.

---

## Local development

Nothing to configure. `PHONE_OTP_DRIVER` defaults to `fake`:

```
pnpm infra:up
pnpm dev
# → /dealer/onboarding, press Send OTP, enter 123456
```

No widget script is loaded and no message is sent. Everything above the
provider — the binding check, the replay guard, the uniqueness refusal, the
onboarding gate — is the production path.

To exercise real delivery locally, set the four `msg91` variables in `.env` and
restart the API.

---

## Setting up the widget in MSG91

1. **MSG91 → OTP → Widgets → Create widget.** Note the **widget id** and the
   **auth token** it shows; those are `MSG91_WIDGET_ID` and
   `MSG91_WIDGET_TOKEN`.
2. **Restrict the widget to your own domains** in its settings. The widget
   token is in the browser by design, and the domain allow-list is MSG91's own
   control over who may use it.
3. **Enable the widget's captcha** if it is offered. The page renders a
   container for it (`captchaRenderId`), so it works without a code change.
4. **MSG91 → Settings → API keys** for `MSG91_AUTH_KEY`, if you do not already
   have one from the SMS driver. It is the same account.
5. **DLT.** India requires registration of the entity, the sender header and
   each template before any transactional SMS is delivered. An unregistered
   template is accepted by the API and never arrives.

---

## Rollout

1. Release the API and the web app **together**. The web app reads
   `phoneVerified` off `GET /v1/auth/me` and `GET /v1/auth/phone/widget`; an
   older web app against this API would show step 1 with no way past it.
2. There is **no migration**. `users.phone` and `users.phoneVerifiedAt` have
   existed since F014.
3. **Existing dealerships are unaffected while they do not touch their number.**
   `phoneVerifiedAt` is null on every row that predates this, so
   `AuthSession.user.phoneVerified` is false for them — which matters only on
   the two write paths that assert on it. A dealer editing their contact number
   is asked to prove the new one, which is the intended behaviour; a dealer who
   does not, is not.
4. **Watch the first real send**, and watch `phone.verify.refused` in the logs.
   A run of `identifier mismatch` means the widget and the client disagree about
   the identifier format; a run of `UNAVAILABLE` means MSG91 or the network.

---

## Spend

The widget sends from the browser, so the API cannot count sends. What it does
count:

| Control                                         | Limit                  |
| ----------------------------------------------- | ---------------------- |
| `GET /v1/auth/phone/widget`, per session        | 30 / hour              |
| `POST /v1/auth/phone/availability`, per session | 30 / hour              |
| `POST /v1/auth/phone/verify`, per session       | 10 / 10 minutes        |
| One access token                                | one verification, ever |

The availability limit is there because that endpoint is a lookup about numbers
the caller does not own. It answers nothing but yes or no, and never who holds
one — but a yes/no is still something a caller could walk a list through.

And what it does not: **how many messages one signed-in account can provoke.**
`GET /v1/auth/phone/widget` behind `requireSignedIn` bounds that by the set of
people who have completed a Google sign-in rather than by the open internet,
and MSG91's own per-identifier limits do the rest. If that turns out to be too
loose in practice, the answer is an API-side send endpoint — a different
integration, not a tightening of this one.

The browser-side guard rails are a courtesy on top of that, not the control: a
30-second resend cooldown, and three wrong codes before a fresh one is required.

---

## Troubleshooting

| Symptom                                                              | Cause                                                                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| "Mobile verification is unavailable"                                 | `MSG91_WIDGET_ID` / `MSG91_WIDGET_TOKEN` unset, or `GET /v1/auth/phone/widget` could not be reached              |
| "We could not send a code to that number"                            | The widget script failed to load, or `sendOtp` was refused — check the browser console and the domain allow-list |
| `422 PHONE_VERIFICATION_FAILED` on a code the dealer swears is right | An expired token, a replayed one, or the identifier MSG91 named is not the number claimed                        |
| `503 PHONE_OTP_UNAVAILABLE`                                          | MSG91 did not answer inside `PHONE_OTP_TIMEOUT_MS`. Deliberately not the same answer as a wrong code             |
| `422 PHONE_NOT_VERIFIED` on onboarding                               | The number in the body is not the one on the user row, or was never proved                                       |
| A code that arrives but is always refused                            | DLT template mismatch — the message delivered is not the one the widget minted a token for                       |
