import type { ModuleDocs } from '../../docs/spec.js';

const LOCATION_HEADER = {
  Location: { description: 'Where the browser is sent next.', schema: { type: 'string' } },
} as const;

/**
 * PART B — authentication.
 *
 * Three of these operations are browser redirects rather than API calls, and
 * are documented as such: a client library never calls `/google/start`, a
 * person's browser navigates to it. They are in the reference because leaving
 * the only routes that issue a session undocumented would be the worst possible
 * omission (§32).
 *
 * There is no `POST /v1/auth/admin/login` here because there is no such route
 * any more: the admin console's session comes out of the same Google callback,
 * and the operation was removed in the PR that removed the endpoint. The
 * openapi test fails in both directions, which is what keeps that true.
 */
export const authDocs: ModuleDocs = {
  tag: 'Authentication',
  description:
    'Everybody signs in with Google (OAuth 2.0 authorization code + PKCE + OIDC nonce) — ' +
    'dealers and admins alike. Both end in the same place: an opaque `dd_session` cookie ' +
    'backed by a row in `sessions`, revocable instantly (ARCHITECTURE §8.2).\n\n' +
    '**No endpoint here accepts a user identity or login password.** Sessions are issued ' +
    'from a token Google signed. The authenticated phone endpoints accept an OTP only to ' +
    'prove contact ownership; they never issue a login session. What separates the two consoles is the ' +
    '`ADMIN_ALLOWLIST` check on that address, not a second login form. A `dealerId` is ' +
    'never accepted anywhere in the API; it is a property of the resolved session (rule 1).',
  operations: [
    {
      method: 'get',
      path: '/v1/auth/providers',
      operationId: 'getAuthProviders',
      tag: 'Authentication',
      summary: 'Which sign-in methods work here',
      description:
        'Lets the sign-in screen render a working button or an explanation, rather than a ' +
        'button that fails on click. `enabled` is false when this deployment has no Google ' +
        'client configured; `reason` then names what is missing.\n\n`Cache-Control: no-store`.',
      audience: 'public',
      responses: [
        {
          status: 200,
          description: 'The configured providers.',
          schema: 'AuthProvidersResponse',
          example: {
            google: {
              enabled: true,
              startUrl: 'http://localhost:4000/v1/auth/google/start',
              adminStartUrl: 'http://localhost:4000/v1/auth/admin/google/start',
              reason: null,
            },
          },
        },
      ],
    },
    {
      method: 'get',
      path: '/v1/auth/google/start',
      operationId: 'startGoogleSignIn',
      tag: 'Authentication',
      summary: 'Begin Google sign-in',
      description:
        'A browser navigation, not an API call. Mints `state`, an OIDC `nonce` and a PKCE ' +
        'verifier, seals all three into a 10-minute HttpOnly `dd_oauth` cookie, and redirects ' +
        "to Google's authorization endpoint.\n\n" +
        'Optional `?returnTo=/dealer/inventory` — a **path**, never an absolute URL. Anything ' +
        'else is replaced with `/dealer`, because a callback that redirects anywhere the ' +
        'caller asks is an open redirect and a session-leaking one.\n\n' +
        '`503 OAUTH_NOT_CONFIGURED` when the deployment has no Google credentials — the ' +
        'response names the variables to set.',
      audience: 'public',
      responses: [
        {
          status: 302,
          description: 'Redirect to Google, with `dd_oauth` set.',
          headers: LOCATION_HEADER,
        },
      ],
      errors: [503],
    },
    {
      method: 'get',
      path: '/v1/auth/admin/google/start',
      operationId: 'startAdminGoogleSignIn',
      tag: 'Authentication',
      summary: 'Begin Google sign-in for the admin console',
      description:
        'The same navigation as `/v1/auth/google/start`, with one value changed: the sealed ' +
        '`dd_oauth` cookie records that this round trip is for the **admin** console, so the ' +
        'callback issues an `ADMIN`-scope session rather than a dealer one.\n\n' +
        'It is a separate path rather than a query parameter because the audience decides the ' +
        'privilege of the session that comes back, and a value the browser could edit on the ' +
        'return leg would be a way to ask the dealer button for an admin session. Google sees ' +
        'one registered redirect URI either way.\n\n' +
        'Starting here grants nothing. The address Google returns must appear on the ' +
        "deployment's `ADMIN_ALLOWLIST`; anything else ends at " +
        '`/admin/login?error=not_authorised`.',
      audience: 'public',
      responses: [
        {
          status: 302,
          description: 'Redirect to Google, with `dd_oauth` set for the admin console.',
          headers: LOCATION_HEADER,
        },
      ],
      errors: [503],
    },
    {
      method: 'get',
      path: '/v1/auth/google/callback',
      operationId: 'completeGoogleSignIn',
      tag: 'Authentication',
      summary: "Google's redirect back",
      description:
        'Verifies `state` against the sealed cookie, exchanges the authorization code at ' +
        "Google's token endpoint using the PKCE verifier, and checks the identity token's " +
        'issuer, audience, expiry and nonce. The email is taken from that token and from ' +
        'nowhere else.\n\n' +
        'The account is found by `provider + sub`, never by email address — a Google account ' +
        'holder can change their email, and `sub` is what does not move. A first sign-in ' +
        'creates the user and the identity; a returning one refreshes the stored profile.\n\n' +
        'Ends by setting `dd_session` and redirecting to `/dealer/onboarding` when the account ' +
        'has no dealership yet, or to the requested path when it has. Every failure redirects ' +
        'to `/dealer/login?error=…` instead, so the person sees the sign-in screen rather than ' +
        'a JSON body: `sign_in_failed`, `identity_unverified`, `google_declined`, ' +
        '`account_link_required`, `account_suspended`, `invalid_callback`.\n\n' +
        '**Both consoles come back through this one path.** The sealed cookie says which, and ' +
        'an admin round trip is answered differently in two ways: the address must be on ' +
        '`ADMIN_ALLOWLIST` — `not_authorised` if it is not — and the session it sets has ' +
        '`scope = ADMIN`, a 12-hour lifetime, and satisfies `/v1/admin/**` and nothing else. ' +
        'An admin failure lands on `/admin/login?error=…`, not on the dealer screen.',
      audience: 'public',
      responses: [
        {
          status: 302,
          description: 'Signed in, with `dd_session` set — or back to sign-in with an error code.',
          headers: LOCATION_HEADER,
        },
      ],
    },
    {
      method: 'get',
      path: '/v1/auth/me',
      operationId: 'getSession',
      tag: 'Authentication',
      summary: 'Who am I',
      description:
        'The resolved session. One shape covers both states: a verified Google identity with ' +
        'no dealership yet (`next: "ONBOARDING"`, `dealer: null`) and a full dealer seat with ' +
        'its role, permissions (§8.3) and the two badge counts the console header shows.\n\n' +
        '`identity` is the Google account behind the session — what the onboarding screen ' +
        'displays instead of asking for an email again.\n\n`Cache-Control: no-store`.',
      audience: 'dealer',
      responses: [
        {
          status: 200,
          description: 'The current session.',
          schema: 'AuthSession',
          example: {
            next: 'DASHBOARD',
            user: {
              id: '9a2f1d44-1111-4000-8000-000000000001',
              fullName: 'Karthik Raman',
              phone: '+919840012345',
              phoneDisplay: '+91 98400 12345',
              email: 'karthik@srilakshmimotors.in',
              emailVerified: true,
            },
            identity: {
              provider: 'GOOGLE',
              email: 'karthik@srilakshmimotors.in',
              name: 'Karthik Raman',
              pictureUrl: null,
            },
            dealer: {
              id: '3c8f2b10-2222-4000-8000-000000000002',
              slug: 'sri-lakshmi-motors',
              brandName: 'Sri Lakshmi Motors',
              status: 'ACTIVE',
              statusLabel: 'Verified',
              isVerified: true,
              creditBalance: 39,
              creditsHeld: 1,
            },
            role: 'OWNER',
            permissions: ['vehicle:read', 'vehicle:write', 'listing:submit', 'billing:purchase'],
            counts: { newEnquiries: 4, pendingListings: 1 },
          },
        },
      ],
      errors: [401],
    },
    {
      method: 'post',
      path: '/v1/auth/onboarding',
      operationId: 'completeOnboarding',
      tag: 'Authentication',
      summary: 'Create the dealership',
      description:
        'The one endpoint a session with no dealership may call. Creates the user record, the ' +
        'dealership in `DRAFT`, the `OWNER` membership and the three KYC placeholders, in one ' +
        'transaction.\n\n' +
        'No `email` field: the address comes from the Google identity on the session. No ' +
        "`status` and no `slug` either — approval is the admin's decision and the slug is " +
        'derived from the registered name (rules 1 and 5). One name, not two: `brandName` is ' +
        'the display mirror of `legalName` and is written by the server.\n\n' +
        '`city`, `district` and `state` are free text, normalised on write — there is no list ' +
        'of places to choose from, and a dealership may be in any of them. The district is ' +
        "what the admin console's location filter is built on.\n\n" +
        '`mapsUrl` is the dealership\u2019s own Google Maps share link — where the yard is, ' +
        'rather than what its address string resolves to. It is host-checked (`https`, a ' +
        'Google Maps domain) because the public portfolio renders it as a link a buyer ' +
        'clicks, and stored verbatim rather than parsed into coordinates.\n\n' +
        '`tagline` and `specialities` are both required (**R26**). They are the whole of what ' +
        'the public pages render as the dealership\u2019s own words \u2014 the line under its ' +
        'name on the portfolio, and the first three services on its directory card \u2014 and ' +
        'a field a form does not insist on is a field that gets skipped. They replace `about`, ' +
        'which is no longer accepted here and is rendered nowhere public.\n\n' +
        'There is no `phone` field either, since **R39**, and for the reason `email` has ' +
        'never had one: it is a verified fact now. `POST /v1/auth/phone/verify` writes it ' +
        'after MSG91 confirms an OTP, and this endpoint reads it off the user record. A ' +
        'session with no verified number is a `422 PHONE_NOT_VERIFIED` \u2014 a step is ' +
        'missing rather than a field, so the client should send the dealer back to it rather ' +
        'than highlight a box.\n\n' +
        '`409 DEALER_ALREADY_EXISTS` if the session already manages one, `409 ' +
        'PHONE_ALREADY_REGISTERED` if the number belongs to another dealership, `409 ' +
        'DEALER_NAME_TAKEN` if another dealership already trades under that name **in that ' +
        'city** — the same name in another city is not a collision.',
      audience: 'dealer',
      requestBody: {
        schema: 'OnboardingInput',
        example: {
          fullName: 'R. Manikandan',
          legalName: 'Sri Lakshmi Automobiles Pvt Ltd',
          addressLine: '14, Katpadi Main Road, Gandhi Nagar',
          city: 'Vellore',
          district: 'Vellore',
          state: 'Tamil Nadu',
          pincode: '632006',
          mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
          landline: '0416 224 8890',
          tagline:
            'Family-run since 1998 \u2014 hatchbacks under \u20b96 lakh, inspected in-house.',
          specialities: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
        },
      },
      responses: [
        {
          status: 201,
          description: 'The dealership exists; the session now resolves to a dealer seat.',
          schema: 'AuthSession',
        },
      ],
      errors: [401, 403, 409, 422],
    },
    {
      method: 'post',
      path: '/v1/auth/phone/start',
      operationId: 'startPhoneVerification',
      tag: 'Authentication',
      summary: 'Send a phone verification code',
      description:
        'Normalises an Indian mobile number, checks availability and sends a six-digit MSG91 OTP. ' +
        'Requires the existing Google session. Returns a user-bound challenge with five-minute expiry. ' +
        'Call this endpoint again after the 60-second cooldown to resend; the old challenge is invalidated. ' +
        'Limits: five sends/hour per phone, configurable user/IP hourly limits and a daily project ceiling. ' +
        'Counters use CachePort and fail closed. A different user cannot replace a live phone challenge.',
      audience: 'dealer',
      requestBody: {
        schema: 'PhoneVerificationStartInput',
        example: { phone: '9840012345' },
      },
      responses: [
        {
          status: 200,
          description: 'The opaque challenge, normalized phone, expiry and resend cooldown.',
          schema: 'PhoneVerificationStartResponse',
        },
      ],
      errors: [400, 401, 409, 429, 503],
    },
    {
      method: 'post',
      path: '/v1/auth/phone/verify',
      operationId: 'verifyPhone',
      tag: 'Authentication',
      summary: 'Verify and consume a phone challenge',
      description:
        'Verifies a six-digit code against a challenge owned by the session user. ' +
        'The phone is read from the database challenge; the body cannot supply one. ' +
        'Five attempts per challenge, 30 checks per user per five minutes. Expired, replaced, consumed ' +
        'or foreign challenges return PHONE_CODE_EXPIRED. Wrong codes return PHONE_CODE_INVALID. ' +
        'The challenge is consumed atomically with users.phone, phoneVerifiedAt and the dealership contact mirror. ' +
        'Concurrent claims still respect users.phone uniqueness. This does not create a login session.',
      audience: 'dealer',
      requestBody: {
        schema: 'PhoneVerificationInput',
        description: 'The challenge returned by start and the six-digit SMS code.',
        example: { challengeId: '10000000-0000-4000-8000-000000000001', code: '123456' },
      },
      responses: [
        {
          status: 200,
          description: 'The session, with `user.phoneVerified` now true.',
          schema: 'AuthSession',
        },
      ],
      errors: [400, 401, 409, 429, 503],
    },
    {
      method: 'post',
      path: '/v1/auth/logout',
      operationId: 'logout',
      tag: 'Authentication',
      summary: 'End the session',
      description:
        'Revokes the `sessions` row behind the presented cookie and clears the cookie. The ' +
        'row is what makes this real: the token stops working everywhere immediately, rather ' +
        'than merely being forgotten by one browser.',
      audience: 'dealer',
      responses: [{ status: 204, description: 'Revoked and cleared.' }],
      errors: [401],
    },
    {
      method: 'post',
      path: '/v1/auth/admin/logout',
      operationId: 'adminLogout',
      tag: 'Authentication',
      summary: 'End the admin session',
      description:
        'Revokes the presented session and clears the cookie. Unguarded on purpose: signing ' +
        'out has to work when the session has already expired, and it can only ever revoke ' +
        "the token in the caller's own cookie.\n\n" +
        'Separate from `/v1/auth/logout` only so the two consoles can be reasoned about ' +
        'separately; both revoke whatever row the presented cookie names.',
      audience: 'public',
      responses: [{ status: 204, description: 'Revoked and cleared.' }],
    },
  ],
};
