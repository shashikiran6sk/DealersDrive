import type { CompletenessResponse, DealerProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { StatusTag } from '@/components/ui/primitives';
import { DealerProfileForm } from '@/features/dealer/profile-form';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dealer profile' };

/**
 * C1/C2 — the dealership's own record, after onboarding is over.
 *
 * Both reads are `revalidate: false`: they carry the session cookie, and a
 * cached fetch that carries a session is how one dealer's console ends up in
 * another's browser (ARCHITECTURE §18).
 *
 * The completeness meter is the same one the onboarding wizard used, and it
 * stays on screen for the same reason it was there: a profile that drifts back
 * below the bar — a description emptied, a Maps link removed — should be
 * obvious on the screen that did the emptying, not discovered later.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The console shell this page hangs inside is **F047**; until it lands this
 * route renders under the root layout, with no dealer navigation around it. The
 * baseline's "View public page →" link is likewise held back — `/dealers/:slug`
 * arrives with **F086**, and a link to a 404 is worse than no link.
 * ────────────────────────────────────────────────────────────────────────────
 */
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
      </div>

      <DealerProfileForm dealer={dealer} />
    </div>
  );
}
