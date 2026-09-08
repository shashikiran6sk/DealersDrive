'use client';

import type { DealerProfile, MapKind } from '@dealers-drive/contracts';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { saveDealerProfileAction, type ProfileFormState } from '@/features/dealer/profile-actions';

const EMPTY: ProfileFormState = { status: 'idle', fieldErrors: {} };

/**
 * The dealer's own record (C1/C2) — the same answers onboarding collected,
 * after onboarding is over.
 *
 * Read-only here on purpose: `status`, `slug`, `creditBalance`, GSTIN and PAN.
 * The first three are the platform's to set; the tax identifiers were verified
 * against a document during onboarding, and a silent edit would invalidate that
 * check. `UpdateDealerInput` accepts them — the *admin* review screen writes
 * them, with the certificate in hand — and there is deliberately no shortcut
 * here that skips that pair of eyes.
 *
 * ── Divergences from the baseline, each forced by a decision since ──────────
 *   · **No "Trading name".** `brandName` is the server-written mirror of
 *     `legalName` and is absent from `UpdateDealerInput`; two boxes able to
 *     disagree is the thing that removal prevents.
 *   · **City, district and state are typed, and editable** (D6, R2). They were
 *     a disabled box filled in from a five-row `cities` table.
 *   · **The Maps link is here** (R6) — the public portfolio's only source for
 *     "Get directions".
 *   · **The mobile is editable again** (R7). It was the login identity when
 *     dealers signed in with a number; identity is a Google account now, and
 *     what this field holds is the number a *buyer* is given.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function DealerProfileForm({ dealer }: { dealer: DealerProfile }) {
  const [state, formAction] = useActionState(saveDealerProfileAction, EMPTY);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      {state.status === 'saved' ? <Banner tone="ok">Your profile has been saved.</Banner> : null}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Dealership</h2>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Field
            id="legalName"
            label="Dealership name"
            hint="as buyers see it"
            error={errors.legalName}
          >
            <Input
              id="legalName"
              name="legalName"
              defaultValue={dealer.legalName}
              required
              aria-required="true"
              {...invalidProps('legalName', errors.legalName)}
            />
          </Field>

          <Field id="establishedYear" label="Established" error={errors.establishedYear}>
            <Input
              id="establishedYear"
              name="establishedYear"
              type="number"
              min={1900}
              max={2100}
              className="tnum"
              defaultValue={dealer.establishedYear ?? ''}
              {...invalidProps('establishedYear', errors.establishedYear)}
            />
          </Field>
        </div>

        {/*
          The one line the public pages run under the dealership's name — on the
          portfolio header (R25) and, clamped to two lines, on the directory
          card.

          Required here as it is in onboarding (**R26**), with the same
          ten-character floor: a dealer must not be able to delete on the
          profile screen what the sign-up form would not let them skip. It
          replaces the `About the dealership` textarea that used to sit under
          it — nothing public renders that paragraph any more, so a box asking
          for it would be collecting writing to store.
        */}
        <Field
          id="tagline"
          label="One line about your dealership"
          hint="shown under your name on your public page"
          error={errors.tagline}
        >
          <Input
            id="tagline"
            name="tagline"
            minLength={10}
            maxLength={200}
            defaultValue={dealer.tagline ?? ''}
            placeholder="Family-run since 1998 — hatchbacks under ₹6 lakh, every one inspected in-house."
            required
            aria-required="true"
            {...invalidProps('tagline', errors.tagline)}
          />
        </Field>

        {/*
          Required too (**R26**), and for the reason the tagline is: the first
          three are on the directory card and all of them are on the portfolio,
          which makes this the only structured thing a buyer can compare two
          dealerships by.
        */}
        <Field
          id="specialities"
          label="Services you offer"
          hint="comma separated, up to 12 — repeats are merged"
          error={errors.specialities}
        >
          <Input
            id="specialities"
            name="specialities"
            defaultValue={dealer.specialities.join(', ')}
            placeholder="In-house workshop, RC transfer assistance, Bank loan tie-ups"
            required
            aria-required="true"
            {...invalidProps('specialities', errors.specialities)}
          />
        </Field>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Contact</h2>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Field id="contactFullName" label="Contact name" error={errors.contactFullName}>
            <Input
              id="contactFullName"
              name="contactFullName"
              defaultValue={dealer.contact.fullName ?? ''}
              {...invalidProps('contactFullName', errors.contactFullName)}
            />
          </Field>

          <Field id="contactRoleTitle" label="Role" error={errors.contactRoleTitle}>
            <Input
              id="contactRoleTitle"
              name="contactRoleTitle"
              defaultValue={dealer.contact.roleTitle ?? ''}
              {...invalidProps('contactRoleTitle', errors.contactRoleTitle)}
            />
          </Field>

          <Field id="contactEmail" label="Email" error={errors.contactEmail}>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={dealer.contact.email ?? ''}
              {...invalidProps('contactEmail', errors.contactEmail)}
            />
          </Field>

          {/*
            R7 — editable, and raw rather than formatted, because
            `+91 98400 12345` is what a dealer reads and `9840012345` is what
            the field accepts back. It stays unique across users, so swapping to
            a number that belongs to someone else is refused by the API and
            lands on this box.
          */}
          <Field
            id="contactPhone"
            label="Mobile"
            hint="the number buyers are given"
            error={errors.contactPhone}
          >
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              className="tnum"
              defaultValue={dealer.contact.phone}
              {...invalidProps('contactPhone', errors.contactPhone)}
            />
          </Field>

          <Field
            id="contactLandline"
            label="Landline"
            hint="optional"
            error={errors.contactLandline}
          >
            <Input
              id="contactLandline"
              name="contactLandline"
              className="tnum"
              defaultValue={dealer.contact.landline ?? ''}
              {...invalidProps('contactLandline', errors.contactLandline)}
            />
          </Field>
        </div>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Address</h2>

        <Field id="addressLine" label="Street address" error={errors.addressLine}>
          <Input
            id="addressLine"
            name="addressLine"
            autoComplete="street-address"
            defaultValue={dealer.address.line ?? ''}
            {...invalidProps('addressLine', errors.addressLine)}
          />
        </Field>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          {/*
            City, district and state are three text boxes rather than a dropdown
            and two disabled mirrors of it (D6, R2). The server normalises case
            and spacing on write, so one town does not become three facet
            values — and the name-within-a-city uniqueness check is what the
            city is really load-bearing for, which is why a refusal here names
            this box.
          */}
          <Field id="addressCity" label="City" error={errors.addressCity}>
            <Input
              id="addressCity"
              name="addressCity"
              autoComplete="address-level2"
              placeholder="Vellore"
              defaultValue={dealer.address.city ?? ''}
              {...invalidProps('addressCity', errors.addressCity)}
            />
          </Field>

          <Field id="addressDistrict" label="District" error={errors.addressDistrict}>
            <Input
              id="addressDistrict"
              name="addressDistrict"
              placeholder="Vellore"
              defaultValue={dealer.address.district ?? ''}
              {...invalidProps('addressDistrict', errors.addressDistrict)}
            />
          </Field>

          <Field id="addressState" label="State" error={errors.addressState}>
            <Input
              id="addressState"
              name="addressState"
              autoComplete="address-level1"
              placeholder="Tamil Nadu"
              defaultValue={dealer.address.state ?? ''}
              {...invalidProps('addressState', errors.addressState)}
            />
          </Field>

          <Field id="addressPincode" label="Pincode" error={errors.addressPincode}>
            <Input
              id="addressPincode"
              name="addressPincode"
              className="tnum"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              defaultValue={dealer.address.pincode ?? ''}
              {...invalidProps('addressPincode', errors.addressPincode)}
            />
          </Field>
        </div>

        {/*
          R6 — the pin, not the address. A typed street address is several
          different gates in one district, and the buyer who follows the wrong
          one has already driven there. Nullable on rows that predate the
          question, which is why the portfolio branches rather than composing a
          Maps URL out of the address.
        */}
        <Field
          id="addressMapsUrl"
          label="Google Maps location"
          hint="buyers use this for directions"
          error={errors.addressMapsUrl}
        >
          {/*
            `text`, not `url`, and that is deliberate. The Share panel's other
            half — Embed — copies a whole `<iframe …>` element to the clipboard,
            and the server now accepts one and keeps the link out of it (R13).
            `type="url"` would have the browser refuse that paste before the
            form is ever submitted, with a message no dealer can act on.
            `inputMode` still asks a phone for the URL keyboard.
          */}
          <Input
            id="addressMapsUrl"
            name="addressMapsUrl"
            type="text"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            defaultValue={dealer.address.mapsUrl ?? ''}
            {...invalidProps('addressMapsUrl', errors.addressMapsUrl)}
          />
          <p className="mt-[4px] text-[11px] ink-subtle">
            Open your yard in Google Maps, tap <strong className="font-medium">Share</strong>, then{' '}
            <strong className="font-medium">Copy link</strong> and paste it here. The{' '}
            <strong className="font-medium">Embed a map</strong> code works too.
          </p>
          <MapKindNote mapsUrl={dealer.address.mapsUrl} kind={dealer.address.mapKind} />
        </Field>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Tax identifiers</h2>
        <p className="text-[12px] ink-subtle">
          Verified during onboarding. Contact support to change either — a silent edit would
          invalidate the verification your buyers rely on.
        </p>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Field id="gstin" label="GSTIN">
            <Input id="gstin" className="font-mono" defaultValue={dealer.gstin ?? ''} disabled />
          </Field>
          <Field id="pan" label="PAN">
            <Input id="pan" className="font-mono" defaultValue={dealer.pan ?? ''} disabled />
          </Field>
        </div>
      </section>

      <SaveRow />
    </form>
  );
}

function SaveRow() {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-3">
      <Button type="submit" variant="primary" size="md" loading={pending} className="min-w-[160px]">
        Save changes
      </Button>
      <span className="text-[12px] ink-subtle">
        Changes appear on your public dealership page immediately.
      </span>
    </div>
  );
}

/**
 * What the saved link is actually drawing, in words (**R20**).
 *
 * A dealer pastes a URL into a box and never sees the map it produces — the
 * map is on their public page, and the difference between the two kinds of
 * link is invisible in the box. So the difference is said out loud here:
 *
 *   `PLACE`  the frame is their Google listing — name, address, rating
 *   `POINT`  a correctly-placed pin that names nothing, and the fix
 *   `NONE`   a link we could not read a position out of at all
 *
 * The `POINT` case is the one this exists for, and it is not rare: the Share
 * sheet on a phone hands out a short link, and whether that link resolves to a
 * *place* depends on whether the dealer opened their business's own card before
 * sharing or dropped a pin on their street. Both look identical afterwards.
 *
 * `NONE` with no link at all says nothing: the instructions above are the whole
 * message for a dealer who has not answered yet, and a second line telling them
 * an empty box is empty would be noise.
 *
 * `mapKind` is composed by the API from the same function that builds the embed
 * URL, so this cannot claim a listing over a page drawing a dot.
 */
function MapKindNote({ mapsUrl, kind }: { mapsUrl: string | null; kind: MapKind }) {
  if (!mapsUrl) return null;

  if (kind === 'PLACE') {
    return (
      <p className="mt-[6px] text-[11px] text-(--color-ok)">
        This link names your dealership, so your public page shows your Google listing on the map —
        your name, your address and your rating.
      </p>
    );
  }

  if (kind === 'POINT') {
    return (
      <p className="mt-[6px] text-[11px] text-(--color-warn)">
        This link marks the right spot but does not name your dealership, so buyers see a plain pin.
        To show your listing — with your name and rating — search Google Maps for your business,
        open its card, then <strong className="font-medium">Share</strong> →{' '}
        <strong className="font-medium">Copy link</strong>.
      </p>
    );
  }

  return (
    <p className="mt-[6px] text-[11px] text-(--color-warn)">
      We could not read a location out of this link, so your public page shows no map. “Get
      directions” still works. Sharing your business from Google Maps again usually fixes it.
    </p>
  );
}
