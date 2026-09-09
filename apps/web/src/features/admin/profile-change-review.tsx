'use client';

import type { AdminProfileChange } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner, Tag } from '@/components/ui/primitives';
import { approveProfileChangeAction, rejectProfileChangeAction } from '@/features/admin/actions';

/**
 * D3b — the review card for a dealer's proposed tagline and service list
 * (**R34**).
 *
 * ## What it is guarding
 *
 * These two fields are the only free text a dealer writes that a buyer reads.
 * Everything else on their profile screen has been read-only since R27, and
 * these were left editable because a dealership is entitled to revise how it
 * describes itself. That leaves exactly one route by which a phone number can
 * reach a public page without passing `POST /v1/vehicles/:id/reveal-contact` —
 * the one endpoint allowed to hand one out, rate-limited twice over and logged
 * as a lead. This card is where that gets caught.
 *
 * A moderator reading it is not asking "is this a nice tagline". They are
 * asking whether it contains a number, a URL, a rival's name, or a claim the
 * platform would be repeating on the dealership's behalf.
 *
 * ## Old beside new, always
 *
 * The live value is rendered next to the proposed one because the question is
 * *"is this change acceptable"* rather than *"is this sentence acceptable"*, and
 * the two differ whenever the edit is a small correction to a line that was
 * already approved. A card showing only the proposal makes the reviewer hold the
 * old value in their head, and a reviewer holding a value in their head is one
 * who approves a number appended to a sentence they half-remember.
 *
 * A field the request does not touch says so rather than rendering blank — an
 * empty row under "Services" reads as *they are clearing their services*, which
 * is the opposite of what `[]` means here.
 *
 * ## The refusal needs a sentence, and the button says so
 *
 * `Refuse` is disabled until there is a reason of substance behind it, the way
 * suspension is. The dealer reads that sentence verbatim on their own profile
 * screen and it is the only account they will get of why their line did not
 * appear — "rejected" with nothing attached is how a dealer concludes the
 * product is broken and submits the same text again.
 *
 * Neither decision is behind a confirm step. Both are reversible in the way that
 * matters: a refused edit can be resubmitted by the dealer in a minute, and a
 * wrongly published one can be edited back. That is a different category from
 * `Reject dealership`, which destroys an application, and it should not be
 * dressed up as though it were the same.
 */
export function ProfileChangeReview({ change }: { change: AdminProfileChange }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [refusing, setRefusing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function decide(work: () => Promise<{ ok: boolean; message?: string }>): void {
    setMessage(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setMessage(result.message ?? 'That decision did not go through.');
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
        <h2 className="text-[19px]">Proposed change to their public page</h2>
        <span className="text-[12px] ink-muted">waiting {change.waitingLabel}</span>
      </div>

      <p className="text-[12px] ink-secondary">
        The dealer edited how their dealership describes itself. Buyers are still seeing the current
        version. Check it for phone numbers, links and anything the platform would not want to be
        repeating on their behalf.
      </p>

      {message ? <Banner tone="err">{message}</Banner> : null}

      <dl className="flex flex-col gap-3">
        <Row label="Tagline">
          <Comparison
            live={change.liveTagline ?? '—'}
            proposed={change.tagline}
            render={(value) => <span className="text-[13px]">{value}</span>}
          />
        </Row>
        <Row label="Services">
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
                <span className="text-[13px]">—</span>
              )
            }
          />
        </Row>
      </dl>

      {refusing ? (
        <div className="flex flex-col gap-2">
          <Field
            id="profile-change-reason"
            label="What should they change?"
            hint="the dealer reads this word for word"
          >
            <Input
              id="profile-change-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="The tagline ends with a mobile number — buyers reach you through the contact button, which logs the lead for you."
            />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              disabled={reason.trim().length < 6}
              onClick={() => decide(() => rejectProfileChangeAction(change.id, { reason }))}
            >
              Refuse this change
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setRefusing(false)}>
              Cancel
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
            Publish it
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setRefusing(true)}
          >
            Refuse…
          </Button>
        </div>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-(--color-divider) pb-3 last:border-b-0 last:pb-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-[6px]">{children}</dd>
    </div>
  );
}

/**
 * Now, and what it would become.
 *
 * `proposed === null` is the case worth the branch: it means *this request does
 * not touch this field*, and it has to read as **unchanged** rather than as
 * cleared. Rendering an empty row would tell the moderator the dealer wants
 * their services removed, and approving that reading would be approving
 * something nobody asked for.
 */
function Comparison<T>({
  live,
  proposed,
  render,
}: {
  live: T;
  proposed: T | null;
  render: (value: T) => React.ReactNode;
}) {
  if (proposed === null) {
    return (
      <div className="flex items-baseline gap-2">
        {render(live)}
        <span className="text-[11px] ink-faint">unchanged</span>
      </div>
    );
  }

  return (
    <div className="grid gap-[10px] sm:grid-cols-2">
      <div>
        <div className="mb-[4px] text-[11px] ink-muted">Live now</div>
        <div className="ink-muted line-through decoration-1">{render(live)}</div>
      </div>
      <div>
        <div className="mb-[4px] text-[11px] font-semibold text-(--color-accent)">Proposed</div>
        <div className="font-medium">{render(proposed)}</div>
      </div>
    </div>
  );
}
