import type { CompletenessResponse, DealerProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';
import { DealerProfileForm } from '@/features/dealer/profile-form';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dealer profile' };

export default async function DealerProfilePage() {
  const [dealer, completeness] = await Promise.all([
    apiGet<DealerProfile>('/v1/dealer', { revalidate: false }),
    apiGet<CompletenessResponse>('/v1/dealer/completeness', { revalidate: false }),
  ]);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-[18px] p-[22px]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[26px]">Dealer profile</h1>
        <StatusTag tone={dealer.status === 'ACTIVE' ? 'ok' : 'warn'}>
          {dealer.statusLabel}
        </StatusTag>
        <Link
          href={`/dealers/${dealer.slug}`}
          className="btn btn-ghost ml-auto text-[12px]"
          target="_blank"
        >
          View public page →
        </Link>
      </div>

      {/* The completeness meter is the same one onboarding used; it stays
          visible so a profile that drifts back below the bar is obvious. */}
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
      </div>

      <DealerProfileForm dealer={dealer} />
    </div>
  );
}
