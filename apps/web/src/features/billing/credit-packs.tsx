'use client';

import type { CreditPacksResponse } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, Tag } from '@/components/ui/primitives';
import { buyCreditsAction, type BuyCreditsResult } from '@/features/billing/actions';
import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.16 — the pack grid.
 *
 * A client island only because buying has to report back in place; the packs
 * themselves are server-rendered (ARCHITECTURE §15.1: "the pack grid and
 * history render server-side; only the Checkout handshake is client").
 */
export function CreditPacks({ packs }: { packs: CreditPacksResponse }) {
  const [result, setResult] = useState<BuyCreditsResult | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function buy(packId: string) {
    setBuying(packId);
    startTransition(async () => {
      const outcome = await buyCreditsAction(packId);
      setResult(outcome);
      setBuying(null);
      // The balance card above and the ledger below both change.
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-[14px]">
      <h2 className="text-[21px]">Buy credits</h2>

      {result ? (
        <Banner tone={result.ok ? 'ok' : 'err'} title={result.ok ? 'Credits added' : undefined}>
          {result.message}
          {result.invoiceNumber ? (
            <>
              {' '}
              Invoice <span className="font-mono">{result.invoiceNumber}</span>.
            </>
          ) : null}
        </Banner>
      ) : null}

      <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {packs.data.map((pack) => (
          <div
            key={pack.id}
            className={cn('card gap-[6px] p-[14px]', pack.highlighted && 'border-(--color-accent)')}
          >
            {pack.badge ? (
              <Tag variant="accent" className="self-start text-[10px]">
                {pack.badge}
              </Tag>
            ) : null}

            <div className="font-heading text-[34px] font-bold leading-none tnum">
              {pack.credits}
            </div>
            <div className="text-[12px] ink-subtle">credits</div>
            <div className="text-[18px] font-semibold tnum">{pack.priceLabel}</div>
            <div className="text-[11px] ink-subtle tnum">{pack.perListingLabel}</div>

            <Button
              variant="primary"
              block
              className="mt-auto"
              loading={pending && buying === pack.id}
              disabled={pending}
              onClick={() => buy(pack.id)}
            >
              Buy
            </Button>
          </div>
        ))}
      </div>

      <p className="text-[11px] ink-subtle">{packs.taxNote}</p>
    </section>
  );
}
