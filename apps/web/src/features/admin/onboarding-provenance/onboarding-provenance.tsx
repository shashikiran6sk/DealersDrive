import type { DealerOnboardingProvenance } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';

import { PROVENANCE_TEXT } from './onboarding-provenance.constants';

export function OnboardingProvenance({ onboarding }: { onboarding: DealerOnboardingProvenance }) {
  const assisted = onboarding.source === 'ASSISTED';
  return (
    <section className="card gap-2 p-4" aria-labelledby="onboarding-provenance-heading">
      <h2 id="onboarding-provenance-heading" className="text-[19px]">
        {PROVENANCE_TEXT.heading}
      </h2>
      {onboarding.reviewerIsAssistant ? (
        <p className="text-[13px] text-(--color-warn)">{PROVENANCE_TEXT.selfReview}</p>
      ) : null}
      <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-[13px]">
        <dt className="ink-muted">{PROVENANCE_TEXT.source}</dt>
        <dd>
          <StatusTag tone={assisted ? 'accent' : 'neutral'}>{onboarding.sourceLabel}</StatusTag>
        </dd>
        {onboarding.assistedBy ? (
          <>
            <dt className="ink-muted">{PROVENANCE_TEXT.assistedBy}</dt>
            <dd className="break-all">
              {onboarding.assistedBy.name ? `${onboarding.assistedBy.name} · ` : ''}
              {onboarding.assistedBy.email}
            </dd>
          </>
        ) : null}
        <dt className="ink-muted">{PROVENANCE_TEXT.phone}</dt>
        <dd>
          <StatusTag tone={onboarding.phoneVerified ? 'ok' : 'err'}>
            {onboarding.phoneLabel}
          </StatusTag>
        </dd>
        <dt className="ink-muted">{PROVENANCE_TEXT.email}</dt>
        <dd>
          <StatusTag tone={onboarding.emailVerified ? 'ok' : 'warn'}>
            {onboarding.emailLabel}
          </StatusTag>
        </dd>
        {assisted ? (
          <>
            <dt className="ink-muted">{PROVENANCE_TEXT.owner}</dt>
            <dd>{onboarding.claimed ? PROVENANCE_TEXT.claimed : PROVENANCE_TEXT.unclaimed}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
