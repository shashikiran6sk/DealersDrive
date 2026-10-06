'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { submitAssistedDealerAction } from '@/features/sales/sales-actions';
import { SALES_TEXT } from '@/features/sales/sales.constants';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

export function SubmitAssistedDealer({
  dealerId,
  canSubmit,
  missing,
}: {
  dealerId: string;
  canSubmit: boolean;
  missing: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useNavigationSafeAction();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] ink-body">{SALES_TEXT.submitIntro}</p>
      {missing.length > 0 ? (
        <p className="text-[12px] text-(--color-warn)">{SALES_TEXT.missing(missing.join(', '))}</p>
      ) : null}
      {error ? <Banner tone="err">{error}</Banner> : null}
      {done ? <Banner tone="ok">{SALES_TEXT.submitted}</Banner> : null}
      <div>
        <Button
          size="md"
          loading={pending}
          disabled={!canSubmit || done}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await submitAssistedDealerAction(dealerId);
              if (!result.ok) {
                setError(result.message ?? null);
                return;
              }
              setDone(true);
              router.refresh();
            });
          }}
        >
          {SALES_TEXT.submit}
        </Button>
      </div>
    </div>
  );
}
