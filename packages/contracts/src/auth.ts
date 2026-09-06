import { z } from 'zod';

import { Uuid } from './common.js';
import { AdminRole, DealerRole, DealerStatus } from './enums.js';

/**
 * PART B — authentication (API-SPEC B1–B7, revised r3).
 *
 * Dealers sign in with Google; the only thing this file describes about that
 * exchange is its *result*, because everything else — the authorization code,
 * the PKCE verifier, the state — lives between the browser, the API and Google
 * and never crosses this contract. There is no schema here that accepts an
 * email as proof of identity, and that absence is the point: a client that
 * could post `{ email }` and receive a session would make Google decorative.
 *
 * Admins sign in with Google too, and there is no password anywhere in this
 * file — no schema accepts one, because the API no longer verifies one. What
 * separates the two consoles is not the credential but the **allow-list**: an
 * address on `ADMIN_ALLOWLIST` is granted an `ADMIN`-scope session, and every
 * other verified Google account is refused the admin console outright.
 */

/** Where the client should land once a session exists. */
export const SessionNext = z.enum(['DASHBOARD', 'ONBOARDING', 'PENDING_APPROVAL']);
export type SessionNext = z.infer<typeof SessionNext>;

/** The sign-in methods this deployment can actually perform. */
export const AuthProvidersResponse = z.object({
  google: z.object({
    enabled: z.boolean(),
    /** Absolute — the browser navigates here; it is not an API call. */
    startUrl: z.string(),
    /**
     * The same flow, entered for the admin console.
     *
     * A separate URL rather than a query parameter on `startUrl`, because the
     * audience decides the *scope of the session that is issued* — it is sealed
     * into the OAuth transaction cookie at the start and cannot be changed on
     * the way back. Publishing it costs nothing: the allow-list, not the
     * secrecy of this path, is what keeps the console closed.
     */
    adminStartUrl: z.string(),
    /** Present only when `enabled` is false: what a developer must configure. */
    reason: z.string().nullable(),
  }),
});
export type AuthProvidersResponse = z.infer<typeof AuthProvidersResponse>;

/**
 * B6 — dealer onboarding, the one step between a verified Google identity and a
 * dealership.
 *
 * No `email`: it comes from the Google identity on the session, and accepting
 * one here would let a caller claim an address Google never verified. No
 * `status` and no `slug` either — the state machine owns one and the service
 * derives the other (CLAUDE.md rules 1 and 5).
 */
export const OnboardingInput = z
  .object({
    fullName: z.string().trim().min(2, 'Tell us your name.').max(80),
    roleTitle: z.string().trim().max(60).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?91[- ]?)?[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number.'),
    /**
     * One name, not two.
     *
     * The baseline asked for a public `brandName` alongside the registered
     * `legalName`, and dealers filled both in with the same words. The
     * registered name is the one KYC is checked against, so it is the one that
     * is asked for — and it is what buyers see. `dealers.brandName` is kept as
     * the display mirror of it, written by the server, never by a client.
     */
    legalName: z.string().trim().min(2, 'Enter your dealership\u2019s registered name.').max(160),
    addressLine: z.string().trim().min(4, 'Enter the showroom address.').max(200),
    /**
     * The city, typed rather than chosen.
     *
     * It was a slug drawn from a five-row `cities` table, which made the
     * product's reach a migration rather than a sign-up: a dealer in Salem or
     * Bengaluru could not finish this form at all. Free text costs the write
     * path a normalisation step — see `normaliseLocality` — and buys every
     * city in India.
     */
    city: z.string().trim().min(2, 'Enter your city.').max(80),
    /**
     * The district, asked for because the admin console filters on it.
     *
     * A city name alone is ambiguous across India — there is a Vellore town in
     * Vellore district and a Gudiyatham in the same one — and support work is
     * almost always district-shaped: "every dealer in Vellore district", not
     * "every dealer whose town is spelt Vellore". Normalised on write like
     * `city` and `state`, for the same reason: three spellings of one district
     * are three useless filter values.
     */
    district: z.string().trim().min(2, 'Enter your district.').max(80),
    state: z.string().trim().min(2, 'Enter your state.').max(80),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Pincode must be 6 digits.'),
    landline: z.string().trim().max(24).optional(),
  })
  .strict();
export type OnboardingInput = z.infer<typeof OnboardingInput>;

/**
 * B7 — what the admin console's Google callback resolves to.
 *
 * There is no `AdminLoginInput` any more, and its absence is the contract: no
 * schema in this package accepts an admin credential, because no endpoint does.
 * The console's session is issued by the same OAuth callback the dealer flow
 * uses, to an address the deployment has allow-listed.
 */
export const AdminSessionResponse = z.object({
  admin: z.object({
    id: Uuid,
    email: z.string(),
    fullName: z.string().nullable(),
    adminRole: AdminRole,
  }),
  permissions: z.array(z.string()),
  sessionExpiresAt: z.string(),
});
export type AdminSessionResponse = z.infer<typeof AdminSessionResponse>;

/** The Google account behind the session, shown on the onboarding screen. */
export const VerifiedIdentity = z.object({
  provider: z.literal('GOOGLE'),
  email: z.string(),
  name: z.string().nullable(),
  pictureUrl: z.string().nullable(),
});
export type VerifiedIdentity = z.infer<typeof VerifiedIdentity>;

/**
 * B4 `GET /v1/auth/me`.
 *
 * `dealer` and `role` are nullable because the shape has to describe the state
 * between sign-in and onboarding as well as the state after it — a session with
 * a verified identity and no dealership yet. `next` is what the client acts on.
 */
export const AuthSession = z.object({
  next: SessionNext,
  user: z.object({
    id: Uuid,
    fullName: z.string().nullable(),
    roleTitle: z.string().nullable(),
    phone: z.string(),
    phoneDisplay: z.string(),
    email: z.string().nullable(),
    emailVerified: z.boolean(),
  }),
  identity: VerifiedIdentity.nullable(),
  dealer: z
    .object({
      id: Uuid,
      slug: z.string(),
      brandName: z.string(),
      status: DealerStatus,
      statusLabel: z.string(),
      isVerified: z.boolean(),
      creditBalance: z.number().int(),
      creditsHeld: z.number().int(),
    })
    .nullable(),
  role: DealerRole.nullable(),
  permissions: z.array(z.string()),
  counts: z.object({ newEnquiries: z.number().int(), pendingListings: z.number().int() }),
});
export type AuthSession = z.infer<typeof AuthSession>;
