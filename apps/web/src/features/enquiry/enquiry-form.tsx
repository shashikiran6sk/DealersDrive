'use client';

import type { EnquirySource } from '@dealers-drive/contracts';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { submitEnquiryAction } from '@/features/enquiry/actions';
import { EMPTY_ENQUIRY_STATE } from '@/features/enquiry/shared';

/**
 * ARCHITECTURE §14.2 — inline on the VDP and on the dealer portfolio, **never
 * a modal**: modals lose leads. No account, no sign-in gate (§4.10).
 *
 * A real `<form>` posting to a Server Action, so it works with JavaScript off;
 * with JavaScript on, `useActionState` keeps the typed values and paints the
 * per-field messages the API returned.
 */
export function EnquiryForm({
  id,
  source,
  vehicleId,
  dealerSlug,
  dealerBrandName,
  heading = 'Enquire about this car',
  intro,
  messagePlaceholder = 'Is the price negotiable? Can I see it on Saturday morning?',
}: {
  id: string;
  source: EnquirySource;
  /** Exactly one of these two — the schema refines on it (API-SPEC A15). */
  vehicleId?: string;
  dealerSlug?: string;
  dealerBrandName: string;
  heading?: string;
  intro?: string;
  messagePlaceholder?: string;
}) {
  const [state, formAction] = useActionState(submitEnquiryAction, EMPTY_ENQUIRY_STATE);
  const errors = state.fieldErrors;

  return (
    <section id={id} className="card mt-[30px] gap-[14px] p-[18px]">
      <div>
        <h3 className="text-[21px]">{heading}</h3>
        <p className="mt-[5px] text-[13px] ink-muted">
          {intro ??
            `Your details go straight to ${dealerBrandName}. Dealers-Drive never calls you and never sells your number.`}
        </p>
      </div>

      {state.message ? <Banner tone="err">{state.message}</Banner> : null}

      {/* No `noValidate`: the browser's own required/type/pattern checks are
          the client-validation half of §15.4, and they work with JS off too. */}
      <form action={formAction} className="flex flex-col gap-[14px]">
        {vehicleId ? <input type="hidden" name="vehicleId" value={vehicleId} /> : null}
        {dealerSlug ? <input type="hidden" name="dealerSlug" value={dealerSlug} /> : null}
        <input type="hidden" name="source" value={source} />

        {/* Honeypot. Off-screen rather than `display:none`, which some bots
            detect; a non-empty value gets a normal 201 and writes nothing. */}
        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="grid gap-[14px] sm:grid-cols-2">
          <Field id={`${id}-name`} label="Your name" error={errors.name}>
            <input
              id={`${id}-name`}
              name="name"
              className="input"
              autoComplete="name"
              required
              placeholder="Karthik Raja"
              {...invalidProps(`${id}-name`, errors.name)}
            />
          </Field>

          <Field id={`${id}-phone`} label="Mobile number" error={errors.phone}>
            {/* §2.3 — 62px +91 prefix box, then the number field. The
                placeholder is deliberately not a number in the database: a
                placeholder is page source, and page source is what a scraper
                greps. */}
            <div className="flex gap-2">
              <span className="input grid w-[62px] flex-none place-items-center tnum">+91</span>
              <input
                id={`${id}-phone`}
                name="phone"
                type="tel"
                inputMode="numeric"
                className="input tnum"
                autoComplete="tel-national"
                required
                pattern="[6-9][0-9]{9}"
                title="A 10-digit Indian mobile number, starting 6–9."
                placeholder="9876543210"
                {...invalidProps(`${id}-phone`, errors.phone)}
              />
            </div>
          </Field>
        </div>

        <Field id={`${id}-email`} label="Email (optional)" error={errors.email}>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            className="input"
            autoComplete="email"
            placeholder="karthik.raja@example.com"
            {...invalidProps(`${id}-email`, errors.email)}
          />
        </Field>

        <Field id={`${id}-message`} label="Message (optional)" error={errors.message}>
          <textarea
            id={`${id}-message`}
            name="message"
            className="input"
            rows={3}
            maxLength={1000}
            placeholder={messagePlaceholder}
            {...invalidProps(`${id}-message`, errors.message)}
          />
        </Field>

        <SubmitRow dealerBrandName={dealerBrandName} />
      </form>
    </section>
  );
}

/** Split out so `useFormStatus` reads the enclosing form, not a parent render. */
function SubmitRow({ dealerBrandName }: { dealerBrandName: string }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="primary" size="lg" loading={pending} className="min-w-[190px]">
        Send enquiry
      </Button>
      <span className="text-[12px] ink-subtle">
        {dealerBrandName} typically replies the same day.
      </span>
    </div>
  );
}
