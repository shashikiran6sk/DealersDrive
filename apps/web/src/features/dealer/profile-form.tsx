'use client';

import {
  DealerSelfUpdateInput,
  type DealerProfile,
  type DealerProfileChange,
  type MapKind,
} from '@dealers-drive/contracts';
import { useActionState, useState, useTransition, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner, Tag } from '@/components/ui/primitives';
import { ServiceInput } from '@/components/ui/service-input';
import {
  saveDealerProfileAction,
  withdrawProfileChangeAction,
  type ProfileFormState,
} from '@/features/dealer/profile-actions';

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
  const [yearError, setYearError] = useState<string>();
  const establishedYearError = yearError ?? errors.establishedYear;

  /*
   * While a change waits, the two boxes are **shut** and show the proposed text
   * (**R34**).
   *
   * The dealer has already said what they want; the question in front of them
   * is no longer "what should this say" but "do I stand by this". Leaving the
   * boxes live in that state offers an edit the API refuses with a 409, which
   * is the worst of the three options — worse than locking them, and worse than
   * silently merging, because the dealer types a sentence and is then told they
   * could not have.
   *
   * So the boxes hold the proposal, read-only, and the way to change it is the
   * `Cancel` in `ReviewPanel`: withdraw, and they unlock with the live values
   * back in them. Two states, both of them honest.
   *
   * A REJECTED change locks nothing and is *not* put back in the box. The
   * moderator's reason is above it and the point is to write something
   * different — restoring the refused text invites the dealer to press Save
   * again unchanged.
   */
  const waiting = dealer.profileChange?.status === 'PENDING' ? dealer.profileChange : null;
  const taglineValue = waiting?.tagline ?? dealer.tagline ?? '';
  const servicesValue =
    waiting && waiting.specialities.length > 0 ? waiting.specialities : dealer.specialities;

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      {/*
        R34 — what "saved" means now, and it is not "published".

        The two sentences on this form go to a moderator, so a bare "Your
        profile has been saved" would be read as "your page has changed" by a
        dealer who then looks at their page and finds it has not. The banner
        that follows a save says what actually happened; `ReviewPanel` below it
        says what is waiting and what is still live.
      */}
      {state.status === 'saved' ? (
        <Banner tone="ok">
          {dealer.profileChange?.status === 'PENDING'
            ? 'Saved. Your line and services go to us for a quick check before they appear on your public page — everything else is already live.'
            : 'Your profile has been saved.'}
        </Banner>
      ) : null}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}

      <ReviewPanel change={dealer.profileChange} />

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
          <Field id="establishedYear" label="Established" error={establishedYearError}>
            <Input
              id="establishedYear"
              name="establishedYear"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              className="tnum"
              defaultValue={dealer.establishedYear ?? ''}
              onChange={() => setYearError(undefined)}
              onInvalid={(event) => {
                event.preventDefault();
                const result = DealerSelfUpdateInput.safeParse({
                  establishedYear: event.currentTarget.valueAsNumber,
                });
                setYearError(result.error?.issues[0]?.message ?? 'Enter a valid year.');
              }}
              {...invalidProps('establishedYear', establishedYearError)}
            />
          </Field>
        </div>

        <Field
          id="tagline"
          label="One line about your dealership"
          hint={
            waiting
              ? 'waiting for review — cancel above to change it'
              : 'shown under your name on your public page — checked before it appears'
          }
          error={errors.tagline}
        >
          {/*
            `disabled` **and** no `name` while a change waits, which is the
            R27 shape and load-bearing for the same reason: a disabled control
            is not submitted, and one with no name has nothing to be submitted
            under. So a locked box cannot reach `saveDealerProfileAction` even
            by accident, and the action does not have to filter it out — a save
            in this state carries the established year and nothing else.
          */}
          <Input
            id="tagline"
            {...(waiting ? {} : { name: 'tagline' })}
            minLength={10}
            maxLength={200}
            defaultValue={taglineValue}
            placeholder="Family-run since 1998 — hatchbacks under ₹6 lakh, every one inspected in-house."
            required={!waiting}
            aria-required={waiting ? undefined : 'true'}
            disabled={Boolean(waiting)}
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
          hint={
            waiting
              ? 'waiting for review — cancel above to change them'
              : 'one at a time, up to 12 — checked before they appear'
          }
          error={errors.specialities}
        >
          <ServiceInput
            id="specialities"
            {...(waiting ? {} : { name: 'specialities' })}
            value={servicesValue}
            placeholder="In-house workshop"
            required={!waiting}
            disabled={Boolean(waiting)}
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
 * What is waiting for review, or why the last edit was refused (**R34**).
 *
 * ## Why this panel exists at all
 *
 * The dealer presses Save, the page reloads, and the tagline box shows the line
 * they typed — but their public page shows the old one, because the edit is
 * waiting. Without something on this screen saying so, the honest state of the
 * product is invisible, and a dealer who cannot see their change concludes the
 * save failed. Then they do it again. Then they email support.
 *
 * So the panel says three things in the order a dealer wants them: that the
 * edit was received, what it will look like, and what buyers are seeing in the
 * meantime.
 *
 * ## Both values, side by side
 *
 * The live value is rendered next to the proposed one rather than left to the
 * boxes below, because the boxes show what the dealer *typed* — the form
 * defaults to the proposal once one exists — and "what my page says right now"
 * would otherwise be the one thing this screen cannot tell them.
 *
 * ## A refusal is the only thing here a dealer must read
 *
 * `decisionReason` is a sentence a person wrote about this dealership, and it
 * is the only account they will ever get of why their line did not appear. It
 * is given the `err` banner and the reason is set apart from the surrounding
 * copy, for the reason `ChangesRequested` sets its note apart in onboarding: two
 * equal-looking paragraphs, only one of which is actionable, is how the
 * actionable one gets skimmed past.
 *
 * ## Cancel is the only control here, and it is the only way out
 *
 * The two boxes below are shut while this panel is showing, so this button is
 * how a dealer changes their mind: withdraw, and the boxes unlock with the live
 * values back in them.
 *
 * It is a plain button with no confirm step. Nothing is destroyed by it — what
 * buyers see never moved, and the dealer keeps every word they wrote in the box
 * in front of them until they replace it. A confirm dialog on an action that
 * loses nothing is how people learn to click through the ones that do.
 *
 * Nothing renders for an APPROVED change — the API sends `null` for one, since
 * its values are on the profile by then and a banner announcing that a line the
 * dealer can see is the line they asked for is only ever in the way.
 */
function ReviewPanel({ change }: { change: DealerProfileChange | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!change) return null;

  if (change.status === 'REJECTED') {
    return (
      <Banner tone="err" title="Your last change was not published">
        <p className="border-l-2 border-current pl-[10px] font-medium">{change.decisionReason}</p>
        <p className="mt-[8px]">
          Your public page is unchanged. Edit the boxes below and save again — there is nothing else
          you need to do.
        </p>
      </Banner>
    );
  }

  return (
    <Banner tone="warn" title="Waiting for a quick check">
      <p>
        You changed how your dealership describes itself on {change.submittedAtLabel}. We read these
        before they go on your public page — buyers see the current version until then.
      </p>
      <dl className="mt-[10px] flex flex-col gap-[8px] text-[12px]">
        {change.tagline ? (
          <div>
            <dt className="ink-muted">Your new line</dt>
            <dd className="mt-[2px] font-medium">“{change.tagline}”</dd>
          </div>
        ) : null}
        {change.specialities.length > 0 ? (
          <div>
            <dt className="ink-muted">Your new services</dt>
            <dd className="mt-[4px] flex flex-wrap gap-[6px]">
              {change.specialities.map((service) => (
                <Tag key={service} variant="neutral" className="text-[11px]">
                  {service}
                </Tag>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
      {error ? <p className="mt-[8px] text-[12px] font-medium">{error}</p> : null}

      <div className="mt-[10px] flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              setError(await withdrawProfileChangeAction());
            });
          }}
        >
          Cancel this change
        </Button>
        <span className="text-[12px]">
          Your previous wording comes back and the boxes below unlock.
        </span>
      </div>
    </Banner>
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
