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
    '**No endpoint here accepts an identity, and none accepts a password.** There is no ' +
    'request body anywhere in this tag that carries a credential: every session is issued ' +
    'from an email inside a token Google signed. What separates the two consoles is the ' +
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
        'after Firebase confirms an OTP, and this endpoint reads it off the user record. A ' +
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
      summary: 'Normalise a number before sending an OTP to it',
      description:
        'Step one of phone verification (**R39**). It sends no message: it turns what the ' +
        'dealer typed into E.164 and says whether the number is free.\n\n' +
        '**Why the server normalises rather than the browser.** A dealer types ' +
        '`98400 12345`, Firebase wants `+919840012345`, and our records hold E.164. Two ' +
        'implementations of that conversion is one bug nobody can see: the code arrives, the ' +
        'dealer enters it, the verification succeeds, and the number stored is not the number ' +
        'that was texted. This returns exactly what to hand `signInWithPhoneNumber`.\n\n' +
        '**And why it refuses early.** A number another dealership already holds cannot become ' +
        "this one's however many codes are sent to it. A `409 PHONE_ALREADY_REGISTERED` " +
        "before the SMS is kinder to the dealer and cheaper for everybody \u2014 Firebase's " +
        'free tier is a per-project daily message count.\n\n' +
        'It does **not** sign anybody in and cannot be reached without a session. The caller ' +
        'is an authenticated dealer already; Google remains the only door.',
      audience: 'dealer',
      requestBody: {
        schema: 'PhoneVerificationStartInput',
        example: { phone: '9840012345' },
      },
      responses: [
        {
          status: 200,
          description: 'The number in E.164, and how to show it.',
          schema: 'PhoneVerificationStartResponse',
        },
      ],
      errors: [400, 401, 409],
    },
    {
      method: 'post',
      path: '/v1/auth/phone/verify',
      operationId: 'verifyPhone',
      tag: 'Authentication',
      summary: 'Record that an OTP came back',
      description:
        'Step two (**R39**). The browser has completed a Firebase phone sign-in and holds an ' +
        'ID token; this verifies it and marks the number on the session\u2019s user record as ' +
        'verified.\n\n' +
        '**One field, and it is not the phone number.** The number is inside the token, signed ' +
        'by Google. Accepting one in the body would let any caller claim any handset, which is ' +
        'the whole thing this endpoint exists to prevent \u2014 the same rule that keeps ' +
        '`email` out of `OnboardingInput` and `dealerId` out of every schema in the contracts ' +
        'package.\n\n' +
        '**What is checked**, in order: RS256 and a known `kid`; the signature, against ' +
        "Google's published certificates; `aud` equal to this deployment's Firebase project, " +
        'so a token minted by a project an attacker owns is refused; `iss`; `exp` and `iat`; ' +
        'that the sign-in provider was `phone` rather than email, Google or anonymous; and ' +
        'that `auth_time` \u2014 when a person actually entered the code \u2014 is within ' +
        '`PHONE_VERIFICATION_MAX_AGE_S`. Freshness is read from `auth_time` and not `iat`, ' +
        'because a Firebase ID token can be refreshed for a year off one sign-in.\n\n' +
        '`401 PHONE_TOKEN_INVALID` for every structural failure, deliberately as one code: a ' +
        'caller cannot act differently on "the signature was wrong" than on "the audience was ' +
        'wrong", and an error naming the failed check tells anybody probing this endpoint how ' +
        'far their forgery got. `401 PHONE_TOKEN_EXPIRED` is separated for the dealer\u2019s ' +
        'sake rather than the attacker\u2019s \u2014 "send another code" is actionable, and ' +
        'calling a stale code *invalid* sends somebody hunting for a typo that is not there.\n\n' +
        '**Verification happens once.** Re-verifying the number already on the record is a ' +
        'no-op that answers with the session: a double-submitted form cannot move the ' +
        'timestamp or write a second audit row. Verifying a *different* number is a different ' +
        'thing and is allowed \u2014 a dealership that changes its SIM has to be able to say ' +
        "so, and the way it says so is by proving the new handset. The dealership's public " +
        '`contactPhone` is written from the same answer, so the mirror cannot go stale.\n\n' +
        '**It issues no session and it is not a sign-in.** A dealer who signs in with Google ' +
        'tomorrow is not asked for a code: `phoneVerifiedAt` lives on the user row, not on the ' +
        'session.',
      audience: 'dealer',
      requestBody: {
        schema: 'PhoneVerificationInput',
        description: 'The Firebase ID token from `confirmationResult.confirm(code)`.',
        example: { idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2N2I0Y…' },
      },
      responses: [
        {
          status: 200,
          description: 'The session, with `user.phoneVerified` now true.',
          schema: 'AuthSession',
        },
      ],
      errors: [400, 401, 409],
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
