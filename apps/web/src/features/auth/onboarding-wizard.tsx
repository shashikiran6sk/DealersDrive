'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Stepper } from '@/components/ui/primitives';

/**
 * DESIGN-SPEC §3.10 — Account → Business → Documents → Review.
 *
 * The split is not cosmetic. Steps 1 and 2 are one form: nothing is written
 * until "Continue" on the Business step, so a dealer who abandons halfway
 * leaves no half-made tenant behind. Steps 3 and 4 act on a dealership that
 * exists, and are reached by a real navigation so the server can re-read it.
 *
 * Which step you may be on is decided on the server from the session. This
 * component moves between them; it does not decide what you are allowed to see.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * **F037 is the frame only.** The four step bodies land with the features that
 * own them — Account **F038**, Business **F039**, Documents **F041**, Review
 * **F042** — and each brings the props it needs with it (`session`, `cities`,
 * `documents`, `dealer`, `completeness`; component-map C040).
 *
 * What is here is what the feature-map entry names: which step is current, how
 * a step is reached, and the progress indicator. That is a real boundary rather
 * than a convenient one — the movement between steps is decided in two places
 * at once, half on the server and half here, and getting that seam right is the
 * whole of this feature.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const ONBOARDING_STEPS = ['Account', 'Business', 'Documents', 'Review'] as const;

export type OnboardingStep = 0 | 1 | 2 | 3;

export function OnboardingWizard({ step }: { step: OnboardingStep }) {
  const router = useRouter();
  /**
   * Steps 1 and 2 move in the browser; steps 3 and 4 move by navigation.
   *
   * The asymmetry follows the write. Account and Business submit together, so
   * stepping between them must not touch the server — there is nothing to
   * re-read, and a round trip would cost the dealer everything they had typed.
   * Documents and Review each act on a dealership that already exists, so they
   * are reached by a URL the server resolves afresh.
   */
  const [local, setLocal] = useState<0 | 1>(step === 1 ? 1 : 0);

  const current = step >= 2 ? step : local;

  return (
    <div className="flex flex-col gap-[22px]">
      <Stepper steps={ONBOARDING_STEPS} current={current} />

      {current <= 1 ? (
        <div className="flex gap-[8px]">
          <button
            type="button"
            className="btn btn-secondary h-[42px] px-[18px]"
            onClick={() => {
              if (local === 1) setLocal(0);
              else router.push('/dealer/login');
            }}
          >
            Back
          </button>

          {/**
           * Continue means two different things, and the difference is the
           * point of the two-step form. On Account it is a local move. On
           * Business it is the submit that creates the dealership, so it
           * belongs to the form — and the form arrives with **F039**, which
           * replaces this button with its own `type="submit"`. Until then
           * there is nothing to submit, and a control that looks live and does
           * nothing is worse than one that says so.
           */}
          {local === 0 ? (
            <button
              type="button"
              className="btn btn-primary h-[42px] flex-1"
              onClick={() => setLocal(1)}
            >
              Continue
            </button>
          ) : (
            <button type="button" className="btn btn-primary h-[42px] flex-1" disabled>
              Continue
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
