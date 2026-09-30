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

/**
 * Where a signed-in dealer goes next, decided by their dealership's status
 * alone (**R60**) — `null` when they have no dealership yet.
 *
 * One function, because there are now two ways to sign in and the destination
 * must not depend on which was used: Google sign-in, phone sign-in and
 * `GET /v1/auth/me` all answer through this. Before R60 the same three-way
 * branch was written out in two services, and a third copy for the phone is
 * exactly how an OTP sign-in would one day land somewhere Google does not.
 *
 * `DRAFT` covers "changes requested" too: an operator's request for changes
 * returns a dealership to `DRAFT`, and the onboarding wizard is the correction
 * flow. `SUSPENDED` never reaches here — both sign-ins refuse it first.
 */
export function dealerSessionNext(status: DealerStatus | null): SessionNext {
  if (status === null || status === 'DRAFT') return 'ONBOARDING';
  if (status === 'PENDING_APPROVAL') return 'PENDING_APPROVAL';
  return 'DASHBOARD';
}

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
    /**
     * The same flow again, to **link** Google to the account that is already
     * signed in rather than to sign in (**R61**) — a dealer who started with
     * their phone. It needs the session: the callback attaches the Google
     * account to the user whose session started the round trip, and to nobody
     * else.
     */
    linkStartUrl: z.string(),
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
    phone: IndianMobile,
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
    /**
     * Whether `phone` is the number this person proved, rather than one they
     * typed (**R39**).
     *
     * It is not derivable from `phone` being non-empty, and the difference is
     * the whole of R39: `users.phone` is only ever written by a completed OTP
     * round trip now, so an unverified session simply has none. The onboarding
     * screen reads this to decide whether step 1 asks for a code or shows the
     * number as settled, and the API refuses to build a dealership around a
     * number this is false for.
     */
    phoneVerified: z.boolean(),
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

/**
 * ── R39 · the mobile number is proved, not typed ───────────────────────────
 *
 * Three shapes, and the split between them is the trust boundary.
 *
 * `PhoneOtpWidget` is what the browser needs in order to talk to MSG91 at all.
 * `VerifyPhoneInput` is what the browser hands *back* — an opaque token it
 * cannot forge. `VerifyPhoneResponse` is the server's own verdict, and it is
 * the only thing in this exchange the product acts on: nothing the client says
 * about whether a code was right is believed, because the only place that can
 * be answered is a server-to-server call carrying `MSG91_AUTH_KEY`.
 *
 * The OTP proves **ownership of a handset and nothing else**. It issues no
 * session, grants no permission and is not a second factor: identity is the
 * Google account, and it already was before the code was sent. What this buys
 * is that the number a buyer is given rings the dealership that published it.
 */

/**
 * `GET /v1/auth/phone/widget` — the credentials the MSG91 OTP widget is
 * initialised with.
 *
 * **Served from the API rather than baked into the bundle** (rule 9). They are
 * per-deployment values, a rotation must not be a rebuild, and `NEXT_PUBLIC_*`
 * would inline them at build time and end build-once-promote-many.
 *
 * **Behind a session, and not on `GET /v1/config/public`.** The widget sends
 * the SMS from the browser, so whoever holds these two strings can spend this
 * account's balance. Putting them on the public bootstrap payload — which is
 * additionally `Cache-Control: public` — would hand that to the internet.
 * Behind `requireSignedIn` the cost is bounded by the set of people who have
 * already completed a Google sign-in, which is the smallest gate the widget
 * design allows us to put in front of it.
 *
 * **R60 moved that gate.** A phone sign-in has no session before it starts, so
 * the same shape is also served by `GET /v1/auth/sign-in/phone/widget`,
 * rate-limited per address. The session is no longer what bounds the spend;
 * MSG91's per-number limits and widget captcha, and the limits on the sign-in
 * that spends the token, are.
 */
/**
 * How the one-time code reaches the handset. `whatsapp` when an admin has
 * turned on `otp.whatsappEnabled` and this deployment has a WhatsApp-configured
 * MSG91 widget; `sms` otherwise — the fallback is always the channel that
 * already worked. Delivery only: the code is verified the same way whichever
 * channel carried it.
 */
export const OtpChannel = z.enum(['sms', 'whatsapp']);
export type OtpChannel = z.infer<typeof OtpChannel>;

export const PhoneOtpWidget = z.object({
  /** False when this deployment cannot verify a number at all; `reason` says why. */
  enabled: z.boolean(),
  /**
   * Which adapter answers `POST /v1/auth/phone/verify`.
   *
   * `fake` is the local default: no widget script is loaded, no SMS is sent,
   * and the code below is accepted. `env.ts` refuses it in production, exactly
   * as it refuses `CACHE_DRIVER=memory` and `STORAGE_DRIVER=local` there.
   */
  driver: z.enum(['fake', 'msg91']),
  /** `configuration.widgetId`. Null under the `fake` driver. */
  widgetId: z.string().nullable(),
  /** `configuration.tokenAuth`. Null under the `fake` driver. */
  tokenAuth: z.string().nullable(),
  /** The code the `fake` driver accepts, so the screen can say so. Null for `msg91`. */
  devCode: z.string().nullable(),
  /** What a developer must configure, when `enabled` is false. */
  reason: z.string().nullable(),
  /**
   * The channel the code will be sent on, decided by the server from the
   * admin's configuration — the only thing the screen needs to know to label
   * its button. No provider credential rides on it.
   */
  channel: OtpChannel,
});
export type PhoneOtpWidget = z.infer<typeof PhoneOtpWidget>;

/**
 * `POST /v1/auth/phone/availability` — may this account claim this number?
 *
 * Asked **before** a message is sent, and that ordering is the whole point.
 * The uniqueness refusal used to arrive with the verification: the dealer typed
 * a number somebody else holds, an SMS went to it, they read the code off a
 * handset that is theirs, and only then were they told the number is taken.
 * That is a wasted send, a wasted minute, and a message delivered to a phone
 * whose owner never asked for one.
 *
 * So step 1 asks three questions in order — is it a number, is it free, then
 * send — and only the third costs anything.
 *
 * It answers `204` or `409`, and nothing else. There is no shape here that says
 * *who* holds a number: this is a yes/no about the caller's own ability to
 * claim one, behind a session and rate-limited, precisely so it cannot become a
 * way to ask the platform which numbers it knows.
 */
export const PhoneAvailabilityInput = z.object({ phone: IndianMobile }).strict();
export type PhoneAvailabilityInput = z.infer<typeof PhoneAvailabilityInput>;

/**
 * `POST /v1/auth/phone/verify` — the widget's access token, and the number it
 * is claimed to prove.
 *
 * Both, not just the token. The server asks MSG91 which identifier the token
 * belongs to and refuses unless it is this one, so a dealer cannot verify a
 * handset they hold and then register a number they do not. Sending the phone
 * is therefore not trusted input — it is the assertion being checked.
 */
export const VerifyPhoneInput = z
  .object({
    phone: IndianMobile,
    /**
     * The JWT `verifyOtp` handed the page. Bounded because it is proxied to a
     * third party: an unbounded string here is an unbounded request body there.
     */
    accessToken: z.string().trim().min(1, 'The verification token is missing.').max(4096),
  })
  .strict();
export type VerifyPhoneInput = z.infer<typeof VerifyPhoneInput>;

/** What the server recorded. The client renders it; it never derives it. */
export const VerifyPhoneResponse = z.object({
  phone: z.string(),
  phoneDisplay: z.string(),
  verifiedAt: z.string(),
});
export type VerifyPhoneResponse = z.infer<typeof VerifyPhoneResponse>;

/**
 * ── R60 · a dealer signs in with their phone ────────────────────────────────
 *
 * `POST /v1/auth/sign-in/phone/dealer` — the widget's access token, and the
 * number it is claimed to prove, exactly as `VerifyPhoneInput` carries them.
 * The difference is what the server does with a good one: it finds the dealer
 * account that holds that *proved* number and issues the same `dd_session`
 * a Google sign-in would. Nothing in the body names an account; the number is
 * the assertion being checked, not an identifier being trusted.
 */
export const PhoneSignInInput = z
  .object({
    phone: IndianMobile,
    accessToken: z.string().trim().min(1, 'The verification token is missing.').max(4096),
    /**
     * Where to land after a dealer whose dealership is past onboarding signs
     * in. A **path** — anything else is replaced with `/dealer`, the same rule
     * the Google callback applies, because a sign-in that redirects wherever
     * the caller asks is an open redirect.
     */
    returnTo: z.string().trim().max(512).optional(),
  })
  .strict();
export type PhoneSignInInput = z.infer<typeof PhoneSignInInput>;

/**
 * What a phone sign-in decided. The session itself is the `dd_session` cookie
 * on the response, never a field here.
 */
export const PhoneSignInResponse = z.object({
  next: SessionNext,
  /** A path on the web app: onboarding while the dealership is a draft. */
  returnTo: z.string(),
});
export type PhoneSignInResponse = z.infer<typeof PhoneSignInResponse>;

/**
 * ── R62 · customers ─────────────────────────────────────────────────────────
 *
 * A buyer signs in with their phone and nothing else: no Google, no email, no
 * password. A number the platform has not seen is proved first and named
 * second, so an account never exists before its owner has both shown they hold
 * the handset and told us what to call them.
 */

/**
 * What a customer is called — the one thing sign-up asks for.
 *
 * One field, not first and last: plenty of people have one name, and the
 * dealer who calls back needs what the buyer answers to, not a form's idea of
 * how names are shaped. Any script — `\p{L}` rather than `[A-Za-z]` — so
 * "ಶಶಿಕಿರಣ್" and "Sasikiran" are both names. It must contain a letter, and
 * control characters are refused, so a name cannot be blank-looking or break a
 * line on the dealer's screen.
 */
export const CustomerName = z
  .string()
  .trim()
  .min(2, 'Enter your name.')
  .max(80, 'Keep your name under 80 characters.')
  .refine((value) => /\p{L}/u.test(value), 'Enter your name.')
  .refine((value) => !/\p{Cc}/u.test(value), 'Enter your name.');

/** `POST /v1/auth/sign-in/phone/customer` — the same proof a dealer presents. */
export const CustomerSignInInput = z
  .object({
    phone: IndianMobile,
    accessToken: z.string().trim().min(1, 'The verification token is missing.').max(4096),
  })
  .strict();
export type CustomerSignInInput = z.infer<typeof CustomerSignInInput>;

/** A customer, as the customer themselves sees it. */
export const CustomerProfile = z.object({
  id: Uuid,
  fullName: z.string(),
  phone: z.string(),
  phoneDisplay: z.string(),
});
export type CustomerProfile = z.infer<typeof CustomerProfile>;

/**
 * What a proved number leads to.
 *
 * `SIGNED_IN` — the account existed; `dd_session` is on the response.
 *
 * `NAME_REQUIRED` — the number is proved and no account is named for it yet.
 * `signUpToken` is the proof, carried to `POST /v1/auth/sign-up/customer`: an
 * HMAC-sealed, single-use ticket for **this** number that expires at
 * `expiresAt`. It is not a session and opens nothing else.
 */
export const CustomerSignInResponse = z.object({
  status: z.enum(['SIGNED_IN', 'NAME_REQUIRED']),
  /** The signed-in customer. Null while `NAME_REQUIRED`. */
  customer: CustomerProfile.nullable(),
  /** The sealed sign-up ticket. Null once `SIGNED_IN`. */
  signUpToken: z.string().nullable(),
  /** When `signUpToken` stops being accepted. Null once `SIGNED_IN`. */
  expiresAt: z.string().nullable(),
  /** The proved number, formatted — what the name screen says was verified. */
  phoneDisplay: z.string(),
});
export type CustomerSignInResponse = z.infer<typeof CustomerSignInResponse>;

/** `POST /v1/auth/sign-up/customer` — the ticket, and the name. Nothing else. */
export const CustomerSignUpInput = z
  .object({
    signUpToken: z.string().trim().min(1).max(2048),
    fullName: CustomerName,
  })
  .strict();
export type CustomerSignUpInput = z.infer<typeof CustomerSignUpInput>;

/** `GET /v1/auth/customer/me` and the answer to a completed sign-up. */
export const CustomerSession = z.object({ customer: CustomerProfile });
export type CustomerSession = z.infer<typeof CustomerSession>;
