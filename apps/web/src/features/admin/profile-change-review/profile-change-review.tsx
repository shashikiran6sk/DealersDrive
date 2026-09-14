'use client';

import type { AdminProfileChange } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner, Tag } from '@/components/ui/primitives';
import { approveProfileChangeAction, rejectProfileChangeAction } from '@/features/admin/actions';
import type { ActionResult } from '@/types';

import { Comparison } from './comparison';
import {
  EMPTY_VALUE,
  MIN_REFUSAL_REASON,
  PROFILE_CHANGE_TEXT,
} from './profile-change-review.constants';
import { ReviewRow } from './review-row';

/**
 * D3b — the review card for a dealer's proposed tagline and service list
 * (**R34**).
 *
 * These two fields are the only free text a dealer writes that a buyer reads;
 * everything else on their profile screen has been read-only since R27. That
 * leaves exactly one route by which a phone number can reach a public page
 * without passing `POST /v1/vehicles/:id/reveal-contact` — the one endpoint
 * allowed to hand one out — and this card is where it gets caught. A moderator
 * is not asking "is this a nice tagline" but whether it contains a number, a
 * URL, a rival's name, or a claim the platform would be repeating.
 *
 * **Old beside new, always**, because the question is "is this *change*
 * acceptable" and the two differ whenever the edit is a small correction to a
 * line already approved. A reviewer holding the old value in their head is one
 * who approves a number appended to a sentence they half-remember.
 *
 * **The refusal needs a sentence**, which the dealer reads verbatim and is the
 * only account they get of why their line did not appear. Neither decision is
 * behind a confirm step: both are reversible in the way that matters, which is a
 * different category from `Reject dealership`.
 */
export function ProfileChangeReview({ change }: { change: AdminProfileChange }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [refusing, setRefusing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function decide(work: () => Promise<ActionResult>): void {
    setMessage(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setMessage(result.message ?? PROFILE_CHANGE_TEXT.decisionFailed);
        return;
      }
      // The card disappears on the next render: `profileChange` is PENDING-only,
      // so a decided edit is simply no longer there.
      router.refresh();
    });
  }

  return (
    <section className="card gap-3 border-(--color-warn) p-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[19px]">{PROFILE_CHANGE_TEXT.heading}</h2>
        <span className="text-[12px] ink-muted">
          {PROFILE_CHANGE_TEXT.waiting(change.waitingLabel)}
        </span>
      </div>

      <p className="text-[12px] ink-secondary">{PROFILE_CHANGE_TEXT.intro}</p>

      {message ? <Banner tone="err">{message}</Banner> : null}

      <dl className="flex flex-col gap-3">
        <ReviewRow label={PROFILE_CHANGE_TEXT.taglineLabel}>
          <Comparison
            live={change.liveTagline ?? EMPTY_VALUE}
            proposed={change.tagline}
            render={(value) => <span className="text-[13px]">{value}</span>}
          />
        </ReviewRow>
        <ReviewRow label={PROFILE_CHANGE_TEXT.servicesLabel}>
          <Comparison
            live={change.liveSpecialities}
            proposed={change.specialities.length > 0 ? change.specialities : null}
            render={(value) =>
              Array.isArray(value) && value.length > 0 ? (
                <span className="flex flex-wrap gap-[6px]">
                  {value.map((service) => (
                    <Tag key={service} variant="neutral" className="text-[11px]">
                      {service}
                    </Tag>
                  ))}
                </span>
              ) : (
                <span className="text-[13px]">{EMPTY_VALUE}</span>
              )
            }
          />
        </ReviewRow>
      </dl>

      {refusing ? (
        <div className="flex flex-col gap-2">
          <Field
            id="profile-change-reason"
            label={PROFILE_CHANGE_TEXT.reasonLabel}
            hint={PROFILE_CHANGE_TEXT.reasonHint}
          >
            <Input
              id="profile-change-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={PROFILE_CHANGE_TEXT.reasonPlaceholder}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              disabled={reason.trim().length < MIN_REFUSAL_REASON}
              onClick={() => decide(() => rejectProfileChangeAction(change.id, { reason }))}
            >
              {PROFILE_CHANGE_TEXT.refuse}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setRefusing(false)}>
              {PROFILE_CHANGE_TEXT.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() => decide(() => approveProfileChangeAction(change.id))}
          >
            {PROFILE_CHANGE_TEXT.publish}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setRefusing(true)}
          >
            {PROFILE_CHANGE_TEXT.refuseOpen}
          </Button>
        </div>
      )}
    </section>
  );
}
