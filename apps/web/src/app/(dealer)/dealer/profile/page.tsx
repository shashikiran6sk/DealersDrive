import { canDealer, type CompletenessResponse, type DealerProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { TEAM_NAV_ITEM } from '@/components/dealer/console-nav';
import { ButtonLink } from '@/components/ui/button';
import { StatusTag } from '@/components/ui/primitives';
import { DealerProfileForm } from '@/features/dealer/profile-form';
import { apiGet } from '@/lib/api';
import { currentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dealer profile' };

export default async function DealerProfilePage() {
  const [dealer, completeness, session] = await Promise.all([
    apiGet<DealerProfile>('/v1/dealer', { revalidate: false }),
    apiGet<CompletenessResponse>('/v1/dealer/completeness', { revalidate: false }),
    currentSession(),
  ]);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-[18px] px-4 py-[22px] md:px-8 md:py-[30px]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">Dealer profile</h1>
        <StatusTag tone={dealer.status === 'ACTIVE' ? 'ok' : 'warn'}>
          {dealer.statusLabel}
        </StatusTag>
        {canDealer(session?.permissions, 'member:manage') ? (
          <ButtonLink href={TEAM_NAV_ITEM.href} variant="secondary" className="ml-auto md:hidden">
            {TEAM_NAV_ITEM.label}
          </ButtonLink>
        ) : null}
      </div>

      <div className="card gap-2 p-[14px]">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow">Profile completeness</span>
          <span className="ml-auto text-[13px] font-semibold tnum">{completeness.percent}%</span>
        </div>
        <div className="h-1 bg-(--color-neutral-300)">
          <div
            className="h-full bg-(--color-accent)"
            style={{ width: `${completeness.percent}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {completeness.steps.map((step) => (
            <span key={step.key} className={step.complete ? 'ink-muted' : 'text-(--color-warn)'}>
              {step.complete ? '✓' : '•'} {step.label}
              {step.missing.length > 0 ? ` — ${step.missing.join(', ')}` : ''}
            </span>
          ))}
        </div>
        {outstandingNeedsSupport(completeness) ? (
          <p className="text-[12px] ink-subtle">
            Some of what is outstanding is not editable here — it is part of what your verification
            checked. Contact support and we will put it right.
          </p>
        ) : null}
      </div>

      <DealerProfileForm dealer={dealer} />
    </div>
  );
}

const SELF_SERVICE = new Set(['tagline', 'specialities', 'establishedYear']);

function outstandingNeedsSupport(completeness: CompletenessResponse): boolean {
  return completeness.steps.some((step) => step.missing.some((field) => !SELF_SERVICE.has(field)));
}
