import type { ModuleDocs } from '../../docs/spec.js';

const LOCATION_HEADER = {
  Location: { description: 'Where the browser is sent next.', schema: { type: 'string' } },
} as const;

/**
 * PART B — authentication.
 *
 * Two of these operations are browser redirects rather than API calls, and are
 * documented as such: a client library never calls `/google/start`, a person's
 * browser navigates to it. They are in the reference because leaving the only
 * two routes that issue a session undocumented would be the worst possible
 * omission (§32).
 */
export const authDocs: ModuleDocs = {
  tag: 'Authentication',
  description:
    'Dealers sign in with Google (OAuth 2.0 authorization code + PKCE + OIDC nonce); admins ' +
    'sign in with an email and an Argon2id-hashed password. Both end in the same place: an ' +
    'opaque `dd_session` cookie backed by a row in `sessions`, revocable instantly ' +
    '(ARCHITECTURE §8.2).\n\n' +
    '**No endpoint here accepts an identity.** There is no request body anywhere in this tag ' +
    'that carries an email as proof of who the caller is — the dealer flow establishes that ' +
    'from a token Google signed, and the admin flow from a password hash. A `dealerId` is ' +
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
        '`account_link_required`, `account_suspended`, `invalid_callback`.',
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
              roleTitle: 'Proprietor',
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
        'derived from the brand name (rules 1 and 5).\n\n' +
        '`409 DEALER_ALREADY_EXISTS` if the session already manages one, `409 ' +
        'PHONE_ALREADY_REGISTERED` if the number belongs to another dealership, `422 ' +
        'UNKNOWN_CITY` for a city outside the catalogue.',
      audience: 'dealer',
      requestBody: {
        schema: 'OnboardingInput',
        example: {
          fullName: 'R. Manikandan',
          roleTitle: 'Proprietor',
          phone: '9840012345',
          brandName: 'Sri Lakshmi Motors',
          legalName: 'Sri Lakshmi Automobiles Pvt Ltd',
          addressLine: '14, Katpadi Main Road, Gandhi Nagar',
          citySlug: 'vellore',
          pincode: '632006',
          landline: '0416 224 8890',
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
      path: '/v1/auth/admin/login',
      operationId: 'adminLogin',
      tag: 'Authentication',
      summary: 'Admin sign-in',
      description:
        'Email and Argon2id password. There is no admin sign-up, no admin OTP and no Google ' +
        'path into the admin console: admins are created by the seed or by another admin.\n\n' +
        'The session it issues has `scope = ADMIN` and a 12-hour lifetime, and satisfies only ' +
        '`/v1/admin/**` — a dealer cookie can never reach an admin route, and an admin cookie ' +
        'can never reach a dealer one, even for one human holding both seats.\n\n' +
        'Unknown email and wrong password are indistinguishable: same status, same message, ' +
        'and a decoy hash verification so the timing matches too.',
      audience: 'public',
      rateLimit: '5 attempts per email per 15 minutes, 20 per IP per 15 minutes.',
      requestBody: {
        schema: 'AdminLoginInput',
        example: { email: 'ops@dealers-drive.in', password: '••••••••' },
      },
      responses: [
        {
          status: 200,
          description: 'Signed in, with `dd_session` set.',
          schema: 'AdminSessionResponse',
          example: {
            admin: {
              id: '7d1c9b22-3333-4000-8000-000000000003',
              email: 'ops@dealers-drive.in',
              fullName: 'Dealers-Drive Operations',
              adminRole: 'SUPER_ADMIN',
            },
            permissions: ['admin:dealer:approve', 'admin:listing:moderate', 'admin:credit:grant'],
            sessionExpiresAt: '2026-08-18T21:11:42.000Z',
          },
        },
      ],
      errors: [400, 401, 429],
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
        "the token in the caller's own cookie.",
      audience: 'public',
      responses: [{ status: 204, description: 'Revoked and cleared.' }],
    },
  ],
};
