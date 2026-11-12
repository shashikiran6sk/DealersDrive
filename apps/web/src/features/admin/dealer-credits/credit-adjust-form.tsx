'use client';

import { useId, useState } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { adjustDealerCreditsAction } from '@/features/admin/credit-actions';

import { DEALER_CREDITS_TEXT } from './dealer-credits.constants';

export function CreditAdjustForm({ dealerId }: { dealerId: string }) {
  const id = useId();
  const [credits, setCredits] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    const outcome = await adjustDealerCreditsAction(dealerId, Number(credits), note);
    setResult(outcome);
    setBusy(false);
    if (outcome.ok) {
      setCredits('');
      setNote('');
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h3 className="text-[14px] font-semibold">{DEALER_CREDITS_TEXT.adjustTitle}</h3>
      {result?.message ? <Banner tone={result.ok ? 'ok' : 'err'}>{result.message}</Banner> : null}
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field
          id={`${id}-credits`}
          label={DEALER_CREDITS_TEXT.creditsLabel}
          hint={DEALER_CREDITS_TEXT.creditsHint}
        >
          <Input
            id={`${id}-credits`}
            inputMode="numeric"
            value={credits}
            onChange={(event) => setCredits(event.target.value.replace(/[^\d-]/g, ''))}
          />
        </Field>
        <Field id={`${id}-note`} label={DEALER_CREDITS_TEXT.noteLabel}>
          <Input
            id={`${id}-note`}
            value={note}
            maxLength={300}
            placeholder={DEALER_CREDITS_TEXT.notePlaceholder}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" variant="primary" className="self-start" loading={busy} disabled={busy}>
        {DEALER_CREDITS_TEXT.submit}
      </Button>
    </form>
  );
}
