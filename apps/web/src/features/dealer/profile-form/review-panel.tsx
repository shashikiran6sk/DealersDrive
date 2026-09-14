'use client';

import type { DealerProfileChange } from '@dealers-drive/contracts';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, Tag } from '@/components/ui/primitives';
import { withdrawProfileChangeAction } from '@/features/dealer/profile-actions';

import { PROFILE_FORM_TEXT } from './profile-form.constants';

/**
 * What is waiting for review, or why the last edit was refused (**R34**).
 *
 * Without it the honest state of the product is invisible: the dealer presses
 * Save, the tagline box shows the line they typed, and their public page shows
 * the old one. A dealer who cannot see their change concludes the save failed,
 * does it again, then emails support. So the panel says three things in the
 * order a dealer wants them — the edit was received, what it will look like, and
 * what buyers are seeing meanwhile.
 *
 * **Both values, side by side**, because the boxes below show what the dealer
 * *typed*, and "what my page says right now" would otherwise be the one thing
 * this screen cannot tell them.
 *
 * **A refusal is the only thing here a dealer must read.** `decisionReason` is a
 * sentence a person wrote about this dealership, so it gets the `err` banner and
 * is set apart from the surrounding copy: two equal-looking paragraphs, only one
 * of which is actionable, is how the actionable one gets skimmed past.
 *
 * **Cancel is the only control, and the only way out**, since the boxes below are
 * shut while this is showing. A plain button with no confirm step: nothing is
 * destroyed by it, and a confirm dialog on an action that loses nothing is how
 * people learn to click through the ones that do.
 *
 * Nothing renders for an APPROVED change — the API sends `null` for one.
 */
export function ReviewPanel({ change }: { change: DealerProfileChange | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!change) return null;

  if (change.status === 'REJECTED') {
    return (
      <Banner tone="err" title={PROFILE_FORM_TEXT.rejectedTitle}>
        <p className="border-l-2 border-current pl-[10px] font-medium">{change.decisionReason}</p>
        <p className="mt-[8px]">{PROFILE_FORM_TEXT.rejectedNote}</p>
      </Banner>
    );
  }

  return (
    <Banner tone="warn" title={PROFILE_FORM_TEXT.waitingTitle}>
      <p>{PROFILE_FORM_TEXT.waitingIntro(change.submittedAtLabel)}</p>
      <dl className="mt-[10px] flex flex-col gap-[8px] text-[12px]">
        {change.tagline ? (
          <div>
            <dt className="ink-muted">{PROFILE_FORM_TEXT.newLine}</dt>
            <dd className="mt-[2px] font-medium">“{change.tagline}”</dd>
          </div>
        ) : null}
        {change.specialities.length > 0 ? (
          <div>
            <dt className="ink-muted">{PROFILE_FORM_TEXT.newServices}</dt>
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
          {PROFILE_FORM_TEXT.cancelChange}
        </Button>
        <span className="text-[12px]">{PROFILE_FORM_TEXT.cancelNote}</span>
      </div>
    </Banner>
  );
}
