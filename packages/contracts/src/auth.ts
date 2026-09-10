import { z } from 'zod';

import { GoogleMapsUrl, IndianMobile, Uuid } from './common.js';
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
 *
 * **And no `phone`, since R39.** For exactly the reason `email` is absent: it
 * is a *verified* fact now, established by `POST /v1/auth/phone/verify` against
 * an OTP Firebase sent to the handset, and a number in this body would be a
 * number nobody proved. The service reads it off the user record and refuses
 * the whole request when there is none — which is what makes "verified before
 * you may continue" a rule rather than a screen.
 */
export const OnboardingInput = z
  .object({
    fullName: z.string().trim().min(2, 'Tell us your name.').max(80),
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
    /**
     * Where the yard actually is, as a Google Maps link.
     *
     * Asked for rather than derived, because a typed address is not a location:
     * "18, Gandhi Road" resolves to four different pins in one district, and the
     * buyer who follows the wrong one has already driven there. The dealer knows
     * which pin is their gate, and Share → Copy link is the shortest way for
     * them to say so.
     *
     * Required, for the same reason the yard photograph is: the public
     * portfolio is built around "here is the yard, here is how to reach it",
     * and a directions button that is missing for a third of dealerships is a
     * button buyers stop looking for. See `GoogleMapsUrl` for why the host is
     * checked.
     */
    mapsUrl: GoogleMapsUrl,
    landline: z.string().trim().max(24).optional(),
    /**
     * The dealership in one line — the sentence the public portfolio runs
     * under its name, and the blurb on its directory card.
     *
     * It replaces `about`, which asked for the same thing at forty times the
     * length. That field wanted two or three sentences and got either a
     * paragraph nobody read or twenty characters of "we sell used cars": the
     * form insisted on prose, and prose is the thing a person filling in a
     * sign-up form at the end of a working day is least able to produce.
     *
     * A line is a question a dealer can answer. "Family-run since 1998,
     * hatchbacks under ₹6 lakh" is the whole of what a buyer wants from this
     * field, and it is what the two surfaces that render it are sized for
     * — two clamped lines on the card, one paragraph in the portfolio header.
     *
     * **Required, on the same footing as the address and the Maps link.** The
     * public portfolio is the page a dealership is judged on before anybody
     * drives anywhere, and a page with a photograph, a pin and no sentence
     * reads as an unfinished listing rather than a business. Optional here
     * would mean blank on most rows: a field a form does not insist on is a
     * field that gets skipped.
     *
     * The floor is 10 characters, not 1, for the reason `about`'s floor of 20
     * existed — a required field with no minimum is satisfied by `-` and buys
     * nothing except the false belief that every portfolio has a line on it.
     * Ten is short enough that "Since 2004" clears it exactly and long enough
     * that a single evasive word does not.
     *
     * The upper bound matches `UpdateDealerInput.tagline`, so what onboarding
     * accepts and what the profile screen accepts cannot drift.
     */
    tagline: z
      .string()
      .trim()
      .min(10, 'One line buyers will read under your name.')
      .max(200, 'Keep it to one line — 200 characters at most.'),
    /**
     * What the yard actually does, as a set of short labels.
     *
     * Asked for here rather than left to the profile screen for the same
     * reason the tagline is: this is the one moment a dealer is already
     * describing their business. It is also the only structured thing on the
     * public pages a buyer can compare two dealerships by — the directory card
     * shows the first three, the portfolio shows all of them — so a platform
     * where most rows are empty is a platform where the comparison does not
     * exist.
     *
     * At least one, which is the whole of what "required" can mean for a list.
     * The bounds match `UpdateDealerInput.specialities` exactly: up to twelve,
     * each at most sixty characters. Duplicates are not refused here — they
     * are merged on read (**R18**), because a dealer typing "RC transfer" twice
     * has made a typo rather than an error, and a form that rejects it is
     * teaching them to be careful about something that does not matter.
     *
     * **Every bound carries its own sentence** (**R30**). A message left off is
     * not a message left blank: Zod fills the gap with its own, and its own is
     * written for the person who wrote the schema. `Too big: expected array to
     * have <=12 items` is an accurate description of a `ZodArray` and tells a
     * dealer nothing — they did not type an array, they typed a list of the
     * things their yard does, and "items" is not a word this screen has used.
     * These strings are rendered verbatim under the input by
     * `features/auth/onboarding-wizard.tsx` and `features/dealer/profile-form.tsx`.
     */
    specialities: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(60, 'Keep each service to a short label — 60 characters at most.'),
      )
      .min(1, 'Name at least one service you offer.')
      .max(12, 'Twelve services at most — list the ones buyers ask for.'),
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
    phone: z.string(),
    phoneDisplay: z.string(),
    email: z.string().nullable(),
    emailVerified: z.boolean(),
    /**
     * **R39.** Whether an OTP reached this handset and came back.
     *
     * It always describes the number in `phone` above, because the two are
     * written and cleared together: a write that changes the number clears the
     * timestamp behind this flag, so there is no state in which a dealership
     * holds a verified badge for a number nobody proved.
     *
     * `emailVerified` is its neighbour and is `true` for every session — Google
     * verified the address before a session existed. This one is genuinely
     * two-valued, and step 1 of onboarding is where it changes.
     */
    phoneVerified: z.boolean(),
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

// ─────────── B7 phone verification (R39) ───────────────────────────────────
/**
 * What the browser hands back after Firebase has confirmed an OTP.
 *
 * One field, and it is deliberately **not the phone number**. The number is
 * inside the token, signed by Google, and taking it from the body instead
 * would let any caller claim any handset — which is the whole thing this
 * endpoint exists to prevent. It is the same rule that keeps `email` out of
 * `OnboardingInput` and `dealerId` out of every schema in this package.
 *
 * `.strict()`, so a client that also sends `phone` is told which field it
 * invented rather than being quietly ignored (rule 2).
 *
 * The 4096-character ceiling is a bound, not a format: a Firebase ID token is
 * a three-segment RS256 JWT of roughly 900 bytes, and anything an order of
 * magnitude larger is not one. Parsing it is the verifier's job; refusing a
 * megabyte of it before that is this schema's.
 */
export const PhoneVerificationInput = z
  .object({
    idToken: z
      .string()
      .trim()
      .min(1, 'The verification did not complete. Try sending the code again.')
      .max(4096),
  })
  .strict();
export type PhoneVerificationInput = z.infer<typeof PhoneVerificationInput>;

/**
 * What a client asks for before it can show the OTP form at all.
 *
 * The number is normalised to E.164 by the server so the browser hands Firebase
 * exactly what our records will hold — a mismatch between what was texted and
 * what is stored is the bug this removes, and it is not one a dealer could
 * diagnose.
 */
export const PhoneVerificationStartInput = z.object({ phone: IndianMobile }).strict();
export type PhoneVerificationStartInput = z.infer<typeof PhoneVerificationStartInput>;

export const PhoneVerificationStartResponse = z.object({
  /** `+919840012345` — what to hand `signInWithPhoneNumber`. */
  phone: z.string(),
  phoneDisplay: z.string(),
});
export type PhoneVerificationStartResponse = z.infer<typeof PhoneVerificationStartResponse>;
