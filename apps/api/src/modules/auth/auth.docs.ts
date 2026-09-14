import type { ModuleDocs } from '../../docs/spec.js';

const LOCATION_HEADER = {
  Location: { description: 'Where the browser is sent next.', schema: { type: 'string' } },
} as const;

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
              phoneVerified: true,
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
        '`phone` must already be the number this session **proved** through `POST ' +
        '/v1/auth/phone/verify` (**R39**). Onboarding does not write `users.phone`; it asserts ' +
        'that the column already holds this number and refuses with `422 PHONE_NOT_VERIFIED` ' +
        'otherwise, which is what makes the OTP round trip unskippable rather than merely ' +
        'expected. `PHONE_ALREADY_REGISTERED` is answered by the verify endpoint now, at the ' +
        'moment the claim is made.\n\n' +
        '`409 DEALER_ALREADY_EXISTS` if the session already manages one, `409 ' +
        'DEALER_NAME_TAKEN` if another dealership already trades under that name **in that ' +
        'city** — the same name in another city is not a collision.',
      audience: 'dealer',
      requestBody: {
        schema: 'OnboardingInput',
        example: {
          fullName: 'R. Manikandan',
          phone: '9840012345',
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
      method: 'get',
      path: '/v1/auth/phone/widget',
      operationId: 'getPhoneOtpWidget',
      tag: 'Authentication',
      summary: 'Credentials for the MSG91 OTP widget',
      description:
        'What the onboarding screen initialises `verify.msg91.com/otp-provider.js` with ' +
        '(**R39**). Served from the API rather than inlined as `NEXT_PUBLIC_*`, so rotating a ' +
        'widget is a restart and not a rebuild of the web image (rule 9).\n\n' +
        '**Behind a session on purpose.** The widget sends the SMS from the browser, so ' +
        'whoever holds `widgetId` and `tokenAuth` can spend this MSG91 balance — which makes ' +
        'who may read them the only gate the API still owns over that spend. On ' +
        '`GET /v1/config/public` that gate would have been the open internet, and that ' +
        'response is additionally `Cache-Control: public`.\n\n' +
        '`MSG91_AUTH_KEY` is **not** here and never will be: it is the credential that makes ' +
        '`POST /v1/auth/phone/verify` a server-to-server call.\n\n' +
        '`driver: "fake"` is the local and test configuration — no widget script, no SMS, and ' +
        '`devCode` is the code that will be accepted. `env.ts` refuses it in production.\n\n' +
        '`Cache-Control: no-store`. Rate-limited to 30 an hour per session, because each call ' +
        'is a licence to send messages.',
      audience: 'dealer',
      responses: [
        {
          status: 200,
          description: 'The widget configuration for this deployment.',
          schema: 'PhoneOtpWidget',
          example: {
            enabled: true,
            driver: 'msg91',
            widgetId: 'example-widget-id',
            tokenAuth: 'example-widget-token',
            devCode: null,
            reason: null,
          },
        },
      ],
      errors: [401, 429],
    },
    {
      method: 'post',
      path: '/v1/auth/phone/availability',
      operationId: 'checkPhoneAvailability',
      tag: 'Authentication',
      summary: 'May this account claim this number?',
      description:
        'The first of the two calls onboarding step 1 makes, and the cheap one (**R39**). Step 1 ' +
        'asks three questions in order — is it a number, is it free, then send — and only the ' +
        'third costs anything.\n\n' +
        '**It exists because the send is the browser\u2019s.** MSG91\u2019s widget sends the SMS, ' +
        'so the API cannot refuse one already in flight: a number another dealership holds is ' +
        'either caught here or caught at verification, and the second spends a message to tell a ' +
        'dealer they cannot have their own number \u2014 delivered to a handset whose owner never ' +
        'asked for one.\n\n' +
        '`204` when the number is free for this account, including when this account already ' +
        'holds it. `409 PHONE_ALREADY_REGISTERED` naming `body.phone` when another one does.\n\n' +
        '**The read is not the guarantee.** Two callers can pass this at the same instant; the ' +
        'unique index on `users.phone` decides, and `POST /v1/auth/phone/verify` answers the ' +
        'loser with the same refusal. This is the early, cheap copy of a question that is asked ' +
        'again where it can be enforced.\n\n' +
        '**It never says who holds a number.** A yes/no about whether the platform knows a ' +
        'number is something a caller could walk a list through, so it is behind the session and ' +
        'rate-limited to 30 an hour \u2014 and answers nothing but yes or no. The phone is in the ' +
        'body rather than the query string for the same reason a dealer\u2019s number is kept out ' +
        'of URLs everywhere else: access logs.',
      audience: 'dealer',
      requestBody: {
        schema: 'PhoneAvailabilityInput',
        example: { phone: '9840012345' },
      },
      responses: [{ status: 204, description: 'The number is free for this account to claim.' }],
      errors: [400, 401, 409, 429],
    },
    {
      method: 'post',
      path: '/v1/auth/phone/verify',
      operationId: 'verifyPhone',
      tag: 'Authentication',
      summary: 'Prove a mobile number with the widget access token',
      description:
        'The server half of the MSG91 OTP widget (**R39**). The browser runs `sendOtp` and ' +
        '`verifyOtp`; the six digits never reach this API. What arrives is the signed access ' +
        'token `verifyOtp` produced, and this endpoint takes it to ' +
        '`control.msg91.com/api/v5/widget/verifyAccessToken` with the server-only ' +
        '`MSG91_AUTH_KEY` and asks whose handset it proves.\n\n' +
        '**`phone` is not trusted input — it is the assertion being checked.** The identifier ' +
        'MSG91 names must be this number, or the request is refused; without that a dealer ' +
        'could verify a handset they hold and register a number they do not.\n\n' +
        'On success `users.phone` and `users.phoneVerifiedAt` are written, and this endpoint ' +
        'is the **only** thing in the API that writes them. Onboarding and `PATCH /v1/dealer` ' +
        'assert against them rather than setting them.\n\n' +
        'It issues no session and grants no permission. Identity is the Google account and ' +
        'already was; this proves that the number a buyer will be given rings the dealership ' +
        'that published it.\n\n' +
        '`422 PHONE_VERIFICATION_FAILED` when the token is refused, names a different number, ' +
        'or has already been presented — one message for all three, because telling a caller ' +
        'which number a token belongs to is telling them something about somebody else. ' +
        '`409 PHONE_ALREADY_REGISTERED` when another dealership holds the number. ' +
        '`503 PHONE_OTP_UNAVAILABLE` when MSG91 did not answer, which is deliberately not the ' +
        'same answer as a wrong code.\n\n' +
        'Rate-limited to 10 presentations in 10 minutes per session.',
      audience: 'dealer',
      requestBody: {
        schema: 'VerifyPhoneInput',
        example: {
          phone: '9840012345',
          accessToken: '<the signed token verifyOtp() handed the page>',
        },
      },
      responses: [
        {
          status: 200,
          description: 'The number is proved and recorded against this account.',
          schema: 'VerifyPhoneResponse',
          example: {
            phone: '+919840012345',
            phoneDisplay: '+91 98400 12345',
            verifiedAt: '2026-09-13T09:41:22.000Z',
          },
        },
      ],
      errors: [400, 401, 409, 422, 429, 503],
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
