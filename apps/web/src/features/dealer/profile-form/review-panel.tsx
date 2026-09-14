'use client';

import type { DealerProfileChange } from '@dealers-drive/contracts';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, Tag } from '@/components/ui/primitives';
import { withdrawProfileChangeAction } from '@/features/dealer/profile-actions';

import { PROFILE_FORM_TEXT } from './profile-form.constants';

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
