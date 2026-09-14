'use client';

import type { AdminProfileChange } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner, Tag } from '@/components/ui/primitives';
import { approveProfileChangeAction, rejectProfileChangeAction } from '@/features/admin/actions';

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
