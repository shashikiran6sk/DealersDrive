'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { revealContactAction } from '@/features/enquiry/actions';
import type { RevealContactResult } from '@/features/enquiry/shared';
import { useSavedCars } from '@/features/saved/saved-store';

/**
 * DESIGN-SPEC §3.4 — the CTA stack: a 44px `Enquire now`, then a 40px pair.
 *
 * `Enquire now` moves to the inline form rather than opening a modal
 * (ARCHITECTURE §14.2: modals lose leads), and focuses the first field so a
 * keyboard user lands where the mouse user is looking.
 */
export function VdpCtaStack({
  vehicleId,
  dealerBrandName,
  formId,
}: {
  vehicleId: string;
  dealerBrandName: string;
  formId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="primary"
        size="lg"
        onClick={() => {
          const form = document.getElementById(formId);
          form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          form?.querySelector<HTMLInputElement>('input[name="name"]')?.focus({
            preventScroll: true,
          });
        }}
      >
        Enquire now
      </Button>

      <div className="flex gap-2">
        <RevealContactButton vehicleId={vehicleId} dealerBrandName={dealerBrandName} />
        <SaveButton vehicleId={vehicleId} />
      </div>
    </div>
  );
}

/**
 * API-SPEC A7. The number is never in the page source — it arrives only after
 * a deliberate click, through a Server Action, and the dealer sees the tap in
 * their inbox (Rule 7, ARCHITECTURE §14.1).
 */
export function RevealContactButton({
  vehicleId,
  dealerBrandName,
  className,
  label = 'Call dealer',
}: {
  vehicleId: string;
  dealerBrandName: string;
  className?: string;
  label?: string;
}) {
  const [result, setResult] = useState<RevealContactResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.status === 'revealed') {
    const { contact } = result;
    return (
      <div className={className ?? 'flex-1'}>
        <a
          href={contact.callHref}
          className="btn btn-secondary h-10 w-full tnum"
          aria-label={`Call ${dealerBrandName} on ${contact.phoneDisplay}`}
        >
          {contact.phoneDisplay}
        </a>
        <a
          href={contact.whatsappHref}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-ghost mt-[6px] w-full text-[12px]"
        >
          Message on WhatsApp →
        </a>
      </div>
    );
  }

  return (
    <div className={className ?? 'flex-1'}>
      <Button
        variant="secondary"
        size="md"
        block
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await revealContactAction(vehicleId));
          })
        }
      >
        {label}
      </Button>

      {result ? (
        <Banner tone={result.status === 'captcha' ? 'warn' : 'err'} className="mt-2">
          {result.message}
        </Banner>
      ) : null}
    </div>
  );
}

/** The 40px `♡ Save` half of the pair. Same store as the card's save button. */
function SaveButton({ vehicleId }: { vehicleId: string }) {
  const { isSaved, toggle, hydrated } = useSavedCars();
  const saved = isSaved(vehicleId);

  return (
    <Button
      variant="secondary"
      size="md"
      className="flex-1"
      aria-pressed={hydrated ? saved : undefined}
      onClick={() => toggle(vehicleId)}
    >
      {saved ? '♥ Saved' : '♡ Save'}
    </Button>
  );
}
