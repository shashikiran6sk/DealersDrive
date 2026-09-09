'use client';

import type { DealerProfile, MapKind } from '@dealers-drive/contracts';
import { useActionState, type ReactNode } from 'react';
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
 * ## Three boxes, and a page of read-only facts (**R27**)
 *
 * The dealer may change **when they started trading, the line they describe
 * themselves in, and what their yard does**. Everything else on this screen is
 * rendered `disabled` and carries no `name`, so the browser sends nothing for
 * it — and `DealerSelfUpdateInput` would refuse it if it did. Two defences for
 * one rule, deliberately: the form is why a dealer never sends a locked field,
 * and `.strict()` is why it would not be written if they did.
 *
 * The split is between *preferences* and *evidence*. The three editable
 * answers are opinions a dealership is entitled to revise and that nothing
 * rests on. The locked ones are what the platform checked:
 *
 *   · the **registered name** is what KYC was run against, and what the slug
 *     and public URL are derived from;
 *   · the **address, town, pin and map link** are what the yard photograph,
 *     the address proof and the verification were *about*;
 *   · the **mobile and email** are how a buyer reaches a business that has
 *     been vouched for;
 *   · **GSTIN and PAN** were read off a document, and have been read-only here
 *     since this screen was built.
 *
 * A dealership that has genuinely moved does not edit its way to the new
 * address: it closes this account and opens another, and the new premises are
 * verified the way the first were. That is a heavier answer than an edit box
 * and it is the correct one — the VERIFIED plate is a claim about a place, and
 * there is no honest way to carry it across a move.
 *
 * ── What R27 reversed ───────────────────────────────────────────────────────
 * Three earlier decisions made these boxes editable, and each was right about
 * its own question and wrong about this one:
 *   · **R2/D6** made city, district and state typed rather than a dropdown off
 *     a five-row table. Still true — an admin types them. Not the dealer.
 *   · **R6** put the Maps link on this screen as the portfolio's only source
 *     for "Get directions". Still the only source; still not editable here.
 *   · **R7** made the mobile editable, on the reasoning that it had stopped
 *     being a login credential. Right about identity, wrong about the field: it
 *     is the number printed on a verified dealership's public page.
 *
 * **No "Trading name"** remains true for its own reason: `brandName` is the
 * server-written mirror of `legalName`, and two boxes able to disagree is what
 * its absence prevents.
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
          {/*
            R27 — read-only. The registered name is what KYC was checked
            against and what the public slug and URL are derived from, so it is
            not a preference a dealer revises after verification.
          */}
          <LockedField id="legalName" label="Dealership name" value={dealer.legalName} />

          {/* Still theirs: a fact about the business that no verification
              rests on, and one that never becomes a different dealership. */}
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
        <LockedNote>
          These are how buyers and we reach a business that has been verified. Contact support to
          change any of them.
        </LockedNote>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <LockedField id="contactFullName" label="Contact name" value={dealer.contact.fullName} />
          <LockedField id="contactRoleTitle" label="Role" value={dealer.contact.roleTitle} />
          <LockedField id="contactEmail" label="Email" value={dealer.contact.email} />
          {/*
            R27 reverses R7. The number stopped being a credential when dealers
            moved to Google sign-in, and R7 made it editable again on that
            reasoning — which was right about identity and wrong about what the
            field is for. It is the number printed on a verified dealership's
            public page, and a self-service edit re-points every listing at a
            phone nobody checked.
          */}
          <LockedField id="contactPhone" label="Mobile" value={dealer.contact.phoneDisplay} mono />
          <LockedField id="contactLandline" label="Landline" value={dealer.contact.landline} mono />
        </div>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Address</h2>
        {/*
          R27, and the heaviest of the three locks.

          The yard photograph, the address proof and the verification visit were
          all about *this* place. A dealership that edits its way to another one
          is not correcting a record — it is a different business wearing a
          plate that was granted to the first. There is no in-place answer to
          that, so there is no edit box and no request queue either: a
          dealership that has moved closes this account and opens another,
          and the new address is verified the way the first one was.
        */}
        <LockedNote>
          Your address and map pin are what your verification was about — the yard photograph, the
          address proof and the check we ran on them. They cannot be edited here. A dealership that
          has actually moved closes this account and opens a new one, so the new premises are
          verified the way these were. Contact support to start that.
        </LockedNote>

        <LockedField id="addressLine" label="Street address" value={dealer.address.line} />

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <LockedField id="addressCity" label="City" value={dealer.address.city} />
          <LockedField id="addressDistrict" label="District" value={dealer.address.district} />
          <LockedField id="addressState" label="State" value={dealer.address.state} />
          <LockedField id="addressPincode" label="Pincode" value={dealer.address.pincode} mono />
        </div>

        <LockedField
          id="addressMapsUrl"
          label="Google Maps location"
          value={dealer.address.mapsUrl}
        >
          <MapKindNote mapsUrl={dealer.address.mapsUrl} kind={dealer.address.mapKind} />
        </LockedField>
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

/**
 * A fact about the dealership, in the shape of the field it used to be
 * (**R27**).
 *
 * `disabled` and **without a `name`**, which is the load-bearing half: a
 * disabled control is not submitted, and one with no name has nothing to be
 * submitted under. So a locked value cannot reach `saveDealerProfileAction`
 * even by accident, and the action does not have to filter it out — it builds
 * its payload from three keys rather than reading the form.
 *
 * A box rather than a `<dl>` row, because that is what this page has always
 * done with GSTIN and PAN and the eye reads the column as one thing. `—` for a
 * value the dealership never gave: an empty control under a label reads as a
 * box you have not filled in yet, which is the opposite of what is true here.
 *
 * `children` is for the one field that has something to say about itself —
 * the Maps link, and what kind of map it draws.
 */
function LockedField({
  id,
  label,
  value,
  mono,
  children,
}: {
  id: string;
  label: string;
  value: string | null;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <Field id={id} label={label}>
      <Input
        id={id}
        className={mono ? 'font-mono' : undefined}
        defaultValue={value ?? '—'}
        disabled
      />
      {children}
    </Field>
  );
}

/**
 * Why a section is read-only, said once at the top of it rather than on every
 * box in it.
 *
 * A control a person cannot use and is not told why about is the worst of the
 * three states this screen can be in — worse than an editable box and worse
 * than no box at all, because the dealer's conclusion is that the page is
 * broken. The same 12px `ink-subtle` note the Tax identifiers section has
 * carried since this screen was built.
 */
function LockedNote({ children }: { children: ReactNode }) {
  return <p className="text-[12px] ink-subtle">{children}</p>;
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
 * `NONE` with no link at all says nothing: there is nothing to diagnose, and a
 * line telling a dealer that an empty box is empty would be noise.
 *
 * **R27 changed what these say to do.** The link is read-only now, so "share
 * your business from Google Maps again" is advice a dealer cannot act on. The
 * diagnosis is worth as much as it ever was — it explains a public page that
 * shows a bare pin — so it stays, and the remedy is support.
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
        This link marks the right spot but does not name your dealership, so buyers see a plain pin
        rather than your Google listing. Contact support if you would like it changed to your
        business card.
      </p>
    );
  }

  return (
    <p className="mt-[6px] text-[11px] text-(--color-warn)">
      We could not read a location out of this link, so your public page shows no map. “Get
      directions” still works. Contact support and we will re-point it.
    </p>
  );
}
