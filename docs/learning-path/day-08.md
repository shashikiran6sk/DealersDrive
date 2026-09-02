# Day 8 — OAuth 2.0 and OpenID Connect, from first principles

> **Track:** Week 2 · Identity
> **Time:** ~4 hours · **Prerequisite:** Day 7
> **Goal in one sentence:** explain the authorization code flow from scratch, and
> name the distinct attack that each of `state`, PKCE and `nonce` defends against.

---

## 1. Why today matters

Today is **protocol day**, deliberately separated from **implementation day**
(Day 9). Trying to learn both at once is why OAuth has a reputation for being
hard. It is not hard; it is a sequence of small defences added to a naive flow,
and each one makes sense only if you know what it is defending against.

The three things people confuse, and which you will be able to separate by this
evening:

|          | Defends against                                                     |
| -------- | ------------------------------------------------------------------- |
| `state`  | CSRF on the callback — being logged into _someone else's_ account   |
| **PKCE** | an intercepted authorization code being redeemed by the interceptor |
| `nonce`  | an ID token captured elsewhere being replayed here                  |

They are three different attacks. Anyone who says "they all stop replay" has not
understood them.

---

## 2. Read first

Read in exactly this order. This is the one day where sequence really matters.

| #   | Source                                                           | Sections                                                                                                  | ~min |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---- |
| 1   | `docs/ENGINEER-ONBOARDING.md`                                    | **Part 34-B7** — OAuth 2.0: authorization _delegation_, not login                                         | 20   |
| 2   | `docs/ENGINEER-ONBOARDING.md`                                    | **Part 34-B8** — OpenID Connect and the ID token                                                          | 20   |
| 3   | `docs/ENGINEER-ONBOARDING.md`                                    | **Part 34-B9** — `state`, `nonce` and PKCE: three defences                                                | 20   |
| 4   | `docs/ENGINEER-ONBOARDING.md`                                    | **Part 4.1 → 4.3** — the mental model you are arriving with; the vocabulary; why the account is the `sub` | 30   |
| 5   | [oauth.net/2](https://oauth.net/2/)                              | "Authorization Code" and "PKCE"                                                                           | 20   |
| 6   | [RFC 7636 — PKCE](https://datatracker.ietf.org/doc/html/rfc7636) | §1 (motivation) and §4.1–4.2                                                                              | 20   |

**Video (strongly recommended, ~1 hour):** _"OAuth 2.0 and OpenID Connect (in
plain English)"_ by Nate Barbettini, on the
[OktaDev channel](https://www.youtube.com/@OktaDev). It builds the flow up from
the naive version and shows what each addition fixes. If you only do one optional
thing this week, do this.

---

## 3. Open these files, in this order

Today you **read** these; tomorrow you trace them running.

| #   | File                                             | What to look for                                                                                                                              |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/api/src/modules/auth/oauth.port.ts`        | The seam. Read the doc comment: _nothing above this interface knows about authorization codes, PKCE verifiers, JWTs or `accounts.google.com`_ |
| 2   | `apps/api/src/modules/auth/oauth-transaction.ts` | Where `state`, `nonce` and the PKCE verifier are generated. All three, in one function                                                        |
| 3   | `apps/api/src/modules/auth/google.provider.ts`   | `authorizationUrl()` — every query parameter, and `challengeFor()` at the bottom: `BASE64URL(SHA256(verifier))`, RFC 7636 §4.2 verbatim       |
| 4   | `apps/api/src/modules/auth/google.provider.ts`   | `claimsFrom()` — every claim check, one per line: `iss`, `aud`, `exp`, `nonce`, `sub`, `email`, `email_verified`                              |
| 5   | `apps/api/src/modules/auth/google.provider.ts`   | `decodeIdToken()` and its long comment. **Read it twice.** This is the OIDC Core §3.1.3.7 argument                                            |
| 6   | `apps/api/prisma/schema.prisma`                  | The `OAuthIdentity` model. `@@unique([provider, providerSubject])`. The email is _not_ the key                                                |

---

## 4. Do

### 4.1 Build the flow up yourself, on paper

Do not skip this. Draw five versions, each fixing the previous one's flaw.

**Version 1 — the naive one.** The dealer types their Google password into
Dealers-Drive.

> _Write down three reasons this is unacceptable._

**Version 2 — redirect to Google, Google redirects back with a token in the URL.**

> _The token is now in an address bar, browser history, a `Referer` header, and
> possibly a proxy log. Write down why that is fatal._

**Version 3 — redirect back with a single-use `code` instead; the server
exchanges it server-to-server for the token, using a client secret.**

> _Better. But: what happens if an attacker sends the victim a link to
> `/callback?code=<the attacker's own code>`?_ Answer: the victim's browser is
> now signed into the **attacker's** account, and everything the victim uploads
> lands in the attacker's inventory.

**Version 4 — add `state`.** A random value sent to Google, echoed back, and
compared against a value stored in _this browser_.

> _Now: what if the code itself is intercepted — a malicious app registered on
> the same redirect URI, a leaky log?_

**Version 5 — add PKCE.** The client keeps a secret `code_verifier`, sends only
its SHA-256 in step 1, and presents the raw verifier at exchange.

> _And finally: the ID token proves identity. What stops one captured elsewhere
> being replayed here?_ Answer: the `nonce`, which Google embeds **inside** the
> signed token.

**Now check your five versions against Part 34-B9.**

### 4.2 Decode a real JWT

You do not need Google for this. Take any JWT (there is a sample on
[jwt.io](https://jwt.io/)) and decode it by hand:

```bash
echo '<the middle segment>' | base64 -d 2>/dev/null | jq .
```

Note: **the payload is not encrypted.** Anyone can read it. The signature proves
it was not _altered_; it does not make it secret. That distinction is one of the
most commonly misunderstood things about JWTs.

### 4.3 Compute a PKCE challenge yourself

```bash
VERIFIER=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
echo "verifier:  $VERIFIER"
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -sha256 -binary \
  | base64 | tr '+/' '-_' | tr -d '=')
echo "challenge: $CHALLENGE"
```

Now open `google.provider.ts` and find `challengeFor()`. It is the same three
operations. Note the verifier is 43 characters — RFC 7636 §4.1 requires 43–128,
and 32 random bytes base64url-encoded lands exactly there.

### 4.4 Register a real Google OAuth client (optional but valuable)

If you can, do this today so Day 9 is a live trace rather than a code read.

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services →
   Credentials → Create Credentials → **OAuth client ID** → Web application.
2. Authorized redirect URI, **character for character**:
   `http://localhost:4000/v1/auth/google/callback`
3. Put the client id and secret in `.env`:
   ```
   AUTH_MODE=cookie
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
4. Restart and check:
   ```bash
   curl -s http://localhost:4000/v1/auth/providers | jq
   ```
   `google.enabled` should be `true`. If it is `false`, `reason` names exactly
   what is missing.

### 4.5 Answer the hardest question in the module

> **Why is the account the Google `sub` and not the email address?**

Write your answer, then read Part 4.3. Then find the refusal in the code:

```bash
grep -n "ACCOUNT_LINK_REQUIRED" -r apps/api/src
```

Read the comment above it. The scenario it describes — an expired domain
becoming somebody else's inventory — is the reason a matching email is _refused_
rather than merged.

---

## 5. Prove you understood it

1. Name the four OAuth roles and map each to a real party here. → _§34-B7_
2. Why does the browser receive a **code** rather than a token? → _§34-B7_
3. What exactly does `state` defend against? Describe the attack in two
   sentences. → _§34-B9_
4. What does PKCE defend against, and why is it used even though this client has
   a secret? → _§34-B9_
5. What does `nonce` defend against, and where does Google put it? → _§34-B9_
6. What is the difference between OAuth 2.0 and OpenID Connect? → _§34-B8_
7. Why is `email_verified !== true` a refusal rather than a warning? → _§34-B8_
8. Why is the ID token's signature not re-verified here — and when _would_
   verifying it be mandatory? → _§34-B8, `google.provider.ts`_
9. Why is `access_type=online` used rather than requesting a refresh token? → _`google.provider.ts`_

---

## 6. Traps

- **"OAuth is a login protocol."** It is not. OAuth 2.0 is _authorization
  delegation_. OIDC is the identity layer on top. Saying "log in with OAuth"
  without OIDC is a category error.
- **A JWT payload is readable by anyone.** Signed ≠ encrypted. Never put a secret
  in one.
- **The redirect URI must match character for character** — scheme, host, port,
  path, no trailing slash. Most first-time OAuth failures are this.

---

## 7. Deliverable

- [ ] I built the flow up in five versions on paper and checked it against §34-B9
- [ ] I decoded a JWT by hand and can state why signed ≠ encrypted
- [ ] I computed a PKCE challenge with `openssl` and matched it to `challengeFor()`
- [ ] I can name the distinct attack each of `state`, PKCE and `nonce` stops
- [ ] I can explain why the account is the `sub` and not the email
- [ ] _(optional)_ I registered a Google OAuth client and `google.enabled` is `true`
- [ ] I have answered all nine questions in §5

---

## 8. Going deeper (optional)

- Read [OpenID Connect Core §3.1.3.7](https://openid.net/specs/openid-connect-core-1_0.html),
  item 6 — the actual clause that justifies `decodeIdToken()`. Reading the
  primary source once is worth a great deal.
- Skim the [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
  introduction to see which historical flows are now discouraged, and why.
