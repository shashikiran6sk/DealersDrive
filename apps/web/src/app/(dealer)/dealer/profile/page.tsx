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
 * ## Who is allowed to be here
 *
 * Nothing on this page asks. The guard is on `(dealer)/dealer/layout.tsx`
 * (**R31**), which resolves a *dealership* and not merely a signed-in person,
 * and sends the two kinds of 401 visitor to two different screens — sign-in for
 * nobody signed in, onboarding for somebody signed in without a dealership.
 * It was written here at F046 with a note saying F047 should lift it once one
 * route stopped being the whole segment; it has been lifted, and the next
 * console page inherits it rather than remembering to repeat it.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline's "View public page →" link is still held back —
 * `/dealers/:slug` arrives with **F086**, and a link to a 404 is worse than no
 * link.
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
        {/*
          R27 — the meter still reports the truth, but the form below it can no
          longer act on most of it.

          The meter was put here so that a profile drifting back below the bar
          would be obvious on the screen that did the drifting. That reasoning
          survives for the three fields this screen still writes; for anything
          else it now points at a box the dealer cannot type in, and a warning
          with no action attached reads as a broken page. So when something
          outstanding is not theirs to fix, the line says who fixes it.
        */}
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

/**
 * The three fields the form below still writes (**R27**).
 *
 * Named here rather than imported from the form because they are the same
 * three for a different reason: this is about what the dealer can *act on*,
 * and the form is about what the dealer can *send*. They agree today, and if
 * one ever moves without the other the note is wrong rather than the save.
 */
const SELF_SERVICE = new Set(['tagline', 'specialities', 'establishedYear']);

function outstandingNeedsSupport(completeness: CompletenessResponse): boolean {
  return completeness.steps.some((step) => step.missing.some((field) => !SELF_SERVICE.has(field)));
}
