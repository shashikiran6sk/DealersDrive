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
 * Admins sign in with an email and a password. No dealer schema has a password
 * field, and no admin schema has an OAuth one.
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
    brandName: z.string().trim().min(2, 'Enter the name buyers will see.').max(120),
    legalName: z.string().trim().min(2, 'Enter the registered legal name.').max(160),
    addressLine: z.string().trim().min(4, 'Enter the showroom address.').max(200),
    citySlug: z.string().regex(/^[a-z0-9-]+$/, 'Choose a city from the list.'),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Pincode must be 6 digits.'),
    landline: z.string().trim().max(24).optional(),
  })
  .strict();
export type OnboardingInput = z.infer<typeof OnboardingInput>;

/** B7 — the admin console's only sign-in. There is no admin sign-up. */
export const AdminLoginInput = z
  .object({
    email: z.string().trim().email('Enter your work email address.').max(160),
    password: z.string().min(1, 'Enter your password.').max(200),
  })
  .strict();
export type AdminLoginInput = z.infer<typeof AdminLoginInput>;

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
